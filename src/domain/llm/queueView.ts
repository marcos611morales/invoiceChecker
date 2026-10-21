/**
 * The view of the pending product queue (D-20, UI-SPEC queue defaults). Signature stubs for the
 * RED commit of Plan 04-17: every function returns a deliberately empty value.
 */
import type { AcceptProductError } from "../settings/products";
import type { SettingsData } from "../settings/types";
import type { ProductSuggestion } from "./suggestions";

export type QueueFilter = "todas" | "varios" | "deUno" | "paraAgregar";

export function orderQueue(
  cards: readonly ProductSuggestion[],
  lines: (key: string) => number,
): ProductSuggestion[] {
  void cards;
  void lines;
  return [];
}

export function stableOrder(
  previousIds: readonly string[],
  ordered: readonly ProductSuggestion[],
): ProductSuggestion[] {
  void previousIds;
  void ordered;
  return [];
}

export function filterQueue(
  cards: readonly ProductSuggestion[],
  filter: QueueFilter,
  search: string,
  displayName?: (card: ProductSuggestion) => string,
): ProductSuggestion[] {
  void cards;
  void filter;
  void search;
  void displayName;
  return [];
}

export function filterCounts(cards: readonly ProductSuggestion[]): Record<QueueFilter, number> {
  void cards;
  return { todas: 0, varios: 0, deUno: 0, paraAgregar: 0 };
}

export interface BulkAcceptResult {
  next: SettingsData;
  acceptedIds: string[];
  refused: { id: string; reason: AcceptProductError | "gone" }[];
  created: number;
  addedTo: number;
}

export function acceptMany(
  settings: SettingsData,
  cards: readonly ProductSuggestion[],
  newId: () => string,
): BulkAcceptResult {
  void cards;
  void newId;
  return { next: settings, acceptedIds: [], refused: [], created: 0, addedTo: 0 };
}
