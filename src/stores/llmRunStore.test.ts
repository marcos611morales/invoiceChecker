import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildCategorizeRun,
  buildGroupRun,
  type CategorizeTarget,
  type LlmItem,
} from "@/domain/llm/candidates";
import type { GroupResponse } from "@/domain/llm/contract";
import { LLM_LIMITS } from "@/domain/llm/contract";
import { postCategorize, postGroup, type LlmFailure } from "@/lib/client/llmClient";
import { resetSuggestionsStore } from "../../tests/support/suggestionsStorage";
import { categorizeBatches, groupBatches, useLlmRunStore, type RunBatch } from "./llmRunStore";
import { useSessionStore } from "./sessionStore";
import { useSettingsStore } from "./settingsStore";
import { useSuggestionsStore } from "./suggestionsStore";

vi.mock("@/lib/client/llmClient", () => ({ postGroup: vi.fn(), postCategorize: vi.fn() }));

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

describe("the result of an ended run", () => {
  it("is dismissed when the invoices are cleared, so an old Alert never outlives them", async () => {
    const batch = controlled();
    const done = useLlmRunStore.getState().startRun("group", [batch.batch]);
    await started(batch);
    batch.fail("upstream_timeout");
    await done;
    expect(useLlmRunStore.getState().status.phase).toBe("partial");
    useSessionStore.getState().clearAll();
    expect(useLlmRunStore.getState().status).toEqual({ phase: "idle" });
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

describe("an apply that throws (WR-02)", () => {
  it("counts the batch as failed, goes on with the next one and never rejects", async () => {
    const throwing: RunBatch = {
      send: () =>
        Promise.resolve({
          ok: true,
          apply: () => {
            throw new Error("randomUUID is not available");
          },
        }),
    };
    const two = controlled();
    const done = useLlmRunStore.getState().startRun("group", [throwing, two.batch]);
    await started(two);
    two.ok(3);
    await expect(done).resolves.toBeUndefined();
    expect(useLlmRunStore.getState().status).toMatchObject({
      phase: "partial",
      failed: 1,
      received: 3,
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

// ---------------------------------------------------------------------------------------
// Names of the earlier batches of one run (D-28, D-33)

type GroupAnswer = Extract<Awaited<ReturnType<typeof postGroup>>, { ok: true }>["data"]["groups"];

function answer(groups: GroupAnswer): Awaited<ReturnType<typeof postGroup>> {
  return { ok: true, data: { groups, meta: metaOf() } };
}

function bodies(): { existing: { id: string; name: string }[]; itemIds: string[] }[] {
  return vi.mocked(postGroup).mock.calls.map(([body]) => ({
    existing: body.existing,
    itemIds: body.items.map((item) => item.id),
  }));
}

/** Items "Descripción 1".."n"; with max 2 and three items, batch 1 holds 1 and 3, batch 2 holds 2. */
function twoBatchRun(accepted: { productId: string; name: string }[] = []) {
  return buildGroupRun([sampleItem(1), sampleItem(2), sampleItem(3)], accepted, 2);
}

describe("groupBatches: earlier-batch names on later batches (D-28, D-33)", () => {
  beforeEach(() => {
    useSettingsStore.setState({ products: [] });
  });
  afterEach(() => {
    useSettingsStore.setState({ products: [] });
  });

  it("sends only the accepted names in a run of one batch", async () => {
    const run = buildGroupRun([sampleItem(1)], [{ productId: "prod_a", name: "Leche" }]);
    vi.mocked(postGroup).mockResolvedValue(
      answer([{ name: "Uno", ids: ["i1"], existing: null }]),
    );
    await useLlmRunStore.getState().startGroupRun(run);
    expect(bodies()).toEqual([
      { existing: [{ id: "p1", name: "Leche" }], itemIds: ["i1"] },
    ]);
  });

  it("adds to batch 2 the names of the cards batch 1 enqueued, after the accepted ones", async () => {
    const run = twoBatchRun([{ productId: "prod_a", name: "Leche" }]);
    vi.mocked(postGroup)
      .mockResolvedValueOnce(
        answer([
          { name: "Uno", ids: ["i1"], existing: null },
          { name: "Tres", ids: ["i2"], existing: null },
        ]),
      )
      .mockResolvedValueOnce(answer([{ name: "Dos", ids: ["i1"], existing: null }]));
    await useLlmRunStore.getState().startGroupRun(run);
    const sent = bodies();
    expect(sent[0]?.existing).toEqual([{ id: "p1", name: "Leche" }]);
    expect(sent[1]?.existing).toEqual([
      { id: "p1", name: "Leche" },
      { id: "p2", name: "Uno" },
      { id: "p3", name: "Tres" },
    ]);
    // The bodies the dialog lists are untouched: they keep only the accepted names.
    expect(run.batches[1]?.body.existing).toEqual([{ id: "p1", name: "Leche" }]);
  });

  it("caps the context at 400 names in all, accepted first", async () => {
    const accepted = Array.from({ length: LLM_LIMITS.contextNames - 1 }, (_, index) => ({
      productId: `prod_${String(index)}`,
      name: `Producto ${String(index).padStart(3, "0")}`,
    }));
    const run = twoBatchRun(accepted);
    vi.mocked(postGroup)
      .mockResolvedValueOnce(
        answer([
          { name: "Uno", ids: ["i1"], existing: null },
          { name: "Tres", ids: ["i2"], existing: null },
        ]),
      )
      .mockResolvedValueOnce(answer([{ name: "Dos", ids: ["i1"], existing: null }]));
    await useLlmRunStore.getState().startGroupRun(run);
    const second = bodies()[1]?.existing ?? [];
    expect(second).toHaveLength(LLM_LIMITS.contextNames);
    expect(second[LLM_LIMITS.contextNames - 1]).toEqual({
      id: `p${String(LLM_LIMITS.contextNames)}`,
      name: "Uno",
    });
  });

  it("puts a description of batch 2 into the card of batch 1 while that card is pending", async () => {
    const run = twoBatchRun();
    vi.mocked(postGroup)
      .mockResolvedValueOnce(answer([{ name: "Leche", ids: ["i1", "i2"], existing: null }]))
      .mockResolvedValueOnce(answer([{ name: "Leche entera", ids: ["i1"], existing: "p1" }]));
    await useLlmRunStore.getState().startGroupRun(run);
    const queue = useSuggestionsStore.getState().products;
    expect(queue).toHaveLength(1);
    expect(queue[0]?.name).toBe("Leche");
    expect(queue[0]?.members.map((m) => m.description)).toEqual([
      "Descripción 1",
      "Descripción 3",
      "Descripción 2",
    ]);
    expect(useLlmRunStore.getState().status).toMatchObject({ phase: "finished", received: 1 });
  });

  it("makes an «Agregar a» card for the product the user accepted from the batch-1 card in the meantime", async () => {
    const run = twoBatchRun();
    vi.mocked(postGroup)
      .mockResolvedValueOnce(answer([{ name: "Leche", ids: ["i1", "i2"], existing: null }]))
      .mockImplementationOnce(() => {
        // While batch 2 is in flight the user accepts the card of batch 1.
        const first = useSuggestionsStore.getState().products[0];
        if (first === undefined) throw new Error("expected the batch-1 card");
        useSuggestionsStore.getState().removeProduct(first.id);
        useSettingsStore.setState({
          products: [
            {
              id: "prod_leche",
              name: "Leche",
              categoryId: null,
              members: first.members.map((m) => ({ ...m })),
            },
          ],
        });
        return Promise.resolve(answer([{ name: "Leche entera", ids: ["i1"], existing: "p1" }]));
      });
    await useLlmRunStore.getState().startGroupRun(run);
    const queue = useSuggestionsStore.getState().products;
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({ name: "Leche entera", target: "prod_leche" });
    expect(queue[0]?.members.map((m) => m.description)).toEqual(["Descripción 2"]);
  });

  it("keeps its own card with the group's name when the user rejected the batch-1 card", async () => {
    const run = twoBatchRun();
    vi.mocked(postGroup)
      .mockResolvedValueOnce(answer([{ name: "Leche", ids: ["i1", "i2"], existing: null }]))
      .mockImplementationOnce(() => {
        const first = useSuggestionsStore.getState().products[0];
        if (first === undefined) throw new Error("expected the batch-1 card");
        useSuggestionsStore.getState().rejectSuggestion(first.id);
        return Promise.resolve(answer([{ name: "Leche entera", ids: ["i1"], existing: "p1" }]));
      });
    await useLlmRunStore.getState().startGroupRun(run);
    const queue = useSuggestionsStore.getState().products;
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({ name: "Leche entera", target: null });
  });

  it("never sends, nor changes, a card that was pending from an earlier run", async () => {
    const old = {
      id: "sug_vieja",
      name: "Tarjeta de otra corrida",
      target: null,
      members: [
        {
          rfc: "ZZZ990909ZZZ",
          key: "otra cosa",
          description: "Otra cosa",
          supplierName: "Otra tienda",
        },
      ],
    };
    useSuggestionsStore.getState().enqueueProducts([old]);
    const run = twoBatchRun();
    vi.mocked(postGroup)
      .mockResolvedValueOnce(answer([{ name: "Uno", ids: ["i1", "i2"], existing: null }]))
      .mockResolvedValueOnce(answer([{ name: "Dos", ids: ["i1"], existing: null }]));
    await useLlmRunStore.getState().startGroupRun(run);
    for (const sent of bodies()) {
      expect(sent.existing.map((entry) => entry.name)).not.toContain("Tarjeta de otra corrida");
    }
    expect(useSuggestionsStore.getState().products.find((c) => c.id === "sug_vieja")).toEqual(old);
  });

  it("does not offer a batch-1 «Agregar a» card as context, since its product is already in the context", async () => {
    const run = twoBatchRun([{ productId: "prod_a", name: "Leche" }]);
    vi.mocked(postGroup)
      .mockResolvedValueOnce(
        answer([
          { name: "Leche entera", ids: ["i1"], existing: "p1" },
          { name: "Tres", ids: ["i2"], existing: null },
        ]),
      )
      .mockResolvedValueOnce(answer([{ name: "Dos", ids: ["i1"], existing: null }]));
    await useLlmRunStore.getState().startGroupRun(run);
    expect(bodies()[1]?.existing.map((entry) => entry.name)).toEqual(["Leche", "Tres"]);
  });
});

// ---------------------------------------------------------------------------------------
// «Sugerir categorías» batches (Plan 04-18)

const CATEGORY_TARGETS: CategorizeTarget[] = [
  { kind: "supplier", rfc: "AAA010101AAA", name: "Tienda Uno" },
  { kind: "product", productId: "prod_a", name: "Leche entera", members: ["MM LECHE ENT"] },
];
const USER_CATEGORIES = [
  { id: "cat_abarrotes", name: "Abarrotes" },
  { id: "cat_servicios", name: "Servicios" },
];

type CategorizeAnswers = Extract<
  Awaited<ReturnType<typeof postCategorize>>,
  { ok: true }
>["data"]["answers"];

function categorizeAnswer(answers: CategorizeAnswers): Awaited<ReturnType<typeof postCategorize>> {
  return { ok: true, data: { answers, meta: metaOf() } };
}

describe("categorizeBatches (LLM-02, D-23, D-27)", () => {
  function firstBatch(): { batch: RunBatch; run: ReturnType<typeof buildCategorizeRun> } {
    const run = buildCategorizeRun(CATEGORY_TARGETS, USER_CATEGORIES);
    const batch = categorizeBatches(run)[0];
    if (batch === undefined) throw new Error("expected a batch");
    return { batch, run };
  }

  it("maps a code to the existing category and a new name to a new choice; nothing is enqueued before apply", async () => {
    const { batch, run } = firstBatch();
    vi.mocked(postCategorize).mockResolvedValue(
      categorizeAnswer([
        { id: "s1", choice: { kind: "code", code: "c2" } },
        { id: "q1", choice: { kind: "new", name: "Bebidas" } },
      ]),
    );
    const result = await batch.send(new AbortController().signal);
    expect(vi.mocked(postCategorize)).toHaveBeenCalledWith(run.batches[0]?.body, expect.any(AbortSignal));
    expect(useSuggestionsStore.getState().categories).toEqual([]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.apply()).toBe(2);
    const rows = useSuggestionsStore.getState().categories;
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      kind: "supplier",
      rfc: "AAA010101AAA",
      name: "Tienda Uno",
      choice: { kind: "existing", categoryId: "cat_servicios" },
    });
    expect(rows[1]).toMatchObject({
      kind: "product",
      productId: "prod_a",
      name: "Leche entera",
      choice: { kind: "new", name: "Bebidas" },
    });
    expect(rows.every((row) => row.id.startsWith("cat_"))).toBe(true);
    // Idempotent per target: applying the same answer again adds nothing.
    expect(result.apply()).toBe(0);
    expect(useSuggestionsStore.getState().categories).toHaveLength(2);
  });

  it("skips a target that already has a row from another run", async () => {
    useSuggestionsStore.getState().enqueueCategories([
      { id: "cat_old", kind: "supplier", rfc: "AAA010101AAA", name: "Tienda Uno", choice: null },
    ]);
    const { batch } = firstBatch();
    vi.mocked(postCategorize).mockResolvedValue(
      categorizeAnswer([
        { id: "s1", choice: { kind: "code", code: "c1" } },
        { id: "q1", choice: { kind: "code", code: "c1" } },
      ]),
    );
    const result = await batch.send(new AbortController().signal);
    if (!result.ok) throw new Error("expected ok");
    expect(result.apply()).toBe(1);
    expect(useSuggestionsStore.getState().categories.map((row) => row.id)[0]).toBe("cat_old");
  });

  it("checks the coverage again: an answer that omits an id is an incomplete_response and adds nothing", async () => {
    const { batch } = firstBatch();
    vi.mocked(postCategorize).mockResolvedValue(
      categorizeAnswer([{ id: "s1", choice: { kind: "code", code: "c1" } }]),
    );
    expect(await batch.send(new AbortController().signal)).toEqual({
      ok: false,
      error: "incomplete_response",
    });
    expect(useSuggestionsStore.getState().categories).toEqual([]);
  });

  it("refuses an answer with an invented id or a code that was not sent", async () => {
    const { batch } = firstBatch();
    vi.mocked(postCategorize).mockResolvedValueOnce(
      categorizeAnswer([
        { id: "s1", choice: { kind: "code", code: "c1" } },
        { id: "q1", choice: { kind: "code", code: "c1" } },
        { id: "s9", choice: { kind: "code", code: "c1" } },
      ]),
    );
    expect(await batch.send(new AbortController().signal)).toEqual({
      ok: false,
      error: "incomplete_response",
    });
    vi.mocked(postCategorize).mockResolvedValueOnce(
      categorizeAnswer([
        { id: "s1", choice: { kind: "code", code: "c1" } },
        { id: "q1", choice: { kind: "code", code: "c9" } },
      ]),
    );
    expect(await batch.send(new AbortController().signal)).toEqual({
      ok: false,
      error: "invalid_response",
    });
    expect(useSuggestionsStore.getState().categories).toEqual([]);
  });

  it("passes a client failure through", async () => {
    const { batch } = firstBatch();
    vi.mocked(postCategorize).mockResolvedValue({ ok: false, error: "offline" });
    expect(await batch.send(new AbortController().signal)).toEqual({ ok: false, error: "offline" });
  });

  it("startCategorizeRun runs the batches as a «categorize» run and ends finished with the rows added", async () => {
    const run = buildCategorizeRun(CATEGORY_TARGETS, USER_CATEGORIES);
    vi.mocked(postCategorize).mockResolvedValue(
      categorizeAnswer([
        { id: "s1", choice: { kind: "code", code: "c1" } },
        { id: "q1", choice: { kind: "new", name: "Bebidas" } },
      ]),
    );
    await useLlmRunStore.getState().startCategorizeRun(run);
    expect(useLlmRunStore.getState().status).toEqual({
      phase: "finished",
      kind: "categorize",
      total: 1,
      received: 2,
    });
    expect(useSuggestionsStore.getState().categories).toHaveLength(2);
  });
});
