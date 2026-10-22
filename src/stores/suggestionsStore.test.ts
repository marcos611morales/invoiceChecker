// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LedgerEntry } from "@/domain/accounting/ledger";
import type { Concepto, ParsedInvoice } from "@/domain/cfdi/types";
import { buildGroupRun, collectItems } from "@/domain/llm/candidates";
import {
  PENDING_LIMITS,
  SUGGESTIONS_VERSION,
  memberKey,
  toProductSuggestions,
  type CategorySuggestion,
  type PendingQueue,
  type ProductSuggestion,
  type SuggestionMember,
} from "@/domain/llm/suggestions";
import { postGroup } from "@/lib/client/llmClient";
import { makeEntry, makeInvoice } from "../../tests/support/ledgerFactory";
import {
  readStoredQueue,
  resetSuggestionsStore,
  storeQueue,
} from "../../tests/support/suggestionsStorage";
import { resetSettingsStore } from "../../tests/support/settingsStorage";
import { useLlmRunStore } from "./llmRunStore";
import { useSessionStore } from "./sessionStore";
import { useSettingsStore } from "./settingsStore";
import { useStorageStatusStore, useSuggestionsStatusStore } from "./storageStatusStore";
import { useSuggestionsStore } from "./suggestionsStore";

vi.mock("@/lib/client/llmClient", () => ({ postGroup: vi.fn() }));

const KEY = "invoicechecker:suggestions";

function member(rfc: string, key: string, supplierName = "Tienda"): SuggestionMember {
  return { rfc, key, description: `Descripción ${key}`, supplierName };
}

function card(id: string, name: string, members: SuggestionMember[]): ProductSuggestion {
  return { id, name, target: null, members };
}

const LECHE_UNO = member("AAA010101AAA", "leche entera 1l", "Tienda Uno");
const LECHE_DOS = member("BBB020202BBB", "leche entera 1l", "Tienda Dos");
const CAFE = member("AAA010101AAA", "cafe molido 1kg", "Tienda Uno");

const SUPPLIER_ROW: CategorySuggestion = {
  id: "cat_a",
  kind: "supplier",
  rfc: "AAA010101AAA",
  name: "Tienda Uno",
  choice: { kind: "existing", categoryId: "seed:abarrotes-despensa" },
};

const PRODUCT_ROW: CategorySuggestion = {
  id: "cat_b",
  kind: "product",
  productId: "prod_1",
  name: "Café molido",
  choice: { kind: "new", name: "Bebidas" },
};

/** Two product cards and one category row. */
function queue(): PendingQueue {
  return {
    products: [card("sug_a", "Leche entera", [LECHE_UNO, LECHE_DOS]), card("sug_b", "Café molido", [CAFE])],
    categories: [PRODUCT_ROW],
  };
}

async function rehydrate(): Promise<void> {
  await useSuggestionsStore.persist.rehydrate();
}

/**
 * A page reload: the stored value is kept, the memory is emptied and the store reads storage
 * again. (`setState` writes too, so the stored value is put back before rehydrating.)
 */
async function reload(): Promise<void> {
  const raw = window.localStorage.getItem(KEY);
  useSuggestionsStore.setState({ products: [], categories: [] });
  if (raw === null) window.localStorage.removeItem(KEY);
  else window.localStorage.setItem(KEY, raw);
  await rehydrate();
}

function snapshot(): PendingQueue {
  const { products, categories } = useSuggestionsStore.getState();
  return { products, categories };
}

function storedEnvelope(): unknown {
  return JSON.parse(window.localStorage.getItem(KEY) ?? "null");
}

function storeRaw(value: unknown): void {
  window.localStorage.setItem(KEY, JSON.stringify(value));
}

function queueStatus() {
  const { readFailed, writeFailed } = useSuggestionsStatusStore.getState();
  return { readFailed, writeFailed };
}

function settingsStatus() {
  const { readFailed, writeFailed } = useStorageStatusStore.getState();
  return { readFailed, writeFailed };
}

