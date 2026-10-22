import { describe, expect, it } from "vitest";
import {
  PENDING_LIMITS,
  SUGGESTIONS_VERSION,
  appendSuggestionMembers,
  categoryTargetKey,
  dropMember,
  enqueueCategorySuggestions,
  enqueueProductSuggestions,
  memberKey,
  mergeSuggestions,
  pendingQueueSchema,
  pruneCategoryRows,
  removeCategoryRow,
  removeSuggestion,
  renameSuggestion,
  resolvePendingQueue,
  resolveProductAnswer,
  restoreCategoryRow,
  restoreMember,
  restoreSuggestion,
  setCategoryChoice,
  splitSuggestion,
  toProductSuggestions,
  turnIntoAddCard,
  undoQueueChange,
  type CategoryChoice,
  type CategorySuggestion,
  type PendingQueue,
  type ProductSuggestion,
  type PruneSettings,
  type RunContext,
  type SuggestionMember,
} from "./suggestions";
import { cutText, type ContextTarget } from "./candidates";
import { LLM_LIMITS } from "./contract";

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

describe("resolveProductAnswer: pending targets of one run (D-28, D-33)", () => {
  const MILK_A = member("AAA010101AAA", "leche a");
  const MILK_B = member("BBB020202BBB", "leche b");
  const MILK_C = member("CCC030303CCC", "leche c");
  const OIL = member("AAA010101AAA", "aceite");
  const idMap = new Map<string, SuggestionMember>([
    ["i1", MILK_B],
    ["i2", MILK_C],
    ["i3", OIL],
  ]);
  const targets = new Map<string, ContextTarget>([
    ["p1", { kind: "product", productId: "prod_aceite" }],
    ["p2", { kind: "pending", suggestionId: "sug_old" }],
  ]);
  function ids(): () => string {
    let next = 0;
    return () => {
      next += 1;
      return `sug_new_${String(next)}`;
    };
  }
  /** The card batch 1 enqueued, with the member it carried. */
  const OLD_CARD: ProductSuggestion = { id: "sug_old", name: "Leche", target: null, members: [MILK_A] };
  function context(overrides: Partial<RunContext> = {}): RunContext {
    return {
      queue: [OLD_CARD],
      productIdOfMember: () => null,
      runCards: new Map([["sug_old", [memberKey(MILK_A)]]]),
      ...overrides,
    };
  }

  it("appends the members of a group placed with a card that is still pending and creates no card", () => {
    const answer = resolveProductAnswer(
      [{ name: "Leche entera", ids: ["i1", "i2"], existing: "p2" }],
      idMap,
      targets,
      ids(),
      context(),
    );
    expect(answer.cards).toEqual([]);
    expect(answer.appends).toEqual([{ cardId: "sug_old", members: [MILK_B, MILK_C] }]);
  });

  it("gathers two groups of one answer that point at the same pending card into one append, none twice", () => {
    const answer = resolveProductAnswer(
      [
        { name: "Leche B", ids: ["i1"], existing: "p2" },
        { name: "Aceite", ids: ["i3"], existing: null },
        { name: "Leche otra vez", ids: ["i2", "i1"], existing: "p2" },
      ],
      idMap,
      targets,
      ids(),
      context(),
    );
    expect(answer.appends).toEqual([{ cardId: "sug_old", members: [MILK_B, MILK_C] }]);
    expect(answer.cards).toEqual([{ id: "sug_new_1", name: "Aceite", target: null, members: [OIL] }]);
  });

  it("becomes an «Agregar a» card for the product that now holds the card's members once the user accepted it", () => {
    const answer = resolveProductAnswer(
      [{ name: "Leche entera", ids: ["i1"], existing: "p2" }],
      idMap,
      targets,
      ids(),
      context({
        queue: [],
        productIdOfMember: (key) => (key === memberKey(MILK_A) ? "prod_leche" : null),
      }),
    );
    expect(answer.appends).toEqual([]);
    expect(answer.cards).toEqual([
      { id: "sug_new_1", name: "Leche entera", target: "prod_leche", members: [MILK_B] },
    ]);
  });

  it("merges it with another group of the answer that points at the same accepted product", () => {
    const answer = resolveProductAnswer(
      [
        { name: "Aceite", ids: ["i3"], existing: "p1" },
        { name: "Aceite y leche", ids: ["i1"], existing: "p2" },
      ],
      idMap,
      targets,
      ids(),
      context({ queue: [], productIdOfMember: () => "prod_aceite" }),
    );
    expect(answer.cards).toEqual([
      { id: "sug_new_1", name: "Aceite", target: "prod_aceite", members: [OIL, MILK_B] },
    ]);
  });

  it("keeps its own card with the group's name when the user rejected the card", () => {
    const answer = resolveProductAnswer(
      [{ name: "Leche entera", ids: ["i1", "i2"], existing: "p2" }],
      idMap,
      targets,
      ids(),
      context({ queue: [] }),
    );
    expect(answer.appends).toEqual([]);
    expect(answer.cards).toEqual([
      { id: "sug_new_1", name: "Leche entera", target: null, members: [MILK_B, MILK_C] },
    ]);
  });

  it("keeps its own card when the card of the run is unknown or its product was deleted", () => {
    const unknown = resolveProductAnswer(
      [{ name: "Leche entera", ids: ["i1"], existing: "p2" }],
      idMap,
      targets,
      ids(),
      context({ queue: [], runCards: new Map() }),
    );
    expect(unknown.cards.map((entry) => entry.target)).toEqual([null]);
    const deleted = resolveProductAnswer(
      [{ name: "Leche entera", ids: ["i1"], existing: "p2" }],
      idMap,
      targets,
      ids(),
      context({ queue: [], productIdOfMember: () => null }),
    );
    expect(deleted.cards.map((entry) => entry.target)).toEqual([null]);
  });

  it("does not append a member that is already in the pending card, and drops an append left empty", () => {
    const withMember: ProductSuggestion = { ...OLD_CARD, members: [MILK_A, MILK_B] };
    const answer = resolveProductAnswer(
      [{ name: "Leche", ids: ["i1"], existing: "p2" }],
      idMap,
      targets,
      ids(),
      context({ queue: [withMember] }),
    );
    expect(answer.appends).toEqual([]);
    expect(answer.cards).toEqual([]);
  });

  it("treats a pending target without a run context as a new card and matches toProductSuggestions", () => {
    const groups = [{ name: "Leche entera", ids: ["i1"], existing: "p2" }];
    const cards = toProductSuggestions(groups, idMap, targets, ids());
    expect(cards).toEqual([
      { id: "sug_new_1", name: "Leche entera", target: null, members: [MILK_B] },
    ]);
  });

  it("never changes its inputs", () => {
    const frozenQueue = [deepFreezeCard(OLD_CARD)];
    const frozenRun = new Map<string, readonly string[]>([["sug_old", Object.freeze([memberKey(MILK_A)])]]);
    expect(() =>
      resolveProductAnswer(
        [{ name: "Leche", ids: ["i1"], existing: "p2" }],
        idMap,
        targets,
        ids(),
        { queue: frozenQueue, productIdOfMember: () => null, runCards: frozenRun },
      ),
    ).not.toThrow();
    expect(frozenQueue[0]?.members).toEqual([MILK_A]);
  });
});

