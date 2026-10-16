// @vitest-environment jsdom
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loaded, TEST_FECHA_CONTEXT } from "../../../tests/support/ledgerFactory";
import { parseCfdi } from "../cfdi/parseCfdi";
import type { ParsedInvoice } from "../cfdi/types";
import { totalSpend } from "./aggregate";
import { EMPTY_OVERRIDES, PPD_SIN_COMPLEMENTO, buildLedger, type LedgerEntry } from "./ledger";

// Local identity test against the real 2025 sample. Facturas/ is gitignored, so
// the suite is skipped where the folder is absent (Vercel, CI, other machines).
// FACTURAS_DIR overrides the default <cwd>/Facturas (useful from git worktrees).
// Assertions are identities and counts only: no RFC, name, UUID or amount is
// ever asserted as a literal or printed, so comparisons are reduced to booleans.
const facturasRoot = process.env.FACTURAS_DIR ?? resolve(process.cwd(), "Facturas");
const sampleDir = join(facturasRoot, "2025");
const hasSample = existsSync(sampleDir);

// BigInt literals need target ES2020 and tsconfig targets ES2017, so use BigInt().
const ZERO_UNITS = BigInt(0);
const UNITS_PER_ONE = BigInt(1000000);

/** Integer micro-units of a plain decimal string (up to 6 decimals), without big.js. */
function microUnits(text: string): bigint {
  const match = /^(-?)(\d+)(?:\.(\d{1,6}))?$/.exec(text.trim());
  if (match === null) throw new Error("sample amount is not a plain decimal");
  const [, sign = "", integer = "0", fraction = ""] = match;
  const value = BigInt(integer) * UNITS_PER_ONE + BigInt(fraction.padEnd(6, "0"));
  return sign === "-" ? -value : value;
}

/** Parses the sample and dedupes by uuid keeping the first file, as the import does. */
function loadSample(): ParsedInvoice[] {
  const names = readdirSync(sampleDir)
    .filter((name) => name.toLowerCase().endsWith(".xml"))
    .sort();
  const byUuid = new Map<string, ParsedInvoice>();
  for (const name of names) {
    const result = parseCfdi(readFileSync(join(sampleDir, name), "utf8"));
    if (result.ok && !byUuid.has(result.invoice.uuid)) {
      byUuid.set(result.invoice.uuid, result.invoice);
    }
  }
  return [...byUuid.values()];
}

describe.skipIf(!hasSample)("ledger sobre la muestra real 2025", () => {
  // Lazy: describe.skipIf still runs this body when collecting, and the folder may be absent.
  let cache: { invoices: ParsedInvoice[]; entries: LedgerEntry[] } | null = null;
  function sample(): { invoices: ParsedInvoice[]; entries: LedgerEntry[] } {
    if (cache === null) {
      const invoices = loadSample();
      cache = { invoices, entries: buildLedger(invoices.map(loaded), EMPTY_OVERRIDES, TEST_FECHA_CONTEXT) };
    }
    return cache;
  }

  it("builds exactly one entry per invoice of the sample", () => {
    const { invoices, entries } = sample();
    expect(entries).toHaveLength(invoices.length);
    expect(invoices.length).toBeGreaterThan(0);
  });

  it("counted net with Con IVA equals an independent integer loop", () => {
    const { invoices, entries } = sample();
    let expected = ZERO_UNITS;
    for (const invoice of invoices) {
      const total = microUnits(invoice.total);
      if (invoice.tipo === "I" && total > ZERO_UNITS) expected += total;
      if (invoice.tipo === "E") expected -= total;
    }
    const net = totalSpend(entries, "con").times("1000000").toString();
    expect(net === expected.toString()).toBe(true);
  });

  it("counted Ingreso count equals the independent count of Ingreso above zero", () => {
    const { invoices, entries } = sample();
    const independent = invoices.filter(
      (invoice) => invoice.tipo === "I" && microUnits(invoice.total) > ZERO_UNITS,
    ).length;
    const counted = entries.filter((e) => e.counted && e.kind === "ingreso").length;
    expect(counted).toBe(independent);
  });

  it("has 8 PPD invoices and 7 of them resolve to a form of payment", () => {
    const { entries } = sample();
    const ppdEntries = entries.filter(
      (e) => e.invoice.metodoPago === "PPD" || e.invoice.formaPago === "99",
    );
    expect(ppdEntries).toHaveLength(8);
    const resolved = ppdEntries.filter(
      (e) => e.formas.length > 0 && !e.formas.includes(PPD_SIN_COMPLEMENTO),
    );
    expect(resolved).toHaveLength(7);
  });

  it("never sums Pago entries and flags every Total 0 Ingreso as cero", () => {
    const { entries } = sample();
    for (const entry of entries) {
      if (entry.kind === "pago") expect(entry.noSuma).toBe("tipo");
      if (entry.kind === "ingreso" && microUnits(entry.invoice.total) === ZERO_UNITS) {
        expect(entry.noSuma).toBe("cero");
      }
    }
  });
});