beforeEach(() => {
  window.localStorage.clear();
  resetSuggestionsStore();
  resetSettingsStore();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(postGroup).mockReset();
  window.localStorage.clear();
  resetSuggestionsStore();
  resetSettingsStore();
  useLlmRunStore.setState({ status: { phase: "idle" }, controller: null });
  useSessionStore.getState().clearAll();
});

describe("suggestionsStore persistence (D-24, D-30, ROADMAP criterion 2)", () => {
  it("starts with an empty queue", () => {
    expect(snapshot()).toEqual({ products: [], categories: [] });
  });

  it("round-trips two product cards and a category row through storage and rehydrate", async () => {
    storeQueue(queue());
    await rehydrate();
    expect(snapshot()).toEqual(queue());
    expect(queueStatus()).toEqual({ readFailed: false, writeFailed: false });
  });

  it("writes { state: { products, categories }, version: 1 } under its own key and nothing else", () => {
    useSuggestionsStore.getState().enqueueProducts(queue().products);
    expect(SUGGESTIONS_VERSION).toBe(1);
    expect(storedEnvelope()).toEqual({
      state: { products: queue().products, categories: [] },
      version: 1,
    });
    expect(window.localStorage.getItem("invoicechecker:settings")).toBeNull();
    expect(window.localStorage).toHaveLength(1);
  });

  it("does not touch the settings key, and the settings store does not touch the queue key", () => {
    useSuggestionsStore.getState().enqueueProducts(queue().products);
    useSettingsStore.getState().setIvaMode("sin");
    const settingsRaw = window.localStorage.getItem("invoicechecker:settings") ?? "";
    expect(settingsRaw).toContain('"ivaMode":"sin"');
    expect(settingsRaw).not.toContain("sug_a");
    expect(settingsRaw).not.toContain("Leche entera");
    expect(storedEnvelope()).toEqual({
      state: { products: queue().products, categories: [] },
      version: 1,
    });
  });

  it("stores the category rows too, so the stored contract does not change in Plan 04-18", async () => {
    useSuggestionsStore.setState({ categories: [SUPPLIER_ROW, PRODUCT_ROW] });
    expect(storedEnvelope()).toEqual({
      state: { products: [], categories: [SUPPLIER_ROW, PRODUCT_ROW] },
      version: 1,
    });
    useSuggestionsStore.setState({ categories: [] });
    storeQueue({ products: [], categories: [SUPPLIER_ROW, PRODUCT_ROW] });
    await rehydrate();
    expect(useSuggestionsStore.getState().categories).toEqual([SUPPLIER_ROW, PRODUCT_ROW]);
  });

  it("leaves storage when a card is accepted or rejected (removeProduct), and survives another reload", async () => {
    useSuggestionsStore.getState().enqueueProducts(queue().products);
    const removed = useSuggestionsStore.getState().removeProduct("sug_a");
    expect(removed?.id).toBe("sug_a");
    expect(storedEnvelope()).toEqual({
      state: { products: [queue().products[1]], categories: [] },
      version: 1,
    });
    await reload();
    expect(snapshot().products.map((entry) => entry.id)).toEqual(["sug_b"]);
  });

  it("writes nothing when removeProduct finds no such card", () => {
    useSuggestionsStore.getState().enqueueProducts(queue().products);
    const writes = vi.spyOn(Storage.prototype, "setItem");
    expect(useSuggestionsStore.getState().removeProduct("sug_missing")).toBeNull();
    expect(writes).not.toHaveBeenCalled();
  });

  it("keeps the idempotence per member after a reload (D-25)", async () => {
    useSuggestionsStore.getState().enqueueProducts(queue().products);
    await reload();
    useSuggestionsStore.getState().enqueueProducts([card("sug_late", "Otra vez", [LECHE_UNO])]);
    expect(snapshot().products.map((entry) => entry.id)).toEqual(["sug_a", "sug_b"]);
  });

  it("stores each batch as it lands: the stored queue grows batch by batch", () => {
    const [first, second] = queue().products;
    if (first === undefined || second === undefined) throw new Error("fixture");
    useSuggestionsStore.getState().enqueueProducts([first]);
    expect(storedEnvelope()).toEqual({ state: { products: [first], categories: [] }, version: 1 });
    useSuggestionsStore.getState().enqueueProducts([second]);
    expect(storedEnvelope()).toEqual({
      state: { products: [first, second], categories: [] },
      version: 1,
    });
  });

  it("keeps the batches that arrived when a later batch fails (LLM-05, D-26)", async () => {
    const free = [
      { rfc: LECHE_UNO.rfc, key: LECHE_UNO.key, description: "Leche entera 1L", supplierName: "Tienda Uno", lines: 1 },
      { rfc: CAFE.rfc, key: CAFE.key, description: "Café Molido 1kg", supplierName: "Tienda Uno", lines: 1 },
    ];
    // One item per batch: two batches.
    const run = buildGroupRun(free, [], 1);
    expect(run.batches).toHaveLength(2);
    const first = run.batches[0];
    if (first === undefined) throw new Error("fixture");
    const [item] = first.body.items;
    if (item === undefined) throw new Error("fixture");
    vi.mocked(postGroup)
      .mockResolvedValueOnce({
        ok: true,
        data: {
          groups: [{ name: "Leche entera", ids: [item.id], existing: null }],
          meta: {
            attempts: 1,
            durationMs: 5,
            finishReason: "stop",
            promptTokens: 1,
            completionTokens: 1,
            reasoningTokens: 0,
          },
        },
      })
      .mockResolvedValueOnce({ ok: false, error: "upstream_unavailable" });
    await useLlmRunStore.getState().startGroupRun(run);
    // A retryable failure of batch 2 does not stop the run (D-27): it ends partial and the cards stay.
    expect(useLlmRunStore.getState().status).toMatchObject({
      phase: "partial",
      failed: 1,
      lastError: "upstream_unavailable",
      received: 1,
    });
    expect(storedEnvelope()).toMatchObject({
      version: 1,
      state: { products: [{ name: "Leche entera" }], categories: [] },
    });
    // A reload brings back what had landed.
    await reload();
    expect(snapshot().products.map((entry) => entry.name)).toEqual(["Leche entera"]);
  });
});

