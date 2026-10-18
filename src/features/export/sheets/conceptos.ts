import type { DashboardView } from "@/domain/accounting/view";
import { es } from "@/lib/copy/es";
import type { SheetModel } from "../cellModel";
import type { WorkbookContext } from "../workbook";

// RED skeleton: replaced by the implementation in the GREEN commit.
export function buildConceptos(view: DashboardView, ctx: WorkbookContext): SheetModel {
  void view;
  void ctx;
  return { name: es.export.sheets.conceptos, columns: [], rows: [], totalRow: null };
}