function deepFreezeCard(value: ProductSuggestion): ProductSuggestion {
  for (const entry of value.members) Object.freeze(entry);
  Object.freeze(value.members);
  return Object.freeze(value);
}

describe("appendSuggestionMembers (D-33)", () => {
  const NEW_ONE = member("DDD040404DDD", "leche d");
  const NEW_TWO = member("EEE050505EEE", "leche e");

  it("adds the members at the end of the card, in order, and the result is a valid queue", () => {
    const base = reviewQueue();
    const next = appendSuggestionMembers(base, "sug_a", [NEW_ONE, NEW_TWO]);
    const target = next.products.find((entry) => entry.id === "sug_a");
    expect(target?.members.slice(-2)).toEqual([NEW_ONE, NEW_TWO]);
    expect(next.products.find((entry) => entry.id === "sug_b")).toEqual(
      base.products.find((entry) => entry.id === "sug_b"),
    );
    expect(pendingQueueSchema.safeParse(next).success).toBe(true);
  });

  it("is idempotent per member: one already pending in any card is skipped, and nothing new is the same queue", () => {
    const base = reviewQueue();
    const once = appendSuggestionMembers(base, "sug_a", [NEW_ONE, CAFE]);
    expect(once.products.find((entry) => entry.id === "sug_a")?.members.filter((m) => memberKey(m) === memberKey(CAFE))).toHaveLength(0);
    expect(appendSuggestionMembers(once, "sug_a", [NEW_ONE, CAFE])).toBe(once);
  });

  it("returns the same queue for an unknown card", () => {
    const base = reviewQueue();
    expect(appendSuggestionMembers(base, "sug_missing", [NEW_ONE])).toBe(base);
  });

  it("stops at the members limit and does not change its input", () => {
    const full: PendingQueue = {
      products: [card("sug_full", "Lleno", manyMembers(PENDING_LIMITS.members - 1))],
      categories: [],
    };
    const frozen = deepFreezeQueue(full);
    const next = appendSuggestionMembers(frozen, "sug_full", [NEW_ONE, NEW_TWO]);
    expect(next.products[0]?.members).toHaveLength(PENDING_LIMITS.members);
    expect(pendingQueueSchema.safeParse(next).success).toBe(true);
    expect(frozen.products[0]?.members).toHaveLength(PENDING_LIMITS.members - 1);
  });
});

