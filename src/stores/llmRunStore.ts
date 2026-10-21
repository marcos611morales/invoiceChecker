import { create } from "zustand";
import { cutText, type ContextTarget, type GroupBatch, type GroupRun } from "@/domain/llm/candidates";
import { LLM_LIMITS, isRetryable, type GroupRequest } from "@/domain/llm/contract";
import { coverageOf, isComplete } from "@/domain/llm/reconcile";
import { memberKey, resolveProductAnswer } from "@/domain/llm/suggestions";
import { ruleMapKey } from "@/domain/settings/normalize";
import { postGroup, type LlmFailure } from "@/lib/client/llmClient";
import { useSessionStore } from "./sessionStore";
import { useSettingsStore } from "./settingsStore";
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
 * A card this run put in the queue: the name DeepSeek proposed for it and the member keys it had
 * when it entered. Memory only, in the closure of one run (D-33).
 */
interface RunCard {
  suggestionId: string;
  name: string;
  memberKeys: string[];
}

/** The id of the accepted product that holds a member, read from the settings as they are now. */
function acceptedProductOf(): (key: string) => string | null {
  const byKey = new Map<string, string>();
  for (const product of useSettingsStore.getState().products) {
    for (const member of product.members) byKey.set(ruleMapKey(member.rfc, member.key), product.id);
  }
  return (key) => byKey.get(key) ?? null;
}

/**
 * The request of batch k of a run (D-28, D-33): the body built at send time plus, after the
 * accepted names, the names of the cards the earlier batches of this run enqueued, as p(K+1)..
 * and never more than `LLM_LIMITS.contextNames` in all. With no earlier card the built body and
 * targets come back as they are. The result is for the request only: the dialog keeps listing the
 * bodies built at send time.
 */
function composeRequest(
  batch: GroupBatch,
  earlier: readonly RunCard[],
): { body: GroupRequest; targets: ReadonlyMap<string, ContextTarget> } {
  const accepted = batch.body.existing.length;
  const extra: GroupRequest["existing"] = [];
  const targets = new Map(batch.targets);
  for (const card of earlier) {
    if (accepted + extra.length >= LLM_LIMITS.contextNames) break;
    const name = cutText(card.name, LLM_LIMITS.productName);
    if (name === "") continue;
    const id = `p${String(accepted + extra.length + 1)}`;
    extra.push({ id, name });
    targets.set(id, { kind: "pending", suggestionId: card.suggestionId });
  }
  if (extra.length === 0) return { body: batch.body, targets: batch.targets };
  return { body: { ...batch.body, existing: [...batch.body.existing, ...extra] }, targets };
}

/**
 * The batches of a grouping run. Each one posts its body, re-checks the coverage of the answer
 * (an answer that omits, repeats or invents an id becomes an incomplete_response and adds
 * nothing, D-11, OQ3) and maps it to cards; `apply` enqueues them as soon as the runner
 * decides the batch counts (D-26).
 *
 * Batch k also carries the names of the cards that batches 1..k-1 enqueued (D-28, D-33). The
 * answer is mapped at apply time, not at send time, because a group placed with one of those
 * cards depends on what the user did with the card meanwhile: it joins the card while it is
 * pending, becomes an «Agregar a» card once the card was accepted, or keeps its own card once it
 * was rejected. Cards pending from earlier runs are never named here and never touched.
 */
export function groupBatches(run: GroupRun): RunBatch[] {
  const runCards = new Map<string, RunCard>();
  return run.batches.map((batch) => ({
    send: async (signal) => {
      const request = composeRequest(batch, [...runCards.values()]);
      const result = await postGroup(request.body, signal);
      if (!result.ok) return { ok: false, error: result.error };
      const coverage = coverageOf(
        batch.body.items.map((item) => item.id),
        result.data.groups.map((group) => ({ ids: group.ids })),
      );
      if (!isComplete(coverage)) return { ok: false, error: "incomplete_response" };
      const groups = result.data.groups;
      return {
        ok: true,
        apply: () => {
          const store = useSuggestionsStore.getState();
          const before = store.products.length;
          const answer = resolveProductAnswer(groups, batch.idMap, request.targets, newSuggestionId, {
            queue: store.products,
            productIdOfMember: acceptedProductOf(),
            runCards: new Map([...runCards].map(([id, card]) => [id, card.memberKeys])),
          });
          for (const append of answer.appends) store.appendMembers(append.cardId, append.members);
          store.enqueueProducts(answer.cards);
          const after = useSuggestionsStore.getState().products;
          // Only the cards that really entered the queue, and only new products: an «Agregar a»
          // card is named after DeepSeek's group, its product is already in the context.
          for (const card of answer.cards) {
            if (card.target !== null) continue;
            const stored = after.find((candidate) => candidate.id === card.id);
            if (stored === undefined) continue;
            runCards.set(card.id, {
              suggestionId: card.id,
              name: card.name,
              memberKeys: stored.members.map(memberKey),
            });
          }
          return after.length - before;
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

// The result of an ended run (canceled, partial, stopped) belongs to the invoices it ran on:
// clearing them dismisses it, so a later load never shows an old Alert or offers its «Reintentar».
useSessionStore.subscribe((session, previous) => {
  if (session.generation === previous.generation) return;
  const { phase } = useLlmRunStore.getState().status;
  if (phase === "running" || phase === "cancelling" || phase === "idle") return;
  useLlmRunStore.setState({ status: { phase: "idle" } });
});
