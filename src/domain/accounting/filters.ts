/**
 * RED stub: the exported surface with no behavior, so the failing tests fail
 * on their assertions rather than on a missing module.
 */
import type { LedgerEntry } from "./ledger";
import type { MonthKey } from "./months";

export interface DateRange {
  from: MonthKey;
  to: MonthKey;
}

export interface Filters {
  range: DateRange | null;
  suppliers: ReadonlySet<string>;
  formas: ReadonlySet<string>;
}

export interface FilterOption {
  key: string;
  label: string;
  count: number;
}

export const EMPTY_FILTERS: Filters = {
  range: null,
  suppliers: new Set<string>(),
  formas: new Set<string>(),
};

export function loadedSpan(entries: readonly LedgerEntry[]): DateRange | null {
  void entries;
  return null;
}

export function resolveRange(filters: Filters, span: DateRange | null): DateRange | null {
  void filters;
  void span;
  return null;
}

export function normalizeRange(range: DateRange, span: DateRange | null): DateRange | null {
  void range;
  void span;
  return null;
}

export function applyFilters(
  entries: readonly LedgerEntry[],
  filters: Filters,
  span: DateRange | null,
): LedgerEntry[] {
  void entries;
  void filters;
  void span;
  return [];
}

export function supplierOptions(entries: readonly LedgerEntry[]): FilterOption[] {
  void entries;
  return [];
}

export function formaOptions(
  entries: readonly LedgerEntry[],
  labelOf: (code: string) => string,
): FilterOption[] {
  void entries;
  void labelOf;
  return [];
}

export function previousFilters(filters: Filters, range: DateRange): Filters {
  void range;
  return filters;
}

export function isDefaultFilters(filters: Filters): boolean {
  void filters;
  return false;
}
