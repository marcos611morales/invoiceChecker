import { describe, expect, it } from "vitest";
import {
  PENDING_LIMITS,
  SUGGESTIONS_VERSION,
  dropMember,
  enqueueProductSuggestions,
  memberKey,
  pendingQueueSchema,
  removeSuggestion,
  renameSuggestion,
  resolvePendingQueue,
  restoreMember,
  restoreSuggestion,
  toProductSuggestions,
  type CategorySuggestion,
  type PendingQueue,
  type ProductSuggestion,
  type SuggestionMember,
} from "./suggestions";
import type { ContextTarget } from "./candidates";

function member(rfc: string, key: string): SuggestionMember {
  return { rfc, key, description: `Descripción ${key}`, supplierName: `Tienda ${rfc}` };
}

function card(id: string, name: string, members: SuggestionMember[]): ProductSuggestion {
  return { id, name, target: null, members };
}

const LECHE_UNO = member("AAA010101AAA", "leche entera 1l");
const LECHE_DOS = member("BBB020202BBB", "leche entera 1l");
const CAFE = member("AAA010101AAA", "cafe molido 1kg");

/** Two product cards and one category row of each kind. */
function queue(): PendingQueue {
  return {
    products: [
      card("sug_a", "Leche entera", [LECHE_UNO, LECHE_DOS]),
      { id: "sug_b", name: "Café molido", target: "prod_1", members: [CAFE] },
    ],
    categories: [
      {
        id: "cat_a",
        kind: "supplier",
        rfc: "AAA010101AAA",
        name: "Tienda Uno",
        choice: { kind: "existing", categoryId: "seed:abarrotes-despensa" },
      },
      {
        id: "cat_b",
        kind: "product",
        productId: "prod_1",
        name: "Café molido",
        choice: { kind: "new", name: "Bebidas" },
      },
    ],
  };
}

function categoryRows(count: number): CategorySuggestion[] {
  return Array.from({ length: count }, (_unused, index) => ({
    id: `cat_${String(index)}`,
    kind: "supplier" as const,
    rfc: `RFC${String(index)}`,
    name: `Proveedor ${String(index)}`,
    choice: null,
  }));
}

function oneMemberCards(count: number, prefix = "k"): ProductSuggestion[] {
  return Array.from({ length: count }, (_unused, index) =>
    card(`sug_${prefix}${String(index)}`, `Producto ${String(index)}`, [
      member("AAA010101AAA", `${prefix}${String(index)}`),
    ]),
  );
}

const EMPTY: PendingQueue = { products: [], categories: [] };

describe("pending queue contract", () => {
  it("is stored version 1 with the limits of D-24", () => {
    expect(SUGGESTIONS_VERSION).toBe(1);
    expect(PENDING_LIMITS).toEqual({ productCards: 20000, members: 20000, categoryRows: 7000 });
  });
});

