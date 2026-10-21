import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  SUGGESTIONS_VERSION,
  appendSuggestionMembers,
  dropMember,
  enqueueProductSuggestions,
  mergeSuggestions,
  removeSuggestion,
  renameSuggestion,
  resolvePendingQueue,
  restoreMember,
  restoreSuggestion,
  splitSuggestion,
  turnIntoAddCard,
  undoQueueChange,
  type CategorySuggestion,
  type DroppedMember,
  type PendingQueue,
  type ProductSuggestion,
  type QueueUndo,
  type RemovedSuggestion,
  type SuggestionMember,
} from "@/domain/llm/suggestions";
import { createSafeStorage } from "./safeStorage";
import { useSuggestionsStatusStore } from "./storageStatusStore";

/**
 * The pending review queue (D-24, D-30). Contract: key `invoicechecker:suggestions`,
 * `{ state: { products, categories }, version: 1 }`, separate from `invoicechecker:settings`
 * and never part of the settings file. It holds product names, the accepted-product target and,
 * per member, the supplier RFC, the normalized key, the description and the supplier name:
 * never an amount, an invoice UUID, a folio or a date. The RFC stays in this browser (D-30).
 * Persist writes after every change, so each batch that lands is stored as it lands (LLM-05).
 */
const STORAGE_KEY = "invoicechecker:suggestions";

interface SuggestionsState {
  /** Pending product cards, in arrival order. */
  products: ProductSuggestion[];
  /** Pending category rows; empty until Plan 04-18 fills them. */
  categories: CategorySuggestion[];
  /** Adds the cards, skipping every member already pending (idempotent per member, D-25). */
  enqueueProducts: (incoming: readonly ProductSuggestion[]) => void;
  /**
   * Adds members at the end of a pending card (D-33), skipping every member already pending in any
   * card (idempotent per member); an unknown card or nothing new writes nothing.
   */
  appendMembers: (cardId: string, members: readonly SuggestionMember[]) => void;
  /** Takes one card out of the queue and returns it, or null when there is no such card (nothing changes then). */
  removeProduct: (id: string) => ProductSuggestion | null;
  /** Stores the name typed on a card, cut to 60 (D-12); an unknown id or the same name writes nothing. */
  renameSuggestion: (id: string, name: string) => void;
  /** Takes a rejected card out (D-22) and returns what `restoreSuggestion` needs, or null for an unknown id. */
  rejectSuggestion: (id: string) => RemovedSuggestion | null;
  /** Undo of `rejectSuggestion`; a refused restore (members pending elsewhere, a limit) writes nothing. */
  restoreSuggestion: (removed: RemovedSuggestion) => void;
  /**
   * Takes one member (`key` is `memberKey`) out of a card (D-22); the only member takes the card
   * with it. Returns what `restoreMember` needs, or null for an unknown card or member.
   */
  dropMember: (cardId: string, key: string) => DroppedMember | null;
  /** Undo of `dropMember`; a refused restore writes nothing. */
  restoreMember: (dropped: DroppedMember) => void;
  /**
   * Joins card `fromId` into `intoId` (D-19); returns what `undoQueueChange` needs, or null (and
   * writes nothing) for the same card or an unknown one.
   */
  mergeSuggestions: (fromId: string, intoId: string) => QueueUndo | null;
  /** Turns a card into an «Agregar a» card for an accepted product; null (nothing written) when it changes nothing. */
  turnIntoAddCard: (id: string, productId: string) => QueueUndo | null;
  /**
   * Moves the members whose `memberKey` is in `keys` into a new card placed right below
   * («sug_» plus a random id, reported as `createdId` of the result); null (nothing written)
   * unless some but not all of the card's members are named.
   */
  splitSuggestion: (id: string, keys: readonly string[]) => QueueUndo | null;
  /** Undo of the three actions above; a refused undo writes nothing. */
  undoQueueChange: (undo: QueueUndo) => void;
  /**
   * Takes every card whose id is in `ids` out of the queue in one write (D-20) and returns what
   * `restoreMany` needs, in queue order; unknown ids are ignored and nothing known writes nothing.
   */
  rejectMany: (ids: readonly string[]) => RemovedSuggestion[];
  /** Undo of `rejectMany`: every card goes back to the index it had; a refused card is left out. */
  restoreMany: (removed: readonly RemovedSuggestion[]) => void;
}

