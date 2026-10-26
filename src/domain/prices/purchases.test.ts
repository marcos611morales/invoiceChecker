import { describe, expect, it } from "vitest";
import { scopeToCategories, type ScopedEntry } from "@/domain/accounting/categories";
import { EMPTY_OVERRIDES, buildLedger, type LedgerOverrides } from "@/domain/accounting/ledger";
import type { Concepto, ParsedInvoice } from "@/domain/cfdi/types";
import { normalizeDescription, ruleMapKey } from "@/domain/settings/normalize";
import { makeResolver } from "@/domain/settings/resolver";
import { defaultSettings } from "@/domain/settings/types";
import { TEST_FECHA_CONTEXT, loaded } from "../../../tests/support/ledgerFactory";
import { makeConcepto, makeProduct, purchaseInvoice } from "../../../tests/support/pricesFactory";
import { extractPurchases, productIndex } from "./purchases";

const RFC_A = "AAA010101AAA";
const RFC_B = "BBB010101BBB";
const NAME_A = "Tienda Alfa";
const NAME_B = "Tienda Beta";
const AZUCAR = "AZÚCAR ESTÁNDAR";

/** Ledger entries the way the hook builds them: real ledger rules, empty category selection. */
function entriesOf(
  invoices: readonly ParsedInvoice[],
  overrides: LedgerOverrides = EMPTY_OVERRIDES,
): ScopedEntry[] {
  const ledger = buildLedger(invoices.map(loaded), overrides, TEST_FECHA_CONTEXT);
  return scopeToCategories(ledger, new Set<string>(), makeResolver(defaultSettings()));
}

function azucar(overrides: Partial<Concepto> = {}): Concepto {
  return makeConcepto({ descripcion: AZUCAR, claveUnidad: "KGM", ...overrides });
}

const PRODUCT = makeProduct("Azúcar", [
  { rfc: RFC_A, descripcion: AZUCAR, supplierName: NAME_A },
  { rfc: RFC_B, descripcion: AZUCAR, supplierName: NAME_B },
]);
const INDEX = productIndex([PRODUCT]);

