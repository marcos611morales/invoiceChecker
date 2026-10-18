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
import { SIN_CATEGORIA, defaultSettings, type SettingsData } from "@/domain/settings/types";
import { makeEntry } from "./ledgerFactory";
import type { WorkbookContext } from "@/features/export/workbook";

/** A display-name lookup for the categories of some settings. */
function nameOfFor(settings: SettingsData): (key: string) => string {
  return (key: string): string => {
    if (key === SIN_CATEGORIA) return "Sin categoría";
    return settings.categories.find((category) => category.id === key)?.name ?? key;
  };
}

/** A workbook context over the given settings (suppliers, rules, categories). */
export function contextFor(settings: SettingsData, mode: IvaMode): WorkbookContext {
  return {
    mode,
    nameOf: nameOfFor(settings),
    resolver: makeResolver(settings),
    exportedAtText: "17/10/2026 12:00",
    supplierLabels: [],
    categoryLabels: [],
    formaLabels: [],
  };
}

export function testContext(mode: IvaMode): WorkbookContext {
  return contextFor(defaultSettings(), mode);
}

/** A real DashboardView over the given settings, optionally with a category selection. */
export function viewFor(
  ledger: readonly LedgerEntry[],
  range: DateRange | null,
  mode: IvaMode,
  settings: SettingsData,
  categories: readonly string[] = [],
): DashboardView {
  return selectView({
    ledger,
    filters: { ...EMPTY_FILTERS, range, categories: new Set(categories) },
    resolver: makeResolver(settings),
    mode,
    nameOf: nameOfFor(settings),
    knownCategories: new Set(settings.categories.map((category) => category.id)),
  });
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
  return viewFor(ledger, range, mode, defaultSettings());
}
