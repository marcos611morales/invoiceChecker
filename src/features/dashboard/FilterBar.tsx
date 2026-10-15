"use client";

import type { DateRange } from "@/domain/accounting/filters";
import type { LedgerEntry } from "@/domain/accounting/ledger";

/** Skeleton for the RED commit: the real filter bar arrives in the GREEN commit. */
export function FilterBar(props: {
  ledger: readonly LedgerEntry[];
  span: DateRange | null;
}) {
  void props;
  return null;
}
