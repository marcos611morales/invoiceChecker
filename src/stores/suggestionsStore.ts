import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  SUGGESTIONS_VERSION,
  enqueueProductSuggestions,
  resolvePendingQueue,
  type CategorySuggestion,
  type PendingQueue,
  type ProductSuggestion,
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
  /** Takes one card out of the queue and returns it, or null when there is no such card (nothing changes then). */
  removeProduct: (id: string) => ProductSuggestion | null;
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
      removeProduct: (id) => {
        const removed = get().products.find((card) => card.id === id);
        if (removed === undefined) return null;
        set((current) => ({ products: current.products.filter((card) => card.id !== id) }));
        return removed;
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
