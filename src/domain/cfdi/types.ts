export type TipoComprobante = "I" | "E" | "P" | "T" | "N";

export type RejectReason =
  | "cfdi-3x"
  | "not-cfdi"
  | "malformed"
  | "no-timbre"
  | "too-large";

/** A Traslado or Retencion of a concepto. Strings are the exact XML values. */
export interface Impuesto {
  base: string | null;
  impuesto: string;
  tipoFactor: string | null;
  tasaOCuota: string | null;
  importe: string | null;
}

/**
 * One Concepto of a CFDI 4.0 with its own (concept-level) taxes. Required
 * attributes that are absent become "" (never undefined); optional ones null.
 */
export interface Concepto {
  claveProdServ: string;
  noIdentificacion: string | null;
  cantidad: string;
  claveUnidad: string;
  unidad: string | null;
  descripcion: string;
  valorUnitario: string;
  importe: string;
  descuento: string | null;
  objetoImp: string | null;
  traslados: Impuesto[];
  retenciones: Impuesto[];
}

/**
 * Data of a CFDI 4.0. Money and rates stay as the exact XML
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
  conceptos: Concepto[];
}

export type ParseResult =
  | { ok: true; invoice: ParsedInvoice }
  | { ok: false; reason: RejectReason; detail?: string };