/** The queue as the domain reducers take it. */
function queueOf(state: PendingQueue): PendingQueue {
  return { products: state.products, categories: state.categories };
}

/**
 * Resolves a stored value into a valid queue and reports an unusable one. Both `migrate` and
 * `merge` use it. It touches only the status store, never the persisted one.
 */
function resolveAndReport(raw: unknown, version: number | undefined): PendingQueue {
  const { data, status } = resolvePendingQueue(raw, version);
  if (status === "unreadable") useSuggestionsStatusStore.getState().markReadFailed();
  return data;
}

export const useSuggestionsStore = create<SuggestionsState>()(
  persist<SuggestionsState, [], [], unknown>(
    (set, get) => ({
      products: [],
      categories: [],
      enqueueProducts: (incoming) =>
        set((current) => ({
          products: enqueueProductSuggestions(current.products, incoming),
        })),
      appendMembers: (cardId, members) => {
        const current = queueOf(get());
        const next = appendSuggestionMembers(current, cardId, members);
        // An unknown card or no new member comes back as the same object: nothing to write.
        if (next !== current) set({ products: next.products });
      },
      removeProduct: (id) => {
        const removed = get().products.find((card) => card.id === id);
        if (removed === undefined) return null;
        set((current) => ({ products: current.products.filter((card) => card.id !== id) }));
        return removed;
      },
      renameSuggestion: (id, name) => {
        const current = queueOf(get());
        const next = renameSuggestion(current, id, name);
        // An unknown id or an unchanged name comes back as the same object: nothing to write.
        if (next !== current) set({ products: next.products });
      },
      rejectSuggestion: (id) => {
        const result = removeSuggestion(queueOf(get()), id);
        if (result === null) return null;
        set({ products: result.next.products });
        return result.removed;
      },
      restoreSuggestion: (removed) => {
        const current = queueOf(get());
        const next = restoreSuggestion(current, removed);
        // A refused restore comes back as the same object: nothing to write.
        if (next !== current) set({ products: next.products });
      },
      dropMember: (cardId, key) => {
        const result = dropMember(queueOf(get()), cardId, key);
        if (result === null) return null;
        set({ products: result.next.products });
        return result.dropped;
      },
      restoreMember: (dropped) => {
        const current = queueOf(get());
        const next = restoreMember(current, dropped);
        // A refused restore comes back as the same object: nothing to write.
        if (next !== current) set({ products: next.products });
      },
      mergeSuggestions: (fromId, intoId) => {
        const result = mergeSuggestions(queueOf(get()), fromId, intoId);
        if (result === null) return null;
        set({ products: result.next.products });
        return result.undo;
      },
      turnIntoAddCard: (id, productId) => {
        const result = turnIntoAddCard(queueOf(get()), id, productId);
        if (result === null) return null;
        set({ products: result.next.products });
        return result.undo;
      },
      splitSuggestion: (id, keys) => {
        const result = splitSuggestion(
          queueOf(get()),
          id,
          keys,
          `sug_${crypto.randomUUID()}`,
        );
        if (result === null) return null;
        set({ products: result.next.products });
        return result.undo;
      },
      undoQueueChange: (undo) => {
        const current = queueOf(get());
        const next = undoQueueChange(current, undo);
        // A refused undo comes back as the same object: nothing to write.
        if (next !== current) set({ products: next.products });
      },
      rejectMany: (ids) => {
        void ids;
        return [];
      },
      restoreMany: (removed) => {
        void removed;
      },
    }),
    {
      name: STORAGE_KEY,
      version: SUGGESTIONS_VERSION,
      // Rehydrated from an effect in the app shell, so server and first client render agree.
      skipHydration: true,
      storage: createSafeStorage(() => useSuggestionsStatusStore.getState()),
      partialize: (state): PendingQueue => ({
        products: state.products,
        categories: state.categories,
      }),
      // Both delegate to the total resolvePendingQueue: an exception here would be
      // swallowed by zustand and silently reset the store (Pitfall 5).
      migrate: (persisted, version) => resolveAndReport(persisted, version),
      // set(..., true) replaces the state, so merge returns the full state with the actions.
      merge: (persisted, current) => ({
        ...current,
        ...resolveAndReport(persisted, SUGGESTIONS_VERSION),
      }),
    },
  ),
);
