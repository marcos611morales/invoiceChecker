import { create } from "zustand";
import type { GroupRun } from "@/domain/llm/candidates";
import { isRetryable } from "@/domain/llm/contract";
import { coverageOf, isComplete } from "@/domain/llm/reconcile";
import { toProductSuggestions } from "@/domain/llm/suggestions";
import { postGroup, type LlmFailure } from "@/lib/client/llmClient";
import { useSessionStore } from "./sessionStore";
import { useSuggestionsStore } from "./suggestionsStore";

/** What a run asks DeepSeek for; Plan 04-18 adds the «categorize» batches. */
export type RunKind = "group" | "categorize";

export type RunStatus =
  | { phase: "idle" }
  | {
      phase: "running";
      kind: RunKind;
      /** The batch in flight, 1-based. */
      batch: number;
      total: number;
      /** Suggestions that entered the queue so far in this run. */
      received: number;
      failed: number;
      lastError: LlmFailure | null;
    }
  | { phase: "cancelling"; kind: RunKind; batch: number; total: number; received: number }
  | { phase: "finished"; kind: RunKind; total: number; received: number }
  | {
      phase: "partial";
      kind: RunKind;
      total: number;
      received: number;
      failed: number;
      lastError: LlmFailure;
    }
  | {
      phase: "stopped";
      kind: RunKind;
      batch: number;
      total: number;
      received: number;
      error: LlmFailure;
    }
  | { phase: "canceled"; kind: RunKind; received: number };

/**
 * One request of a run. `send` does the request, the coverage re-check and the mapping, and
 * enqueues nothing; `apply` enqueues what `send` produced and returns how many suggestions it
 * added. The runner calls `apply` only when the run was not canceled and the session did not
 * change while the request was in flight (Pitfall 6).
 */
export interface RunBatch {
  send: (
    signal: AbortSignal,
  ) => Promise<{ ok: true; apply: () => number } | { ok: false; error: LlmFailure }>;
}

interface LlmRunState {
  status: RunStatus;
  /** Aborts the batch in flight; null when no run is active. */
  controller: AbortController | null;
  /**
   * Runs the batches one after another; returns at once when a run is active (single slot).
   * It never throws and resolves when the run has ended.
   */
  startRun: (kind: RunKind, batches: readonly RunBatch[]) => Promise<void>;
  /** The tracer entry point: a thin wrapper of `startRun("group", groupBatches(run))`. */
  startGroupRun: (run: GroupRun) => Promise<void>;
  /** Stops the batch in flight and every later one; keeps what already arrived. */
  cancel: () => void;
  dismissResult: () => void;
}

function newSuggestionId(): string {
  return `sug_${crypto.randomUUID()}`;
}

/**
 * True for a failure a retry cannot fix: it stops the whole run after that batch (T-04-29).
 * «offline» and «aborted» are not DeepSeek codes; a lost connection can come back.
 */
function stopsRun(error: LlmFailure): boolean {
  if (error === "offline" || error === "aborted") return false;
  return !isRetryable(error);
}

/**
 * The batches of a grouping run. Each one posts its body, re-checks the coverage of the answer
 * (an answer that omits, repeats or invents an id becomes an incomplete_response and adds
 * nothing, D-11, OQ3) and maps it to cards; `apply` enqueues them as soon as the runner
 * decides the batch counts (D-26).
 */
export function groupBatches(run: GroupRun): RunBatch[] {
  return run.batches.map((batch) => ({
    send: async (signal) => {
      const result = await postGroup(batch.body, signal);
      if (!result.ok) return { ok: false, error: result.error };
      const coverage = coverageOf(
        batch.body.items.map((item) => item.id),
        result.data.groups.map((group) => ({ ids: group.ids })),
      );
      if (!isComplete(coverage)) return { ok: false, error: "incomplete_response" };
      const cards = toProductSuggestions(
        result.data.groups,
        batch.idMap,
        batch.targets,
        newSuggestionId,
      );
      return {
        ok: true,
        apply: () => {
          const store = useSuggestionsStore.getState();
          const before = store.products.length;
          store.enqueueProducts(cards);
          return useSuggestionsStore.getState().products.length - before;
        },
      };
    },
  }));
}

/**
 * The run lives here, outside any tab panel, so switching to another tab while a
 * batch is in flight does not lose it (RESEARCH Pattern 2). In memory only, like the
 * session store: nothing about an in-flight run survives a reload.
 */
export const useLlmRunStore = create<LlmRunState>()((set, get) => ({
  status: { phase: "idle" },
  controller: null,
  startRun: async (kind, batches) => {
    const current = get().status.phase;
    if (current === "running" || current === "cancelling") return;
    const total = batches.length;
    if (total === 0) return;
    const generation = useSessionStore.getState().generation;
    const controller = new AbortController();
    set({
      controller,
      status: {
        phase: "running",
        kind,
        batch: 1,
        total,
        received: 0,
        failed: 0,
        lastError: null,
      },
    });
    // Clearing the invoices aborts the batch in flight; the loop below then writes nothing.
    const unsubscribe = useSessionStore.subscribe((session) => {
      if (session.generation !== generation) controller.abort();
    });
    const cleared = () => useSessionStore.getState().generation !== generation;
    let received = 0;
    let failed = 0;
    let lastError: LlmFailure | null = null;
    try {
      for (let k = 1; k <= total; k += 1) {
        const batch = batches[k - 1];
        if (batch === undefined) continue;
        if (controller.signal.aborted) break;
        // Batch 1 is announced by the initial status above.
        if (k > 1) {
          set({
            status: { phase: "running", kind, batch: k, total, received, failed, lastError },
          });
        }
        let outcome: Awaited<ReturnType<RunBatch["send"]>>;
        try {
          outcome = await batch.send(controller.signal);
        } catch {
          // A send that throws is an unusable answer, not a crash: the batch fails and the run goes on.
          outcome = { ok: false, error: "invalid_response" };
        }
        // A late answer never writes after a cancel or after the invoices were cleared (Pitfall 6).
        if (controller.signal.aborted || cleared()) break;
        if (!outcome.ok) {
          if (stopsRun(outcome.error)) {
            set({
              status: {
                phase: "stopped",
                kind,
                batch: k,
                total,
                received,
                error: outcome.error,
              },
            });
            return;
          }
          failed += 1;
          lastError = outcome.error;
          continue;
        }
        // The cards of each batch enter the queue as soon as that batch lands (D-26).
        received += outcome.apply();
      }
      if (cleared()) {
        set({ status: { phase: "idle" } });
      } else if (controller.signal.aborted) {
        set({ status: { phase: "canceled", kind, received } });
      } else if (lastError !== null) {
        set({ status: { phase: "partial", kind, total, received, failed, lastError } });
      } else {
        set({ status: { phase: "finished", kind, total, received } });
      }
    } finally {
      unsubscribe();
      // Whatever ended the run, the slot is freed and a stale «running» never stays behind.
      set((state) => ({
        controller: state.controller === controller ? null : state.controller,
        status:
          state.status.phase === "running" || state.status.phase === "cancelling"
            ? { phase: "idle" }
            : state.status,
      }));
    }
  },
  startGroupRun: (run) => get().startRun("group", groupBatches(run)),
  cancel: () => {
    const { status, controller } = get();
    if (status.phase !== "running" || controller === null) return;
    set({
      status: {
        phase: "cancelling",
        kind: status.kind,
        batch: status.batch,
        total: status.total,
        received: status.received,
      },
    });
    controller.abort();
  },
  dismissResult: () => set({ status: { phase: "idle" } }),
}));
