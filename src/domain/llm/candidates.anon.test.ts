// @vitest-environment jsdom
import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loaded, TEST_FECHA_CONTEXT } from "../../../tests/support/ledgerFactory";
import { readFixture } from "../../../tests/support/cfdiVariants";
import { EMPTY_OVERRIDES, buildLedger, type LedgerEntry } from "../accounting/ledger";
import { parseCfdi } from "../cfdi/parseCfdi";
import type { ParsedInvoice } from "../cfdi/types";
import { SEED_CATEGORIES, type Product } from "../settings/types";
import {
  buildCategorizeRun,
  buildGroupRun,
  collectCategorizeTargets,
  collectItems,
  isSensitive,
} from "./candidates";
import { categorizeRequestSchema, groupRequestSchema } from "./contract";
import { emptyQueue } from "./suggestions";

// LLM-03, D-05, T-04-40: built from the anonymized CFDI fixtures, the serialized bodies of both
// flows carry no identifier of those invoices. The fixtures use public SAT generic RFCs and
// synthetic names only (tests/fixtures.guard.test.ts keeps it so).

const ANON_DIR = resolve(process.cwd(), "tests/fixtures/cfdi/anon");

function parseOk(xml: string): ParsedInvoice {
  const result = parseCfdi(xml);
  if (!result.ok) {
    throw new Error(`expected ok, got ${result.reason} ${result.detail ?? ""}`);
  }
  return result.invoice;
}

const FIXTURES = readdirSync(ANON_DIR)
  .filter((name) => name.endsWith(".xml"))
  .sort()
  .map((name) => parseOk(readFixture(`anon/${name}`)));

/**
 * The fixtures all share one supplier, so two more synthetic ones are derived from them: the same
 * documents with another emisor and fresh UUIDs. The ledger then has three suppliers.
 */
function withSupplier(index: number): ParsedInvoice[] {
  return FIXTURES.map((invoice, position) => ({
    ...invoice,
    uuid: `00000000-0000-4000-8000-0000000${String(index)}${String(position).padStart(5, "0")}`,
    emisor: { rfc: `ZZZ01010${String(index)}AA${String(index)}`, nombre: `PROVEEDOR ANONIMO ${String(index + 1)}` },
  }));
}

const INVOICES: ParsedInvoice[] = [...FIXTURES, ...withSupplier(1), ...withSupplier(2)];

const ENTRIES: LedgerEntry[] = buildLedger(
  INVOICES.map((invoice) => loaded(invoice)),
  EMPTY_OVERRIDES,
  TEST_FECHA_CONTEXT,
);

/** Every string value of a JSON-shaped value. */
function stringsOf(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(stringsOf);
  if (typeof value === "object" && value !== null) return Object.values(value).flatMap(stringsOf);
  return [];
}

/**
 * What a body must never carry for these invoices. Identifiers are searched as substrings (a UUID
 * in either case, an RFC, a date with or without its time, a folio of 4 or more characters);
 * amounts and shorter folios are compared with whole string values, because "0" or "1000" would
 * otherwise match any id or count.
 */
function identifiers(invoices: readonly ParsedInvoice[]) {
  const inside = new Set<string>();
  const exact = new Set<string>();
  for (const invoice of invoices) {
    inside.add(invoice.emisor.rfc);
    inside.add(invoice.receptor.rfc);
    inside.add(invoice.uuid.toLowerCase());
    inside.add(invoice.fecha);
    inside.add(invoice.fecha.slice(0, 10));
    if (invoice.folio !== null) {
      if (invoice.folio.length >= 4) inside.add(invoice.folio);
      else exact.add(invoice.folio);
    }
    for (const amount of [invoice.subTotal, invoice.total, invoice.descuento]) {
      if (amount !== null) exact.add(amount);
    }
    for (const concepto of invoice.conceptos) {
      exact.add(concepto.valorUnitario);
      exact.add(concepto.importe);
    }
  }
  return { inside: [...inside], exact: [...exact] };
}

