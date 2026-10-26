import Big from "big.js";
import { describe, expect, it } from "vitest";
import { ZERO } from "@/domain/accounting/decimal";
import { ruleMapKey } from "@/domain/settings/normalize";
import type { ContentCorrection } from "@/domain/settings/types";
import { makeProduct } from "../../../tests/support/pricesFactory";
import { comparePrices, compareProduct, median, type ProductComparison } from "./compare";
import type { Purchase } from "./purchases";

const RFC_A = "AAA010101AAA";
const RFC_B = "BBB010101BBB";
const RFC_C = "CCC010101CCC";
const RFC_Z = "ZZZ010101ZZZ";
const NAME_A = "Tienda Alfa";
const NAME_B = "Tienda Beta";
const NAME_C = "Tienda Gama";

const PRODUCT = makeProduct("Azúcar", [
  { rfc: RFC_A, descripcion: "AZUCAR", supplierName: NAME_A },
  { rfc: RFC_B, descripcion: "AZUCAR", supplierName: NAME_B },
]);

interface Buy {
  /** SAT unit; defaults to KGM. */
  unidad?: string;
  cantidad?: string;
  /** Net amount of the line; null is an unusable amount. */
  amount?: string | null;
  fecha?: string;
}

let sequence = 0;

/** A purchase of the product at a store, built directly (the ledger rules are pinned elsewhere). */
function buy(rfc: string, name: string, options: Buy = {}): Purchase {
  sequence += 1;
  const amount = options.amount === undefined ? "10.00" : options.amount;
  return {
    productId: PRODUCT.id,
    productName: PRODUCT.name,
    storeRfc: rfc,
    storeName: name,
    memberKey: `${rfc}\u0000azucar`,
    descripcion: "AZUCAR",
    claveProdServ: "50161800",
    claveUnidad: options.unidad ?? "KGM",
    cantidad: options.cantidad ?? "1",
    fecha: options.fecha ?? "2025-01-15T10:00:00",
    folio: null,
    uuid: `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
    conceptIndex: 0,
    amount: amount === null ? null : new Big(amount),
  };
}

/** Price of kg for a store: `quantity` kg at a total of `amount`. */
function kg(rfc: string, name: string, cantidad: string, amount: string, fecha?: string): Purchase {
  return buy(rfc, name, { cantidad, amount, ...(fecha === undefined ? {} : { fecha }) });
}

function reasonsOf(row: ProductComparison): string[] {
  return row.purchases.flatMap((purchase) =>
    purchase.status === "not-normalized" ? [purchase.reason] : [],
  );
}

function storeNames(row: ProductComparison): string[] {
  return row.stores.map((store) => store.name);
}

describe("median", () => {
  it("is null for an empty list and the middle value for an odd count", () => {
    expect(median([])).toBeNull();
    expect(median([new Big("3"), new Big("5"), new Big("9")])?.toString()).toBe("5");
  });

  it("is the exact mean of the two middle values for an even count", () => {
    const values = ["10", "20", "30", "40"].map((value) => new Big(value));
    expect(median(values)?.toString()).toBe("25");
    expect(median([new Big("0.01"), new Big("0.02")])?.toString()).toBe("0.015");
  });
});

describe("compareProduct: two stores of one family (PREC-01, PREC-04, PREC-05)", () => {
  const purchases = [kg(RFC_A, NAME_A, "2", "100.00"), kg(RFC_B, NAME_B, "1", "60.00")];

  it("compares in mass, sorts the stores by median and picks the cheapest", () => {
    const row = compareProduct(PRODUCT, purchases);
    expect(row.family).toBe("mass");
    expect(row.perPiece).toBe(false);
    expect(storeNames(row)).toEqual([NAME_A, NAME_B]);
    expect(row.stores.map((s) => s.median.toString())).toEqual(["50", "60"]);
    expect(row.cheapest?.rfc).toBe(RFC_A);
    expect(row.decidedByCount).toBe(false);
  });

  it("estimates the saving as (60 - 50) x 1 kg and adds it to the summary", () => {
    const { rows, summary } = comparePrices([PRODUCT], purchases);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.saving?.toString()).toBe("10");
    expect(summary.total.toString()).toBe("10");
    expect(summary.products).toBe(1);
    expect(summary.perPieceProducts).toBe(0);
  });

  it("has no cheapest store, no saving and a zero summary with a single store", () => {
    const only = [kg(RFC_A, NAME_A, "2", "100.00"), kg(RFC_A, NAME_A, "1", "40.00")];
    const { rows, summary } = comparePrices([PRODUCT], only);
    const [row] = rows;
    expect(row?.stores).toHaveLength(1);
    expect(row?.cheapest).toBeNull();
    expect(row?.saving).toBeNull();
    expect(row?.decidedByCount).toBe(false);
    expect(summary.total.eq(ZERO)).toBe(true);
    expect(summary.products).toBe(0);
  });

  it("has no stores at all when no purchase can be normalized", () => {
    const row = compareProduct(PRODUCT, [buy(RFC_A, NAME_A, { unidad: "MTR" })]);
    expect(row.family).toBeNull();
    expect(row.stores).toEqual([]);
    expect(row.cheapest).toBeNull();
    expect(row.saving).toBeNull();
    expect(row.perPiece).toBe(false);
  });
});

describe("compareProduct: per piece and unsized pieces (D-10)", () => {
  const piece = (rfc: string, name: string, cantidad: string, amount: string) =>
    buy(rfc, name, { unidad: "H87", cantidad, amount });

  it("compares per piece when every purchase is a piece without size", () => {
    const row = compareProduct(PRODUCT, [
      piece(RFC_A, NAME_A, "12", "60.00"),
      piece(RFC_B, NAME_B, "12", "48.00"),
    ]);
    expect(row.family).toBe("piece");
    expect(row.perPiece).toBe(true);
    expect(row.cheapest?.rfc).toBe(RFC_B);
    expect(row.stores.map((s) => s.median.toString())).toEqual(["4", "5"]);
    expect(row.saving?.toString()).toBe("12");
  });

  it("turns unsized pieces into unsized-with-sized-siblings when a purchase has a size", () => {
    const row = compareProduct(PRODUCT, [
      piece(RFC_A, NAME_A, "12", "60.00"),
      piece(RFC_B, NAME_B, "12", "48.00"),
      kg(RFC_C, NAME_C, "2", "30.00"),
    ]);
    expect(row.family).toBe("mass");
    expect(row.perPiece).toBe(false);
    expect(reasonsOf(row)).toEqual([
      "unsized-with-sized-siblings",
      "unsized-with-sized-siblings",
    ]);
    expect(row.notNormalizedCount).toBe(2);
    expect(row.otherFamilies).toEqual([]);
    expect(storeNames(row)).toEqual([NAME_C]);
    expect(row.cheapest).toBeNull();
  });
});

describe("compareProduct: several families (D-12, D-29)", () => {
  const litre = (rfc: string, name: string, amount: string) =>
    buy(rfc, name, { unidad: "LTR", cantidad: "1", amount });

  it("compares the family with more purchases and lists the dropped one", () => {
    const row = compareProduct(PRODUCT, [
      kg(RFC_A, NAME_A, "1", "10.00"),
      kg(RFC_A, NAME_A, "1", "11.00"),
      kg(RFC_A, NAME_A, "1", "12.00"),
      litre(RFC_B, NAME_B, "9.00"),
      litre(RFC_C, NAME_C, "8.00"),
    ]);
    expect(row.family).toBe("mass");
    expect(row.otherFamilies).toEqual([{ family: "volume", count: 2 }]);
    expect(reasonsOf(row)).toEqual(["other-family", "other-family"]);
    expect(row.notNormalizedCount).toBe(2);
    expect(row.stores).toHaveLength(1);
  });

  it("breaks an equal count of purchases by the family with more distinct stores", () => {
    const row = compareProduct(PRODUCT, [
      kg(RFC_A, NAME_A, "1", "10.00"),
      kg(RFC_A, NAME_A, "1", "11.00"),
      litre(RFC_B, NAME_B, "9.00"),
      litre(RFC_C, NAME_C, "8.00"),
    ]);
    expect(row.family).toBe("volume");
    expect(row.otherFamilies).toEqual([{ family: "mass", count: 2 }]);
    expect(storeNames(row)).toEqual([NAME_C, NAME_B]);
    expect(reasonsOf(row)).toEqual(["other-family", "other-family"]);
  });

  it("breaks a remaining tie in the fixed order kg, L, pieza", () => {
    const row = compareProduct(PRODUCT, [
      litre(RFC_B, NAME_B, "9.00"),
      kg(RFC_A, NAME_A, "1", "10.00"),
    ]);
    expect(row.family).toBe("mass");
    expect(row.otherFamilies).toEqual([{ family: "volume", count: 1 }]);

    // An unsized piece never competes with a sized family: D-10 drops it first, as unsized.
    const pieceAndLitre = compareProduct(PRODUCT, [
      buy(RFC_A, NAME_A, { unidad: "H87", amount: "5.00" }),
      litre(RFC_B, NAME_B, "9.00"),
    ]);
    expect(pieceAndLitre.family).toBe("volume");
    expect(pieceAndLitre.otherFamilies).toEqual([]);
    expect(reasonsOf(pieceAndLitre)).toEqual(["unsized-with-sized-siblings"]);
  });

  it("never lets a dropped family reach a price, the cheapest store or the saving", () => {
    const row = compareProduct(PRODUCT, [
      kg(RFC_A, NAME_A, "1", "10.00"),
      kg(RFC_B, NAME_B, "1", "14.00"),
      kg(RFC_B, NAME_B, "1", "16.00"),
      litre(RFC_C, NAME_C, "1.00"),
    ]);
    expect(row.family).toBe("mass");
    expect(storeNames(row)).toEqual([NAME_A, NAME_B]);
    expect(row.cheapest?.rfc).toBe(RFC_A);
    // Only the two purchases of B above A's median: (14 - 10) + (16 - 10).
    expect(row.saving?.toString()).toBe("10");
  });
});

describe("compareProduct: purchases that cannot be normalized (D-26)", () => {
  it("gives zero-amount for a net amount of exactly 0", () => {
    const row = compareProduct(PRODUCT, [buy(RFC_A, NAME_A, { amount: "0.00" })]);
    expect(reasonsOf(row)).toEqual(["zero-amount"]);
  });

  it("gives bad-amount for a negative or unusable net amount", () => {
    const row = compareProduct(PRODUCT, [
      buy(RFC_A, NAME_A, { amount: "-5.00" }),
      buy(RFC_A, NAME_A, { amount: null }),
    ]);
    expect(reasonsOf(row)).toEqual(["bad-amount", "bad-amount"]);
  });

  it("gives bad-quantity and unit-unknown without a family or content", () => {
    const row = compareProduct(PRODUCT, [
      buy(RFC_A, NAME_A, { cantidad: "0" }),
      buy(RFC_A, NAME_A, { unidad: "MTR" }),
    ]);
    expect(reasonsOf(row).sort()).toEqual(["bad-quantity", "unit-unknown"]);
    for (const purchase of row.purchases) {
      if (purchase.status === "not-normalized") {
        expect(purchase.family).toBeNull();
        expect(purchase.content).toBeNull();
      }
    }
  });

  it("reads the content before the amount: an unknown unit wins over a bad amount", () => {
    const row = compareProduct(PRODUCT, [buy(RFC_A, NAME_A, { unidad: "MTR", amount: "0.00" })]);
    expect(reasonsOf(row)).toEqual(["unit-unknown"]);
  });

  it("keeps every one of them out of min, median, last, count and saving", () => {
    const row = compareProduct(PRODUCT, [
      kg(RFC_A, NAME_A, "1", "10.00", "2025-01-10T10:00:00"),
      buy(RFC_A, NAME_A, { amount: "0.00", fecha: "2025-03-01T10:00:00" }),
      buy(RFC_A, NAME_A, { amount: "-5.00", fecha: "2025-03-02T10:00:00" }),
      buy(RFC_A, NAME_A, { amount: null, fecha: "2025-03-03T10:00:00" }),
      buy(RFC_A, NAME_A, { cantidad: "0", fecha: "2025-03-04T10:00:00" }),
      buy(RFC_A, NAME_A, { unidad: "MTR", fecha: "2025-03-05T10:00:00" }),
      kg(RFC_B, NAME_B, "1", "15.00"),
    ]);
    const store = row.stores.find((s) => s.rfc === RFC_A);
    expect(store?.count).toBe(1);
    expect(store?.min.toString()).toBe("10");
    expect(store?.median.toString()).toBe("10");
    expect(store?.last.toString()).toBe("10");
    expect(store?.lastFecha).toBe("2025-01-10T10:00:00");
    expect(row.notNormalizedCount).toBe(5);
    expect(row.saving?.toString()).toBe("5");
  });
});

describe("compareProduct: statistics per store (PREC-01)", () => {
  it("holds min, exact even-count median, last price and count", () => {
    const row = compareProduct(PRODUCT, [
      kg(RFC_A, NAME_A, "1", "30.00", "2025-02-01T10:00:00"),
      kg(RFC_A, NAME_A, "1", "10.00", "2025-04-01T10:00:00"),
      kg(RFC_A, NAME_A, "1", "40.00", "2025-01-01T10:00:00"),
      kg(RFC_A, NAME_A, "1", "20.00", "2025-03-01T10:00:00"),
      kg(RFC_B, NAME_B, "1", "99.00"),
    ]);
    const store = row.stores.find((s) => s.rfc === RFC_A);
    expect(store?.count).toBe(4);
    expect(store?.min.toString()).toBe("10");
    expect(store?.median.toString()).toBe("25");
  });

  it("takes the last price from the largest literal fecha even when it is not last in the input", () => {
    const row = compareProduct(PRODUCT, [
      kg(RFC_A, NAME_A, "1", "20.00", "2025-06-30T08:00:00"),
      kg(RFC_A, NAME_A, "1", "10.00", "2025-01-02T08:00:00"),
      kg(RFC_A, NAME_A, "1", "15.00", "2025-03-03T08:00:00"),
      kg(RFC_B, NAME_B, "1", "99.00"),
    ]);
    const store = row.stores.find((s) => s.rfc === RFC_A);
    expect(store?.last.toString()).toBe("20");
    expect(store?.lastFecha).toBe("2025-06-30T08:00:00");
  });

  it("keeps the price unrounded: 10 over 3 kg", () => {
    const row = compareProduct(PRODUCT, [
      kg(RFC_A, NAME_A, "3", "10.00"),
      kg(RFC_B, NAME_B, "1", "20.00"),
    ]);
    const price = row.stores.find((s) => s.rfc === RFC_A)?.median;
    expect(price?.round(4).toString()).toBe("3.3333");
    expect(price?.toString().length).toBeGreaterThan(8);
  });

  it("orders the purchases by fecha descending", () => {
    const row = compareProduct(PRODUCT, [
      kg(RFC_A, NAME_A, "1", "10.00", "2025-01-01T10:00:00"),
      buy(RFC_B, NAME_B, { amount: "0.00", fecha: "2025-05-01T10:00:00" }),
      kg(RFC_B, NAME_B, "1", "12.00", "2025-03-01T10:00:00"),
    ]);
    expect(row.purchases.map((p) => p.fecha)).toEqual([
      "2025-05-01T10:00:00",
      "2025-03-01T10:00:00",
      "2025-01-01T10:00:00",
    ]);
  });
});

describe("compareProduct: the cheapest store and its ties (D-20, D-30, D-02)", () => {
  it("breaks equal medians with the store with more purchases and flags decidedByCount", () => {
    // The store with more purchases is the later one alphabetically, so only the count decides.
    const row = compareProduct(PRODUCT, [
      kg(RFC_A, NAME_A, "1", "10.00"),
      kg(RFC_B, NAME_B, "1", "10.00"),
      kg(RFC_B, NAME_B, "1", "10.00"),
      kg(RFC_B, NAME_B, "1", "10.00"),
    ]);
    expect(row.cheapest?.rfc).toBe(RFC_B);
    expect(row.cheapest?.count).toBe(3);
    expect(row.decidedByCount).toBe(true);
    expect(storeNames(row)).toEqual([NAME_B, NAME_A]);
    expect(row.saving?.toString()).toBe("0");
  });

  it("breaks equal medians and counts by the Spanish alphabetical order of the store name", () => {
    const row = compareProduct(PRODUCT, [
      kg(RFC_Z, "Zapata", "1", "10.00"),
      kg(RFC_A, "Abarrotes Ñandú", "1", "10.00"),
    ]);
    expect(row.cheapest?.name).toBe("Abarrotes Ñandú");
    expect(row.decidedByCount).toBe(false);
    expect(storeNames(row)).toEqual(["Abarrotes Ñandú", "Zapata"]);
  });

  it("lets a store with one single purchase be the cheapest", () => {
    const row = compareProduct(PRODUCT, [
      kg(RFC_A, NAME_A, "1", "5.00"),
      kg(RFC_B, NAME_B, "1", "8.00"),
      kg(RFC_B, NAME_B, "1", "8.00"),
      kg(RFC_B, NAME_B, "1", "8.00"),
    ]);
    expect(row.cheapest?.rfc).toBe(RFC_A);
    expect(row.cheapest?.count).toBe(1);
    expect(row.decidedByCount).toBe(false);
    expect(row.saving?.toString()).toBe("9");
  });

  it("compares unrounded medians: a difference below a centavo still decides", () => {
    const row = compareProduct(PRODUCT, [
      kg(RFC_A, NAME_A, "1", "10.004"),
      kg(RFC_B, NAME_B, "1", "10.003"),
    ]);
    expect(row.cheapest?.rfc).toBe(RFC_B);
    expect(row.decidedByCount).toBe(false);
  });
});

describe("compareProduct: the estimated saving (D-21)", () => {
  it("never adds the purchases of the cheapest store, even those above its median", () => {
    const row = compareProduct(PRODUCT, [
      kg(RFC_A, NAME_A, "1", "10.00"),
      kg(RFC_A, NAME_A, "1", "10.00"),
      kg(RFC_A, NAME_A, "1", "30.00"),
      kg(RFC_B, NAME_B, "1", "14.00"),
    ]);
    expect(row.cheapest?.rfc).toBe(RFC_A);
    expect(row.saving?.toString()).toBe("4");
  });

  it("adds nothing for a purchase of another store that is cheaper than the cheapest median", () => {
    const row = compareProduct(PRODUCT, [
      kg(RFC_A, NAME_A, "1", "10.00"),
      kg(RFC_B, NAME_B, "1", "4.00"),
      kg(RFC_B, NAME_B, "1", "20.00"),
      kg(RFC_B, NAME_B, "1", "21.00"),
    ]);
    expect(row.cheapest?.rfc).toBe(RFC_A);
    // B has a median of 20, so A is the cheapest; the 4.00 purchase is below 10 and adds nothing.
    expect(row.saving?.toString()).toBe("21");
  });

  it("multiplies each difference by the content and does not round", () => {
    const row = compareProduct(PRODUCT, [
      kg(RFC_A, NAME_A, "1", "10.00"),
      kg(RFC_B, NAME_B, "2", "20.01"),
    ]);
    // Price 10.005 per kg over 2 kg against a median of 10: 0.005 x 2.
    expect(row.saving?.toString()).toBe("0.01");
  });

  it("sums the differences over several stores", () => {
    const row = compareProduct(PRODUCT, [
      kg(RFC_A, NAME_A, "1", "10.00"),
      kg(RFC_B, NAME_B, "2", "30.00"),
      kg(RFC_C, NAME_C, "4", "100.00"),
    ]);
    // B: (15 - 10) x 2 = 10; C: (25 - 10) x 4 = 60.
    expect(row.saving?.toString()).toBe("70");
  });
});

describe("comparePrices: rows and savings summary (D-22, D-23)", () => {
  const OTHER = makeProduct("Huevo", [{ rfc: RFC_A, descripcion: "HUEVO BLANCO", supplierName: NAME_A }]);
  const PIECES = makeProduct("Servilleta", [
    { rfc: RFC_A, descripcion: "SERVILLETA BLANCA", supplierName: NAME_A },
  ]);

  function forProduct(productId: string, purchase: Purchase): Purchase {
    return { ...purchase, productId };
  }

  it("totals only the products with 2 or more stores and counts the per-piece ones", () => {
    const sugar = [kg(RFC_A, NAME_A, "1", "10.00"), kg(RFC_B, NAME_B, "1", "16.00")];
    const napkins = [
      forProduct(PIECES.id, buy(RFC_A, NAME_A, { unidad: "H87", cantidad: "100", amount: "50.00" })),
      forProduct(PIECES.id, buy(RFC_B, NAME_B, { unidad: "H87", cantidad: "100", amount: "40.00" })),
    ];
    const eggs = [forProduct(OTHER.id, buy(RFC_A, NAME_A, { unidad: "H87", cantidad: "30", amount: "90.00" }))];
    const { rows, summary } = comparePrices([PRODUCT, OTHER, PIECES], [...sugar, ...eggs, ...napkins]);

    expect(rows.map((row) => row.name)).toEqual(["Azúcar", "Huevo", "Servilleta"]);
    expect(rows[1]?.cheapest).toBeNull();
    expect(rows[1]?.saving).toBeNull();
    expect(rows[2]?.perPiece).toBe(true);
    // Sugar saves 6, napkins save (0.5 - 0.4) x 100 = 10, the egg product adds nothing.
    expect(summary.total.toString()).toBe("16");
    expect(summary.products).toBe(2);
    expect(summary.perPieceProducts).toBe(1);
  });

  it("does not count a per-piece product with a single store", () => {
    const eggs = [forProduct(OTHER.id, buy(RFC_A, NAME_A, { unidad: "H87", amount: "5.00" }))];
    const { summary } = comparePrices([OTHER], eggs);
    expect(summary.products).toBe(0);
    expect(summary.perPieceProducts).toBe(0);
    expect(summary.total.eq(ZERO)).toBe(true);
  });

  it("leaves out the products without purchases and ignores purchases of unknown products", () => {
    const stray = forProduct("prod-desconocido", kg(RFC_A, NAME_A, "1", "10.00"));
    const { rows } = comparePrices([PRODUCT, OTHER], [stray]);
    expect(rows).toEqual([]);
  });

  it("counts the not-normalized purchases of each row", () => {
    const { rows } = comparePrices(
      [PRODUCT],
      [
        kg(RFC_A, NAME_A, "1", "10.00"),
        buy(RFC_A, NAME_A, { amount: "0.00" }),
        buy(RFC_B, NAME_B, { unidad: "MTR" }),
      ],
    );
    expect(rows[0]?.notNormalizedCount).toBe(2);
  });
});

describe("compareProduct and comparePrices with content corrections (D-09 step 1, D-13, D-28)", () => {
  const EGGS = makeProduct("Huevo", [
    { rfc: RFC_A, descripcion: "HUEVO BLANCO", supplierName: NAME_A },
    { rfc: RFC_B, descripcion: "HUEVO BLANCO", supplierName: NAME_B },
  ]);

  function egg(rfc: string, name: string, amount: string, cantidad = "1"): Purchase {
    return {
      ...buy(rfc, name, { unidad: "H87", cantidad, amount }),
      productId: EGGS.id,
      productName: EGGS.name,
      memberKey: ruleMapKey(rfc, "huevo blanco"),
      descripcion: "HUEVO BLANCO",
    };
  }

  function fix(rfc: string, overrides: Partial<ContentCorrection> = {}): ContentCorrection {
    return {
      rfc,
      key: "huevo blanco",
      description: "HUEVO BLANCO",
      supplierName: "Tienda",
      packs: 1,
      amount: "12",
      unit: "piezas",
      ...overrides,
    };
  }

  function mapOf(...corrections: ContentCorrection[]): Map<string, ContentCorrection> {
    return new Map(corrections.map((c) => [ruleMapKey(c.rfc, c.key), c]));
  }

  const PURCHASES = [egg(RFC_A, NAME_A, "60.00"), egg(RFC_B, NAME_B, "50.00")];

  it("without the argument the result equals the one with an empty map", () => {
    const plain = compareProduct(EGGS, PURCHASES);
    expect(compareProduct(EGGS, PURCHASES, new Map())).toEqual(plain);
    expect(plain.perPiece).toBe(true);
  });

  it("a correction on one member makes the other unsized-with-sized-siblings and ends per piece (D-28)", () => {
    const row = compareProduct(EGGS, PURCHASES, mapOf(fix(RFC_A)));
    expect(row.perPiece).toBe(false);
    expect(row.family).toBe("piece");
    expect(storeNames(row)).toEqual([NAME_A]);
    expect(reasonsOf(row)).toEqual(["unsized-with-sized-siblings"]);
    const compared = row.purchases.find((p) => p.status === "compared" && p.storeRfc === RFC_A);
    expect(compared?.status === "compared" && compared.source).toBe("user");
    expect(compared?.status === "compared" && compared.price.toString()).toBe("5");
  });

  it("a correction on both members compares them by their typed content", () => {
    const row = compareProduct(
      EGGS,
      PURCHASES,
      mapOf(fix(RFC_A, { amount: "12" }), fix(RFC_B, { amount: "18" })),
    );
    expect(row.perPiece).toBe(false);
    expect(row.stores.map((s) => [s.name, s.median.toString()])).toEqual([
      [NAME_B, "2.777777777777777778"],
      [NAME_A, "5"],
    ]);
    expect(row.cheapest?.name).toBe(NAME_B);
  });

  it("a correction of one RFC does not apply to the same description of another RFC", () => {
    const row = compareProduct(EGGS, PURCHASES, mapOf(fix(RFC_C)));
    expect(row.perPiece).toBe(true);
    expect(reasonsOf(row)).toEqual([]);
  });

  it("the correction does not touch weight lines of the same member", () => {
    const kgLine: Purchase = { ...buy(RFC_B, NAME_B, { unidad: "KGM", cantidad: "2", amount: "40.00" }),
      productId: EGGS.id,
      productName: EGGS.name,
      memberKey: ruleMapKey(RFC_B, "huevo blanco"),
      descripcion: "HUEVO BLANCO",
    };
    const row = compareProduct(EGGS, [kgLine, egg(RFC_B, NAME_B, "50.00")], mapOf(fix(RFC_B, { unit: "kg", amount: "1" })));
    const sources = row.purchases.map((p) => (p.status === "compared" ? p.source : p.status));
    expect(sources.sort()).toEqual(["user", "xml"]);
  });

  it("comparePrices passes the corrections to every row", () => {
    const { rows, summary } = comparePrices([EGGS], PURCHASES, mapOf(fix(RFC_A), fix(RFC_B, { amount: "24" })));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.perPiece).toBe(false);
    expect(rows[0]?.cheapest?.name).toBe(NAME_B);
    expect(summary.perPieceProducts).toBe(0);
    expect(summary.products).toBe(1);
    expect(comparePrices([EGGS], PURCHASES).summary.perPieceProducts).toBe(1);
  });
});