describe("suggestionsStore with an unusable stored queue (T-04-25, T-04-27)", () => {
  const BAD_PRODUCT_ROW = {
    id: "cat_a",
    kind: "supplier",
    rfc: "AAA010101AAA",
    productId: "prod_1",
    name: "Tienda Uno",
    choice: null,
  };

  const broken: [string, () => void][] = [
    ["is not JSON", () => window.localStorage.setItem(KEY, "{not json")],
    ["is JSON but not an object", () => window.localStorage.setItem(KEY, "42")],
    ["has a wrong envelope", () => window.localStorage.setItem(KEY, JSON.stringify([]))],
    [
      "has a version that is not a number",
      () => storeRaw({ state: queue(), version: "1" }),
    ],
    [
      "has a state that is not a queue",
      () => storeRaw({ state: { products: "x" }, version: 1 }),
    ],
    [
      "has a card with no member",
      () =>
        storeRaw({
          state: { products: [card("sug_a", "Leche", [])], categories: [] },
          version: 1,
        }),
    ],
    [
      "repeats a member key across cards",
      () =>
        storeRaw({
          state: {
            products: [card("sug_a", "Leche", [LECHE_UNO]), card("sug_b", "Otra", [LECHE_UNO])],
            categories: [],
          },
          version: 1,
        }),
    ],
    [
      "repeats an id",
      () =>
        storeRaw({
          state: {
            products: [card("sug_a", "Leche", [LECHE_UNO]), card("sug_a", "Café", [CAFE])],
            categories: [],
          },
          version: 1,
        }),
    ],
    [
      "breaks the limit of category rows",
      () =>
        storeRaw({
          state: {
            products: [],
            categories: Array.from({ length: PENDING_LIMITS.categoryRows + 1 }, (_unused, index) => ({
              id: `cat_${String(index)}`,
              kind: "supplier",
              rfc: `R${String(index)}`,
              name: "x",
              choice: null,
            })),
          },
          version: 1,
        }),
    ],
    [
      "has a category row with both kinds of target",
      () => storeRaw({ state: { products: [], categories: [BAD_PRODUCT_ROW] }, version: 1 }),
    ],
    [
      "is a version this app does not know",
      () => storeRaw({ state: queue(), version: 2 }),
    ],
  ];

  it.each(broken)("starts empty, marks only the queue's read failure and never throws when the stored queue %s", async (_label, store) => {
    useSuggestionsStore.setState({ products: [card("sug_mem", "En memoria", [CAFE])] });
    store();
    await expect(rehydrate()).resolves.toBeUndefined();
    expect(snapshot()).toEqual({ products: [], categories: [] });
    expect(queueStatus().readFailed).toBe(true);
    expect(settingsStatus().readFailed).toBe(false);
  });

  it("does not mark a read failure with nothing stored, a valid queue, or when getItem itself throws", async () => {
    await rehydrate();
    expect(queueStatus().readFailed).toBe(false);
    storeQueue(queue());
    await rehydrate();
    expect(queueStatus().readFailed).toBe(false);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    await rehydrate();
    expect(queueStatus().readFailed).toBe(false);
  });
});

