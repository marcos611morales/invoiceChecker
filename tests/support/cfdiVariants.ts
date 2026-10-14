import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** UTF-8 text of tests/fixtures/cfdi/<relPath>; the BOM, if any, is preserved. */
export function readFixture(relPath: string): string {
  return readFileSync(resolve(process.cwd(), "tests/fixtures/cfdi", relPath), "utf8");
}

/** Strips a leading BOM and a leading XML declaration. */
export function withoutBomAndDeclaration(xml: string): string {
  return xml.replace(/^\uFEFF/, "").replace(/^\s*<\?xml[^?]*\?>\s*/, "");
}

/**
 * Rebinds the cfdi and tfd prefixes in the xmlns declarations and in every
 * start and end tag. The namespace URIs stay the same.
 */
export function withPrefixes(
  xml: string,
  prefixes: { cfdi: string; tfd: string },
): string {
  return xml
    .replace(/xmlns:cfdi=/g, `xmlns:${prefixes.cfdi}=`)
    .replace(/xmlns:tfd=/g, `xmlns:${prefixes.tfd}=`)
    .replace(/<(\/?)cfdi:/g, (_m, slash: string) => `<${slash}${prefixes.cfdi}:`)
    .replace(/<(\/?)tfd:/g, (_m, slash: string) => `<${slash}${prefixes.tfd}:`);
}

/** Replaces the first match's attribute value; throws if the pattern is absent. */
function replaceAttr(xml: string, pattern: RegExp, value: string, label: string): string {
  if (!pattern.test(xml)) {
    throw new Error(`cfdiVariants: attribute not found (${label})`);
  }
  return xml.replace(pattern, (_m, head: string, tail: string) => `${head}${value}${tail}`);
}

/** Replaces TipoDeComprobante on the root. */
export function withTipo(xml: string, tipo: string): string {
  return replaceAttr(xml, /(\sTipoDeComprobante=")[^"]*(")/, tipo, "TipoDeComprobante");
}

/** Replaces Rfc on the Receptor element. */
export function withReceptorRfc(xml: string, rfc: string): string {
  return replaceAttr(
    xml,
    /(<(?:[\w-]+:)?Receptor\b[^>]*?\sRfc=")[^"]*(")/,
    rfc,
    "Receptor.Rfc",
  );
}

/** Replaces the TimbreFiscalDigital UUID attribute value. */
export function withUuid(xml: string, uuid: string): string {
  return replaceAttr(
    xml,
    /(<(?:[\w-]+:)?TimbreFiscalDigital\b[^>]*?\sUUID=")[^"]*(")/,
    uuid,
    "TimbreFiscalDigital.UUID",
  );
}

/** Cuts the document in the middle of an element so it is no longer well-formed. */
export function truncated(xml: string): string {
  const anchor = "<cfdi:Conceptos>";
  const at = xml.indexOf(anchor);
  if (at === -1) {
    throw new Error("cfdiVariants: anchor not found (cfdi:Conceptos)");
  }
  return xml.slice(0, at + "<cfdi:Concep".length);
}

/** Inserts a DOCTYPE holding an ENTITY declaration right after the XML declaration. */
export function withDoctype(xml: string): string {
  const declaration = /^(﻿?\s*<\?xml[^?]*\?>)/;
  if (!declaration.test(xml)) {
    throw new Error("cfdiVariants: anchor not found (XML declaration)");
  }
  return xml.replace(
    declaration,
    (_m, head: string) => `${head}\n<!DOCTYPE cfdi:Comprobante [<!ENTITY xxe "expandido">]>`,
  );
}

/** Removes the Complemento element and everything inside it. */
export function withoutComplemento(xml: string): string {
  const pattern = /<(?:[\w-]+:)?Complemento\b[\s\S]*?<\/(?:[\w-]+:)?Complemento>/;
  if (!pattern.test(xml)) {
    throw new Error("cfdiVariants: anchor not found (Complemento)");
  }
  return xml.replace(pattern, "");
}

/** Replaces the Version attribute of the root element. */
export function withVersion(xml: string, version: string): string {
  return replaceAttr(
    xml,
    /(<(?:[\w-]+:)?Comprobante\b[^>]*?\sVersion=")[^"]*(")/,
    version,
    "Comprobante.Version",
  );
}

/** Pattern for an attribute of the root Comprobante start tag (the `\s` anchor keeps Total off SubTotal). */
function rootAttr(name: string): RegExp {
  return new RegExp(`(<(?:[\\w-]+:)?Comprobante\\b[^>]*?\\s${name}=")[^"]*(")`);
}

/** Replaces Fecha on the root. */
export function withFecha(xml: string, fecha: string): string {
  return replaceAttr(xml, rootAttr("Fecha"), fecha, "Comprobante.Fecha");
}

/** Replaces Moneda on the root. */
export function withMoneda(xml: string, moneda: string): string {
  return replaceAttr(xml, rootAttr("Moneda"), moneda, "Comprobante.Moneda");
}

/** Replaces TipoCambio on the root; throws when the root has none. */
export function withTipoCambio(xml: string, tipoCambio: string): string {
  return replaceAttr(xml, rootAttr("TipoCambio"), tipoCambio, "Comprobante.TipoCambio");
}

/** Replaces Total on the root (never SubTotal or TotalImpuestos*). */
export function withTotal(xml: string, total: string): string {
  return replaceAttr(xml, rootAttr("Total"), total, "Comprobante.Total");
}

/** Replaces SubTotal on the root. */
export function withSubTotal(xml: string, subTotal: string): string {
  return replaceAttr(xml, rootAttr("SubTotal"), subTotal, "Comprobante.SubTotal");
}

/** Replaces Descuento on the root; throws when the root has none. */
export function withDescuento(xml: string, descuento: string): string {
  return replaceAttr(xml, rootAttr("Descuento"), descuento, "Comprobante.Descuento");
}

/** Replaces MetodoPago on the root. */
export function withMetodoPago(xml: string, metodoPago: string): string {
  return replaceAttr(xml, rootAttr("MetodoPago"), metodoPago, "Comprobante.MetodoPago");
}

/** Replaces FormaPago on the root. */
export function withFormaPago(xml: string, formaPago: string): string {
  return replaceAttr(xml, rootAttr("FormaPago"), formaPago, "Comprobante.FormaPago");
}

/** Replaces TipoRelacion on the first CfdiRelacionados element. */
export function withTipoRelacion(xml: string, tipoRelacion: string): string {
  return replaceAttr(
    xml,
    /(<(?:[\w-]+:)?CfdiRelacionados\b[^>]*?\sTipoRelacion=")[^"]*(")/,
    tipoRelacion,
    "CfdiRelacionados.TipoRelacion",
  );
}
