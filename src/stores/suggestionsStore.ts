import { create } from "zustand";
import {
  enqueueProductSuggestions,
  type ProductSuggestion,
} from "@/domain/llm/suggestions";

interface SuggestionsState {
  /** Pending product cards, in arrival order. */
  products: ProductSuggestion[];
  /** Adds the cards, skipping every member already pending (idempotent per member, D-25). */
  enqueueProducts: (incoming: readonly ProductSuggestion[]) => void;
  /** Takes one card out of the queue and returns it, or null when there is no such card (nothing changes then). */
  removeProduct: (id: string) => ProductSuggestion | null;
}

// In memory in this plan; persistence under its own key arrives with Plan 04-11.
export const useSuggestionsStore = create<SuggestionsState>()((set, get) => ({
  products: [],
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
}));