describe("suggestionsStore when the queue cannot be written (Q8 pattern)", () => {
  it("marks only the queue's write failure, keeps the cards in memory and clears the flag after a later write", () => {
    const blocked = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    expect(() => {
      useSuggestionsStore.getState().enqueueProducts(queue().products);
    }).not.toThrow();
    expect(queueStatus().writeFailed).toBe(true);
    expect(settingsStatus().writeFailed).toBe(false);
    expect(snapshot().products).toHaveLength(2);
    blocked.mockRestore();
    useSuggestionsStore.getState().removeProduct("sug_a");
    expect(queueStatus().writeFailed).toBe(false);
  });

  it("does not mark the queue when the settings cannot be written", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    useSettingsStore.getState().setIvaMode("sin");
    expect(settingsStatus().writeFailed).toBe(true);
    expect(queueStatus().writeFailed).toBe(false);
  });

  it("never sets the queue store from the adapter: one change writes once", () => {
    const writes = vi.spyOn(Storage.prototype, "setItem");
    useSuggestionsStore.getState().enqueueProducts(queue().products);
    expect(writes).toHaveBeenCalledTimes(1);
    writes.mockClear();
    writes.mockImplementation(() => {
      throw new Error("quota");
    });
    useSuggestionsStore.getState().removeProduct("sug_a");
    expect(writes).toHaveBeenCalledTimes(1);
  });

  it("does not persist the status flags", () => {
    useSuggestionsStatusStore.getState().markReadFailed();
    useSuggestionsStatusStore.getState().setWriteFailed(true);
    expect(window.localStorage).toHaveLength(0);
  });
});

