import Big from "big.js";

// Synthetic CFDI 4.0 builder for the price scenarios of the end-to-end checks (Phase 5). Nothing
// here comes from a real invoice: the callers pass fake RFCs, names, folios and UUIDs. The totals
// are derived from the lines with big.js strings, so the app's ledger counts the invoice as a
// normal Ingreso and the amounts reconcile to the cent.

/** One concept line. Amounts are decimal strings, never floats. */
export interface PriceLine {
  descripcion: string;
  claveProdServ: string;
  claveUnidad: string;
  cantidad: string;
  importe: string;
  descuento?: string;
}

/** One invoice: the issuer, the folio, the local timestamp, the UUID and its lines. */
export interface PriceInvoiceSpec {
  rfc: string;
  nombre: string;
  folio: string;
  fecha: string;
  uuid: string;
  lines: PriceLine[];
}

const CFDI_NS = "http://www.sat.gob.mx/cfd/4";
const TFD_NS = "http://www.sat.gob.mx/TimbreFiscalDigital";

/** Escapes the five XML special characters of an attribute value written between double quotes. */
function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function attributes(pairs: readonly (readonly [string, string])[]): string {
  return pairs.map(([name, value]) => `${name}="${escapeAttribute(value)}"`).join(" ");
}

/** Sum of decimal strings, exact. */
function sum(values: readonly string[]): Big {
  return values.reduce((total, value) => total.plus(new Big(value)), new Big("0"));
}

function conceptoXml(line: PriceLine): string {
  // ValorUnitario is the undiscounted unit value; up to 6 decimals, like the CFDI.
  const valorUnitario = new Big(line.importe).div(new Big(line.cantidad)).round(6).toFixed();
  const pairs: (readonly [string, string])[] = [
    ["ClaveProdServ", line.claveProdServ],
    ["Cantidad", line.cantidad],
    ["ClaveUnidad", line.claveUnidad],
    ["Descripcion", line.descripcion],
    ["ValorUnitario", valorUnitario],
    ["Importe", line.importe],
  ];
  if (line.descuento !== undefined) pairs.push(["Descuento", line.descuento]);
  pairs.push(["ObjetoImp", "01"]);
  return `    <cfdi:Concepto ${attributes(pairs)}/>`;
}

/**
 * A CFDI 4.0 Ingreso without taxes (ObjetoImp 01): SubTotal is the sum of the importes, Descuento
 * the sum of the descuentos (the attribute is written only when a line has one) and Total is
 * SubTotal minus Descuento. It carries a TimbreFiscalDigital with the given UUID.
 */
export function buildPriceXml(spec: PriceInvoiceSpec): string {
  const subTotal = sum(spec.lines.map((line) => line.importe));
  const hasDiscount = spec.lines.some((line) => line.descuento !== undefined);
  const descuento = sum(spec.lines.map((line) => line.descuento ?? "0"));
  const total = subTotal.minus(descuento);

  const comprobante: (readonly [string, string])[] = [
    ["xmlns:cfdi", CFDI_NS],
    ["Version", "4.0"],
    ["Folio", spec.folio],
    ["Fecha", spec.fecha],
    ["FormaPago", "03"],
    ["SubTotal", subTotal.toFixed(2)],
  ];
  if (hasDiscount) comprobante.push(["Descuento", descuento.toFixed(2)]);
  comprobante.push(
    ["Moneda", "MXN"],
    ["Total", total.toFixed(2)],
    ["TipoDeComprobante", "I"],
    ["Exportacion", "01"],
    ["MetodoPago", "PUE"],
    ["LugarExpedicion", "00000"],
  );

  const timbre = attributes([
    ["xmlns:tfd", TFD_NS],
    ["Version", "1.1"],
    ["UUID", spec.uuid],
    ["FechaTimbrado", spec.fecha],
  ]);

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<cfdi:Comprobante ${attributes(comprobante)}>`,
    `  <cfdi:Emisor ${attributes([
      ["Rfc", spec.rfc],
      ["Nombre", spec.nombre],
      ["RegimenFiscal", "601"],
    ])}/>`,
    `  <cfdi:Receptor ${attributes([
      ["Rfc", "XAXX010101000"],
      ["Nombre", "RECEPTOR DE PRUEBA"],
      ["DomicilioFiscalReceptor", "00000"],
      ["RegimenFiscalReceptor", "616"],
      ["UsoCFDI", "G03"],
    ])}/>`,
    "  <cfdi:Conceptos>",
    ...spec.lines.map(conceptoXml),
    "  </cfdi:Conceptos>",
    "  <cfdi:Complemento>",
    `    <tfd:TimbreFiscalDigital ${timbre}/>`,
    "  </cfdi:Complemento>",
    "</cfdi:Comprobante>",
    "",
  ].join("\n");
}
