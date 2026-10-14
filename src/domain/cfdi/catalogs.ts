/**
 * Static SAT catalogs (D-45). The labels are accepted as written and can be
 * confirmed later against the official catCFDI. Codes come from XML, so the
 * lookups use `Object.hasOwn`: a code such as "__proto__" or "constructor"
 * never reaches Object.prototype. Fallback text for an unknown code
 * ("Forma de pago {codigo}") is UI copy and lives with the UI.
 */

// Source: phpcfdi/resources-sat-catalogs, c_FormaPago (22 rows), mirror of the SAT catCFDI.
export const FORMA_PAGO: Readonly<Record<string, string>> = {
  "01": "Efectivo",
  "02": "Cheque nominativo",
  "03": "Transferencia electrónica de fondos",
  "04": "Tarjeta de crédito",
  "05": "Monedero electrónico",
  "06": "Dinero electrónico",
  "08": "Vales de despensa",
  "12": "Dación en pago",
  "13": "Pago por subrogación",
  "14": "Pago por consignación",
  "15": "Condonación",
  "17": "Compensación",
  "23": "Novación",
  "24": "Confusión",
  "25": "Remisión de deuda",
  "26": "Prescripción o caducidad",
  "27": "A satisfacción del acreedor",
  "28": "Tarjeta de débito",
  "29": "Tarjeta de servicios",
  "30": "Aplicación de anticipos",
  "31": "Intermediario pagos",
  "99": "Por definir",
};

// c_TipoRelacion (7 rows).
export const TIPO_RELACION: Readonly<Record<string, string>> = {
  "01": "Nota de crédito de los documentos relacionados",
  "02": "Nota de débito de los documentos relacionados",
  "03": "Devolución de mercancía sobre facturas o traslados previos",
  "04": "Sustitución de los CFDI previos",
  "05": "Traslados de mercancías facturados previamente",
  "06": "Factura generada por los traslados previos",
  "07": "CFDI por aplicación de anticipo",
};

function lookup(catalog: Readonly<Record<string, string>>, code: string): string | null {
  if (!Object.hasOwn(catalog, code)) return null;
  return catalog[code] ?? null;
}

/** Name of a c_FormaPago code, or null when the code is not in the catalog. */
export function formaPagoName(code: string): string | null {
  return lookup(FORMA_PAGO, code);
}

/** Name of a c_TipoRelacion code, or null when the code is not in the catalog. */
export function tipoRelacionName(code: string): string | null {
  return lookup(TIPO_RELACION, code);
}
