import { describe, expect, it } from "vitest";
import { memberKey, pendingQueueSchema, type ProductSuggestion, type SuggestionMember } from "./suggestions";
import {
  acceptMany,
  filterCounts,
  filterQueue,
  orderQueue,
  stableOrder,
  type QueueFilter,
} from "./queueView";
import { normalizeDescription } from "../settings/normalize";
import { LIMITS, defaultSettings, type Product, type SettingsData } from "../settings/types";

function member(rfc: string, description: string, supplierName = `Tienda ${rfc}`): SuggestionMember {
  return { rfc, key: normalizeDescription(description), description, supplierName };
}

function card(id: string, name: string, members: SuggestionMember[], target: string | null = null): ProductSuggestion {
  return { id, name, target, members };
}

/** `lines` of a table of keys; a key that is not in the table has no loaded line. */
function linesOf(table: Record<string, number>): (key: string) => number {
  return (key) => table[key] ?? 0;
}

function ids(cards: readonly ProductSuggestion[]): string[] {
  return cards.map((entry) => entry.id);
}

function settingsWith(products: Product[]): SettingsData {
  return { ...defaultSettings(), products };
}

function product(id: string, name: string, members: SuggestionMember[]): Product {
  return {
    id,
    name,
    categoryId: null,
    members: members.map((m) => ({ rfc: m.rfc, key: m.key, description: m.description, supplierName: m.supplierName })),
  };
}

/** Deterministic ids for `acceptMany`: prod_1, prod_2, ... */
function counter(): () => string {
  let next = 0;
  return () => {
    next += 1;
    return `prod_${String(next)}`;
  };
}

describe("orderQueue (UI-SPEC queue order)", () => {
  const A = "AAA010101AAA";
  const B = "BBB020202BBB";

  it("puts «Agregar a» first, then a 3-member card before a 2-member card, then singletons by lines descending and name", () => {
    const single = card("s_few", "Sal", [member(A, "sal")]);
    const singleMany = card("s_many", "Azúcar", [member(A, "azucar")]);
    const two = card("two", "Leche", [member(A, "leche"), member(B, "leche entera")]);
    const three = card("three", "Café", [member(A, "cafe"), member(B, "cafe molido"), member(A, "cafe grano")]);
    const add = card("add", "Aceite", [member(A, "aceite")], "prod_1");
    const lines = linesOf({
      [memberKey(member(A, "sal"))]: 1,
      [memberKey(member(A, "azucar"))]: 9,
    });
    const ordered = orderQueue([single, singleMany, two, three, add], lines);
    expect(ids(ordered)).toEqual(["add", "three", "two", "s_many", "s_few"]);
  });

  it("breaks a tie between groups of the same size by the total of loaded lines, descending", () => {
    const quiet = card("quiet", "Quieto", [member(A, "uno"), member(B, "dos")]);
    const busy = card("busy", "Ocupado", [member(A, "tres"), member(B, "cuatro")]);
    const lines = linesOf({
      [memberKey(member(B, "cuatro"))]: 4,
      [memberKey(member(A, "tres"))]: 3,
      [memberKey(member(A, "uno"))]: 1,
    });
    expect(ids(orderQueue([quiet, busy], lines))).toEqual(["busy", "quiet"]);
  });

  it("breaks a tie between singletons by name with the Spanish collator, ignoring case and accents", () => {
    const cards = [
      card("z", "zanahoria", [member(A, "zanahoria")]),
      card("a", "Álamo", [member(A, "alamo")]),
      card("b", "banana", [member(A, "banana")]),
    ];
    expect(ids(orderQueue(cards, linesOf({})))).toEqual(["a", "b", "z"]);
  });

  it("keeps the arrival order of cards that tie in everything and does not mutate its input", () => {
    const cards = [
      card("first", "Igual", [member(A, "igual a")]),
      card("second", "Igual", [member(A, "igual b")]),
    ];
    const snapshot = ids(cards);
    expect(ids(orderQueue(cards, linesOf({})))).toEqual(["first", "second"]);
    expect(ids(cards)).toEqual(snapshot);
  });

  it("keeps the arrival order among «Agregar a» cards", () => {
    const cards = [
      card("add_2", "Segundo", [member(A, "x")], "prod_2"),
      card("add_1", "Primero", [member(A, "y")], "prod_1"),
    ];
    expect(ids(orderQueue(cards, linesOf({})))).toEqual(["add_2", "add_1"]);
  });
});

