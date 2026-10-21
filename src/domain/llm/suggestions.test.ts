import { describe, expect, it } from "vitest";
import {
  PENDING_LIMITS,
  SUGGESTIONS_VERSION,
  enqueueProductSuggestions,
  pendingQueueSchema,
  resolvePendingQueue,
  type CategorySuggestion,
  type PendingQueue,
  type ProductSuggestion,
  type SuggestionMember,
} from "./suggestions";

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
          products: [card("sug_a", "Leche", [{ ...LECHE_UNO, total: "116.00" }])],
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
