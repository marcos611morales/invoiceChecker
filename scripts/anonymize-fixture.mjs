#!/usr/bin/env node
// Whitelist-based anonymizer for real CFDI 4.0 files.
//
// Usage: node scripts/anonymize-fixture.mjs <in.xml> <out.xml>
//
// Every attribute whose name is NOT in the structural whitelist below is
// rewritten, so unknown or vendor attributes are anonymized by default.
// Element text, comments and CDATA are dropped or neutralized as well.
// UUID-shaped values map to a deterministic synthetic UUID, so the same real
// UUID gives the same synthetic one across files (cross references survive).
//
// This script NEVER prints input values: errors only say what failed.

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

/** Attribute names kept verbatim: structural data, no identity. */
const WHITELIST = new Set([
  "Version",
  "Fecha",
  "TipoDeComprobante",
  "Exportacion",
  "Moneda",
  "TipoCambio",
  "SubTotal",
  "Descuento",
  "Total",
  "FormaPago",
  "MetodoPago",
  "UsoCFDI",
  "RegimenFiscal",
  "RegimenFiscalReceptor",
  "ClaveProdServ",
  "ClaveUnidad",
  "Unidad",
  "Cantidad",
  "ValorUnitario",
  "Importe",
  "ObjetoImp",
  "Base",
  "Impuesto",
  "TipoFactor",
  "TasaOCuota",
  "TotalImpuestosTrasladados",
  "TotalImpuestosRetenidos",
  "TipoRelacion",
  "FechaPago",
  "FormaDePagoP",
  "MonedaP",
  "TipoCambioP",
  "Monto",
  "MonedaDR",
  "EquivalenciaDR",
  "NumParcialidad",
  "ImpSaldoAnt",
  "ImpPagado",
  "ImpSaldoInsoluto",
  "ObjetoImpDR",
  "MontoTotalPagos",
  "Periodicidad",
  "Meses",
  // Structural extensions beyond the minimal list: pago20 tax breakdowns and the
  // stamp date. They carry amounts, rates and dates only, never identity.
  "FechaTimbrado",
  "BaseDR",
  "ImpuestoDR",
  "TipoFactorDR",
  "TasaOCuotaDR",
  "ImporteDR",
  "BaseP",
  "ImpuestoP",
  "TipoFactorP",
  "TasaOCuotaP",
  "ImporteP",
  "TotalRetencionesIVA",
  "TotalRetencionesISR",
  "TotalRetencionesIEPS",
  "TotalTrasladosBaseIVA16",
  "TotalTrasladosImpuestoIVA16",
  "TotalTrasladosBaseIVA8",
  "TotalTrasladosImpuestoIVA8",
  "TotalTrasladosBaseIVA0",
  "TotalTrasladosImpuestoIVA0",
  "TotalTrasladosBaseIVAExento",
]);

const SYNTHETIC_EMISOR_RFC = "EKU9003173C9";
const SYNTHETIC_RECEPTOR_RFC = "XAXX010101000";
const SYNTHETIC_PAC_RFC = "AAA010101AAA";
const SALT = "invoicechecker-anon-v1";

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const UUID_FULL_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;
const DIGITS_RE = /^\d+$/;