describe("stableOrder (cards that land during a run)", () => {
  const A = "AAA010101AAA";
  const cardA = card("A", "Beta", [member(A, "a")]);
  const cardB = card("B", "Gamma", [member(A, "b")]);
  const cardC = card("C", "Alfa", [member(A, "c")]);

  it("keeps [B, A] when A and B were shown, and appends a new card C after them even if C sorts first", () => {
    const ordered = [cardC, cardA, cardB];
    expect(ids(stableOrder(["B", "A"], ordered)).join(",")).toBe("B,A,C");
  });

  it("drops ids that are not in the queue any more and keeps the rest in order", () => {
    expect(ids(stableOrder(["Z", "B", "A"], [cardA, cardB]))).toEqual(["B", "A"]);
  });

  it("appends several new cards in the order of `ordered`", () => {
    const cardD = card("D", "Delta", [member(A, "d")]);
    expect(ids(stableOrder(["A"], [cardD, cardA, cardC, cardB]))).toEqual(["A", "D", "C", "B"]);
  });

  it("shows each card once even when an id repeats in the previous order, and uses the current card objects", () => {
    const renamed = { ...cardA, name: "Renombrada" };
    const result = stableOrder(["A", "A"], [renamed]);
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("Renombrada");
  });

  it("starts from the order given when there was no previous order", () => {
    expect(ids(stableOrder([], [cardC, cardA]))).toEqual(["C", "A"]);
  });
});

describe("filterQueue and filterCounts (E4)", () => {
  const A = "AAA010101AAA";
  const B = "BBB020202BBB";
  const leche = card("leche", "Leche entera", [member(A, "LECHE DESL L", "Abarrotes Sol"), member(B, "leche 1l", "Super Luna")]);
  const cafe = card("cafe", "Café molido", [member(A, "Café Molido 1kg", "Abarrotes Sol")]);
  const azucar = card("azucar", "Azúcar", [member(B, "azucar 1kg", "Super Luna")]);
  const agregar = card("agregar", "Aceite", [member(A, "aceite 1l", "Abarrotes Sol")], "prod_1");
  const all = [leche, cafe, azucar, agregar];

  function filtered(filter: QueueFilter, search = ""): string[] {
    return ids(filterQueue(all, filter, search));
  }

  it("«todas» keeps every card and «varios» keeps the cards with 2 or more members and no target", () => {
    expect(filtered("todas")).toEqual(["leche", "cafe", "azucar", "agregar"]);
    expect(filtered("varios")).toEqual(["leche"]);
  });

  it("«deUno» keeps one-member cards without target and «paraAgregar» keeps the cards with a target", () => {
    expect(filtered("deUno")).toEqual(["cafe", "azucar"]);
    expect(filtered("paraAgregar")).toEqual(["agregar"]);
  });

  it("an «Agregar a» card with several members counts as «paraAgregar» only", () => {
    const wide = card("wide", "Varios", [member(A, "p"), member(B, "q")], "prod_2");
    expect(ids(filterQueue([wide], "varios", ""))).toEqual([]);
    expect(ids(filterQueue([wide], "deUno", ""))).toEqual([]);
    expect(ids(filterQueue([wide], "paraAgregar", ""))).toEqual(["wide"]);
  });

  it("searches the name, ignoring case and accents", () => {
    expect(filtered("todas", "CAFE")).toEqual(["cafe"]);
    expect(filtered("todas", "azúcar")).toEqual(["azucar"]);
  });

  it("searches a member description: «leche» finds a card by «LECHE DESL L» and by «leche 1l»", () => {
    const byDescription = card("x", "Sin relación", [member(A, "LECHE DESL L")]);
    expect(ids(filterQueue([byDescription, cafe], "todas", "leche"))).toEqual(["x"]);
  });

  it("searches the supplier name of a member", () => {
    expect(filtered("todas", "luna")).toEqual(["leche", "azucar"]);
  });

  it("combines the filter and the search", () => {
    expect(filtered("deUno", "luna")).toEqual(["azucar"]);
    expect(filtered("varios", "azucar")).toEqual([]);
  });

  it("ignores extra spaces and case in the search text, and a blank search matches everything", () => {
    expect(filtered("todas", "  cafe   MOLIDO ")).toEqual(["cafe"]);
    expect(filtered("todas", "   ")).toEqual(["leche", "cafe", "azucar", "agregar"]);
  });

  it("keeps «ñ» apart from «n» like the rest of the app", () => {
    const peña = card("p", "Peña", [member(A, "peña")]);
    expect(ids(filterQueue([peña], "todas", "pena"))).toEqual([]);
    expect(ids(filterQueue([peña], "todas", "PEÑA"))).toEqual(["p"]);
  });

  it("also searches the name an «Agregar a» card is shown with when the caller gives it", () => {
    const named = card("named", "Nombre de DeepSeek", [member(A, "x")], "prod_9");
    const shown = (entry: ProductSuggestion): string => (entry.id === "named" ? "Aceite de oliva" : entry.name);
    expect(ids(filterQueue([named], "todas", "oliva"))).toEqual([]);
    expect(ids(filterQueue([named], "todas", "oliva", shown))).toEqual(["named"]);
  });

  it("returns the cards in the order it received them and does not mutate its input", () => {
    const input = [azucar, leche];
    expect(ids(filterQueue(input, "todas", ""))).toEqual(["azucar", "leche"]);
    expect(ids(input)).toEqual(["azucar", "leche"]);
  });

  it("counts every pending card by filter, ignoring any search", () => {
    expect(filterCounts(all)).toEqual({ todas: 4, varios: 1, deUno: 2, paraAgregar: 1 });
    expect(filterCounts([])).toEqual({ todas: 0, varios: 0, deUno: 0, paraAgregar: 0 });
  });
});