function manyMembers(count: number): SuggestionMember[] {
  return Array.from({ length: count }, (_, index) => member("ZZZ990909ZZZ", `producto ${String(index)}`));
}

describe("mergeSuggestions, turnIntoAddCard, splitSuggestion and undoQueueChange (D-19)", () => {
  type Change = NonNullable<ReturnType<typeof mergeSuggestions>>;
  const LECHE_TRES_KEY = memberKey(LECHE_TRES);

  /** «A» (two members), «B» (one) and «C» (one), the shape of the join example. */
  function joinQueue(): PendingQueue {
    return {
      products: [
        card("sug_a", "Leche entera", [LECHE_UNO, LECHE_DOS]),
        card("sug_b", "Café molido", [CAFE]),
        card("sug_c", "Azúcar", [AZUCAR]),
      ],
      categories: categoryRows(2),
    };
  }

  function merged(queue: PendingQueue, fromId: string, intoId: string): Change {
    const result = mergeSuggestions(queue, fromId, intoId);
    if (result === null) throw new Error("expected a merge");
    return result;
  }

  describe("mergeSuggestions", () => {
    it("appends the members of A to B in order, removes A, and keeps B's id, name and target", () => {
      const base = joinQueue();
      const { next, undo } = merged(base, "sug_a", "sug_b");
      expect(next.products.map((entry) => entry.id)).toEqual(["sug_b", "sug_c"]);
      expect(next.products[0]).toEqual({
        id: "sug_b",
        name: "Café molido",
        target: null,
        members: [CAFE, LECHE_UNO, LECHE_DOS],
      });
      expect(next.categories).toBe(base.categories);
      expect(undo.createdId).toBeNull();
    });

    it("keeps the «Agregar a» target of the card that receives the members", () => {
      const base: PendingQueue = {
        products: [
          card("sug_a", "Leche entera", [LECHE_UNO]),
          { id: "sug_b", name: "Café", target: "prod_1", members: [CAFE] },
        ],
        categories: [],
      };
      const { next } = merged(base, "sug_a", "sug_b");
      expect(next.products).toEqual([
        { id: "sug_b", name: "Café", target: "prod_1", members: [CAFE, LECHE_UNO] },
      ]);
    });

    it("undo gives back the original queue, whichever card comes first", () => {
      const base = joinQueue();
      const forward = merged(base, "sug_a", "sug_b");
      expect(undoQueueChange(forward.next, forward.undo)).toEqual(base);
      const backward = merged(base, "sug_c", "sug_a");
      expect(backward.next.products.map((entry) => entry.id)).toEqual(["sug_a", "sug_b"]);
      expect(undoQueueChange(backward.next, backward.undo)).toEqual(base);
    });

    it("returns null for the same card or for an unknown card", () => {
      const base = joinQueue();
      expect(mergeSuggestions(base, "sug_a", "sug_a")).toBeNull();
      expect(mergeSuggestions(base, "sug_x", "sug_b")).toBeNull();
      expect(mergeSuggestions(base, "sug_a", "sug_x")).toBeNull();
    });
  });

  describe("turnIntoAddCard", () => {
    it("sets the target and keeps the id, the name and the members", () => {
      const base = joinQueue();
      const result = turnIntoAddCard(base, "sug_b", "prod_1");
      if (result === null) throw new Error("expected a change");
      expect(result.next.products[1]).toEqual({
        id: "sug_b",
        name: "Café molido",
        target: "prod_1",
        members: [CAFE],
      });
      expect(result.next.products[0]).toEqual(base.products[0]);
      expect(result.undo.createdId).toBeNull();
    });

    it("undo clears the target again", () => {
      const base = joinQueue();
      const result = turnIntoAddCard(base, "sug_b", "prod_1");
      if (result === null) throw new Error("expected a change");
      expect(undoQueueChange(result.next, result.undo)).toEqual(base);
    });

    it("returns null for an unknown card, or when the card already points at that product", () => {
      const base = joinQueue();
      expect(turnIntoAddCard(base, "sug_x", "prod_1")).toBeNull();
      const once = turnIntoAddCard(base, "sug_b", "prod_1");
      if (once === null) throw new Error("expected a change");
      expect(turnIntoAddCard(once.next, "sug_b", "prod_1")).toBeNull();
    });
  });

  describe("splitSuggestion", () => {
    function splitQueue(): PendingQueue {
      return {
        products: [
          card("sug_c", "Leche entera", [LECHE_UNO, LECHE_DOS, LECHE_TRES]),
          card("sug_d", "Azúcar", [AZUCAR]),
        ],
        categories: categoryRows(1),
      };
    }

    it("keeps the unchecked members in the card and puts the checked ones in a new card right below", () => {
      const base = splitQueue();
      const result = splitSuggestion(
        base,
        "sug_c",
        [memberKey(LECHE_DOS), LECHE_TRES_KEY],
        "sug_new",
      );
      if (result === null) throw new Error("expected a split");
      expect(result.next.products).toEqual([
        { id: "sug_c", name: "Leche entera", target: null, members: [LECHE_UNO] },
        {
          id: "sug_new",
          name: LECHE_DOS.description,
          target: null,
          members: [LECHE_DOS, LECHE_TRES],
        },
        base.products[1],
      ]);
      expect(result.undo.createdId).toBe("sug_new");
      expect(result.next.categories).toBe(base.categories);
    });

    it("keeps the order of the card, not the order of the keys, and names the card after its first checked member", () => {
      const result = splitSuggestion(
        splitQueue(),
        "sug_c",
        [LECHE_TRES_KEY, memberKey(LECHE_DOS)],
        "sug_new",
      );
      if (result === null) throw new Error("expected a split");
      expect(result.next.products[1]?.members).toEqual([LECHE_DOS, LECHE_TRES]);
      expect(result.next.products[1]?.name).toBe(LECHE_DOS.description);
    });

    it("cuts the name of the new card to 60 characters", () => {
      const long: SuggestionMember = {
        rfc: "AAA010101AAA",
        key: "descripcion larga",
        description: "d".repeat(90),
        supplierName: "Tienda Uno",
      };
      const base: PendingQueue = {
        products: [card("sug_c", "Varios", [LECHE_UNO, long])],
        categories: [],
      };
      const result = splitSuggestion(base, "sug_c", [memberKey(long)], "sug_new");
      if (result === null) throw new Error("expected a split");
      const name = result.next.products[1]?.name ?? "";
      expect(name).toBe(cutText(long.description, LLM_LIMITS.productName));
      expect(name.length).toBeLessThanOrEqual(60);
    });

    it("undo restores the card with all its members and removes the new card", () => {
      const base = splitQueue();
      const result = splitSuggestion(base, "sug_c", [memberKey(LECHE_DOS)], "sug_new");
      if (result === null) throw new Error("expected a split");
      expect(undoQueueChange(result.next, result.undo)).toEqual(base);
    });

    it("splits an «Agregar a» card into a new product card and leaves the target on the original", () => {
      const base: PendingQueue = {
        products: [{ id: "sug_c", name: "Leche", target: "prod_1", members: [LECHE_UNO, LECHE_DOS] }],
        categories: [],
      };
      const result = splitSuggestion(base, "sug_c", [memberKey(LECHE_DOS)], "sug_new");
      if (result === null) throw new Error("expected a split");
      expect(result.next.products[0]?.target).toBe("prod_1");
      expect(result.next.products[1]?.target).toBeNull();
      expect(undoQueueChange(result.next, result.undo)).toEqual(base);
    });

    it("returns null with no key in the card, with every member checked, or for an unknown card", () => {
      const base = splitQueue();
      const all = base.products[0]?.members.map(memberKey) ?? [];
      expect(splitSuggestion(base, "sug_c", [], "sug_new")).toBeNull();
      expect(splitSuggestion(base, "sug_c", [memberKey(AZUCAR)], "sug_new")).toBeNull();
      expect(splitSuggestion(base, "sug_c", all, "sug_new")).toBeNull();
      expect(splitSuggestion(base, "sug_x", [memberKey(LECHE_DOS)], "sug_new")).toBeNull();
    });

    it("ignores keys the card does not have as long as some but not all of its members are named", () => {
      const result = splitSuggestion(
        splitQueue(),
        "sug_c",
        [memberKey(LECHE_DOS), memberKey(AZUCAR)],
        "sug_new",
      );
      expect(result?.next.products[1]?.members).toEqual([LECHE_DOS]);
    });

    it("refuses a new id that is already in the queue", () => {
      expect(splitSuggestion(splitQueue(), "sug_c", [memberKey(LECHE_DOS)], "sug_d")).toBeNull();
    });

    it("refuses to pass the card cap (an input already at the cap)", () => {
      const atCap: PendingQueue = {
        products: [
          card("sug_c", "Leche entera", [LECHE_UNO, LECHE_DOS]),
          ...oneMemberCards(PENDING_LIMITS.productCards - 1),
        ],
        categories: [],
      };
      expect(splitSuggestion(atCap, "sug_c", [memberKey(LECHE_DOS)], "sug_new")).toBeNull();
    });
  });

  describe("undoQueueChange", () => {
    it("leaves out a member that is pending in another card now", () => {
      const base: PendingQueue = {
        products: [card("sug_c", "Leche entera", [LECHE_UNO, LECHE_DOS, LECHE_TRES])],
        categories: [],
      };
      const result = splitSuggestion(base, "sug_c", [memberKey(LECHE_DOS)], "sug_new");
      if (result === null) throw new Error("expected a split");
      // The user moved the new card's member into another card meanwhile.
      const meanwhile: PendingQueue = {
        products: [
          ...result.next.products.filter((entry) => entry.id === "sug_c"),
          card("sug_x", "Otra", [LECHE_DOS]),
        ],
        categories: [],
      };
      const undone = undoQueueChange(meanwhile, result.undo);
      expect(undone.products.map((entry) => entry.id)).toEqual(["sug_c", "sug_x"]);
      expect(undone.products[0]?.members).toEqual([LECHE_UNO, LECHE_TRES]);
      expect(pendingQueueSchema.safeParse(undone).success).toBe(true);
    });

    it("keeps a member that a later batch added to a card of the change", () => {
      const base = joinQueue();
      const { next, undo } = merged(base, "sug_a", "sug_b");
      const late = member("DDD040404DDD", "te verde 20 sobres");
      const meanwhile = appendSuggestionMembers(next, "sug_b", [late]);
      const undone = undoQueueChange(meanwhile, undo);
      expect(undone.products.map((entry) => entry.id)).toEqual(["sug_a", "sug_b", "sug_c"]);
      expect(undone.products[0]?.members).toEqual([LECHE_UNO, LECHE_DOS]);
      expect(undone.products[1]?.members).toEqual([CAFE, late]);
      expect(pendingQueueSchema.safeParse(undone).success).toBe(true);

      // The created card of a split took the late member: it goes back to the restored card.
      const split = splitSuggestion(base, "sug_a", [memberKey(LECHE_DOS)], "sug_new");
      if (split === null) throw new Error("expected a split");
      const afterSplit = appendSuggestionMembers(split.next, "sug_new", [late]);
      const back = undoQueueChange(afterSplit, split.undo);
      expect(back.products.map((entry) => entry.id)).toEqual(["sug_a", "sug_b", "sug_c"]);
      expect(back.products[0]?.members).toEqual([LECHE_UNO, LECHE_DOS, late]);
    });

    it("does nothing when no card of the change is left in the queue (it was accepted or rejected)", () => {
      const base = joinQueue();
      const { next, undo } = merged(base, "sug_a", "sug_b");
      const gone: PendingQueue = {
        ...next,
        products: next.products.filter((entry) => entry.id !== "sug_b"),
      };
      expect(undoQueueChange(gone, undo)).toBe(gone);
    });

    it("is idempotent: a second undo changes nothing", () => {
      const base = joinQueue();
      const { next, undo } = merged(base, "sug_a", "sug_b");
      const once = undoQueueChange(next, undo);
      expect(undoQueueChange(once, undo)).toEqual(base);
    });
  });

  it("never mutates a frozen queue, and every result is a valid queue", () => {
    const frozen = deepFreezeQueue(joinQueue());
    const results: PendingQueue[] = [];
    expect(() => {
      const join = mergeSuggestions(frozen, "sug_a", "sug_b");
      if (join !== null) results.push(join.next, undoQueueChange(join.next, join.undo));
      const turn = turnIntoAddCard(frozen, "sug_a", "prod_1");
      if (turn !== null) results.push(turn.next, undoQueueChange(turn.next, turn.undo));
      const split = splitSuggestion(frozen, "sug_a", [memberKey(LECHE_DOS)], "sug_new");
      if (split !== null) results.push(split.next, undoQueueChange(split.next, split.undo));
    }).not.toThrow();
    expect(results).toHaveLength(6);
    for (const result of results) {
      expect(pendingQueueSchema.safeParse(result).success).toBe(true);
    }
  });

  it("gives an undo value that shares nothing with the queue", () => {
    const base = joinQueue();
    const { undo } = merged(base, "sug_a", "sug_b");
    const saved = undo.cards.find((entry) => entry.card.id === "sug_a");
    expect(saved?.card).toEqual(base.products[0]);
    expect(saved?.card).not.toBe(base.products[0]);
    expect(saved?.card.members).not.toBe(base.products[0]?.members);
  });
});

