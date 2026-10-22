import { describe, expect, it } from "vitest";
import type { LedgerEntry } from "../accounting/ledger";
import type { Concepto, ParsedInvoice } from "../cfdi/types";
import { makeEntry, makeInvoice } from "../../../tests/support/ledgerFactory";
import type { Category, Product } from "../settings/types";
import {
  buildCategorizeRun,
  buildGroupRun,
  collectCategorizeTargets,
  collectItems,
  cutText,
  freeItems,
  isSensitive,
  withheldItems,
  withheldTargets,
  type CategorizeTarget,
  type LlmItem,
} from "./candidates";
import { categorizeRequestSchema, groupRequestSchema, LLM_LIMITS } from "./contract";
import { coverageOf, isComplete, normalizeProductName } from "./reconcile";
import {
  categoryTargetKey,
  emptyQueue,
  enqueueProductSuggestions,
  type CategorySuggestion,
  type PendingQueue,
  type ProductSuggestion,
} from "./suggestions";

const UNO = { rfc: "AAA010101AAA", nombre: "Tienda Uno" };
const DOS = { rfc: "BBB020202BBB", nombre: "Tienda Dos" };

function concepto(descripcion: string): Concepto {
  return {
    claveProdServ: "50202306",
    noIdentificacion: null,
    cantidad: "1",
    claveUnidad: "H87",
    unidad: null,
    descripcion,
    valorUnitario: "100.00",
    importe: "100.00",
    descuento: null,
    objetoImp: "01",
    traslados: [],
    retenciones: [],
  };
}

function entry(
  emisor: { rfc: string; nombre: string },
  descriptions: readonly string[],
  overrides: Partial<ParsedInvoice> = {},
  entryOverrides: Partial<LedgerEntry> = {},
): LedgerEntry {
  return makeEntry({
    invoice: makeInvoice({ emisor, conceptos: descriptions.map(concepto), ...overrides }),
    ...entryOverrides,
  });
}

function item(index: number, overrides: Partial<LlmItem> = {}): LlmItem {
  return {
    rfc: UNO.rfc,
    key: `descripcion ${String(index)}`,
    description: `Descripción ${String(index)}`,
    supplierName: UNO.nombre,
    lines: 1,
    ...overrides,
  };
}

function items(count: number): LlmItem[] {
  return Array.from({ length: count }, (_unused, index) => item(index));
}

describe("collectItems (D-03, D-09, OQ2)", () => {
  it("collapses duplicate lines of one supplier, however they are spelled, into one item with its line count", () => {
    const result = collectItems([
      entry(UNO, ["MM LECHE ENT", "mm  leche ent"]),
      entry(UNO, ["Mm Leche Ent"]),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]?.lines).toBe(3);
    expect(result[0]?.description).toBe("MM LECHE ENT");
  });

  it("keeps the same text at two suppliers as two items", () => {
    const result = collectItems([entry(UNO, ["Azúcar"]), entry(DOS, ["Azúcar"])]);
    expect(result.map((entryItem) => entryItem.supplierName)).toEqual(["Tienda Dos", "Tienda Uno"]);
    expect(result.map((entryItem) => entryItem.rfc).sort()).toEqual([UNO.rfc, DOS.rfc]);
  });

  it("includes the concepts of tipo P and tipo E invoices and of an excluded invoice", () => {
    const result = collectItems([
      entry(UNO, ["Pago"], { tipo: "P" }, { kind: "pago", noSuma: "tipo", counted: false }),
      entry(UNO, ["Devolución"], { tipo: "E" }, { kind: "nota-credito" }),
      entry(DOS, ["Excluida"], {}, { exclusion: "manual", counted: false }),
    ]);
    expect(result.map((entryItem) => entryItem.description).sort()).toEqual(
      ["Devolución", "Excluida", "Pago"].sort(),
    );
  });

  it("skips a description that normalizes to nothing", () => {
    expect(collectItems([entry(UNO, ["   ", "Sal"])]).map((entryItem) => entryItem.description)).toEqual([
      "Sal",
    ]);
  });
});

describe("freeItems", () => {
  it("drops the items whose key is taken", () => {
    const all = collectItems([entry(UNO, ["Azúcar", "Sal"])]);
    const first = all[0];
    if (first === undefined) throw new Error("expected an item");
    const taken = new Set([`${first.rfc}\u0000${first.key}`]);
    expect(freeItems(all, taken).map((entryItem) => entryItem.key)).toEqual(
      all.slice(1).map((entryItem) => entryItem.key),
    );
  });
});

describe("cutText", () => {
  const max = LLM_LIMITS.description;

  it("keeps 199 and 200 characters as they are", () => {
    expect(cutText("a".repeat(199), max)).toHaveLength(199);
    expect(cutText("a".repeat(200), max)).toBe("a".repeat(200));
  });

  it("cuts 201 characters to 200, the last one being «…»", () => {
    const cut = cutText("a".repeat(201), max);
    expect(cut).toHaveLength(200);
    expect(cut.endsWith("…")).toBe(true);
  });

  it("never splits a surrogate pair", () => {
    const cut = cutText(`${"a".repeat(198)}😀😀`, max);
    expect(cut.length).toBeLessThanOrEqual(max);
    expect(cut.endsWith("…")).toBe(true);
    expect(cut).not.toMatch(/[\ud800-\udbff]…$/);
  });
});