describe("what the stored queue holds (D-24 amended by D-30, T-04-26)", () => {
  const UUID_A = "11111111-2222-4333-8444-555555555501";
  const UUID_B = "11111111-2222-4333-8444-555555555502";
  const FOLIO = "F-90210";
  const FECHA = "2025-03-03T09:00:00";
  const TOTAL = "2468.13";
  const SUBTOTAL = "2123.00";
  const RECEPTOR = { rfc: "CAF030303CCC", nombre: "Coworking de prueba" };

  function concepto(descripcion: string): Concepto {
    return {
      claveProdServ: "50202306",
      noIdentificacion: null,
      cantidad: "1",
      claveUnidad: "H87",
      unidad: null,
      descripcion,
      valorUnitario: "777.77",
      importe: "777.77",
      descuento: null,
      objetoImp: "01",
      traslados: [],
      retenciones: [],
    };
  }

  function entry(
    uuid: string,
    emisor: { rfc: string; nombre: string },
    descriptions: readonly string[],
  ): LedgerEntry {
    const invoice: ParsedInvoice = makeInvoice({
      uuid,
      serie: "ZZ",
      folio: FOLIO,
      fecha: FECHA,
      subTotal: SUBTOTAL,
      total: TOTAL,
      emisor,
      receptor: RECEPTOR,
      conceptos: descriptions.map(concepto),
    });
    return makeEntry({ invoice });
  }

  it("holds the supplier rfc, the key, the description and the supplier name, and no amount, uuid, folio, date or receptor", () => {
    const items = collectItems([
      entry(UUID_A, { rfc: "AAA010101AAA", nombre: "Tienda Uno" }, ["MM LECHE ENT", "Café Molido 1kg"]),
      entry(UUID_B, { rfc: "BBB020202BBB", nombre: "Tienda Dos" }, ["LECHE ENTERA 1L"]),
    ]);
    const run = buildGroupRun(items, []);
    const batch = run.batches[0];
    if (batch === undefined) throw new Error("fixture");
    const idOf = (description: string): string => {
      const found = batch.body.items.find((candidate) => candidate.description === description);
      if (found === undefined) throw new Error(`no item for ${description}`);
      return found.id;
    };
    const cards = toProductSuggestions(
      [
        { name: "Leche entera", ids: [idOf("MM LECHE ENT"), idOf("LECHE ENTERA 1L")], existing: null },
        { name: "Café", ids: [idOf("Café Molido 1kg")], existing: null },
      ],
      batch.idMap,
      batch.targets,
      (() => {
        let next = 0;
        return () => `sug_${String(++next)}`;
      })(),
    );
    useSuggestionsStore.getState().enqueueProducts(cards);
    const text = window.localStorage.getItem(KEY) ?? "";
    expect(text).toContain("AAA010101AAA");
    expect(text).toContain("BBB020202BBB");
    expect(text).toContain("Tienda Uno");
    expect(text).toContain("MM LECHE ENT");
    for (const forbidden of [UUID_A, UUID_B, FOLIO, FECHA, TOTAL, SUBTOTAL, "777.77", RECEPTOR.rfc, RECEPTOR.nombre]) {
      expect(text).not.toContain(forbidden);
    }
    // Only these keys exist anywhere in the stored value.
    const keys = new Set<string>();
    const walk = (value: unknown): void => {
      if (Array.isArray(value)) {
        value.forEach((child: unknown) => {
          walk(child);
        });
      } else if (typeof value === "object" && value !== null) {
        for (const [key, child] of Object.entries(value)) {
          keys.add(key);
          walk(child);
        }
      }
    };
    walk(storedEnvelope());
    expect([...keys].sort()).toEqual(
      ["categories", "description", "id", "key", "members", "name", "products", "rfc", "state", "supplierName", "target", "version"].sort(),
    );
  });
});

describe("review actions of the queue store (D-12, D-19, D-22)", () => {
  it("renameSuggestion stores the new name, cut to 60, and it survives a reload", async () => {
    useSuggestionsStore.getState().enqueueProducts(queue().products);
    useSuggestionsStore.getState().renameSuggestion("sug_b", "n".repeat(61));
    expect(snapshot().products[1]?.name).toBe("n".repeat(60));
    await reload();
    expect(snapshot().products[1]?.name).toBe("n".repeat(60));
    expect(queueStatus()).toEqual({ readFailed: false, writeFailed: false });
  });

  it("renameSuggestion with an unknown id or the same name writes nothing", () => {
    useSuggestionsStore.getState().enqueueProducts(queue().products);
    const before = window.localStorage.getItem(KEY);
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    useSuggestionsStore.getState().renameSuggestion("sug_x", "Otro");
    useSuggestionsStore.getState().renameSuggestion("sug_a", "Leche entera");
    expect(setItem).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(KEY)).toBe(before);
  });

  it("rejectSuggestion returns what restoreSuggestion needs, and the pair gives back the stored queue", () => {
    useSuggestionsStore.getState().enqueueProducts(queue().products);
    const before = storedEnvelope();
    const removed = useSuggestionsStore.getState().rejectSuggestion("sug_a");
    if (removed === null) throw new Error("expected a card");
    expect(removed.card.id).toBe("sug_a");
    expect(snapshot().products.map((entry) => entry.id)).toEqual(["sug_b"]);
    useSuggestionsStore.getState().restoreSuggestion(removed);
    expect(storedEnvelope()).toEqual(before);
  });

  it("rejectSuggestion of an unknown id returns null and changes nothing", () => {
    useSuggestionsStore.getState().enqueueProducts(queue().products);
    expect(useSuggestionsStore.getState().rejectSuggestion("sug_x")).toBeNull();
    expect(snapshot().products).toHaveLength(2);
  });

  it("dropMember and restoreMember work on a card with several members and on a single one", () => {
    useSuggestionsStore.getState().enqueueProducts(queue().products);
    const before = storedEnvelope();
    const part = useSuggestionsStore.getState().dropMember("sug_a", memberKey(LECHE_DOS));
    expect(part?.card).toBeNull();
    expect(snapshot().products[0]?.members).toEqual([LECHE_UNO]);
    if (part !== null) useSuggestionsStore.getState().restoreMember(part);
    expect(storedEnvelope()).toEqual(before);

    const lone = useSuggestionsStore.getState().dropMember("sug_b", memberKey(CAFE));
    expect(lone?.card?.index).toBe(1);
    expect(snapshot().products.map((entry) => entry.id)).toEqual(["sug_a"]);
    if (lone !== null) useSuggestionsStore.getState().restoreMember(lone);
    expect(storedEnvelope()).toEqual(before);
  });

  it("dropMember of an unknown card or member returns null", () => {
    useSuggestionsStore.getState().enqueueProducts(queue().products);
    expect(useSuggestionsStore.getState().dropMember("sug_x", "k")).toBeNull();
    expect(useSuggestionsStore.getState().dropMember("sug_a", "nope")).toBeNull();
  });

  it("only sets the products: the category rows are left alone", () => {
    storeQueue(queue());
    useSuggestionsStore.setState({ products: queue().products, categories: queue().categories });
    useSuggestionsStore.getState().rejectSuggestion("sug_a");
    expect(snapshot().categories).toEqual(queue().categories);
  });
});