describe("acceptMany (D-20, D-35)", () => {
  const A = "AAA010101AAA";
  const B = "BBB020202BBB";

  it("accepts regular cards in the order given, each against the settings the previous one left", () => {
    const first = card("c1", "Leche", [member(A, "leche"), member(B, "leche entera")]);
    const second = card("c2", "Café", [member(A, "cafe")]);
    const result = acceptMany(defaultSettings(), [first, second], counter());
    expect(result.acceptedIds).toEqual(["c1", "c2"]);
    expect(result.refused).toEqual([]);
    expect(result.created).toBe(2);
    expect(result.addedTo).toBe(0);
    expect(result.next.products.map((entry) => entry.id)).toEqual(["prod_1", "prod_2"]);
    expect(result.next.products.map((entry) => entry.name)).toEqual(["Leche", "Café"]);
    expect(result.next.products[0]?.members).toHaveLength(2);
  });

  it("accepts the first and third and refuses the second when it repeats the first's name", () => {
    const first = card("c1", "Leche", [member(A, "leche")]);
    const second = card("c2", "leche", [member(A, "otra leche")]);
    const third = card("c3", "Café", [member(A, "cafe")]);
    const result = acceptMany(defaultSettings(), [first, second, third], counter());
    expect(result.acceptedIds).toEqual(["c1", "c3"]);
    expect(result.refused).toEqual([{ id: "c2", reason: "duplicate" }]);
    expect(result.created).toBe(2);
    expect(result.next.products.map((entry) => entry.name)).toEqual(["Leche", "Café"]);
  });

  it("refuses an empty name, a reserved name and a name over the limit with their own reason", () => {
    const empty = card("e", "   ", [member(A, "uno")]);
    const reserved = card("r", "Sin categoría", [member(A, "dos")]);
    const tooLong = card("l", "x".repeat(LIMITS.productName + 1), [member(A, "tres")]);
    const result = acceptMany(defaultSettings(), [empty, reserved, tooLong], counter());
    expect(result.refused).toEqual([
      { id: "e", reason: "empty" },
      { id: "r", reason: "reserved" },
      { id: "l", reason: "too-long" },
    ]);
    expect(result.acceptedIds).toEqual([]);
    expect(result.created).toBe(0);
  });

  it("refuses a card whose member an earlier card of the same bulk took", () => {
    // Not reachable from a valid queue (a member is in one card), but the reducer must still be safe.
    const first = card("c1", "Leche", [member(A, "leche")]);
    const second = card("c2", "Otra", [member(A, "leche")]);
    const result = acceptMany(defaultSettings(), [first, second], counter());
    expect(result.acceptedIds).toEqual(["c1"]);
    expect(result.refused).toEqual([{ id: "c2", reason: "members-taken" }]);
  });

  it("adds an «Agregar a» card with all its members to the product it targets", () => {
    const existing = product("prod_x", "Aceite", [member(A, "aceite 1l")]);
    const add = card("add", "Aceite", [member(B, "aceite vegetal"), member(A, "aceite 900ml")], "prod_x");
    const result = acceptMany(settingsWith([existing]), [add], counter());
    expect(result.acceptedIds).toEqual(["add"]);
    expect(result.created).toBe(0);
    expect(result.addedTo).toBe(1);
    const stored = result.next.products[0];
    expect(stored?.id).toBe("prod_x");
    expect(stored?.members.map((entry) => entry.description)).toEqual(["aceite 1l", "aceite vegetal", "aceite 900ml"]);
  });

  it("refuses an «Agregar a» card whose product was deleted with «gone»", () => {
    const add = card("add", "Aceite", [member(A, "aceite")], "prod_borrado");
    const result = acceptMany(defaultSettings(), [add], counter());
    expect(result.acceptedIds).toEqual([]);
    expect(result.refused).toEqual([{ id: "add", reason: "gone" }]);
    expect(result.addedTo).toBe(0);
  });

  it("lets an «Agregar a» card follow a regular card of the same bulk that created the product", () => {
    const regular = card("c1", "Leche", [member(A, "leche")]);
    // The id the first card gets is the one the second card targets.
    const add = card("add", "Leche", [member(B, "leche entera")], "prod_1");
    const result = acceptMany(defaultSettings(), [regular, add], counter());
    expect(result.acceptedIds).toEqual(["c1", "add"]);
    expect(result.created).toBe(1);
    expect(result.addedTo).toBe(1);
    expect(result.next.products[0]?.members).toHaveLength(2);
  });

  it("refuses everything past the product limit with «limit» and keeps the settings valid", () => {
    const full: Product[] = Array.from({ length: LIMITS.products }, (_, index) =>
      product(`prod_full_${String(index)}`, `Producto ${String(index)}`, [member("ZZZ010101ZZZ", `desc ${String(index)}`)]),
    );
    const extra = card("c1", "Nuevo", [member(A, "nuevo")]);
    const result = acceptMany(settingsWith(full), [extra], counter());
    expect(result.refused).toEqual([{ id: "c1", reason: "limit" }]);
    expect(result.next.products).toHaveLength(LIMITS.products);
  });

  it("returns the very same settings object when nothing is accepted, and never mutates its input", () => {
    const settings = settingsWith([]);
    const snapshot = JSON.stringify(settings);
    const none = acceptMany(settings, [], counter());
    expect(none.next).toBe(settings);
    const refused = acceptMany(settings, [card("e", "", [member(A, "x")])], counter());
    expect(refused.next).toBe(settings);
    const accepted = acceptMany(settings, [card("c", "Sal", [member(A, "sal")])], counter());
    expect(accepted.next).not.toBe(settings);
    expect(JSON.stringify(settings)).toBe(snapshot);
  });

  it("only uses ids it asked `newId` for, one per regular card it tried, and none for an «Agregar a» card", () => {
    const asked: string[] = [];
    const newId = (): string => {
      const id = `prod_t${String(asked.length)}`;
      asked.push(id);
      return id;
    };
    const existing = product("prod_x", "Aceite", [member(A, "aceite 1l")]);
    const add = card("add", "Aceite", [member(B, "aceite vegetal")], "prod_x");
    const regular = card("c1", "Sal", [member(A, "sal")]);
    acceptMany(settingsWith([existing]), [add, regular], newId);
    expect(asked).toEqual(["prod_t0"]);
  });

  it("produces settings whose products pass the stored queue rules (names unique, members unique)", () => {
    const cards = [
      card("c1", "Leche", [member(A, "leche"), member(B, "leche entera")]),
      card("c2", "Café", [member(A, "cafe")]),
      card("c3", "Café", [member(A, "cafe molido")]),
    ];
    const result = acceptMany(defaultSettings(), cards, counter());
    const keys = result.next.products.flatMap((entry) => entry.members.map((m) => `${m.rfc}|${m.key}`));
    expect(new Set(keys).size).toBe(keys.length);
    const names = result.next.products.map((entry) => entry.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
    // The cards that were not accepted still form a valid queue.
    const left = cards.filter((entry) => !result.acceptedIds.includes(entry.id));
    expect(pendingQueueSchema.safeParse({ products: left, categories: [] }).success).toBe(true);
  });
});
