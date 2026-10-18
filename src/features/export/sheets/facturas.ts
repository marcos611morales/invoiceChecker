import type { ScopedEntry } from "@/domain/accounting/categories";
import type { DashboardView } from "@/domain/accounting/view";
import { es } from "@/lib/copy/es";
import type { SheetModel } from "../cellModel";
import type { WorkbookContext } from "../workbook";

// RED skeleton: replaced by the implementation in the GREEN commit.
export function sortEntriesForExport(entries: readonly ScopedEntry[]): ScopedEntry[] {
  return [...entries];
}

// RED skeleton: replaced by the implementation in the GREEN commit.
export function buildFacturas(view: DashboardView, ctx: WorkbookContext): SheetModel {
  void view;
  void ctx;
  return { name: es.export.sheets.facturas, columns: [], rows: [], totalRow: null };
}
