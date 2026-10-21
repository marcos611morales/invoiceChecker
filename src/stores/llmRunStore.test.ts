import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildGroupRun, type LlmItem } from "@/domain/llm/candidates";
import type { GroupResponse } from "@/domain/llm/contract";
import { postGroup, type LlmFailure } from "@/lib/client/llmClient";
import { resetSuggestionsStore } from "../../tests/support/suggestionsStorage";
import { groupBatches, useLlmRunStore, type RunBatch } from "./llmRunStore";
import { useSessionStore } from "./sessionStore";
import { useSuggestionsStore } from "./suggestionsStore";

vi.mock("@/lib/client/llmClient", () => ({ postGroup: vi.fn() }));

type SendResult = Awaited<ReturnType<RunBatch["send"]>>;

interface Controlled {
  batch: RunBatch;
  state: { sends: number; signal: AbortSignal | null; applied: number };
  /** Resolves the pending send with an answer whose apply adds `added` suggestions. */
  ok: (added: number) => void;
  fail: (error: LlmFailure) => void;
  reject: (reason: Error) => void;
}

/** A batch whose answer the test releases by hand. */
function controlled(): Controlled {
  const state: Controlled["state"] = { sends: 0, signal: null, applied: 0 };
  let release: (result: SendResult) => void = () => undefined;
  let fail: (reason: Error) => void = () => undefined;
  return {
    state,
    batch: {
      send: (signal) => {
        state.sends += 1;
        state.signal = signal;
        return new Promise<SendResult>((resolve, reject) => {
          release = resolve;
          fail = reject;
        });
      },
    },
    ok: (added) => {
      release({
        ok: true,
        apply: () => {
          state.applied += 1;
          return added;
        },
      });
    },
    fail: (error) => {
      release({ ok: false, error });
    },
    reject: (reason) => {
      fail(reason);
    },
  };
}

async function started(batch: Controlled, sends = 1): Promise<void> {
  await vi.waitFor(() => {
    expect(batch.state.sends).toBe(sends);
  });
}

beforeEach(() => {
  resetSuggestionsStore();
  useLlmRunStore.setState({ status: { phase: "idle" }, controller: null });
});

afterEach(() => {
  useLlmRunStore.getState().cancel();
  useLlmRunStore.setState({ status: { phase: "idle" }, controller: null });
  useSessionStore.getState().clearAll();
  resetSuggestionsStore();
  vi.clearAllMocks();
});

describe("startRun order and success (D-26)", () => {
  it("sends the batches one after another and ends finished with what each apply returned", async () => {
    const [one, two] = [controlled(), controlled()];
    const done = useLlmRunStore.getState().startRun("group", [one.batch, two.batch]);
    await started(one);
    expect(useLlmRunStore.getState().status).toEqual({
      phase: "running",
      kind: "group",
      batch: 1,
      total: 2,
      received: 0,
      failed: 0,
      lastError: null,
    });
    // Batch 2 does not start before batch 1 resolves.
    expect(two.state.sends).toBe(0);
    one.ok(3);
    await started(two);
    expect(one.state.applied).toBe(1);
    expect(useLlmRunStore.getState().status).toMatchObject({ phase: "running", batch: 2, received: 3 });
    two.ok(4);
    await done;
    expect(useLlmRunStore.getState().status).toEqual({
      phase: "finished",
      kind: "group",
      total: 2,
      received: 7,
    });
    expect(useLlmRunStore.getState().controller).toBeNull();
  });

  it("does nothing for an empty list", async () => {
    await useLlmRunStore.getState().startRun("group", []);
    expect(useLlmRunStore.getState().status).toEqual({ phase: "idle" });
  });

  it("ignores startRun while a run is active and sends nothing of the second list", async () => {
    const first = controlled();
    const second = controlled();
    const done = useLlmRunStore.getState().startRun("group", [first.batch]);
    await started(first);
    await useLlmRunStore.getState().startRun("categorize", [second.batch]);
    expect(second.state.sends).toBe(0);
    expect(useLlmRunStore.getState().status).toMatchObject({ phase: "running", kind: "group" });
    first.ok(1);
    await done;
  });

  it("lets a new run start after a result (finished, canceled, partial or stopped) is left on screen", async () => {
    const first = controlled();
    const firstDone = useLlmRunStore.getState().startRun("group", [first.batch]);
    await started(first);
    first.fail("upstream_auth");
    await firstDone;
    expect(useLlmRunStore.getState().status.phase).toBe("stopped");
    const second = controlled();
    const secondDone = useLlmRunStore.getState().startRun("group", [second.batch]);
    await started(second);
    expect(useLlmRunStore.getState().status.phase).toBe("running");
    second.ok(0);
    await secondDone;
  });

  it("dismissResult goes back to idle", async () => {
    const batch = controlled();
    const done = useLlmRunStore.getState().startRun("group", [batch.batch]);
    await started(batch);
    batch.fail("upstream_auth");
    await done;
    useLlmRunStore.getState().dismissResult();
    expect(useLlmRunStore.getState().status).toEqual({ phase: "idle" });
  });
});