describe("category row actions of the queue store (D-17, D-18, D-22, A-3)", () => {
  const SECOND_ROW: CategorySuggestion = {
    id: "cat_c",
    kind: "supplier",
    rfc: "BBB020202BBB",
    name: "Tienda Dos",
    choice: null,
  };

  function seedRows(): void {
    useSuggestionsStore.getState().enqueueProducts(queue().products);
    useSuggestionsStore.getState().enqueueCategories([SUPPLIER_ROW, PRODUCT_ROW, SECOND_ROW]);
  }

  it("removeCategoryRow returns the row and its index, and the pair gives back the stored queue", () => {
    seedRows();
    const before = storedEnvelope();
    const removed = useSuggestionsStore.getState().removeCategoryRow("cat_b");
    if (removed === null) throw new Error("expected a row");
    expect(removed.row.id).toBe("cat_b");
    expect(removed.index).toBe(1);
    expect(snapshot().categories.map((row) => row.id)).toEqual(["cat_a", "cat_c"]);
    useSuggestionsStore.getState().restoreCategoryRow(removed);
    expect(storedEnvelope()).toEqual(before);
  });

  it("removeCategoryRow of an unknown id returns null and writes nothing", () => {
    seedRows();
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    expect(useSuggestionsStore.getState().removeCategoryRow("cat_x")).toBeNull();
    expect(setItem).not.toHaveBeenCalled();
  });

  it("a refused restore writes nothing", () => {
    seedRows();
    const removed = useSuggestionsStore.getState().removeCategoryRow("cat_b");
    if (removed === null) throw new Error("expected a row");
    useSuggestionsStore.getState().restoreCategoryRow(removed);
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    useSuggestionsStore.getState().restoreCategoryRow(removed);
    expect(setItem).not.toHaveBeenCalled();
  });

  it("setCategoryChoice stores the chosen category and it survives a reload", async () => {
    seedRows();
    useSuggestionsStore
      .getState()
      .setCategoryChoice("cat_c", { kind: "existing", categoryId: "seed:otros" });
    await reload();
    expect(snapshot().categories.find((row) => row.id === "cat_c")?.choice).toEqual({
      kind: "existing",
      categoryId: "seed:otros",
    });
  });

  it("setCategoryChoice with the same choice or an unknown row writes nothing", () => {
    seedRows();
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    useSuggestionsStore.getState().setCategoryChoice("cat_b", { kind: "new", name: "Bebidas" });
    useSuggestionsStore.getState().setCategoryChoice("cat_x", { kind: "new", name: "Otra" });
    expect(setItem).not.toHaveBeenCalled();
  });

  it("pruneCategories drops the rows whose target got a category and keeps the product cards", () => {
    seedRows();
    useSuggestionsStore.getState().pruneCategories({
      categories: [{ id: "seed:otros" }],
      supplierCategories: [{ rfc: "AAA010101AAA", categoryId: "seed:otros" }],
      products: [{ id: "prod_1", categoryId: null }],
    });
    expect(snapshot().categories.map((row) => row.id)).toEqual(["cat_b", "cat_c"]);
    expect(snapshot().products).toHaveLength(2);
  });

  it("pruneCategories with nothing to drop writes nothing", () => {
    seedRows();
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    useSuggestionsStore.getState().pruneCategories({
      categories: [],
      supplierCategories: [],
      products: [{ id: "prod_1", categoryId: null }],
    });
    expect(setItem).not.toHaveBeenCalled();
  });

  it("only sets the category rows: the product cards are left alone", () => {
    seedRows();
    useSuggestionsStore.getState().removeCategoryRow("cat_a");
    expect(snapshot().products).toEqual(queue().products);
  });
});

