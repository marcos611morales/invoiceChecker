// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { readFixture } from "../../../tests/support/cfdiVariants";
import { loaded, TEST_FECHA_CONTEXT } from "../../../tests/support/ledgerFactory";
import { makeProduct } from "../../../tests/support/pricesFactory";
import { scopeToCategories } from "../accounting/categories";
import { EMPTY_OVERRIDES, buildLedger } from "../accounting/ledger";
import { parseCfdi } from "../cfdi/parseCfdi";
import { makeResolver } from "../settings/resolver";
import { defaultSettings } from "../settings/types";
import { comparePrices, type ComparedPurchase, type ProductComparison } from "./compare";
import { extractPurchases, productIndex } from "./purchases";

// The size reader over XML: the anonymized fixture goes through parseCfdi, buildLedger,
// scopeToCategories, extractPurchases and comparePrices (Plan 05-05).

const RFC = "EKU9003173C9";
const SUPPLIER = "PROVEEDOR ANONIMO 2";

function compareFixture(mode: "con" | "sin") {
  const parsed = parseCfdi(readFixture("anon/anon-precios.xml"));
  if (!parsed.ok) throw new Error(`fixture does not parse: ${parsed.reason}`);
  const entries = buildLedger([loaded(parsed.invoice)], EMPTY_OVERRIDES, TEST_FECHA_CONTEXT);
  const scoped = scopeToCategories(entries, new Set<string>(), makeResolver(defaultSettings()));
  const products = [
    makeProduct("Leche", [
      { rfc: RFC, descripcion: "12/1L ALPURA", supplierName: SUPPLIER },
      { rfc: RFC, descripcion: "Leche LacDel Desla", supplierName: SUPPLIER },
    ]),
    makeProduct("Jamon", [
      {
        rfc: RFC,
        descripcion: "JAMON ZWAN VIRGINIA1X1KG & 10360 1/1 KG",
        supplierName: SUPPLIER,
      },
    ]),
    makeProduct("Toalla", [{ rfc: RFC, descripcion: "TOALLA DE PRUEBA", supplierName: SUPPLIER }]),
  ];
  const purchases = extractPurchases(scoped, mode, productIndex(products));
  return comparePrices(products, purchases);
}

function rowOf(rows: readonly ProductComparison[], name: string): ProductComparison {
  const row = rows.find((r) => r.name === name);
  if (row === undefined) throw new Error(`no row ${name}`);
  return row;
}

function purchaseOf(row: ProductComparison, descripcion: string): ComparedPurchase {
  const purchase = row.purchases.find((p) => p.descripcion === descripcion);
  if (purchase === undefined) throw new Error(`no purchase ${descripcion}`);
  return purchase;
}

describe.each(["con", "sin"] as const)("anon-precios.xml, IVA mode %s", (mode) => {
  const { rows } = compareFixture(mode);

  it("compares a product by litre when one purchase carries its size", () => {
    const leche = rowOf(rows, "Leche");
    expect(leche.family).toBe("volume");
    expect(leche.perPiece).toBe(false);
    const sized = purchaseOf(leche, "12/1L ALPURA");
    expect(sized.status).toBe("compared");
    if (sized.status !== "compared") return;
    expect(sized.family).toBe("volume");
    expect(sized.content.toString()).toBe("12");
    expect(sized.source).toBe("description");
    expect(sized.price.toString()).toBe("15");
  });

  it("leaves the unsized purchase out with the sized-siblings reason", () => {
    const leche = rowOf(rows, "Leche");
    const unsized = purchaseOf(leche, "Leche LacDel Desla");
    expect(unsized.status).toBe("not-normalized");
    if (unsized.status !== "not-normalized") return;
    expect(unsized.reason).toBe("unsized-with-sized-siblings");
    expect(unsized.family).toBe("piece");
    expect(unsized.content?.toString()).toBe("6");
    expect(leche.notNormalizedCount).toBe(1);
  });

  it("takes a KGM line from the XML quantity, not from the description", () => {
    const jamon = rowOf(rows, "Jamon");
    expect(jamon.family).toBe("mass");
    const line = purchaseOf(jamon, "JAMON ZWAN VIRGINIA1X1KG & 10360 1/1 KG");
    expect(line.status).toBe("compared");
    if (line.status !== "compared") return;
    expect(line.content.toString()).toBe("0.27");
    expect(line.source).toBe("xml");
    expect(line.sized).toBe(true);
  });

  it("does not normalize the line whose discount equals its amount", () => {
    const toalla = rowOf(rows, "Toalla");
    const line = purchaseOf(toalla, "TOALLA DE PRUEBA");
    expect(line.status).toBe("not-normalized");
    if (line.status !== "not-normalized") return;
    expect(line.reason).toBe("zero-amount");
  });
});
