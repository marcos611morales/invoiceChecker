/** Skeleton for the RED step. */
import type { IvaMode } from "@/domain/accounting/aggregate";
import type { DashboardView } from "@/domain/accounting/view";
import type { Resolver } from "@/domain/settings/resolver";
import type { SheetModel } from "./cellModel";

export interface WorkbookContext {
  mode: IvaMode;
  nameOf: (key: string) => string;
  resolver: Resolver;
  exportedAtText: string;
  supplierLabels: string[];
  categoryLabels: string[];
  formaLabels: string[];
}

export function amountHeader(_mode: IvaMode): string {
  return "";
}

export function buildWorkbook(_view: DashboardView, _ctx: WorkbookContext): SheetModel[] {
  return [];
}