describe("extractPurchases (D-02, D-04, D-05, D-06)", () => {
  it("makes a purchase of a concept line of a counted Ingreso whose member belongs to a product", () => {
    const invoice = purchaseInvoice({
      rfc: RFC_A,
      nombre: NAME_A,
      folio: "F-10",
      fecha: "2025-03-04T09:30:00",
      conceptos: [azucar({ cantidad: "2", importe: "100.00", claveProdServ: "50161800" })],
    });
    const purchases = extractPurchases(entriesOf([invoice]), "sin", INDEX);
    expect(purchases).toHaveLength(1);
    const [purchase] = purchases;
    expect(purchase).toMatchObject({
      productId: PRODUCT.id,
      productName: "Azúcar",
      storeRfc: RFC_A,
      storeName: NAME_A,
      descripcion: AZUCAR,
      claveProdServ: "50161800",
      claveUnidad: "KGM",
      cantidad: "2",
      folio: "F-10",
      uuid: invoice.uuid,
      conceptIndex: 0,
    });
    expect(purchase?.amount?.toString()).toBe("100");
  });

  it("keeps the literal invoice Fecha and the member identity key", () => {
    const invoice = purchaseInvoice({
      rfc: RFC_A,
      nombre: NAME_A,
      fecha: "2025-12-31T23:59:59",
      conceptos: [azucar()],
    });
    const [purchase] = extractPurchases(entriesOf([invoice]), "con", INDEX);
    expect(purchase?.fecha).toBe("2025-12-31T23:59:59");
    expect(purchase?.memberKey).toBe(ruleMapKey(RFC_A, normalizeDescription(AZUCAR)));
  });

  it("reads Con IVA and Sin IVA of a line with 16 % IVA: the two prices differ", () => {
    const iva = {
      base: "100.00",
      impuesto: "002",
      tipoFactor: "Tasa",
      tasaOCuota: "0.160000",
      importe: "16.00",
    };
    const invoice = purchaseInvoice({
      rfc: RFC_A,
      nombre: NAME_A,
      conceptos: [azucar({ importe: "100.00", traslados: [iva] })],
    });
    const entries = entriesOf([invoice]);
    const con = extractPurchases(entries, "con", INDEX)[0]?.amount;
    const sin = extractPurchases(entries, "sin", INDEX)[0]?.amount;
    expect(con?.toString()).toBe("116");
    expect(sin?.toString()).toBe("100");
  });

  it("adds IEPS to Sin IVA and applies the discount in both modes", () => {
    const ieps = {
      base: "90.00",
      impuesto: "003",
      tipoFactor: "Tasa",
      tasaOCuota: "0.080000",
      importe: "7.20",
    };
    const iva = {
      base: "97.20",
      impuesto: "002",
      tipoFactor: "Tasa",
      tasaOCuota: "0.160000",
      importe: "15.55",
    };
    const invoice = purchaseInvoice({
      rfc: RFC_A,
      nombre: NAME_A,
      conceptos: [azucar({ importe: "100.00", descuento: "10.00", traslados: [ieps, iva] })],
    });
    const entries = entriesOf([invoice]);
    expect(extractPurchases(entries, "sin", INDEX)[0]?.amount?.toString()).toBe("97.2");
    expect(extractPurchases(entries, "con", INDEX)[0]?.amount?.toString()).toBe("112.75");
  });

  it("does not make purchases from a credit note (kind nota-credito, counted)", () => {
    const note = purchaseInvoice({
      rfc: RFC_A,
      nombre: NAME_A,
      tipo: "E",
      conceptos: [azucar({ importe: "50.00" })],
    });
    const entries = entriesOf([note]);
    expect(entries[0]?.kind).toBe("nota-credito");
    expect(entries[0]?.counted).toBe(true);
    expect(extractPurchases(entries, "sin", INDEX)).toEqual([]);
    expect(extractPurchases(entries, "con", INDEX)).toEqual([]);
  });

  it("does not make purchases from an entry that is not counted", () => {
    const excluded = purchaseInvoice({ rfc: RFC_A, nombre: NAME_A, conceptos: [azucar()] });
    const kept = purchaseInvoice({ rfc: RFC_B, nombre: NAME_B, conceptos: [azucar()] });
    const entries = entriesOf([excluded, kept], {
      excluded: new Set([excluded.uuid]),
      restored: new Set<string>(),
    });
    expect(entries[0]?.counted).toBe(false);
    const purchases = extractPurchases(entries, "sin", INDEX);
    expect(purchases.map((p) => p.storeRfc)).toEqual([RFC_B]);
  });

  it("does not make purchases from a substituted invoice or from a $0 invoice", () => {
    const original = purchaseInvoice({ rfc: RFC_A, nombre: NAME_A, conceptos: [azucar()] });
    const replacement = {
      ...purchaseInvoice({ rfc: RFC_A, nombre: NAME_A, conceptos: [azucar()] }),
      relacionados: [{ tipoRelacion: "04", uuids: [original.uuid] }],
    };
    const free = purchaseInvoice({
      rfc: RFC_B,
      nombre: NAME_B,
      conceptos: [azucar({ importe: "0.00", valorUnitario: "0.00" })],
    });
    const entries = entriesOf([original, replacement, free]);
    expect(entries[0]?.exclusion).toBe("sustituida");
    expect(entries[2]?.counted).toBe(false);
    const purchases = extractPurchases(entries, "sin", INDEX);
    expect(purchases.map((p) => p.uuid)).toEqual([replacement.uuid]);
  });

  it("does not make purchases from a Pago", () => {
    const pago = { ...purchaseInvoice({ rfc: RFC_A, nombre: NAME_A, conceptos: [azucar()] }), tipo: "P" as const };
    const entries = entriesOf([pago]);
    expect(entries[0]?.kind).toBe("pago");
    expect(extractPurchases(entries, "sin", INDEX)).toEqual([]);
  });

  it("drops a concept whose member belongs to no accepted product", () => {
    const invoice = purchaseInvoice({
      rfc: RFC_A,
      nombre: NAME_A,
      conceptos: [azucar(), makeConcepto({ descripcion: "JABON LIQUIDO" })],
    });
    const purchases = extractPurchases(entriesOf([invoice]), "sin", INDEX);
    expect(purchases.map((p) => p.descripcion)).toEqual([AZUCAR]);
  });

  it("matches the member by supplier too: the same description at another RFC is not a member", () => {
    const stranger = purchaseInvoice({
      rfc: "CCC010101CCC",
      nombre: "Tienda Gama",
      conceptos: [azucar()],
    });
    expect(extractPurchases(entriesOf([stranger]), "sin", INDEX)).toEqual([]);
  });

  it("reports the concept index of each line in XML order", () => {
    const invoice = purchaseInvoice({
      rfc: RFC_A,
      nombre: NAME_A,
      conceptos: [makeConcepto({ descripcion: "JABON LIQUIDO" }), azucar()],
    });
    const [purchase] = extractPurchases(entriesOf([invoice]), "sin", INDEX);
    expect(purchase?.conceptIndex).toBe(1);
  });

  it("ignores the rounding-difference part, which has no concept", () => {
    const base = purchaseInvoice({ rfc: RFC_A, nombre: NAME_A, conceptos: [azucar()] });
    const rounded = { ...base, total: "100.01", subTotal: "100.01" };
    const entries = entriesOf([rounded]);
    expect(entries[0]?.parts.some((part) => part.concept === null)).toBe(true);
    const purchases = extractPurchases(entries, "sin", INDEX);
    expect(purchases).toHaveLength(1);
    expect(purchases[0]?.conceptIndex).toBe(0);
  });

  it("makes one store of two invoices of the same RFC with different branch names", () => {
    const first = purchaseInvoice({ rfc: RFC_A, nombre: "Tienda Alfa Centro", conceptos: [azucar()] });
    const second = purchaseInvoice({ rfc: RFC_A, nombre: "Tienda Alfa Norte", conceptos: [azucar()] });
    const third = purchaseInvoice({ rfc: RFC_A, nombre: "Tienda Alfa Norte", conceptos: [azucar()] });
    const entries = entriesOf([first, second, third]);
    const purchases = extractPurchases(entries, "sin", INDEX);
    expect(new Set(purchases.map((p) => p.storeRfc))).toEqual(new Set([RFC_A]));
    expect(purchases).toHaveLength(3);
    // storeName is the entry's supplierName: the most frequent Nombre of that RFC.
    for (const [position, purchase] of purchases.entries()) {
      expect(purchase.storeName).toBe(entries[position]?.supplierName);
      expect(purchase.storeName).toBe("Tienda Alfa Norte");
    }
  });

  it("gives an unusable amount as null instead of throwing", () => {
    const base = purchaseInvoice({ rfc: RFC_A, nombre: NAME_A, conceptos: [azucar()] });
    const broken = { ...base, conceptos: [azucar({ importe: "abc" })] };
    const [purchase] = extractPurchases(entriesOf([broken]), "sin", INDEX);
    expect(purchase).toBeDefined();
    expect(purchase?.amount).toBeNull();
  });
});

describe("productIndex", () => {
  it("indexes every member by RFC and normalized description", () => {
    expect(INDEX.get(ruleMapKey(RFC_A, normalizeDescription(AZUCAR)))?.id).toBe(PRODUCT.id);
    expect(INDEX.get(ruleMapKey(RFC_B, normalizeDescription(AZUCAR)))?.id).toBe(PRODUCT.id);
    expect(INDEX.size).toBe(2);
  });
});