describe("cancel (LLM-05, D-26, Pitfall 6)", () => {
  it("aborts the batch in flight, applies nothing of it, never sends the next one and ends canceled with what had arrived", async () => {
    const [one, two, three] = [controlled(), controlled(), controlled()];
    const done = useLlmRunStore.getState().startRun("group", [one.batch, two.batch, three.batch]);
    await started(one);
    one.ok(3);
    await started(two);
    useLlmRunStore.getState().cancel();
    expect(useLlmRunStore.getState().status).toEqual({
      phase: "cancelling",
      kind: "group",
      batch: 2,
      total: 3,
      received: 3,
    });
    expect(two.state.signal?.aborted).toBe(true);
    // The answer lands after the cancel: it must not be applied.
    two.ok(5);
    await done;
    expect(two.state.applied).toBe(0);
    expect(three.state.sends).toBe(0);
    expect(useLlmRunStore.getState().status).toEqual({
      phase: "canceled",
      kind: "group",
      received: 3,
    });
    expect(useLlmRunStore.getState().controller).toBeNull();
  });

  it("ignores a second cancel and a cancel with no run", async () => {
    useLlmRunStore.getState().cancel();
    expect(useLlmRunStore.getState().status).toEqual({ phase: "idle" });
    const batch = controlled();
    const done = useLlmRunStore.getState().startRun("group", [batch.batch]);
    await started(batch);
    useLlmRunStore.getState().cancel();
    useLlmRunStore.getState().cancel();
    expect(useLlmRunStore.getState().status.phase).toBe("cancelling");
    batch.ok(1);
    await done;
    expect(useLlmRunStore.getState().status).toMatchObject({ phase: "canceled", received: 0 });
  });
});

describe("session generation (Pitfall 6, T-04-28)", () => {
  it("aborts the batch in flight when the invoices are cleared, applies nothing and returns to idle", async () => {
    const [one, two] = [controlled(), controlled()];
    const done = useLlmRunStore.getState().startRun("group", [one.batch, two.batch]);
    await started(one);
    useSessionStore.getState().clearAll();
    expect(one.state.signal?.aborted).toBe(true);
    one.ok(4);
    await done;
    expect(one.state.applied).toBe(0);
    expect(two.state.sends).toBe(0);
    expect(useLlmRunStore.getState().status).toEqual({ phase: "idle" });
    expect(useLlmRunStore.getState().controller).toBeNull();
  });

  it("keeps the batches already applied when the invoices are cleared later", async () => {
    const [one, two] = [controlled(), controlled()];
    const done = useLlmRunStore.getState().startRun("group", [one.batch, two.batch]);
    await started(one);
    one.ok(2);
    await started(two);
    useSessionStore.getState().clearAll();
    two.ok(9);
    await done;
    expect(one.state.applied).toBe(1);
    expect(two.state.applied).toBe(0);
    expect(useLlmRunStore.getState().status).toEqual({ phase: "idle" });
  });

  it("stops listening to the session when the run ends", async () => {
    const batch = controlled();
    const done = useLlmRunStore.getState().startRun("group", [batch.batch]);
    await started(batch);
    batch.ok(1);
    await done;
    const after = controlled();
    const next = useLlmRunStore.getState().startRun("group", [after.batch]);
    await started(after);
    // A clear now belongs to the second run only: the first one's listener is gone.
    useSessionStore.getState().clearAll();
    expect(after.state.signal?.aborted).toBe(true);
    after.ok(1);
    await next;
  });
});