function expectNoIdentifier(body: unknown): void {
  const { inside, exact } = identifiers(INVOICES);
  const strings = stringsOf(JSON.parse(JSON.stringify(body)));
  expect(strings.length).toBeGreaterThan(0);
  for (const text of strings) {
    for (const forbidden of inside) {
      expect(text.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
    expect(exact).not.toContain(text);
  }
}

function productsOf(entries: readonly LedgerEntry[]): Product[] {
  const items = collectItems(entries);
  const byRfc = new Map<string, typeof items>();
  for (const item of items) byRfc.set(item.rfc, [...(byRfc.get(item.rfc) ?? []), item]);
  return [...byRfc.values()].map((members, index) => ({
    id: `prod_${String(index + 1)}`,
    name: `PRODUCTO ANONIMO ${String(index + 1)}`,
    categoryId: null,
    members: members.map((item) => ({
      rfc: item.rfc,
      key: item.key,
      description: item.description,
      supplierName: item.supplierName,
    })),
  }));
}

describe("the anonymized fixtures", () => {
  it("are loaded: the fixtures and their copies give three suppliers in the ledger", () => {
    expect(FIXTURES.length).toBeGreaterThan(0);
    expect(new Set(ENTRIES.map((entry) => entry.supplierRfc)).size).toBe(
      new Set(FIXTURES.map((invoice) => invoice.emisor.rfc)).size + 2,
    );
  });

  it("carry nothing that the sensitive-pattern guard would hold back (names and descriptions are synthetic)", () => {
    for (const item of collectItems(ENTRIES)) {
      expect(isSensitive(item.description)).toBe(false);
      expect(isSensitive(item.supplierName)).toBe(false);
    }
  });
});

describe("the grouping bodies built from the anonymized invoices (LLM-03, D-05)", () => {
  const items = collectItems(ENTRIES);
  const products = productsOf(ENTRIES);
  const run = buildGroupRun(
    items,
    products.map((product) => ({ productId: product.id, name: product.name })),
    5,
  );

  it("travel as several batches, valid for the route's own schema", () => {
    expect(run.batches.length).toBeGreaterThan(1);
    expect(run.withheld).toEqual([]);
    for (const batch of run.batches) {
      expect(groupRequestSchema.safeParse(JSON.parse(JSON.stringify(batch.body))).success).toBe(true);
    }
  });

  it("contain no emisor or receptor RFC, UUID, folio, fecha or amount of those invoices", () => {
    for (const batch of run.batches) expectNoIdentifier(batch.body);
  });

  it("do contain the synthetic descriptions, supplier names and product names", () => {
    const strings = run.batches.flatMap((batch) => stringsOf(batch.body));
    expect(strings).toContain("CONCEPTO 1");
    expect(strings).toContain("PROVEEDOR ANONIMO 1");
    expect(strings).toContain("PROVEEDOR ANONIMO 3");
    expect(strings).toContain("PRODUCTO ANONIMO 1");
  });
});

describe("the categorize bodies built from the anonymized invoices (LLM-03, D-05)", () => {
  const products = productsOf(ENTRIES);
  const targets = collectCategorizeTargets(
    ENTRIES,
    { categories: [...SEED_CATEGORIES], supplierCategories: [], products },
    emptyQueue(),
  );
  const run = buildCategorizeRun(targets, [...SEED_CATEGORIES], 4);

  it("ask for the three suppliers and the three products, in several batches valid for the route's schema", () => {
    expect(run.suppliers).toBe(3);
    expect(run.products).toBe(3);
    expect(run.withheld).toEqual([]);
    expect(run.batches.length).toBeGreaterThan(1);
    for (const batch of run.batches) {
      expect(categorizeRequestSchema.safeParse(JSON.parse(JSON.stringify(batch.body))).success).toBe(
        true,
      );
    }
  });

  it("contain no emisor or receptor RFC, UUID, folio, fecha or amount of those invoices", () => {
    for (const batch of run.batches) expectNoIdentifier(batch.body);
  });

  it("do contain the synthetic names, member descriptions and the user's categories", () => {
    const strings = run.batches.flatMap((batch) => stringsOf(batch.body));
    expect(strings).toContain("PROVEEDOR ANONIMO 2");
    expect(strings).toContain("PRODUCTO ANONIMO 1");
    expect(strings).toContain("CONCEPTO 1");
    expect(strings).toContain("Otros");
  });
});

describe("the check itself", () => {
  it("fails on a body that carries an identifier of the invoices", () => {
    const first = INVOICES[0];
    if (first === undefined) throw new Error("no fixture");
    expect(() => {
      expectNoIdentifier({ items: [{ id: "i1", description: `PAGO ${first.emisor.rfc}`, supplier: "x" }] });
    }).toThrow();
    expect(() => {
      expectNoIdentifier({ items: [{ id: "i1", description: "x", supplier: first.total }] });
    }).toThrow();
    expect(() => {
      expectNoIdentifier({ items: [{ id: "i1", description: first.uuid.toLowerCase(), supplier: "x" }] });
    }).toThrow();
  });
});
