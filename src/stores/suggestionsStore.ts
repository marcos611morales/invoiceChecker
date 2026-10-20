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
}

// In memory in this plan; persistence under its own key arrives with Plan 04-11.
export const useSuggestionsStore = create<SuggestionsState>()((set) => ({
  products: [],
  enqueueProducts: (incoming) =>
    set((current) => ({
      products: enqueueProductSuggestions(current.products, incoming),
    })),
}));