describe("enqueueCategorySuggestions (A-2, D-23)", () => {
  function supplierRow(id: string, rfc: string): CategorySuggestion {
    return { id, kind: "supplier", rfc, name: `Tienda ${rfc}`, choice: { kind: "new", name: "Bebidas" } };
  }
  function productRow(id: string, productId: string): CategorySuggestion {
    return { id, kind: "product", productId, name: productId, choice: null };
  }

  it("keys a supplier by its RFC and a product by its id, apart from each other", () => {
    expect(categoryTargetKey(supplierRow("r", "AAA"))).toBe("supplier:AAA");
    expect(categoryTargetKey(productRow("r", "AAA"))).toBe("product:AAA");
  });

  it("adds the rows in order and never changes the queued ones", () => {
    const queued = [supplierRow("r1", "AAA")];
    const next = enqueueCategorySuggestions(queued, [supplierRow("r2", "BBB"), productRow("r3", "p1")]);
    expect(next.map((row) => row.id)).toEqual(["r1", "r2", "r3"]);
    expect(queued).toHaveLength(1);
    expect(next).not.toBe(queued);
  });

  it("skips a target that already has a row and a target that repeats inside the incoming rows", () => {
    const queued = [supplierRow("r1", "AAA"), productRow("r2", "p1")];
    const next = enqueueCategorySuggestions(queued, [
      supplierRow("r3", "AAA"),
      productRow("r4", "p1"),
      supplierRow("r5", "BBB"),
      supplierRow("r6", "BBB"),
    ]);
    expect(next.map((row) => row.id)).toEqual(["r1", "r2", "r5"]);
  });

  it("is idempotent: the same rows twice give the same queue", () => {
    const incoming = [supplierRow("r1", "AAA"), productRow("r2", "p1")];
    const once = enqueueCategorySuggestions([], incoming);
    expect(enqueueCategorySuggestions(once, incoming)).toEqual(once);
  });

  it("stops at the stored limit, so the queue it returns is always readable", () => {
    const full = Array.from({ length: PENDING_LIMITS.categoryRows }, (_unused, index) =>
      supplierRow(`r${String(index)}`, `RFC${String(index)}`),
    );
    const next = enqueueCategorySuggestions(full, [supplierRow("extra", "OTHER")]);
    expect(next).toHaveLength(PENDING_LIMITS.categoryRows);
    expect(
      pendingQueueSchema.safeParse({ products: [], categories: next }).success,
    ).toBe(true);
  });

  it("returns rows the stored-queue schema accepts", () => {
    const next = enqueueCategorySuggestions([], [supplierRow("r1", "AAA"), productRow("r2", "p1")]);
    expect(pendingQueueSchema.safeParse({ products: [], categories: next }).success).toBe(true);
  });
});

