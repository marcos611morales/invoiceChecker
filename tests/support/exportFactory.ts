/**
 * Test helper shared by the export tests: a real DashboardView built with `selectView` over
 * synthetic ledger entries, plus a workbook context. Not imported by production code.
 */
import Big from "big.js";
import type { IvaMode } from "@/domain/accounting/aggregate";
import { EMPTY_FILTERS, type DateRange } from "@/domain/accounting/filters";
import type { LedgerEntry } from "@/domain/accounting/ledger";
import { selectView, type DashboardView } from "@/domain/accounting/view";
import { makeResolver } from "@/domain/settings/resolver";
import { SIN_CATEGORIA, defaultSettings } from "@/domain/settings/types";
import { makeEntry } from "./ledgerFactory";
import type { WorkbookContext } from "@/features/export/workbook";

const settings = defaultSettings();
const resolver = makeResolver(settings);

function nameOf(key: string): string {
  if (key === SIN_CATEGORIA) return "Sin categoría";
  return settings.categories.find((category) => category.id === key)?.name ?? key;
}

export function testContext(mode: IvaMode): WorkbookContext {
  return {
    mode,
    nameOf,
    resolver,
    exportedAtText: "17/10/2026 12:00",
    supplierLabels: [],
    categoryLabels: [],
    formaLabels: [],
  };
}

export interface SpecEntry {
  month: string;
  con: string;
  sin: string;
  kind?: LedgerEntry["kind"];
}

export function entriesOf(specs: readonly SpecEntry[]): LedgerEntry[] {
  return specs.map((spec) =>
    makeEntry({
      kind: spec.kind ?? "ingreso",
      conIva: new Big(spec.con),
      sinIva: new Big(spec.sin),
      month: spec.month,
      ownMonth: spec.month,
    }),
  );
}

export function viewOf(
  ledger: readonly LedgerEntry[],
  range: DateRange | null,
  mode: IvaMode,
): DashboardView {
  return selectView({
    ledger,
    filters: { ...EMPTY_FILTERS, range },
    resolver,
    mode,
    nameOf,
    knownCategories: new Set(settings.categories.map((category) => category.id)),
  });
}