describe("failure policy (D-27, T-04-29)", () => {
  it("lets the run go on after a retryable failure and ends partial with the count and the last reason", async () => {
    const [one, two, three] = [controlled(), controlled(), controlled()];
    const done = useLlmRunStore.getState().startRun("group", [one.batch, two.batch, three.batch]);
    await started(one);
    one.fail("upstream_timeout");
    await started(two);
    expect(useLlmRunStore.getState().status).toMatchObject({
      phase: "running",
      batch: 2,
      failed: 1,
      lastError: "upstream_timeout",
    });
    two.ok(2);
    await started(three);
    three.ok(3);
    await done;
    expect(useLlmRunStore.getState().status).toEqual({
      phase: "partial",
      kind: "group",
      total: 3,
      received: 5,
      failed: 1,
      lastError: "upstream_timeout",
    });
    // The browser never retries on its own: every batch was sent exactly once.
    expect([one, two, three].map((batch) => batch.state.sends)).toEqual([1, 1, 1]);
  });

  it.each<LlmFailure>([
    "upstream_rate_limited",
    "upstream_unavailable",
    "upstream_timeout",
    "invalid_response",
    "incomplete_response",
    "offline",
  ])("counts %s as a failed batch and keeps going", async (error) => {
    const [one, two] = [controlled(), controlled()];
    const done = useLlmRunStore.getState().startRun("group", [one.batch, two.batch]);
    await started(one);
    one.fail(error);
    await started(two);
    two.fail(error);
    await done;
    expect(useLlmRunStore.getState().status).toEqual({
      phase: "partial",
      kind: "group",
      total: 2,
      received: 0,
      failed: 2,
      lastError: error,
    });
  });

  it.each<LlmFailure>([
    "unauthorized",
    "server_not_configured",
    "upstream_auth",
    "upstream_balance",
    "upstream_rejected",
    "bad_request",
    "payload_too_large",
  ])("stops the run after the batch that fails with %s and sends no further batch", async (error) => {
    const [one, two, three] = [controlled(), controlled(), controlled()];
    const done = useLlmRunStore.getState().startRun("group", [one.batch, two.batch, three.batch]);
    await started(one);
    one.fail(error);
    await done;
    expect(two.state.sends).toBe(0);
    expect(three.state.sends).toBe(0);
    expect(useLlmRunStore.getState().status).toEqual({
      phase: "stopped",
      kind: "group",
      batch: 1,
      total: 3,
      received: 0,
      error,
    });
  });

  it("keeps what arrived before a refusal that stops the run", async () => {
    const [one, two, three] = [controlled(), controlled(), controlled()];
    const done = useLlmRunStore.getState().startRun("group", [one.batch, two.batch, three.batch]);
    await started(one);
    one.ok(6);
    await started(two);
    two.fail("upstream_balance");
    await done;
    expect(one.state.applied).toBe(1);
    expect(three.state.sends).toBe(0);
    expect(useLlmRunStore.getState().status).toMatchObject({
      phase: "stopped",
      batch: 2,
      total: 3,
      received: 6,
      error: "upstream_balance",
    });
  });

  it("treats a send that throws as a failed batch and frees the slot", async () => {
    const [one, two] = [controlled(), controlled()];
    const done = useLlmRunStore.getState().startRun("group", [one.batch, two.batch]);
    await started(one);
    one.reject(new Error("boom"));
    await started(two);
    two.ok(2);
    await done;
    expect(useLlmRunStore.getState().status).toMatchObject({
      phase: "partial",
      failed: 1,
      received: 2,
      lastError: "invalid_response",
    });
    expect(useLlmRunStore.getState().controller).toBeNull();
  });
});