describe("pruneCategoryRows (D-07, D-18, D-34, A-3)", () => {
  const settings: PruneSettings = {
    categories: [{ id: "cat_bebidas" }, { id: "cat_limpieza" }],
    supplierCategories: [],
    products: [
      { id: "p_con", categoryId: "cat_bebidas" },
      { id: "p_sin", categoryId: null },
    ],
  };

  function supplierRow(id: string, rfc: string): CategorySuggestion {
    return { id, kind: "supplier", rfc, name: `Tienda ${rfc}`, choice: { kind: "new", name: "Bebidas" } };
  }
  function productRow(id: string, productId: string): CategorySuggestion {
    return { id, kind: "product", productId, name: productId, choice: null };
  }
  function queueOf(rows: CategorySuggestion[]): PendingQueue {
    return { products: [card("sug_a", "Leche", [LECHE_UNO])], categories: rows };
  }
  function withAssignment(rfc: string, categoryId: string): PruneSettings {
    return { ...settings, supplierCategories: [{ rfc, categoryId }] };
  }

  it("returns the very same queue when every row still needs a category", () => {
    const base = queueOf([supplierRow("r1", "AAA"), productRow("r2", "p_sin")]);
    expect(pruneCategoryRows(base, settings)).toBe(base);
  });

  it("returns the very same queue when there are no rows", () => {
    expect(pruneCategoryRows(EMPTY, settings)).toBe(EMPTY);
  });

  it("drops a supplier row whose supplier now has a default category", () => {
    const base = queueOf([supplierRow("r1", "AAA"), supplierRow("r2", "BBB")]);
    const next = pruneCategoryRows(base, withAssignment("AAA", "cat_bebidas"));
    expect(next.categories.map((row) => row.id)).toEqual(["r2"]);
  });

  it("keeps a supplier row whose assignment points at a category that no longer exists", () => {
    const base = queueOf([supplierRow("r1", "AAA")]);
    expect(pruneCategoryRows(base, withAssignment("AAA", "cat_borrada"))).toBe(base);
  });

  it("drops a product row whose product now has a category", () => {
    const base = queueOf([productRow("r1", "p_con"), productRow("r2", "p_sin")]);
    const next = pruneCategoryRows(base, settings);
    expect(next.categories.map((row) => row.id)).toEqual(["r2"]);
  });

  it("drops a product row whose product was deleted", () => {
    const base = queueOf([productRow("r1", "p_borrado"), productRow("r2", "p_sin")]);
    const next = pruneCategoryRows(base, settings);
    expect(next.categories.map((row) => row.id)).toEqual(["r2"]);
  });

  it("keeps the order of the other rows and never touches the product cards", () => {
    const base = queueOf([
      supplierRow("r1", "AAA"),
      productRow("r2", "p_con"),
      supplierRow("r3", "CCC"),
      productRow("r4", "p_sin"),
    ]);
    const next = pruneCategoryRows(base, withAssignment("AAA", "cat_limpieza"));
    expect(next.categories.map((row) => row.id)).toEqual(["r3", "r4"]);
    expect(next.products).toBe(base.products);
  });

  it("keeps a supplier and a product that share an id apart", () => {
    const base = queueOf([supplierRow("r1", "p_con"), productRow("r2", "p_con")]);
    const next = pruneCategoryRows(base, settings);
    expect(next.categories.map((row) => row.id)).toEqual(["r1"]);
  });

  it("never mutates its input and returns a queue the stored schema accepts", () => {
    const base = deepFreezeQueue(queueOf([supplierRow("r1", "AAA"), productRow("r2", "p_con")]));
    const next = pruneCategoryRows(base, withAssignment("AAA", "cat_bebidas"));
    expect(next.categories).toEqual([]);
    expect(base.categories).toHaveLength(2);
    expect(pendingQueueSchema.safeParse(next).success).toBe(true);
  });
});

