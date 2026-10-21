import { describe, expect, it } from "vitest";
import type { LedgerEntry } from "../accounting/ledger";
import type { Concepto, ParsedInvoice } from "../cfdi/types";
import { makeEntry, makeInvoice } from "../../../tests/support/ledgerFactory";
import {
  buildGroupRun,
  collectItems,
  cutText,
  freeItems,
  type LlmItem,
} from "./candidates";
import { groupRequestSchema, LLM_LIMITS } from "./contract";
import { coverageOf, isComplete, normalizeProductName } from "./reconcile";
import { enqueueProductSuggestions, type ProductSuggestion } from "./suggestions";

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