describe("resolvePendingQueue", () => {
  it("returns an empty queue and «absent» when nothing is stored", () => {
    expect(resolvePendingQueue(undefined, undefined)).toEqual({ data: EMPTY, status: "absent" });
  });

  it("returns a new empty queue on every call", () => {
    const first = resolvePendingQueue(undefined, undefined).data;
    const second = resolvePendingQueue(undefined, undefined).data;
    expect(first.products).not.toBe(second.products);
    expect(first.categories).not.toBe(second.categories);
  });

  it("keeps a valid queue as it is, both kinds of category row included", () => {
    const result = resolvePendingQueue(queue(), SUGGESTIONS_VERSION);
    expect(result.status).toBe("ok");
    expect(result.data).toEqual(queue());
  });

  it("reads a value with no stored version like the current version", () => {
    expect(resolvePendingQueue(queue(), undefined).status).toBe("ok");
  });

  it("accepts an empty queue, empty card names and the exact limits of a name", () => {
    expect(resolvePendingQueue(EMPTY, 1).status).toBe("ok");
    const long = "x".repeat(60);
    const edge: PendingQueue = {
      products: [card("sug_a", "", [LECHE_UNO]), card("sug_b", long, [CAFE])],
      categories: [
        {
          id: "cat_a",
          kind: "product",
          productId: "prod_1",
          name: long,
          choice: { kind: "new", name: long },
        },
        {
          id: "cat_b",
          kind: "supplier",
          rfc: "AAA010101AAA",
          name: "",
          choice: { kind: "new", name: "B" },
        },
      ],
    };
    expect(resolvePendingQueue(edge, 1)).toEqual({ data: edge, status: "ok" });
  });

  it("keeps an rfc or a key such as __proto__ as plain data", () => {
    const proto: PendingQueue = {
      products: [card("sug_a", "Leche", [member("__proto__", "__proto__")])],
      categories: [],
    };
    const parsed = JSON.parse(JSON.stringify(proto)) as unknown;
    const result = resolvePendingQueue(parsed, 1);
    expect(result.status).toBe("ok");
    expect(result.data.products[0]?.members[0]?.rfc).toBe("__proto__");
  });

  it("accepts the limit of category rows and refuses one more", () => {
    expect(
      resolvePendingQueue({ products: [], categories: categoryRows(PENDING_LIMITS.categoryRows) }, 1)
        .status,
    ).toBe("ok");
    expect(
      resolvePendingQueue(
        { products: [], categories: categoryRows(PENDING_LIMITS.categoryRows + 1) },
        1,
      ),
    ).toEqual({ data: EMPTY, status: "unreadable" });
  });

  it("accepts the limit of cards and refuses one more", () => {
    expect(
      resolvePendingQueue(
        { products: oneMemberCards(PENDING_LIMITS.productCards), categories: [] },
        1,
      ).status,
    ).toBe("ok");
    expect(
      resolvePendingQueue(
        { products: oneMemberCards(PENDING_LIMITS.productCards + 1), categories: [] },
        1,
      ),
    ).toEqual({ data: EMPTY, status: "unreadable" });
  });

  it("refuses more members than the limit across all the cards", () => {
    const heavy = (id: string, prefix: string, count: number): ProductSuggestion =>
      card(
        id,
        id,
        Array.from({ length: count }, (_unused, index) =>
          member("AAA010101AAA", `${prefix}${String(index)}`),
        ),
      );
    const atLimit: PendingQueue = {
      products: [heavy("sug_a", "a", 10000), heavy("sug_b", "b", 10000)],
      categories: [],
    };
    expect(resolvePendingQueue(atLimit, 1).status).toBe("ok");
    const over: PendingQueue = {
      products: [heavy("sug_a", "a", 10000), heavy("sug_b", "b", 10001)],
      categories: [],
    };
    expect(resolvePendingQueue(over, 1)).toEqual({ data: EMPTY, status: "unreadable" });
  });

  describe("an unusable value is «unreadable» with an empty queue, never an exception", () => {
    const broken: [string, unknown][] = [
      ["null", null],
      ["a string", "queue"],
      ["a number", 42],
      ["an array", []],
      ["no categories list", { products: [] }],
      ["no products list", { categories: [] }],
      ["products that are not a list", { products: "x", categories: [] }],
      ["a card with no member", { products: [card("sug_a", "Leche", [])], categories: [] }],
      [
        "a card without an id",
        { products: [{ name: "Leche", target: null, members: [LECHE_UNO] }], categories: [] },
      ],
      [
        "a card with an empty id",
        { products: [card("", "Leche", [LECHE_UNO])], categories: [] },
      ],
      [
        "a card name of 61 characters",
        { products: [card("sug_a", "x".repeat(61), [LECHE_UNO])], categories: [] },
      ],
      [
        "a card target that is not a string or null",
        { products: [{ ...card("sug_a", "Leche", [LECHE_UNO]), target: 3 }], categories: [] },
      ],
      [
        "a member key repeated in two cards",
        {
          products: [card("sug_a", "Leche", [LECHE_UNO]), card("sug_b", "Otra", [LECHE_UNO])],
          categories: [],
        },
      ],
      [
        "a member key repeated inside one card",
        { products: [card("sug_a", "Leche", [LECHE_UNO, LECHE_UNO])], categories: [] },
      ],
      [
        "a card id repeated",
        {
          products: [card("sug_a", "Leche", [LECHE_UNO]), card("sug_a", "Café", [CAFE])],
          categories: [],
        },
      ],
      [
        "a category row id repeated",
        { products: [], categories: [...categoryRows(1), ...categoryRows(1)] },
      ],
      [
        "a member with a field the queue never stores",
        {
          products: [
            { id: "sug_a", name: "Leche", target: null, members: [{ ...LECHE_UNO, total: "116.00" }] },
          ],
          categories: [],
        },
      ],
      [
        "a card with a field the queue never stores",
        {
          products: [{ ...card("sug_a", "Leche", [LECHE_UNO]), uuid: "11111111-2222-4333-8444-555555555501" }],
          categories: [],
        },
      ],
      [
        "a category row with both kinds of target",
        {
          products: [],
          categories: [
            {
              id: "cat_a",
              kind: "supplier",
              rfc: "AAA010101AAA",
              productId: "prod_1",
              name: "Tienda Uno",
              choice: null,
            },
          ],
        },
      ],
      [
        "a category row of an unknown kind",
        {
          products: [],
          categories: [{ id: "cat_a", kind: "month", rfc: "AAA010101AAA", name: "x", choice: null }],
        },
      ],
      [
        "a category row with no choice field",
        {
          products: [],
          categories: [{ id: "cat_a", kind: "supplier", rfc: "AAA010101AAA", name: "x" }],
        },
      ],
      [
        "a new category with an empty name",
        {
          products: [],
          categories: [
            {
              id: "cat_a",
              kind: "supplier",
              rfc: "AAA010101AAA",
              name: "x",
              choice: { kind: "new", name: "" },
            },
          ],
        },
      ],
      [
        "a new category name of 61 characters",
        {
          products: [],
          categories: [
            {
              id: "cat_a",
              kind: "supplier",
              rfc: "AAA010101AAA",
              name: "x",
              choice: { kind: "new", name: "y".repeat(61) },
            },
          ],
        },
      ],
      [
        "a choice of an unknown kind",
        {
          products: [],
          categories: [
            {
              id: "cat_a",
              kind: "supplier",
              rfc: "AAA010101AAA",
              name: "x",
              choice: { kind: "other", categoryId: "c" },
            },
          ],
        },
      ],
    ];

    it.each(broken)("%s", (_label, value) => {
      expect(resolvePendingQueue(value, 1)).toEqual({ data: EMPTY, status: "unreadable" });
    });

    it("a stored version that is not the current one", () => {
      expect(resolvePendingQueue(queue(), 2)).toEqual({ data: EMPTY, status: "unreadable" });
      expect(resolvePendingQueue(queue(), 0)).toEqual({ data: EMPTY, status: "unreadable" });
    });
  });

  it("is what pendingQueueSchema accepts", () => {
    expect(pendingQueueSchema.safeParse(queue()).success).toBe(true);
    expect(pendingQueueSchema.safeParse({ products: [], categories: "x" }).success).toBe(false);
  });
});

