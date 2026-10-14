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
