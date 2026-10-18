import type { DashboardView } from "@/domain/accounting/view";
import { es } from "@/lib/copy/es";
import type { SheetModel } from "../cellModel";
import type { WorkbookContext } from "../workbook";

/** RED skeleton: the real builder follows in the GREEN commit. */
export function buildParametros(_view: DashboardView, _ctx: WorkbookContext): SheetModel {
  return { name: es.export.sheets.parametros, columns: [], rows: [], totalRow: null };
}