describe("buildGroupRun (D-28, LLM-03)", () => {
  it.each([
    [0, 0, []],
    [1, 1, [1]],
    [120, 1, [120]],
    [121, 2, [61, 60]],
    [240, 2, [120, 120]],
  ])("splits %i items into %i batch(es) of sizes %j", (count, batches, sizes) => {
    const run = buildGroupRun(items(count), []);
    expect(run.batches).toHaveLength(batches);
    expect(run.batches.map((batch) => batch.body.items.length)).toEqual(sizes);
    expect(run.items).toBe(count);
  });

  it("splits 251 items into batches of 126 and 125", () => {
    const run = buildGroupRun(items(251), [], 250);
    expect(run.batches.map((batch) => batch.body.items.length)).toEqual([126, 125]);
  });

  it("spreads one big supplier evenly: 500 items with 220 of one supplier give two batches of 250 with 110 each (D-28 split rule)", () => {
    const big = Array.from({ length: 220 }, (_unused, index) =>
      item(index, { rfc: "BIG010101BIG", supplierName: "Tienda Grande" }),
    );
    const rest = Array.from({ length: 280 }, (_unused, index) =>
      item(index, { rfc: `R${String(index % 14).padStart(2, "0")}0101RRR`, supplierName: `Tienda ${String(index % 14).padStart(2, "0")}` }),
    );
    // Sorted by supplier name the big supplier sits in the middle: a consecutive split would put
    // almost all of it in one batch.
    const run = buildGroupRun([...big, ...rest], [], 250);
    expect(run.batches).toHaveLength(2);
    expect(run.batches.map((batch) => batch.body.items.length)).toEqual([250, 250]);
    expect(
      run.batches.map(
        (batch) => batch.body.items.filter((bodyItem) => bodyItem.supplier === "Tienda Grande").length,
      ),
    ).toEqual([110, 110]);
  });

  it("spreads every supplier round-robin: item j of the sorted list goes to batch j mod M, each batch keeps the sorted order", () => {
    const sorted = collectItems([
      entry(UNO, ["a", "b", "c", "d", "e", "f"]),
      entry(DOS, ["g", "h", "i", "j"]),
    ]);
    expect(sorted).toHaveLength(10);
    const run = buildGroupRun(sorted, [], 4);
    expect(run.batches).toHaveLength(3);
    run.batches.forEach((batch, batchIndex) => {
      const expected = sorted
        .filter((_unused, j) => j % 3 === batchIndex)
        .map((entryItem) => entryItem.description);
      expect(batch.body.items.map((bodyItem) => bodyItem.description)).toEqual(expected);
      // The ids follow the batch order and map back to the same member.
      expect(batch.body.items.map((bodyItem) => batch.idMap.get(bodyItem.id)?.description)).toEqual(
        expected,
      );
    });
  });

  it("sorts the free items by supplier then description before it spreads them", () => {
    const shuffled = [item(3, { supplierName: "B" }), item(1, { supplierName: "A" }), item(2, { supplierName: "B" })];
    const run = buildGroupRun(shuffled, [], 2);
    expect(run.batches.map((batch) => batch.body.items.map((bodyItem) => bodyItem.description))).toEqual([
      ["Descripción 1", "Descripción 3"],
      ["Descripción 2"],
    ]);
  });

  it("numbers the ids i1.. in each batch and every body passes the request schema", () => {
    const run = buildGroupRun(items(121), []);
    for (const batch of run.batches) {
      expect(batch.body.items.map((bodyItem) => bodyItem.id)).toEqual(
        batch.body.items.map((_unused, index) => `i${String(index + 1)}`),
      );
      expect(groupRequestSchema.safeParse(batch.body).success).toBe(true);
      expect([...batch.idMap.keys()]).toEqual(batch.body.items.map((bodyItem) => bodyItem.id));
    }
  });

  it("serializes no RFC, UUID, folio, date or amount of the invoices", () => {
    const uuid = "11111111-2222-4333-8444-555555555501";
    const emisor = { rfc: "ZZZ090909ZZZ", nombre: "Tienda Tres" };
    const receptor = { rfc: "CAF030303CCC", nombre: "Coworking de prueba" };
    const secrets = [
      emisor.rfc,
      receptor.rfc,
      uuid,
      "F-90210",
      "2025-03-03T09:00:00",
      "2025-03-03",
      "2468.13",
      "2123.00",
    ];
    const run = buildGroupRun(
      collectItems([
        makeEntry({
          invoice: makeInvoice({
            uuid,
            serie: "ZZ",
            folio: "F-90210",
            fecha: "2025-03-03T09:00:00",
            subTotal: "2123.00",
            total: "2468.13",
            emisor,
            receptor,
            conceptos: [concepto("Leche entera"), concepto("Azúcar")],
          }),
        }),
      ]),
      [],
    );
    const serialized = run.batches.map((batch) => JSON.stringify(batch.body)).join("\n");
    expect(serialized).toContain("Leche entera");
    for (const secret of secrets) expect(serialized).not.toContain(secret);
  });

  it("cuts a long description and a long supplier name to their limits", () => {
    const run = buildGroupRun(
      [
        {
          rfc: UNO.rfc,
          key: "k",
          description: "d".repeat(300),
          supplierName: "s".repeat(200),
          lines: 1,
        },
      ],
      [],
    );
    const body = run.batches[0]?.body;
    expect(body?.items[0]?.description).toHaveLength(LLM_LIMITS.description);
    expect(body?.items[0]?.supplier).toHaveLength(LLM_LIMITS.supplier);
    expect(groupRequestSchema.safeParse(body).success).toBe(true);
  });
});

