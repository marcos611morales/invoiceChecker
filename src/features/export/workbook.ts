/**
 * The workbook as a list of library-independent sheet models, in workbook order (XLS-01).
 * Every sheet reads the same `DashboardView` the Dashboard shows, so the figures of the
 * file cannot disagree with the screen (FILT-05). Plan 03-13 writes the models to a file.
 */
import type { IvaMode } from "@/domain/accounting/aggregate";
import type { DashboardView } from "@/domain/accounting/view";
import type { Resolver } from "@/domain/settings/resolver";
import { es } from "@/lib/copy/es";
import type { SheetModel } from "./cellModel";
import { buildConceptos } from "./sheets/conceptos";
import { buildFacturas } from "./sheets/facturas";
import { buildParametros } from "./sheets/parametros";
import { buildResumenCategoria } from "./sheets/resumenCategoria";
import { buildResumenMes } from "./sheets/resumenMes";
import { buildResumenProveedor } from "./sheets/resumenProveedor";

export interface WorkbookContext {
  mode: IvaMode;
  /** Display name of a category id (including SIN_CATEGORIA). */
  nameOf: (key: string) => string;
  resolver: Resolver;
  /** Moment of the export, already formatted dd/mm/aaaa hh:mm by the caller. */
  exportedAtText: string;
  /** Names of the selected suppliers, categories and formas; empty means "all". */
  supplierLabels: string[];
  categoryLabels: string[];
  formaLabels: string[];
}

/** Header of every amount column: «Monto (con IVA)» or «Monto (sin IVA)» (D-22). */
export function amountHeader(mode: IvaMode): string {
  return mode === "con" ? es.export.amountCon : es.export.amountSin;
}

/** The six sheet models of XLS-01 in UI-SPEC order. */
export function buildWorkbook(view: DashboardView, ctx: WorkbookContext): SheetModel[] {
  return [
    buildFacturas(view, ctx),
    buildConceptos(view, ctx),
    buildResumenCategoria(view, ctx),
    buildResumenProveedor(view, ctx),
    buildResumenMes(view, ctx),
    buildParametros(view, ctx),
  ];
}