/** Deterministic v4-shaped UUID derived from the real one (case-insensitive). */
function syntheticUuid(real) {
  const hex = createHash("sha256")
    .update(`${SALT}:${real.toUpperCase()}`)
    .digest("hex");
  const variant = "89ab"[Number.parseInt(hex.charAt(16), 16) % 4];
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    `${variant}${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ]
    .join("-")
    .toUpperCase();
}

/** Stable "PREFIX N" labels: the same real value gets the same N in one file. */
function makeLabeler(prefix) {
  const seen = new Map();
  return (real) => {
    let n = seen.get(real);
    if (n === undefined) {
      n = seen.size + 1;
      seen.set(real, n);
    }
    return `${prefix} ${n}`;
  };
}

function localName(name) {
  const i = name.indexOf(":");
  return i === -1 ? name : name.slice(i + 1);
}

/** Neutral token of the same kind as the (non-whitelisted) value. */
function genericToken(value) {
  if (ISO_DATE_RE.test(value)) return "2025-01-01T00:00:00";
  if (DIGITS_RE.test(value)) return "0".repeat(Math.min(value.length, 20));
  return "X";
}

function anonymize(text) {
  const proveedor = makeLabeler("PROVEEDOR ANONIMO");
  const concepto = makeLabeler("CONCEPTO");
  const sku = makeLabeler("SKU");
  const otro = makeLabeler("NOMBRE ANONIMO");

  // 1. Drop comments and CDATA blocks outright.
  let out = text.replace(/<!--[\s\S]*?-->/g, "").replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "");

  // 2. Every UUID-shaped string anywhere maps to its synthetic twin.
  out = out.replace(UUID_RE, (m) => syntheticUuid(m));

  // 3. Rewrite attributes tag by tag (the element name gives the context).
  const tagRe =
    /<([A-Za-z_][\w:.-]*)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/g;
  const attrRe = /(\s+)([\w:.-]+)(\s*=\s*)(?:"([^"]*)"|'([^']*)')/g;

  out = out.replace(tagRe, (_whole, tag, attrs, selfClose) => {
    const element = localName(tag);
    const rewritten = attrs.replace(
      attrRe,
      (_a, space, name, eq, dq, sq) => {
        const value = dq !== undefined ? dq : sq;
        const local = localName(name);
        // Namespace declarations and schema location are structural.
        if (name === "xmlns" || name.startsWith("xmlns:") || name === "xsi:schemaLocation") {
          return `${space}${name}${eq}"${value}"`;
        }
        let next;
        if (UUID_FULL_RE.test(value)) {
          next = value; // already synthetic (step 2)
        } else if (local === "Rfc") {
          next = element === "Receptor" ? SYNTHETIC_RECEPTOR_RFC : SYNTHETIC_EMISOR_RFC;
        } else if (local === "RfcProvCertif") {
          next = SYNTHETIC_PAC_RFC;
        } else if (local.startsWith("Rfc")) {
          next = SYNTHETIC_RECEPTOR_RFC;
        } else if (local === "Nombre") {
          if (element === "Receptor") next = "RECEPTOR ANONIMO";
          else if (element === "Emisor") next = proveedor(value);
          else next = otro(value);
        } else if (local === "Descripcion") {
          next = concepto(value);
        } else if (local === "NoIdentificacion") {
          next = sku(value);
        } else if (WHITELIST.has(local) && !name.includes(":")) {
          next = value;
        } else if (local === "Sello" || local === "SelloCFD" || local === "SelloSAT" || local === "Certificado") {
          next = "AAAA";
        } else if (local === "NoCertificado" || local === "NoCertificadoSAT") {
          next = "00000000000000000000";
        } else if (local === "LugarExpedicion" || local === "DomicilioFiscalReceptor") {
          next = "00000";
        } else if (local === "Serie") {
          next = "A";
        } else if (local === "Folio") {
          next = DIGITS_RE.test(value) ? "1".repeat(Math.min(value.length, 9)) : "1";
        } else {
          next = genericToken(value);
        }
        return `${space}${name}${eq}"${next.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;")}"`;
      },
    );
    return `<${tag}${rewritten}${selfClose}>`;
  });

  // 4. Non-blank element text is neutralized (CFDI carries none; Addenda might).
  out = out.replace(/>([^<]+)</g, (whole, content) =>
    content.trim() === "" ? whole : ">X<",
  );

  return out;
}

function main() {
  const [inPath, outPath] = process.argv.slice(2);
  if (!inPath || !outPath) {
    console.error("usage: node scripts/anonymize-fixture.mjs <in.xml> <out.xml>");
    process.exit(2);
  }
  let input;
  try {
    input = readFileSync(inPath, "utf8");
  } catch {
    console.error("error: cannot read the input file");
    process.exit(1);
  }
  const result = anonymize(input);
  try {
    writeFileSync(outPath, result, "utf8");
  } catch {
    console.error("error: cannot write the output file");
    process.exit(1);
  }
  console.log("anonymized: 1 file written");
}

main();