describe("enqueueProductSuggestions caps (D-24)", () => {
  it("adds cards up to the limit of members and then stops adding", () => {
    const queued = oneMemberCards(PENDING_LIMITS.productCards - 2, "q");
    const incoming = oneMemberCards(3, "n");
    const next = enqueueProductSuggestions(queued, incoming);
    expect(next).toHaveLength(PENDING_LIMITS.productCards);
    expect(next.slice(-2).map((entry) => entry.id)).toEqual(["sug_n0", "sug_n1"]);
    expect(next.some((entry) => entry.id === "sug_n2")).toBe(false);
  });

  it("adds nothing to a queue that is at the limit, and keeps the queue untouched", () => {
    const queued = oneMemberCards(PENDING_LIMITS.productCards, "q");
    const next = enqueueProductSuggestions(queued, oneMemberCards(1, "n"));
    expect(next).toHaveLength(PENDING_LIMITS.productCards);
    expect(next[next.length - 1]?.id).toBe(`sug_q${String(PENDING_LIMITS.productCards - 1)}`);
  });

  it("does not add a card whose members would pass the limit of members", () => {
    const queued = oneMemberCards(PENDING_LIMITS.members - 1, "q");
    const wide = card("sug_wide", "Ancha", [member("AAA010101AAA", "w1"), member("AAA010101AAA", "w2")]);
    expect(enqueueProductSuggestions(queued, [wide])).toHaveLength(PENDING_LIMITS.members - 1);
  });

  it("still skips members that are already pending", () => {
    const next = enqueueProductSuggestions(
      [card("sug_a", "Leche", [LECHE_UNO])],
      [card("sug_b", "Otra", [LECHE_UNO, CAFE])],
    );
    expect(next.map((entry) => entry.members.map((m) => m.key))).toEqual([
      ["leche entera 1l"],
      ["cafe molido 1kg"],
    ]);
  });
});