describe("join, turn into «Agregar a» and split in the queue store (D-19)", () => {
  it("mergeSuggestions stores the joined card, and undoQueueChange gives back the stored queue", async () => {
    useSuggestionsStore.getState().enqueueProducts(queue().products);
    const before = storedEnvelope();
    const undo = useSuggestionsStore.getState().mergeSuggestions("sug_a", "sug_b");
    if (undo === null) throw new Error("expected a merge");
    expect(snapshot().products).toEqual([
      card("sug_b", "Café molido", [CAFE, LECHE_UNO, LECHE_DOS]),
    ]);
    await reload();
    expect(snapshot().products.map((entry) => entry.id)).toEqual(["sug_b"]);
    useSuggestionsStore.getState().undoQueueChange(undo);
    expect(storedEnvelope()).toEqual(before);
    expect(queueStatus()).toEqual({ readFailed: false, writeFailed: false });
  });

  it("turnIntoAddCard stores the target, and undoQueueChange clears it", () => {
    useSuggestionsStore.getState().enqueueProducts(queue().products);
    const before = storedEnvelope();
    const undo = useSuggestionsStore.getState().turnIntoAddCard("sug_b", "prod_1");
    if (undo === null) throw new Error("expected a change");
    expect(snapshot().products[1]?.target).toBe("prod_1");
    useSuggestionsStore.getState().undoQueueChange(undo);
    expect(storedEnvelope()).toEqual(before);
  });

  it("splitSuggestion makes a card with a «sug_» id right below, reports it in the undo, and the undo removes it", async () => {
    useSuggestionsStore.getState().enqueueProducts(queue().products);
    const before = storedEnvelope();
    const undo = useSuggestionsStore.getState().splitSuggestion("sug_a", [memberKey(LECHE_DOS)]);
    if (undo === null) throw new Error("expected a split");
    expect(undo.createdId).toMatch(/^sug_.+/);
    const ids = snapshot().products.map((entry) => entry.id);
    expect(ids).toEqual(["sug_a", undo.createdId, "sug_b"]);
    await reload();
    expect(snapshot().products.map((entry) => entry.id)).toEqual(ids);
    useSuggestionsStore.getState().undoQueueChange(undo);
    expect(storedEnvelope()).toEqual(before);
  });

  it("returns null and writes nothing when a change is refused", () => {
    useSuggestionsStore.getState().enqueueProducts(queue().products);
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const store = useSuggestionsStore.getState();
    expect(store.mergeSuggestions("sug_a", "sug_a")).toBeNull();
    expect(store.turnIntoAddCard("sug_x", "prod_1")).toBeNull();
    expect(store.splitSuggestion("sug_a", [])).toBeNull();
    expect(store.splitSuggestion("sug_a", [memberKey(LECHE_UNO), memberKey(LECHE_DOS)])).toBeNull();
    expect(setItem).not.toHaveBeenCalled();
  });

  it("leaves the category rows alone", () => {
    useSuggestionsStore.setState({ products: queue().products, categories: queue().categories });
    useSuggestionsStore.getState().mergeSuggestions("sug_a", "sug_b");
    expect(snapshot().categories).toEqual(queue().categories);
  });
});

