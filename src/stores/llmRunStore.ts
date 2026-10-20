import { create } from "zustand";
import type { GroupRun } from "@/domain/llm/candidates";
import { coverageOf, isComplete } from "@/domain/llm/reconcile";
import { toProductSuggestions } from "@/domain/llm/suggestions";
import { postGroup, type LlmFailure } from "@/lib/client/llmClient";
import { useSessionStore } from "./sessionStore";
import { useSuggestionsStore } from "./suggestionsStore";

export type RunStatus =
  | { phase: "idle" }
  | { phase: "running"; kind: "group"; batch: number; total: number }
  | {
      phase: "stopped";
      kind: "group";
      batch: number;
      total: number;
      error: LlmFailure;
    };

interface LlmRunState {
  status: RunStatus;
  /** Aborts the batch in flight; null when no run is active. */
  controller: AbortController | null;
  /** Runs the batches one after another; returns at once when a run is active (single slot). */
  startGroupRun: (run: GroupRun) => Promise<void>;
  dismissResult: () => void;
}

function newSuggestionId(): string {
  return `sug_${crypto.randomUUID()}`;
}

/**
 * The run lives here, outside any tab panel, so switching to another tab while a
 * batch is in flight does not lose it (RESEARCH Pattern 2). In memory only, like
 * the session store: nothing about an in-flight run survives a reload.
 */
export const useLlmRunStore = create<LlmRunState>()((set, get) => ({
  status: { phase: "idle" },
  controller: null,
  startGroupRun: async (run) => {
    if (get().status.phase === "running") return;
    const total = run.batches.length;
    if (total === 0) return;
    const generation = useSessionStore.getState().generation;
    const controller = new AbortController();
    set({ controller });
    try {
      for (let k = 1; k <= total; k += 1) {
        const batch = run.batches[k - 1];
        if (batch === undefined) continue;
        set({ status: { phase: "running", kind: "group", batch: k, total } });
        const result = await postGroup(batch.body, controller.signal);
        // A late answer never writes after a cancel or after the invoices were cleared (Pitfall 6).
        if (
          controller.signal.aborted ||
          useSessionStore.getState().generation !== generation
        ) {
          return;
        }
        if (!result.ok) {
          set({
            status: {
              phase: "stopped",
              kind: "group",
              batch: k,
              total,
              error: result.error,
            },
          });
          return;
        }
        // The server already refuses an incomplete answer; the browser checks again before it
        // enqueues anything (D-11, OQ3), so an answer that omits, repeats or invents an id
        // stops the run, adds no card and leaves its descriptions free.
        const coverage = coverageOf(
          batch.body.items.map((item) => item.id),
          result.data.groups.map((group) => ({ ids: group.ids })),
        );
        if (!isComplete(coverage)) {
          set({
            status: {
              phase: "stopped",
              kind: "group",
              batch: k,
              total,
              error: "incomplete_response",
            },
          });
          return;
        }
        // The cards of each batch enter the queue as soon as that batch lands (D-26).
        useSuggestionsStore
          .getState()
          .enqueueProducts(
            toProductSuggestions(
              result.data.groups,
              batch.idMap,
              batch.targets,
              newSuggestionId,
            ),
          );
      }
    } finally {
      // Whatever ended the run, the slot is freed and a stale "running" never stays behind.
      set((current) => ({
        controller: current.controller === controller ? null : current.controller,
        status: current.status.phase === "running" ? { phase: "idle" } : current.status,
      }));
    }
  },
  dismissResult: () => set({ status: { phase: "idle" } }),
}));
