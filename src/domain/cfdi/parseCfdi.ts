import type { ParseResult, TipoComprobante } from "./types";

export const NS_CFDI4 = "http://www.sat.gob.mx/cfd/4";
export const NS_CFDI3 = "http://www.sat.gob.mx/cfd/3";
export const NS_TFD = "http://www.sat.gob.mx/TimbreFiscalDigital";
export const NS_PAGO20 = "http://www.sat.gob.mx/Pagos20";
export const TIPOS: readonly TipoComprobante[] = ["I", "E", "P", "T", "N"];

const MAX_XML_CHARS = 2_000_000;
const UUID_RE = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/;

function isTipo(value: string | null): value is TipoComprobante {
  return TIPOS.some((t) => t === value);
}

/** Direct children only, matched by namespace URI and local name (never by prefix). */
function kids(parent: Element | undefined, ns: string, local: string): Element[] {
  return parent
    ? Array.from(parent.children).filter(
        (c) => c.namespaceURI === ns && c.localName === local,
      )
    : [];
}

/** Optional attribute: exact string, or null when absent. */
function attr(el: Element | undefined, name: string): string | null {
  return el ? el.getAttribute(name) : null;
}

/**
 * Pure CFDI 4.0 validation chain plus header extraction.
 * Requires the global DOMParser (browser or jsdom).
 */
export function parseCfdi(xmlText: string): ParseResult {
  const text = xmlText.replace(/^﻿/, ""); // BOM: unconditional
  if (text.length > MAX_XML_CHARS) return { ok: false, reason: "too-large" };
  // CFDI never carries a DTD; rejecting it up front blocks entity expansion.
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) {
    return { ok: false, reason: "malformed", detail: "dtd" };
  }
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.getElementsByTagName("parsererror").length > 0) {
    return { ok: false, reason: "malformed" };
  }
  const root = doc.documentElement;
  if (root.localName !== "Comprobante") return { ok: false, reason: "not-cfdi" };
  if (root.namespaceURI === NS_CFDI3) {
    return {
      ok: false,
      reason: "cfdi-3x",
      detail: root.getAttribute("Version") ?? root.getAttribute("version") ?? "3.x",
    };
  }
  if (root.namespaceURI !== NS_CFDI4) return { ok: false, reason: "not-cfdi" };
  const version = root.getAttribute("Version");
  if (version !== "4.0") {
    return { ok: false, reason: "cfdi-3x", detail: version ?? "" };
  }
  const tipoRaw = root.getAttribute("TipoDeComprobante");
  if (!isTipo(tipoRaw)) return { ok: false, reason: "not-cfdi" };

  const complemento = kids(root, NS_CFDI4, "Complemento");
  const tfd = complemento.flatMap((c) => kids(c, NS_TFD, "TimbreFiscalDigital"))[0];
  const uuid = tfd?.getAttribute("UUID")?.trim().toUpperCase() ?? "";
  if (!UUID_RE.test(uuid)) return { ok: false, reason: "no-timbre" };

  // A CFDI 4.0 that omits a mandatory attribute is damaged, not "not a CFDI".
  const fecha = root.getAttribute("Fecha");
  const moneda = root.getAttribute("Moneda");
  const subTotal = root.getAttribute("SubTotal");
  const total = root.getAttribute("Total");
  const emisor = kids(root, NS_CFDI4, "Emisor")[0];
  const receptor = kids(root, NS_CFDI4, "Receptor")[0];
  const emisorRfc = attr(emisor, "Rfc");
  const receptorRfc = attr(receptor, "Rfc");
  const malformed = (name: string): ParseResult => ({
    ok: false,
    reason: "malformed",
    detail: `missing:${name}`,
  });
  if (fecha === null) return malformed("Fecha");
  if (moneda === null) return malformed("Moneda");
  if (subTotal === null) return malformed("SubTotal");
  if (total === null) return malformed("Total");
  if (emisorRfc === null) return malformed("Emisor.Rfc");
  if (receptorRfc === null) return malformed("Receptor.Rfc");

  const impuestos = kids(root, NS_CFDI4, "Impuestos")[0];

  return {
    ok: true,
    invoice: {
      uuid,
      version: "4.0",
      fecha,
      tipo: tipoRaw,
      serie: attr(root, "Serie"),
      folio: attr(root, "Folio"),
      moneda,
      tipoCambio: attr(root, "TipoCambio"),
      formaPago: attr(root, "FormaPago"),
      metodoPago: attr(root, "MetodoPago"),
      subTotal,
      descuento: attr(root, "Descuento"),
      total,
      totalImpuestosTrasladados: attr(impuestos, "TotalImpuestosTrasladados"),
      totalImpuestosRetenidos: attr(impuestos, "TotalImpuestosRetenidos"),
      emisor: { rfc: emisorRfc, nombre: attr(emisor, "Nombre") },
      receptor: { rfc: receptorRfc, nombre: attr(receptor, "Nombre") },
    },
  };
}