describe("removeCategoryRow and restoreCategoryRow (D-18, D-22)", () => {
  function row(id: string, rfc: string): CategorySuggestion {
    return { id, kind: "supplier", rfc, name: `Tienda ${rfc}`, choice: { kind: "new", name: "Bebidas" } };
  }
  function threeRows(): PendingQueue {
    return {
      products: [card("sug_a", "Leche", [LECHE_UNO])],
      categories: [row("r1", "AAA"), row("r2", "BBB"), row("r3", "CCC")],
    };
  }

  it("takes the row out and reports the row and the index it had", () => {
    const result = removeCategoryRow(threeRows(), "r2");
    if (result === null) throw new Error("expected a removal");
    expect(result.next.categories.map((entry) => entry.id)).toEqual(["r1", "r3"]);
    expect(result.removed.index).toBe(1);
    expect(result.removed.row).toEqual(threeRows().categories[1]);
  });

  it("returns null for an unknown id", () => {
    expect(removeCategoryRow(threeRows(), "r9")).toBeNull();
  });

  it("restores the row at the index it had, which gives back the same queue", () => {
    const base = threeRows();
    const result = removeCategoryRow(base, "r2");
    if (result === null) throw new Error("expected a removal");
    expect(restoreCategoryRow(result.next, result.removed)).toEqual(base);
  });

  it("restores the first and the last row at their places", () => {
    const base = threeRows();
    for (const id of ["r1", "r3"]) {
      const result = removeCategoryRow(base, id);
      if (result === null) throw new Error("expected a removal");
      expect(restoreCategoryRow(result.next, result.removed)).toEqual(base);
    }
  });

  it("clamps the index to the list when other rows left in the meantime", () => {
    const result = removeCategoryRow(threeRows(), "r3");
    if (result === null) throw new Error("expected a removal");
    const shorter: PendingQueue = { products: [], categories: [row("r1", "AAA")] };
    const next = restoreCategoryRow(shorter, { ...result.removed, index: 9 });
    expect(next.categories.map((entry) => entry.id)).toEqual(["r1", "r3"]);
  });

  it("refuses, with the same queue, when the id is already in the queue", () => {
    const base = threeRows();
    const result = removeCategoryRow(base, "r2");
    if (result === null) throw new Error("expected a removal");
    expect(restoreCategoryRow(base, result.removed)).toBe(base);
  });

  it("refuses, with the same queue, when its target has another row now", () => {
    const result = removeCategoryRow(threeRows(), "r2");
    if (result === null) throw new Error("expected a removal");
    const other: PendingQueue = { products: [], categories: [row("r8", "BBB")] };
    expect(restoreCategoryRow(other, result.removed)).toBe(other);
  });

  it("refuses, with the same queue, at the stored limit", () => {
    const result = removeCategoryRow(threeRows(), "r2");
    if (result === null) throw new Error("expected a removal");
    const full: PendingQueue = {
      products: [],
      categories: Array.from({ length: PENDING_LIMITS.categoryRows }, (_unused, index) =>
        row(`f${String(index)}`, `RFC${String(index)}`),
      ),
    };
    expect(restoreCategoryRow(full, result.removed)).toBe(full);
  });

  it("gives an undo value that shares nothing with the queue and never mutates its input", () => {
    const base = deepFreezeQueue(threeRows());
    const result = removeCategoryRow(base, "r1");
    if (result === null) throw new Error("expected a removal");
    expect(result.removed.row).not.toBe(base.categories[0]);
    expect(base.categories).toHaveLength(3);
    const back = restoreCategoryRow(result.next, result.removed);
    expect(pendingQueueSchema.safeParse(back).success).toBe(true);
  });
});