/** Freezes the queue deeply so any mutation by the code under test throws. */
function deepFreezeQueue(value: PendingQueue): PendingQueue {
  for (const entry of value.products) {
    for (const item of entry.members) Object.freeze(item);
    Object.freeze(entry.members);
    Object.freeze(entry);
  }
  for (const row of value.categories) Object.freeze(row);
  Object.freeze(value.products);
  Object.freeze(value.categories);
  return Object.freeze(value);
}

const LECHE_TRES = member("CCC030303CCC", "leche entera 1l");
const AZUCAR = member("AAA010101AAA", "azucar");

/** Three cards: «Leche entera» (three members), «Café molido» and «Azúcar» (one each). */
function reviewQueue(): PendingQueue {
  return {
    products: [
      card("sug_a", "Leche entera", [LECHE_UNO, LECHE_DOS, LECHE_TRES]),
      card("sug_b", "Café molido", [CAFE]),
      card("sug_c", "Azúcar", [AZUCAR]),
    ],
    categories: [],
  };
}

describe("renameSuggestion (D-12, D-19)", () => {
  it("stores the new name and keeps the id, the target and the members", () => {
    const base = reviewQueue();
    const next = renameSuggestion(base, "sug_a", "Leche");
    expect(next.products.map((entry) => entry.name)).toEqual(["Leche", "Café molido", "Azúcar"]);
    const [first] = next.products;
    expect(first?.id).toBe("sug_a");
    expect(first?.target).toBeNull();
    expect(first?.members).toEqual(base.products[0]?.members);
    expect(next.categories).toBe(base.categories);
  });

  it("cuts a 61-character name to 60", () => {
    const next = renameSuggestion(reviewQueue(), "sug_b", "n".repeat(61));
    expect(next.products[1]?.name).toBe("n".repeat(60));
    expect(pendingQueueSchema.safeParse(next).success).toBe(true);
  });

  it("keeps a name of exactly 60 characters whole", () => {
    expect(renameSuggestion(reviewQueue(), "sug_b", "n".repeat(60)).products[1]?.name).toBe(
      "n".repeat(60),
    );
  });

  it("never splits an emoji when it cuts", () => {
    const next = renameSuggestion(reviewQueue(), "sug_b", `${"a".repeat(59)}😀😀`);
    const name = next.products[1]?.name ?? "";
    expect(name.length).toBeLessThanOrEqual(60);
    expect(name).toBe("a".repeat(59));
    expect(pendingQueueSchema.safeParse(next).success).toBe(true);
  });

  it("allows an empty name while the user is editing", () => {
    const next = renameSuggestion(reviewQueue(), "sug_b", "");
    expect(next.products[1]?.name).toBe("");
    expect(pendingQueueSchema.safeParse(next).success).toBe(true);
  });

  it("returns the very same queue for an unknown id or an unchanged name", () => {
    const base = reviewQueue();
    expect(renameSuggestion(base, "sug_x", "Otro")).toBe(base);
    expect(renameSuggestion(base, "sug_a", "Leche entera")).toBe(base);
  });
});

