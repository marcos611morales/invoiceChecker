import type Big from "big.js";
import type { Concepto, ParsedInvoice } from "../cfdi/types";

export interface InvoiceBreakdown {
  subtotal: Big | null;
  descuento: Big | null;
  iva: Big | null;
  ieps: Big | null;
  total: Big | null;
  rate: Big | null;
}

export interface ConceptBreakdown {
  importe: Big | null;
  descuento: Big | null;
  iva: Big | null;
  ieps: Big | null;
}

// RED skeleton: replaced by the implementation in the GREEN commit.
export function invoiceBreakdown(invoice: ParsedInvoice): InvoiceBreakdown {
  void invoice;
  return { subtotal: null, descuento: null, iva: null, ieps: null, total: null, rate: null };
}

// RED skeleton: replaced by the implementation in the GREEN commit.
export function conceptBreakdown(concepto: Concepto, invoice: ParsedInvoice): ConceptBreakdown {
  void concepto;
  void invoice;
  return { importe: null, descuento: null, iva: null, ieps: null };
}