describe("rejectMany and restoreMany in the queue store (D-20)", () => {
  const SAL = member("AAA010101AAA", "sal");
  const ARROZ = member("BBB020202BBB", "arroz");

  function four(): ProductSuggestion[] {
    return [
      card("sug_a", "Leche entera", [LECHE_UNO, LECHE_DOS]),
      card("sug_b", "Café molido", [CAFE]),
      card("sug_c", "Sal", [SAL]),
      card("sug_d", "Arroz", [ARROZ]),
    ];
  }

  it("takes the named cards out in one write and returns them with the index they had, in queue order", () => {
    useSuggestionsStore.getState().enqueueProducts(four());
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const removed = useSuggestionsStore.getState().rejectMany(["sug_d", "sug_b"]);
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(removed.map((entry) => [entry.card.id, entry.index])).toEqual([
      ["sug_b", 1],
      ["sug_d", 3],
    ]);
    expect(snapshot().products.map((entry) => entry.id)).toEqual(["sug_a", "sug_c"]);
  });

  it("restoreMany gives back the stored queue exactly, with every card at its old place", async () => {
    useSuggestionsStore.getState().enqueueProducts(four());
    const before = storedEnvelope();
    const removed = useSuggestionsStore.getState().rejectMany(["sug_a", "sug_c", "sug_d"]);
    expect(snapshot().products.map((entry) => entry.id)).toEqual(["sug_b"]);
    await reload();
    useSuggestionsStore.getState().restoreMany(removed);
    expect(storedEnvelope()).toEqual(before);
    expect(queueStatus()).toEqual({ readFailed: false, writeFailed: false });
  });

  it("ignores unknown and repeated ids, and writes nothing when no known card is named", () => {
    useSuggestionsStore.getState().enqueueProducts(four());
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    expect(useSuggestionsStore.getState().rejectMany(["sug_x"])).toEqual([]);
    expect(useSuggestionsStore.getState().rejectMany([])).toEqual([]);
    expect(setItem).not.toHaveBeenCalled();
    const removed = useSuggestionsStore.getState().rejectMany(["sug_b", "sug_b", "sug_x"]);
    expect(removed.map((entry) => entry.card.id)).toEqual(["sug_b"]);
    expect(setItem).toHaveBeenCalledTimes(1);
  });

  it("restoreMany leaves out a card whose member is pending elsewhere now and writes once", () => {
    useSuggestionsStore.getState().enqueueProducts(four());
    const removed = useSuggestionsStore.getState().rejectMany(["sug_b", "sug_c"]);
    // A later batch put the café description in a new card.
    useSuggestionsStore.getState().enqueueProducts([card("sug_e", "Café nuevo", [CAFE])]);
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    useSuggestionsStore.getState().restoreMany(removed);
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(snapshot().products.map((entry) => entry.id)).toEqual(["sug_a", "sug_d", "sug_c", "sug_e"]);
  });

  it("restoreMany with nothing to put back writes nothing, and the category rows are left alone", () => {
    useSuggestionsStore.setState({ products: four(), categories: queue().categories });
    const removed = useSuggestionsStore.getState().rejectMany(["sug_a"]);
    expect(snapshot().categories).toEqual(queue().categories);
    useSuggestionsStore.getState().restoreMany(removed);
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    useSuggestionsStore.getState().restoreMany(removed);
    expect(setItem).not.toHaveBeenCalled();
    expect(useSuggestionsStore.getState().products.map((entry) => entry.id)).toEqual([
      "sug_a",
      "sug_b",
      "sug_c",
      "sug_d",
    ]);
  });
});

describe("readStoredQueue test helper", () => {
  it("returns the envelope the store wrote, or null", async () => {
    expect(await readStoredQueue()).toBeNull();
    useSuggestionsStore.getState().enqueueProducts(queue().products);
    expect(await readStoredQueue()).toEqual({
      state: { products: queue().products, categories: [] },
      version: 1,
    });
  });
});