describe("removeSuggestion and restoreSuggestion (D-22)", () => {
  it("takes the card out, reports its index, and restore gives back the same queue", () => {
    const base = reviewQueue();
    const result = removeSuggestion(base, "sug_b");
    if (result === null) throw new Error("expected a removal");
    expect(result.next.products.map((entry) => entry.id)).toEqual(["sug_a", "sug_c"]);
    expect(result.removed.index).toBe(1);
    expect(result.removed.card.name).toBe("Café molido");
    expect(restoreSuggestion(result.next, result.removed)).toEqual(base);
  });

  it("returns null for an unknown id", () => {
    expect(removeSuggestion(reviewQueue(), "sug_x")).toBeNull();
  });

  it("puts a card back at the end when the queue is shorter than its index now", () => {
    const base = reviewQueue();
    const last = removeSuggestion(base, "sug_c");
    if (last === null) throw new Error("expected a removal");
    const shorter: PendingQueue = { ...last.next, products: last.next.products.slice(0, 1) };
    const restored = restoreSuggestion(shorter, last.removed);
    expect(restored.products.map((entry) => entry.id)).toEqual(["sug_a", "sug_c"]);
  });

  it("leaves out a member that is pending in another card now", () => {
    const base = reviewQueue();
    const result = removeSuggestion(base, "sug_b");
    if (result === null) throw new Error("expected a removal");
    const taken: PendingQueue = {
      ...result.next,
      products: [...result.next.products, card("sug_n", "Nueva", [CAFE])],
    };
    // The only member of the card is pending elsewhere: the card is not restored at all.
    expect(restoreSuggestion(taken, result.removed)).toBe(taken);

    const wide = removeSuggestion(base, "sug_a");
    if (wide === null) throw new Error("expected a removal");
    const partly: PendingQueue = {
      ...wide.next,
      products: [...wide.next.products, card("sug_m", "Otra", [LECHE_DOS])],
    };
    const restored = restoreSuggestion(partly, wide.removed);
    const back = restored.products.find((entry) => entry.id === "sug_a");
    expect(back?.members.map((entry) => memberKey(entry))).toEqual([
      memberKey(LECHE_UNO),
      memberKey(LECHE_TRES),
    ]);
    expect(pendingQueueSchema.safeParse(restored).success).toBe(true);
  });

  it("does not restore a card whose id is already in the queue", () => {
    const base = reviewQueue();
    const result = removeSuggestion(base, "sug_b");
    if (result === null) throw new Error("expected a removal");
    const again: PendingQueue = {
      ...result.next,
      products: [...result.next.products, card("sug_b", "Otra", [member("ZZZ", "otro")])],
    };
    expect(restoreSuggestion(again, result.removed)).toBe(again);
  });

  it("does not restore past the card cap", () => {
    const full: PendingQueue = {
      products: oneMemberCards(PENDING_LIMITS.productCards, "q"),
      categories: [],
    };
    const removed = { card: card("sug_gone", "Fuera", [member("ZZZ", "fuera")]), index: 0 };
    expect(restoreSuggestion(full, removed)).toBe(full);
  });
});

describe("dropMember and restoreMember (D-19, D-22)", () => {
  it("takes a middle member out of a card that keeps others, and restore puts it back at its index", () => {
    const base = reviewQueue();
    const result = dropMember(base, "sug_a", memberKey(LECHE_DOS));
    if (result === null) throw new Error("expected a drop");
    expect(result.next.products[0]?.members.map((entry) => entry.rfc)).toEqual([
      "AAA010101AAA",
      "CCC030303CCC",
    ]);
    expect(result.dropped.index).toBe(1);
    expect(result.dropped.cardId).toBe("sug_a");
    expect(result.dropped.member).toEqual(LECHE_DOS);
    expect(result.dropped.card).toBeNull();
    expect(restoreMember(result.next, result.dropped)).toEqual(base);
  });

  it("removes the card when the member was its only one, and restore brings the card back at its index", () => {
    const base = reviewQueue();
    const result = dropMember(base, "sug_b", memberKey(CAFE));
    if (result === null) throw new Error("expected a drop");
    expect(result.next.products.map((entry) => entry.id)).toEqual(["sug_a", "sug_c"]);
    expect(result.dropped.card?.index).toBe(1);
    expect(result.dropped.card?.card.name).toBe("Café molido");
    expect(restoreMember(result.next, result.dropped)).toEqual(base);
  });

  it("returns null for an unknown card or a member the card does not have", () => {
    const base = reviewQueue();
    expect(dropMember(base, "sug_x", memberKey(CAFE))).toBeNull();
    expect(dropMember(base, "sug_a", memberKey(CAFE))).toBeNull();
  });

  it("does not put a member back when it is pending somewhere now, or its card is gone", () => {
    const base = reviewQueue();
    const result = dropMember(base, "sug_a", memberKey(LECHE_DOS));
    if (result === null) throw new Error("expected a drop");
    const takenElsewhere: PendingQueue = {
      ...result.next,
      products: [...result.next.products, card("sug_n", "Nueva", [LECHE_DOS])],
    };
    expect(restoreMember(takenElsewhere, result.dropped)).toBe(takenElsewhere);
    const cardGone: PendingQueue = {
      ...result.next,
      products: result.next.products.filter((entry) => entry.id !== "sug_a"),
    };
    expect(restoreMember(cardGone, result.dropped)).toBe(cardGone);
  });

  it("does not put a member back past the member cap", () => {
    const base = reviewQueue();
    const result = dropMember(base, "sug_a", memberKey(LECHE_DOS));
    if (result === null) throw new Error("expected a drop");
    const full: PendingQueue = {
      products: [
        ...result.next.products.slice(0, 1),
        ...oneMemberCards(PENDING_LIMITS.members - 2, "q"),
      ],
      categories: [],
    };
    expect(restoreMember(full, result.dropped)).toBe(full);
  });
});