describe("setCategoryChoice (D-17, D-18)", () => {
  function row(id: string, choice: CategoryChoice | null): CategorySuggestion {
    return { id, kind: "supplier", rfc: `RFC${id}`, name: `Tienda ${id}`, choice };
  }
  function base(): PendingQueue {
    return {
      products: [],
      categories: [row("r1", { kind: "new", name: "Bebidas" }), row("r2", null)],
    };
  }

  it("stores an existing category id on the row and leaves the others alone", () => {
    const next = setCategoryChoice(base(), "r1", { kind: "existing", categoryId: "cat_x" });
    expect(next.categories[0]?.choice).toEqual({ kind: "existing", categoryId: "cat_x" });
    expect(next.categories[1]).toEqual(base().categories[1]);
  });

  it("stores a new category name of 1 to 60 characters, trimmed", () => {
    const next = setCategoryChoice(base(), "r2", { kind: "new", name: "  Servicios  " });
    expect(next.categories[1]?.choice).toEqual({ kind: "new", name: "Servicios" });
    const longest = setCategoryChoice(base(), "r2", { kind: "new", name: "n".repeat(60) });
    expect(longest.categories[1]?.choice).toEqual({ kind: "new", name: "n".repeat(60) });
  });

  it("refuses, with the same queue, an empty or a 61-character name and an empty category id", () => {
    const queued = base();
    expect(setCategoryChoice(queued, "r1", { kind: "new", name: "   " })).toBe(queued);
    expect(setCategoryChoice(queued, "r1", { kind: "new", name: "n".repeat(61) })).toBe(queued);
    expect(setCategoryChoice(queued, "r1", { kind: "existing", categoryId: "" })).toBe(queued);
  });

  it("returns the same queue for an unknown row or for the choice the row already has", () => {
    const queued = base();
    expect(setCategoryChoice(queued, "r9", { kind: "new", name: "Bebidas" })).toBe(queued);
    expect(setCategoryChoice(queued, "r1", { kind: "new", name: "Bebidas" })).toBe(queued);
  });

  it("never mutates its input and returns a queue the stored schema accepts", () => {
    const queued = deepFreezeQueue(base());
    const next = setCategoryChoice(queued, "r2", { kind: "existing", categoryId: "cat_x" });
    expect(queued.categories[1]?.choice).toBeNull();
    expect(pendingQueueSchema.safeParse(next).success).toBe(true);
  });
});