describe("buildGroupRun context: the accepted products (D-04, D-21, D-33)", () => {
  const accepted = [
    { productId: "prod_c", name: "Café molido" },
    { productId: "prod_a", name: "Azúcar" },
    { productId: "prod_l", name: "Leche entera" },
  ];

  it("puts the names of the accepted products on every batch body as p1..pK, sorted by name", () => {
    const run = buildGroupRun(items(121), accepted);
    expect(run.batches).toHaveLength(2);
    for (const batch of run.batches) {
      expect(batch.body.existing).toEqual([
        { id: "p1", name: "Azúcar" },
        { id: "p2", name: "Café molido" },
        { id: "p3", name: "Leche entera" },
      ]);
      expect(groupRequestSchema.safeParse(batch.body).success).toBe(true);
    }
    expect(run.contextNames).toBe(3);
  });

  it("maps each context id to a product target in the browser only", () => {
    const run = buildGroupRun(items(2), accepted);
    const batch = run.batches[0];
    if (batch === undefined) throw new Error("fixture");
    expect([...batch.targets.entries()]).toEqual([
      ["p1", { kind: "product", productId: "prod_a" }],
      ["p2", { kind: "product", productId: "prod_c" }],
      ["p3", { kind: "product", productId: "prod_l" }],
    ]);
    expect(JSON.stringify(batch.body)).not.toContain("prod_");
  });

  it("sorts with the Spanish collator, so an accented initial is not sent last", () => {
    const run = buildGroupRun(items(1), [
      { productId: "prod_z", name: "Zanahoria" },
      { productId: "prod_a", name: "Ámbar" },
      { productId: "prod_u", name: "Azúcar" },
    ]);
    expect(run.batches[0]?.body.existing.map((context) => context.name)).toEqual([
      "Ámbar",
      "Azúcar",
      "Zanahoria",
    ]);
  });

  it("keeps the first 400 by name when there are more accepted products", () => {
    const many = Array.from({ length: 450 }, (_unused, index) => ({
      productId: `prod_${String(index)}`,
      name: `Producto ${String(index).padStart(3, "0")}`,
    }));
    // The first ones by name come last in the input: the cut must follow the name, not the input.
    const run = buildGroupRun(items(1), [...many].reverse());
    const batch = run.batches[0];
    if (batch === undefined) throw new Error("fixture");
    expect(batch.body.existing).toHaveLength(LLM_LIMITS.contextNames);
    expect(batch.body.existing[0]).toEqual({ id: "p1", name: "Producto 000" });
    expect(batch.body.existing[399]).toEqual({ id: "p400", name: "Producto 399" });
    expect(batch.targets.size).toBe(400);
    expect(run.contextNames).toBe(400);
    expect(groupRequestSchema.safeParse(batch.body).success).toBe(true);
  });

  it("sends no context when there is no accepted product", () => {
    const run = buildGroupRun(items(3), []);
    expect(run.batches[0]?.body.existing).toEqual([]);
    expect(run.batches[0]?.targets.size).toBe(0);
    expect(run.contextNames).toBe(0);
  });
});