describe("review reducers never mutate their input", () => {
  it("accept a frozen queue for every operation, and every result is a valid queue", () => {
    const frozen = deepFreezeQueue(reviewQueue());
    const results: PendingQueue[] = [];
    expect(() => {
      results.push(renameSuggestion(frozen, "sug_a", "Otro"));
      const removed = removeSuggestion(frozen, "sug_a");
      if (removed !== null) {
        results.push(removed.next, restoreSuggestion(removed.next, removed.removed));
      }
      const dropped = dropMember(frozen, "sug_a", memberKey(LECHE_UNO));
      if (dropped !== null) results.push(dropped.next, restoreMember(dropped.next, dropped.dropped));
      const lone = dropMember(frozen, "sug_b", memberKey(CAFE));
      if (lone !== null) results.push(lone.next, restoreMember(lone.next, lone.dropped));
    }).not.toThrow();
    expect(results).toHaveLength(7);
    for (const result of results) {
      expect(pendingQueueSchema.safeParse(result).success).toBe(true);
    }
  });
});

describe("toProductSuggestions: «Agregar a» cards (D-21)", () => {
  const MILK_A = member("AAA010101AAA", "leche a");
  const MILK_B = member("BBB020202BBB", "leche b");
  const MILK_C = member("CCC030303CCC", "leche c");
  const OIL = member("AAA010101AAA", "aceite");
  const idMap = new Map<string, SuggestionMember>([
    ["i1", MILK_A],
    ["i2", MILK_B],
    ["i3", MILK_C],
    ["i4", OIL],
  ]);
  const targets = new Map<string, ContextTarget>([
    ["p1", { kind: "product", productId: "prod_leche" }],
    ["p2", { kind: "product", productId: "prod_aceite" }],
  ]);
  function ids(): () => string {
    let next = 0;
    return () => {
      next += 1;
      return `sug_${String(next)}`;
    };
  }

  it("turns a group that points at an accepted product into a card with that product as target", () => {
    const cards = toProductSuggestions(
      [{ name: "Leche", ids: ["i1", "i2"], existing: "p1" }],
      idMap,
      targets,
      ids(),
    );
    expect(cards).toEqual([
      { id: "sug_1", name: "Leche", target: "prod_leche", members: [MILK_A, MILK_B] },
    ]);
  });

  it("leaves a plain group as a new product and ignores a context id that was never sent", () => {
    const cards = toProductSuggestions(
      [
        { name: "Aceite", ids: ["i4"], existing: null },
        { name: "Leche", ids: ["i1"], existing: "p9" },
      ],
      idMap,
      targets,
      ids(),
    );
    expect(cards.map((entry) => entry.target)).toEqual([null, null]);
  });

  it("merges two groups of one answer that point at the same product into one card, in answer order", () => {
    const cards = toProductSuggestions(
      [
        { name: "Leche entera", ids: ["i2"], existing: "p1" },
        { name: "Aceite", ids: ["i4"], existing: null },
        { name: "Leche deslactosada", ids: ["i3", "i1"], existing: "p1" },
      ],
      idMap,
      targets,
      ids(),
    );
    expect(cards).toEqual([
      { id: "sug_1", name: "Leche entera", target: "prod_leche", members: [MILK_B, MILK_C, MILK_A] },
      { id: "sug_2", name: "Aceite", target: null, members: [OIL] },
    ]);
  });

  it("keeps groups that point at different products apart and does not repeat a member", () => {
    const cards = toProductSuggestions(
      [
        { name: "Leche", ids: ["i1", "i2"], existing: "p1" },
        { name: "Aceite", ids: ["i4"], existing: "p2" },
        { name: "Leche otra vez", ids: ["i2", "i3"], existing: "p1" },
      ],
      idMap,
      targets,
      ids(),
    );
    expect(cards.map((entry) => [entry.target, entry.members])).toEqual([
      ["prod_leche", [MILK_A, MILK_B, MILK_C]],
      ["prod_aceite", [OIL]],
    ]);
  });
});
