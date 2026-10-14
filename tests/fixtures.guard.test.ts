import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Privacy guard: no real identifier from Facturas/ may appear in tests/ or e2e/.
// Skipped where Facturas/ is absent (Vercel, CI, other machines).
// FACTURAS_DIR overrides the default <cwd>/Facturas (useful from git worktrees).
// Failures report the file and the attribute name, never the value.

const facturasRoot = process.env.FACTURAS_DIR ?? resolve(process.cwd(), "Facturas");
const hasFacturas = existsSync(facturasRoot);

/** Public SAT generic/test RFCs: allowed everywhere. */
const PUBLIC_RFCS = new Set(["EKU9003173C9", "XAXX010101000", "XEXX010101000"]);

/** Attributes whose real values must never reach tests/ or e2e/. */
const GUARDED_ATTRIBUTES = [
  "Rfc",
  "Nombre",
  "UUID",
  "IdDocumento",
  "NoCertificado",
  "NoCertificadoSAT",
  "RfcProvCertif",
] as const;

/** Values shorter than this cannot identify anyone and would create false positives. */
const MIN_LENGTH = 4;

function walk(dir: string, accept: (path: string) => boolean): string[] {
  if (!existsSync(dir)) return [];
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      found.push(...walk(full, accept));
    } else if (accept(full)) {
      found.push(full);
    }
  }
  return found;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

interface RealValue {
  attribute: string;
  value: string;
  isUuid: boolean;
}

function collectRealValues(): RealValue[] {
  const seen = new Set<string>();
  const values: RealValue[] = [];
  const attrRe = new RegExp(
    `\\b(${GUARDED_ATTRIBUTES.join("|")})\\s*=\\s*(?:"([^"]*)"|'([^']*)')`,
    "g",
  );
  for (const file of walk(facturasRoot, (p) => p.toLowerCase().endsWith(".xml"))) {
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(attrRe)) {
      const attribute = m[1] ?? "";
      const raw = m[2] ?? m[3] ?? "";
      for (const candidate of new Set([raw, decodeEntities(raw)])) {
        const value = candidate.trim();
        if (value.length < MIN_LENGTH) continue;
        if (attribute.startsWith("Rfc") && PUBLIC_RFCS.has(value.toUpperCase())) continue;
        const isUuid = attribute === "UUID" || attribute === "IdDocumento";
        const key = `${attribute}\u0000${isUuid ? value.toUpperCase() : value}`;
        if (seen.has(key)) continue;
        seen.add(key);
        values.push({ attribute, value, isUuid });
      }
    }
  }
  return values;
}

describe.skipIf(!hasFacturas)("tests/ y e2e/ no contienen identificadores reales", () => {
  it("ningun Rfc, Nombre, UUID ni certificado de Facturas/ aparece en tests/ ni e2e/", () => {
    const real = collectRealValues();
    expect(real.length).toBeGreaterThan(0);

    const roots = [resolve(process.cwd(), "tests"), resolve(process.cwd(), "e2e")];
    const files = roots.flatMap((root) => walk(root, () => true));
    // e2e/ only exists from a later plan; tests/ always has at least this file.
    expect(files.length).toBeGreaterThan(0);

    const leaks: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      const upper = text.toUpperCase();
      const reported = new Set<string>();
      for (const { attribute, value, isUuid } of real) {
        const hit = isUuid ? upper.includes(value.toUpperCase()) : text.includes(value);
        if (hit && !reported.has(attribute)) {
          reported.add(attribute);
          leaks.push(`${relative(process.cwd(), file)} contains a real ${attribute} value`);
        }
      }
    }
    expect(leaks).toEqual([]);
  });
});