describe("startGroupRun stays a thin wrapper", () => {
  it("runs the group batches of a GroupRun through startRun", async () => {
    vi.mocked(postGroup).mockResolvedValue({ ok: false, error: "upstream_auth" });
    const run = buildGroupRun([sampleItem(1)], []);
    await useLlmRunStore.getState().startGroupRun(run);
    expect(useLlmRunStore.getState().status).toMatchObject({
      phase: "stopped",
      kind: "group",
      batch: 1,
      total: 1,
      error: "upstream_auth",
    });
  });
});

function sampleItem(index: number): LlmItem {
  return {
    rfc: "AAA010101AAA",
    key: `descripcion ${String(index)}`,
    description: `Descripción ${String(index)}`,
    supplierName: "Tienda Uno",
    lines: 1,
  };
}

function metaOf(): GroupResponse["meta"] {
  return {
    attempts: 1,
    durationMs: 1,
    finishReason: "stop",
    promptTokens: null,
    completionTokens: null,
    reasoningTokens: null,
  };
}

describe("groupBatches", () => {
  it("builds one RunBatch per GroupBatch whose apply enqueues the cards and returns how many it added", async () => {
    const run = buildGroupRun([sampleItem(1), sampleItem(2), sampleItem(3)], []);
    const batches = groupBatches(run);
    expect(batches).toHaveLength(1);
    const first = batches[0];
    if (first === undefined) throw new Error("expected a batch");
    vi.mocked(postGroup).mockResolvedValue({
      ok: true,
      data: {
        groups: [
          { name: "Uno y dos", ids: ["i1", "i2"], existing: null },
          { name: "Tres", ids: ["i3"], existing: null },
        ],
        meta: metaOf(),
      },
    });
    const result = await first.send(new AbortController().signal);
    // Nothing is enqueued before apply.
    expect(useSuggestionsStore.getState().products).toEqual([]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.apply()).toBe(2);
    expect(useSuggestionsStore.getState().products.map((card) => card.name)).toEqual([
      "Uno y dos",
      "Tres",
    ]);
    expect(useSuggestionsStore.getState().products.every((card) => card.id.startsWith("sug_"))).toBe(true);
    // Idempotent per member: applying the same answer again adds nothing.
    expect(result.apply()).toBe(0);
    expect(useSuggestionsStore.getState().products).toHaveLength(2);
  });

  it("checks the coverage again: an answer that omits an id is an incomplete_response and adds nothing", async () => {
    const run = buildGroupRun([sampleItem(1), sampleItem(2)], []);
    const first = groupBatches(run)[0];
    if (first === undefined) throw new Error("expected a batch");
    vi.mocked(postGroup).mockResolvedValue({
      ok: true,
      data: { groups: [{ name: "Solo uno", ids: ["i1"], existing: null }], meta: metaOf() },
    });
    expect(await first.send(new AbortController().signal)).toEqual({
      ok: false,
      error: "incomplete_response",
    });
    expect(useSuggestionsStore.getState().products).toEqual([]);
  });

  it("passes a client failure through and hands the signal to the request", async () => {
    const run = buildGroupRun([sampleItem(1)], []);
    const first = groupBatches(run)[0];
    if (first === undefined) throw new Error("expected a batch");
    vi.mocked(postGroup).mockResolvedValue({ ok: false, error: "offline" });
    const controller = new AbortController();
    expect(await first.send(controller.signal)).toEqual({ ok: false, error: "offline" });
    expect(vi.mocked(postGroup)).toHaveBeenCalledWith(run.batches[0]?.body, controller.signal);
  });
});
