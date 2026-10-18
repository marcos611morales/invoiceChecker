/** Skeleton for the RED step. */
import type { DashboardView } from "@/domain/accounting/view";
import type { SheetModel } from "../cellModel";
import type { WorkbookContext } from "../workbook";

export function buildResumenMes(_view: DashboardView, _ctx: WorkbookContext): SheetModel {
  return { name: "", columns: [], rows: [], totalRow: null };
}
