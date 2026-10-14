export type TipoComprobante = "I" | "E" | "P" | "T" | "N";

export type RejectReason =
  | "cfdi-3x"
  | "not-cfdi"
  | "malformed"
  | "no-timbre"
  | "too-large";

/**
 * Header-level data of a CFDI 4.0. Money and rates stay as the exact XML
 * attribute strings (no numeric type in Phase 1). Absent optional attributes
 * are null.
 */
export interface ParsedInvoice {
  uuid: string;
  version: "4.0";
  fecha: string;
  tipo: TipoComprobante;
  serie: string | null;
  folio: string | null;
  moneda: string;
  tipoCambio: string | null;
  formaPago: string | null;
  metodoPago: string | null;
  subTotal: string;
  descuento: string | null;
  total: string;
  totalImpuestosTrasladados: string | null;
  totalImpuestosRetenidos: string | null;
  emisor: { rfc: string; nombre: string | null };
  receptor: { rfc: string; nombre: string | null };
}

export type ParseResult =
  | { ok: true; invoice: ParsedInvoice }
  | { ok: false; reason: RejectReason; detail?: string };