describe("groupRequestSchema (LLM-03)", () => {
  const valid = {
    items: [{ id: "i1", description: "Leche", supplier: "Tienda Uno" }],
    existing: [],
  };

  it("accepts the valid body", () => {
    expect(groupRequestSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects an rfc key on an item", () => {
    expect(
      groupRequestSchema.safeParse({
        ...valid,
        items: [{ ...valid.items[0], rfc: "AAA010101AAA" }],
      }).success,
    ).toBe(false);
  });

  it("rejects a uuid key at the top level", () => {
    expect(groupRequestSchema.safeParse({ ...valid, uuid: "x" }).success).toBe(false);
  });

  it("rejects 121 items", () => {
    const many = Array.from({ length: 121 }, (_unused, index) => ({
      id: `i${String(index + 1)}`,
      description: "Leche",
      supplier: "Tienda Uno",
    }));
    expect(groupRequestSchema.safeParse({ ...valid, items: many }).success).toBe(false);
  });

  it("rejects a 201-character description", () => {
    expect(
      groupRequestSchema.safeParse({
        ...valid,
        items: [{ id: "i1", description: "d".repeat(201), supplier: "Tienda Uno" }],
      }).success,
    ).toBe(false);
  });

  it("rejects the id x1", () => {
    expect(
      groupRequestSchema.safeParse({
        ...valid,
        items: [{ id: "x1", description: "Leche", supplier: "Tienda Uno" }],
      }).success,
    ).toBe(false);
  });
});

function card(id: string, descriptions: readonly string[]): ProductSuggestion {
  return {
    id,
    name: id,
    target: null,
    members: descriptions.map((description) => ({
      rfc: UNO.rfc,
      key: description.toLowerCase(),
      description,
      supplierName: UNO.nombre,
    })),
  };
}

describe("enqueueProductSuggestions (D-25)", () => {
  it("drops the members already pending and the cards left empty, and never changes a queued card", () => {
    const queue = [card("a", ["Leche", "Azúcar"])];
    const next = enqueueProductSuggestions(queue, [
      card("b", ["Azúcar", "Sal"]),
      card("c", ["Leche"]),
    ]);
    expect(next.map((queued) => queued.id)).toEqual(["a", "b"]);
    expect(next[0]).toBe(queue[0]);
    expect(next[1]?.members.map((member) => member.description)).toEqual(["Sal"]);
    expect(queue).toHaveLength(1);
  });

  it("keeps a member that repeats inside the incoming cards only once", () => {
    const next = enqueueProductSuggestions([], [card("a", ["Sal"]), card("b", ["Sal", "Pimienta"])]);
    expect(next.map((queued) => queued.members.map((member) => member.description))).toEqual([
      ["Sal"],
      ["Pimienta"],
    ]);
  });
});

describe("coverageOf and isComplete (D-11)", () => {
  it("is complete when every sent id appears exactly once", () => {
    const coverage = coverageOf(["i1", "i2", "i3"], [{ ids: ["i1", "i3"] }, { ids: ["i2"] }]);
    expect(coverage).toEqual({ missing: [], unknown: [], duplicated: [] });
    expect(isComplete(coverage)).toBe(true);
  });

  it("reports the ids left out", () => {
    const coverage = coverageOf(["i1", "i2", "i3"], [{ ids: ["i1"] }]);
    expect(coverage.missing).toEqual(["i2", "i3"]);
    expect(isComplete(coverage)).toBe(false);
  });

  it("reports the ids that were never sent", () => {
    const coverage = coverageOf(["i1"], [{ ids: ["i1", "i7"] }]);
    expect(coverage.unknown).toEqual(["i7"]);
    expect(isComplete(coverage)).toBe(false);
  });

  it("reports the ids that appear more than once, in one group or across groups", () => {
    const coverage = coverageOf(["i1", "i2"], [{ ids: ["i1", "i1"] }, { ids: ["i2", "i1"] }]);
    expect(coverage.duplicated).toEqual(["i1", "i1"]);
    expect(isComplete(coverage)).toBe(false);
  });

  it("is complete for no sent ids and no groups", () => {
    expect(isComplete(coverageOf([], []))).toBe(true);
  });
});

describe("normalizeProductName (D-12, Pitfall 7)", () => {
  it("removes control characters and collapses runs of whitespace", () => {
    expect(normalizeProductName("  Leche\u0000   entera\u0007 ")).toBe("Leche entera");
    expect(normalizeProductName("Leche\nentera\t1L")).toBe("Leche entera 1L");
  });

  it("keeps a name of 60 characters and cuts a longer one to 60 ending with «…»", () => {
    expect(normalizeProductName("n".repeat(60))).toBe("n".repeat(60));
    const cut = normalizeProductName("n".repeat(61));
    expect(cut).toHaveLength(60);
    expect(cut.endsWith("…")).toBe(true);
  });

  it("returns an empty string when nothing usable is left", () => {
    expect(normalizeProductName("   ")).toBe("");
    expect(normalizeProductName("\u0000\u0007\n")).toBe("");
    expect(normalizeProductName("")).toBe("");
  });
});

// ---------------------------------------------------------------------------------------
// «Sugerir categorías» (Plan 04-18): who is asked, how it is packed, what travels.

const CATEGORIES: Category[] = [
  { id: "cat_servicios", name: "Servicios" },
  { id: "seed:otros", name: "Otros" },
  { id: "cat_abarrotes", name: "Abarrotes" },
];

function product(
  id: string,
  name: string,
  descriptions: readonly string[],
  categoryId: string | null = null,
): Product {
  return {
    id,
    name,
    categoryId,
    members: descriptions.map((description, index) => ({
      rfc: index % 2 === 0 ? UNO.rfc : DOS.rfc,
      key: description.toLowerCase(),
      description,
      supplierName: index % 2 === 0 ? UNO.nombre : DOS.nombre,
    })),
  };
}

function settingsOf(
  overrides: {
    categories?: Category[];
    supplierCategories?: { rfc: string; name: string; categoryId: string }[];
    products?: Product[];
  } = {},
) {
  return {
    categories: overrides.categories ?? CATEGORIES,
    supplierCategories: overrides.supplierCategories ?? [],
    products: overrides.products ?? [],
  };
}

function supplierRow(rfc: string): CategorySuggestion {
  return { id: `row_${rfc}`, kind: "supplier", rfc, name: rfc, choice: null };
}

function productRow(productId: string): CategorySuggestion {
  return { id: `row_${productId}`, kind: "product", productId, name: productId, choice: null };
}

function queueWith(categories: CategorySuggestion[]): PendingQueue {
  return { ...emptyQueue(), categories };
}

describe("collectCategorizeTargets (D-07, A-2)", () => {
  const entries = [entry(DOS, ["Pago"]), entry(UNO, ["Azúcar"]), entry(UNO, ["Café"])];

  it("lists the loaded suppliers without a default category, one per RFC, suppliers first and each by name", () => {
    const targets = collectCategorizeTargets(
      entries,
      settingsOf({
        products: [
          product("prod_b", "Zanahoria", ["Zanahoria 1kg"]),
          product("prod_a", "Aceite", ["Aceite 1L"]),
        ],
      }),
      emptyQueue(),
    );
    expect(targets.map((target) => `${target.kind}:${target.name}`)).toEqual([
      "supplier:Tienda Dos",
      "supplier:Tienda Uno",
      "product:Aceite",
      "product:Zanahoria",
    ]);
  });

  it("leaves out a supplier whose default category exists, but not one assigned to a deleted category", () => {
    const targets = collectCategorizeTargets(
      entries,
      settingsOf({
        supplierCategories: [
          { rfc: UNO.rfc, name: UNO.nombre, categoryId: "cat_servicios" },
          { rfc: DOS.rfc, name: DOS.nombre, categoryId: "cat_borrada" },
        ],
      }),
      emptyQueue(),
    );
    expect(targets).toEqual([{ kind: "supplier", rfc: DOS.rfc, name: DOS.nombre }]);
  });

  it("lists an accepted product only when it has no category, and carries the descriptions of its members", () => {
    const targets = collectCategorizeTargets(
      [],
      settingsOf({
        products: [
          product("prod_a", "Leche entera", ["MM LECHE ENT", "LECHE ENTERA 1L"]),
          product("prod_b", "Azúcar", ["Azúcar 1kg"], "cat_abarrotes"),
        ],
      }),
      emptyQueue(),
    );
    expect(targets).toEqual([
      {
        kind: "product",
        productId: "prod_a",
        name: "Leche entera",
        members: ["MM LECHE ENT", "LECHE ENTERA 1L"],
      },
    ]);
  });

  it("leaves out a target that already has a pending category row (A-2) and keeps the rest", () => {
    const targets = collectCategorizeTargets(
      entries,
      settingsOf({
        products: [product("prod_a", "Leche", ["Leche"]), product("prod_b", "Pan", ["Pan"])],
      }),
      queueWith([supplierRow(UNO.rfc), productRow("prod_b")]),
    );
    expect(targets.map((target) => target.name)).toEqual(["Tienda Dos", "Leche"]);
  });

  it("builds the same key for a row and for its target", () => {
    expect(categoryTargetKey({ kind: "supplier", rfc: "AAA" })).toBe("supplier:AAA");
    expect(categoryTargetKey({ kind: "product", productId: "p1" })).toBe("product:p1");
    expect(categoryTargetKey(supplierRow(DOS.rfc))).toBe(`supplier:${DOS.rfc}`);
    expect(categoryTargetKey(productRow("prod_a"))).toBe("product:prod_a");
    const targets = collectCategorizeTargets(entries, settingsOf(), queueWith([supplierRow(DOS.rfc)]));
    expect(targets.map((target) => (target.kind === "supplier" ? target.rfc : ""))).toEqual([UNO.rfc]);
  });

  it("skips a supplier whose only name is its RFC, and a product with no readable member", () => {
    const targets = collectCategorizeTargets(
      [entry({ rfc: "XAXX010101000", nombre: "XAXX010101000" }, ["Algo"])],
      settingsOf({ products: [product("prod_a", "Vacío", ["   "])] }),
      emptyQueue(),
    );
    expect(targets).toEqual([]);
  });
});

function supplierTarget(index: number): CategorizeTarget {
  return {
    kind: "supplier",
    rfc: `RFC${String(index)}`,
    name: `Proveedor ${String(index).padStart(3, "0")}`,
  };
}

function productTarget(index: number, members: string[] = ["Descripción"]): CategorizeTarget {
  return {
    kind: "product",
    productId: `prod_${String(index)}`,
    name: `Producto ${String(index).padStart(3, "0")}`,
    members,
  };
}

describe("buildCategorizeRun (D-07, LLM-03)", () => {
  it("numbers suppliers s1.., products q1.. and the categories c1.. in orderedCategories order, with «Otros» last", () => {
    const run = buildCategorizeRun(
      [supplierTarget(1), supplierTarget(2), productTarget(1)],
      CATEGORIES,
    );
    expect(run.batches).toHaveLength(1);
    const batch = run.batches[0];
    expect(batch?.body.suppliers.map((supplier) => supplier.id)).toEqual(["s1", "s2"]);
    expect(batch?.body.products.map((entryProduct) => entryProduct.id)).toEqual(["q1"]);
    expect(batch?.body.categories).toEqual([
      { id: "c1", name: "Abarrotes" },
      { id: "c2", name: "Servicios" },
      { id: "c3", name: "Otros" },
    ]);
    expect(batch?.codeMap.get("c1")).toBe("cat_abarrotes");
    expect(batch?.codeMap.get("c3")).toBe("seed:otros");
    expect(batch?.idMap.get("s2")).toEqual(supplierTarget(2));
    expect(batch?.idMap.get("q1")).toEqual(productTarget(1));
    expect(run).toMatchObject({ suppliers: 2, products: 1, members: 1, categories: 3 });
  });

  it("every body passes the strict request schema", () => {
    const run = buildCategorizeRun([supplierTarget(1), productTarget(1, ["A", "B"])], CATEGORIES);
    for (const batch of run.batches) {
      expect(categorizeRequestSchema.safeParse(batch.body).success).toBe(true);
    }
  });

  it("cuts a member description to 200 characters, a product name to 60 and a supplier name to 120", () => {
    const run = buildCategorizeRun(
      [
        { kind: "supplier", rfc: "R", name: "S".repeat(150) },
        { kind: "product", productId: "p", name: "P".repeat(80), members: ["d".repeat(250)] },
      ],
      CATEGORIES,
    );
    const body = run.batches[0]?.body;
    expect(body?.suppliers[0]?.name).toHaveLength(120);
    expect(body?.products[0]?.name).toHaveLength(60);
    expect(body?.products[0]?.members[0]).toHaveLength(200);
    expect(body?.products[0]?.members[0]?.endsWith("…")).toBe(true);
  });

  it("sends the first 100 members of a product and none twice", () => {
    const members = [
      ...Array.from({ length: 150 }, (_unused, index) => `Descripción ${String(index)}`),
      "Descripción 0",
    ];
    const run = buildCategorizeRun([productTarget(1, members)], CATEGORIES);
    const sent = run.batches[0]?.body.products[0]?.members ?? [];
    expect(sent).toHaveLength(LLM_LIMITS.membersPerProduct);
    expect(sent[0]).toBe("Descripción 0");
    expect(new Set(sent).size).toBe(sent.length);
    expect(run.members).toBe(100);
  });

  it("keeps 150 entries in one batch and splits 151 into two of 76 and 75 in the order given", () => {
    const one = buildCategorizeRun(
      Array.from({ length: 150 }, (_unused, index) => supplierTarget(index)),
      CATEGORIES,
    );
    expect(one.batches).toHaveLength(1);
    const targets = [
      ...Array.from({ length: 100 }, (_unused, index) => supplierTarget(index)),
      ...Array.from({ length: 51 }, (_unused, index) => productTarget(index)),
    ];
    const two = buildCategorizeRun(targets, CATEGORIES);
    expect(
      two.batches.map((batch) => batch.body.suppliers.length + batch.body.products.length),
    ).toEqual([76, 75]);
    expect(two.batches[0]?.body.suppliers).toHaveLength(76);
    expect(two.batches[1]?.body.suppliers).toHaveLength(24);
    expect(two.batches[1]?.body.suppliers[0]?.id).toBe("s1");
    expect(two.batches[1]?.body.products[0]?.id).toBe("q1");
    expect(two).toMatchObject({ suppliers: 100, products: 51 });
    // The user's categories travel on every batch with the same codes.
    expect(two.batches[1]?.body.categories).toEqual(two.batches[0]?.body.categories);
  });

  it("splits a batch that would pass the byte budget instead of letting the route refuse it", () => {
    const heavy = Array.from({ length: 100 }, (_unused, index) =>
      productTarget(
        index,
        Array.from(
          { length: 100 },
          (_member, member) => `${"x".repeat(190)} ${String(index)}-${String(member)}`,
        ),
      ),
    );
    const run = buildCategorizeRun(heavy, CATEGORIES);
    expect(run.batches.length).toBeGreaterThan(1);
    for (const batch of run.batches) {
      const bytes = new TextEncoder().encode(JSON.stringify(batch.body)).length;
      expect(bytes).toBeLessThanOrEqual(200000);
      expect(bytes).toBeLessThan(LLM_LIMITS.requestBytes);
    }
    expect(run.products).toBe(100);
    const sentProducts = run.batches.flatMap((batch) =>
      [...batch.idMap.values()].map((target) => (target.kind === "product" ? target.productId : "")),
    );
    expect(new Set(sentProducts).size).toBe(100);
  });

  it("sends no batch when there is nothing to ask", () => {
    expect(buildCategorizeRun([], CATEGORIES)).toMatchObject({
      batches: [],
      suppliers: 0,
      products: 0,
      members: 0,
      categories: 0,
    });
  });

  it("works with no categories: every batch carries an empty list", () => {
    const run = buildCategorizeRun([supplierTarget(1)], []);
    expect(run.batches[0]?.body.categories).toEqual([]);
    expect(categorizeRequestSchema.safeParse(run.batches[0]?.body).success).toBe(true);
  });

  it("serializes no RFC, UUID, folio, date or amount of the invoices (T-04-37)", () => {
    const loadedEntries = [
      entry(UNO, ["Azúcar"], {
        uuid: "11111111-2222-4333-8444-555555555501",
        folio: "F-90210",
        fecha: "2025-03-03T09:00:00",
        total: "2468.13",
      }),
    ];
    const targets = collectCategorizeTargets(
      loadedEntries,
      settingsOf({ products: [product("prod_a", "Leche", ["MM LECHE ENT", "LECHE ENTERA 1L"])] }),
      emptyQueue(),
    );
    const serialized = JSON.stringify(
      buildCategorizeRun(targets, CATEGORIES).batches.map((batch) => batch.body),
    );
    for (const forbidden of [
      UNO.rfc,
      DOS.rfc,
      "11111111-2222",
      "F-90210",
      "2025-03-03",
      "2468.13",
      "prod_a",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
    expect(serialized).toContain("Tienda Uno");
    expect(serialized).toContain("MM LECHE ENT");
    expect(serialized).toContain("Servicios");
  });
});

describe("categorizeRequestSchema (LLM-03, T-04-37)", () => {
  const body = {
    suppliers: [{ id: "s1", name: "Tienda Uno" }],
    products: [{ id: "q1", name: "Leche", members: ["MM LECHE ENT"] }],
    categories: [{ id: "c1", name: "Abarrotes" }],
  };

  it("accepts the valid body", () => {
    expect(categorizeRequestSchema.safeParse(body).success).toBe(true);
  });

  it("rejects an rfc on a supplier, an amount on a product, a uuid at the top and a field on a category", () => {
    expect(
      categorizeRequestSchema.safeParse({
        ...body,
        suppliers: [{ id: "s1", name: "T", rfc: "AAA010101AAA" }],
      }).success,
    ).toBe(false);
    expect(
      categorizeRequestSchema.safeParse({
        ...body,
        products: [{ id: "q1", name: "L", members: ["x"], total: "1" }],
      }).success,
    ).toBe(false);
    expect(categorizeRequestSchema.safeParse({ ...body, uuid: "x" }).success).toBe(false);
    expect(
      categorizeRequestSchema.safeParse({
        ...body,
        categories: [{ id: "c1", name: "A", color: "red" }],
      }).success,
    ).toBe(false);
  });

  it("rejects ids of the wrong kind, a product with no member and more than 100 members", () => {
    expect(
      categorizeRequestSchema.safeParse({ ...body, suppliers: [{ id: "q1", name: "T" }] }).success,
    ).toBe(false);
    expect(
      categorizeRequestSchema.safeParse({
        ...body,
        products: [{ id: "q1", name: "L", members: [] }],
      }).success,
    ).toBe(false);
    expect(
      categorizeRequestSchema.safeParse({
        ...body,
        products: [{ id: "q1", name: "L", members: Array.from({ length: 101 }, () => "x") }],
      }).success,
    ).toBe(false);
  });

  it("rejects 0 and 151 entries and 201 categories", () => {
    expect(
      categorizeRequestSchema.safeParse({ suppliers: [], products: [], categories: [] }).success,
    ).toBe(false);
    expect(
      categorizeRequestSchema.safeParse({
        suppliers: Array.from({ length: 76 }, (_unused, index) => ({
          id: `s${String(index + 1)}`,
          name: "T",
        })),
        products: Array.from({ length: 75 }, (_unused, index) => ({
          id: `q${String(index + 1)}`,
          name: "P",
          members: ["x"],
        })),
        categories: [],
      }).success,
    ).toBe(false);
    expect(
      categorizeRequestSchema.safeParse({
        ...body,
        categories: Array.from({ length: 201 }, (_unused, index) => ({
          id: `c${String(index + 1)}`,
          name: "C",
        })),
      }).success,
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------
// The sensitive-pattern guard (Plan 04-20, UI-SPEC OQ7, LLM-03, T-04-40): text that looks like an
// RFC, a UUID, an e-mail address or a long number never reaches a request body.

describe("isSensitive (LLM-03, UI-SPEC OQ7)", () => {
  it.each([
    ["an RFC of a company inside a sentence", "PAGO RFC EKU9003173C9"],
    ["an RFC of a person (4 letters)", "FACTURA ROMA800101AB1"],
    ["the generic RFC", "XAXX010101000"],
    ["an RFC with Ñ", "ÑAA010101AAA"],
    ["an RFC with &", "&AA010101AAA"],
    ["an RFC in lower case", "pago eku9003173c9"],
    ["a UUID", "UUID 3F2504E0-4F89-41D3-9A0C-0305E82C3301"],
    ["a UUID in lower case", "3f2504e0-4f89-41d3-9a0c-0305e82c3301"],
    ["an e-mail address", "ventas@tienda.mx"],
    ["an e-mail address inside text", "CONTACTO: juan.perez+cafe@mail.example.com GRACIAS"],
    ["8 consecutive digits", "PEDIDO 12345678"],
    ["a long run of digits", "CUENTA 012345678901234567"],
  ])("is true for %s", (_label, text) => {
    expect(isSensitive(text)).toBe(true);
  });

  it.each([
    ["a plain description", "LECHE ENTERA 1L"],
    ["a size code", "PZ DOMO FRUTA CH 13-12-44"],
    ["a weight", "1K MANCHEGO"],
    ["a description with & and short numbers", "JAMON ZWAN VIRGINIA1X1KG & 10360 1/1 KG"],
    ["7 digits", "PEDIDO 1234567"],
    ["digits split by spaces", "55 1234 5678"],
    ["an at sign alone", "CAFE @ 50%"],
    ["a word that only ends like an RFC", "DESCRIPCIONES010101AAAS"],
    ["an empty text", ""],
  ])("is false for %s", (_label, text) => {
    expect(isSensitive(text)).toBe(false);
  });

  it("is stable when called twice with the same text (no regular expression state)", () => {
    expect(isSensitive("PEDIDO 12345678")).toBe(true);
    expect(isSensitive("PEDIDO 12345678")).toBe(true);
    expect(isSensitive("LECHE")).toBe(false);
  });
});

describe("withheldItems and buildGroupRun with the guard (LLM-03, T-04-40)", () => {
  const CLEAN = item(1, { description: "LECHE ENTERA 1L", key: "leche entera 1l" });
  const RFC_IN_TEXT = item(2, { description: "PAGO RFC EKU9003173C9", key: "pago rfc eku9003173c9" });
  const LONG_NUMBER = item(3, { description: "PEDIDO 12345678", key: "pedido 12345678" });
  const SENSITIVE_SUPPLIER = item(4, {
    description: "Azúcar",
    key: "azucar",
    supplierName: "Ventas ventas@tienda.mx",
  });

  it("lists exactly the items with a sensitive description or supplier name", () => {
    expect(
      withheldItems([CLEAN, RFC_IN_TEXT, LONG_NUMBER, SENSITIVE_SUPPLIER]).map((entryItem) => entryItem.key),
    ).toEqual(["pago rfc eku9003173c9", "pedido 12345678", "azucar"]);
    expect(withheldItems([CLEAN])).toEqual([]);
  });

  it("also withholds a description whose sensitive part lies beyond the 200-character cut", () => {
    const long = item(5, { description: `${"A".repeat(250)} ventas@tienda.mx`, key: "largo" });
    expect(withheldItems([long])).toEqual([long]);
  });

  it("leaves a sensitive item out of every body and lists it in withheld", () => {
    const run = buildGroupRun([CLEAN, RFC_IN_TEXT, LONG_NUMBER, SENSITIVE_SUPPLIER], []);
    expect(run.batches).toHaveLength(1);
    expect(run.batches[0]?.body.items.map((sent) => sent.description)).toEqual(["LECHE ENTERA 1L"]);
    expect(run.withheld).toEqual([RFC_IN_TEXT, LONG_NUMBER, SENSITIVE_SUPPLIER]);
    const serialized = JSON.stringify(run.batches.map((batch) => batch.body));
    for (const text of ["EKU9003173C9", "12345678", "ventas@tienda.mx"]) {
      expect(serialized).not.toContain(text);
    }
    expect(run.batches[0]?.idMap.size).toBe(1);
  });

  it("counts only what is sent: items and suppliers", () => {
    const run = buildGroupRun([CLEAN, RFC_IN_TEXT, SENSITIVE_SUPPLIER], []);
    expect(run.items).toBe(1);
    expect(run.suppliers).toBe(1);
  });

  it("sends no batch when every free item is withheld, and still lists them", () => {
    const run = buildGroupRun([RFC_IN_TEXT, LONG_NUMBER], []);
    expect(run.batches).toEqual([]);
    expect(run.items).toBe(0);
    expect(run.withheld).toHaveLength(2);
  });

  it("splits into batches by the items that are sent, not by the withheld ones", () => {
    const sendable = items(5);
    const run = buildGroupRun([...sendable, RFC_IN_TEXT, LONG_NUMBER, SENSITIVE_SUPPLIER], [], 3);
    expect(run.batches.map((batch) => batch.body.items.length)).toEqual([3, 2]);
    expect(run.items).toBe(5);
  });

  it("keeps a sensitive accepted-product name out of the context", () => {
    const run = buildGroupRun(
      [CLEAN],
      [
        { productId: "p1", name: "Leche" },
        { productId: "p2", name: "Pedido 12345678" },
      ],
    );
    expect(run.batches[0]?.body.existing.map((entryProduct) => entryProduct.name)).toEqual(["Leche"]);
    expect(run.contextNames).toBe(1);
    expect(run.batches[0]?.targets.size).toBe(1);
  });

  it("has an empty withheld list when nothing matches", () => {
    expect(buildGroupRun(items(3), []).withheld).toEqual([]);
  });
});

describe("withheldTargets and buildCategorizeRun with the guard (LLM-03, T-04-40)", () => {
  it("withholds a supplier whose name looks sensitive", () => {
    const clean = supplierTarget(1);
    const dirty: CategorizeTarget = { kind: "supplier", rfc: "RFCX", name: "Juan PEREZ ROMA800101AB1" };
    const run = buildCategorizeRun([clean, dirty], CATEGORIES);
    expect(run.batches[0]?.body.suppliers.map((supplier) => supplier.name)).toEqual(["Proveedor 001"]);
    expect(run.withheld).toEqual([dirty]);
    expect(withheldTargets([clean, dirty])).toEqual([dirty]);
    expect(run.suppliers).toBe(1);
  });

  it("drops a sensitive member description from a product and keeps the product", () => {
    const target = productTarget(1, ["LECHE ENTERA 1L", "PEDIDO 12345678", "MM LECHE ENT"]);
    const run = buildCategorizeRun([target], CATEGORIES);
    expect(run.batches[0]?.body.products[0]?.members).toEqual(["LECHE ENTERA 1L", "MM LECHE ENT"]);
    expect(run.withheld).toEqual([]);
    expect(run.members).toBe(2);
    expect(withheldTargets([target])).toEqual([]);
  });

  it("withholds a product whose members are all sensitive", () => {
    const target = productTarget(1, ["PEDIDO 12345678", "ventas@tienda.mx"]);
    const run = buildCategorizeRun([target, supplierTarget(1)], CATEGORIES);
    expect(run.batches[0]?.body.products).toEqual([]);
    expect(run.withheld).toEqual([target]);
    expect(withheldTargets([target])).toEqual([target]);
  });

  it("withholds a product whose name is sensitive, even with clean members", () => {
    const target: CategorizeTarget = {
      kind: "product",
      productId: "prod_x",
      name: "Pedido 12345678",
      members: ["LECHE ENTERA 1L"],
    };
    const run = buildCategorizeRun([target], CATEGORIES);
    expect(run.batches).toEqual([]);
    expect(run.withheld).toEqual([target]);
  });

  it("looks at the cut text: a member whose sensitive part lies beyond 200 characters is still withheld", () => {
    const target = productTarget(1, [`${"A".repeat(250)} ventas@tienda.mx`]);
    expect(buildCategorizeRun([target], CATEGORIES).withheld).toEqual([target]);
  });

  it("serializes none of the withheld texts and passes the strict schema", () => {
    const run = buildCategorizeRun(
      [
        supplierTarget(1),
        { kind: "supplier", rfc: "RFCX", name: "Cobros EKU9003173C9" },
        productTarget(1, ["LECHE", "FOLIO 20250312345"]),
      ],
      CATEGORIES,
    );
    const serialized = JSON.stringify(run.batches.map((batch) => batch.body));
    expect(serialized).not.toContain("EKU9003173C9");
    expect(serialized).not.toContain("20250312345");
    for (const batch of run.batches) {
      expect(categorizeRequestSchema.safeParse(batch.body).success).toBe(true);
    }
  });

  it("counts batches by the targets that are sent", () => {
    const sendable = Array.from({ length: 5 }, (_unused, index) => supplierTarget(index));
    const dirty: CategorizeTarget[] = Array.from({ length: 4 }, (_unused, index) => ({
      kind: "supplier",
      rfc: `D${String(index)}`,
      name: `Cuenta 1234567${String(index)}0`,
    }));
    const run = buildCategorizeRun([...sendable, ...dirty], CATEGORIES, 3);
    expect(run.batches.map((batch) => batch.body.suppliers.length)).toEqual([3, 2]);
    expect(run.withheld).toHaveLength(4);
  });

  it("has an empty withheld list when nothing matches", () => {
    expect(buildCategorizeRun([supplierTarget(1)], CATEGORIES).withheld).toEqual([]);
    expect(buildCategorizeRun([], CATEGORIES).withheld).toEqual([]);
  });
});
