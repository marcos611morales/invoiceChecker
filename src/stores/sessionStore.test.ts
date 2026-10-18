// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ParsedInvoice } from "@/domain/cfdi/types";
import type { BatchEntry } from "@/domain/import/types";
import { EMPTY_FILTERS } from "@/domain/accounting/filters";
import { SIN_CATEGORIA } from "@/domain/settings/types";
import { resetSettingsStore } from "../../tests/support/settingsStorage";
import { useSessionStore } from "./sessionStore";
import { useSettingsStore } from "./settingsStore";

function makeInvoice(uuid: string): ParsedInvoice {
  return {
    uuid,
    version: "4.0",
    fecha: "2025-01-15T10:00:00",
    tipo: "I",
    serie: null,
    folio: null,
    moneda: "MXN",
    tipoCambio: null,
    formaPago: null,
    metodoPago: null,
    subTotal: "100.00",
    descuento: null,
    total: "116.00",
    totalImpuestosTrasladados: null,
    totalImpuestosRetenidos: null,
    impuestos: { traslados: [], retenciones: [] },
    emisor: { rfc: "EMI010101AAA", nombre: null },
    receptor: { rfc: "CAF010101AAA", nombre: null },
    conceptos: [],
    relacionados: [],
    pagos: [],
  };
}

function parsed(name: string, uuid: string): BatchEntry {
  return {
    kind: "parsed",
    file: { name, path: name },
    result: { ok: true, invoice: makeInvoice(uuid) },
  };
}

afterEach(() => {
  useSessionStore.getState().clearAll();
  window.localStorage.clear();
  resetSettingsStore();
});

describe("sessionStore", () => {
  it("accumulates a batch with the current generation and returns its summary", () => {
    const store = useSessionStore.getState();
    const summary = store.applyBatch([parsed("a.xml", "U1")], store.generation);
    expect(summary).toEqual({
      added: 1,
      duplicates: 0,
      rejected: 0,
      ignored: 0,
    });
    expect(useSessionStore.getState().invoices).toHaveLength(1);
  });

  it("accumulates two batches and keeps the latest summary (D-08)", () => {
    const generation = useSessionStore.getState().generation;
    useSessionStore
      .getState()
      .applyBatch([parsed("a.xml", "U1")], generation);
    useSessionStore
      .getState()
      .applyBatch([parsed("a-again.xml", "U1"), parsed("b.xml", "U2")], generation);
    const state = useSessionStore.getState();
    expect(state.invoices.map((i) => i.file.name)).toEqual(["a.xml", "b.xml"]);
    expect(state.duplicates).toHaveLength(1);
    expect(state.lastSummary).toEqual({
      added: 1,
      duplicates: 1,
      rejected: 0,
      ignored: 0,
    });
  });

  it("returns null and changes nothing for a stale generation", () => {
    const stale = useSessionStore.getState().generation;
    useSessionStore.getState().clearAll();
    const result = useSessionStore
      .getState()
      .applyBatch([parsed("a.xml", "U1")], stale);
    expect(result).toBeNull();
    const state = useSessionStore.getState();
    expect(state.invoices).toEqual([]);
    expect(state.lastSummary).toBeNull();
  });

  it("clearAll empties everything and increments the generation", () => {
    const before = useSessionStore.getState();
    before.applyBatch(
      [
        parsed("a.xml", "U1"),
        { kind: "unreadable", file: { name: "x.xml", path: "x.xml" } },
        {
          kind: "ignored",
          file: { name: "a.pdf", path: "a.pdf" },
          ignoredKind: "pdf",
        },
      ],
      before.generation,
    );
    useSessionStore.getState().setProgress({ phase: "listing" });
    const generation = useSessionStore.getState().generation;
    useSessionStore.getState().clearAll();
    const after = useSessionStore.getState();
    expect(after.invoices).toEqual([]);
    expect(after.rejected).toEqual([]);
    expect(after.duplicates).toEqual([]);
    expect(after.ignored).toEqual([]);
    expect(after.firstFileByUuid).toEqual({});
    expect(after.progress).toEqual({ phase: "idle" });
    expect(after.lastSummary).toBeNull();
    expect(after.generation).toBe(generation + 1);
  });

  it("starts empty on a fresh module load, as after a page reload (CARGA-06)", async () => {
    useSessionStore
      .getState()
      .applyBatch([parsed("a.xml", "U1")], useSessionStore.getState().generation);
    vi.resetModules();
    const fresh = await import("./sessionStore");
    const state = fresh.useSessionStore.getState();
    expect(state.invoices).toEqual([]);
    expect(state.generation).toBe(0);
    expect(state.progress).toEqual({ phase: "idle" });
    expect(state.lastSummary).toBeNull();
  });

  describe("filters, exclusions and focus (Plan 02-06)", () => {
    const RANGE = { from: "2025-02", to: "2025-04" } as const;

    it("starts with empty filters, nothing excluded or restored, dashboard tab and no focus requests", () => {
      const state = useSessionStore.getState();
      expect(state.filters).toEqual(EMPTY_FILTERS);
      expect(state.excluded.size).toBe(0);
      expect(state.restored.size).toBe(0);
      expect(state.activeTab).toBe("dashboard");
      expect(state.focusRequest).toBeNull();
      expect(state.importFocus).toBeNull();
    });

    it("excludeInvoice adds to excluded and not to restored, replacing the set", () => {
      const before = useSessionStore.getState().excluded;
      useSessionStore.getState().excludeInvoice("A");
      const state = useSessionStore.getState();
      expect(state.excluded.has("A")).toBe(true);
      expect(state.restored.has("A")).toBe(false);
      expect(state.excluded).not.toBe(before);
      expect(before.size).toBe(0);
    });

    it("excludeInvoice reports that a plain uuid was not restored (WR-01)", () => {
      const token = useSessionStore.getState().excludeInvoice("A");
      expect(token).toEqual({ uuid: "A", wasRestored: false });
      expect(useSessionStore.getState().restored.has("A")).toBe(false);
    });

    it("excludeInvoice reports that a restored uuid was restored and takes it out of restored (WR-01)", () => {
      useSessionStore.setState({ restored: new Set(["A"]) });
      const token = useSessionStore.getState().excludeInvoice("A");
      expect(token).toEqual({ uuid: "A", wasRestored: true });
      expect(useSessionStore.getState().excluded.has("A")).toBe(true);
      expect(useSessionStore.getState().restored.has("A")).toBe(false);
    });

    it("undoExclusion of a plain exclusion removes it from excluded and keeps the restored instance (WR-01)", () => {
      const token = useSessionStore.getState().excludeInvoice("A");
      const excludedBefore = useSessionStore.getState().excluded;
      const restoredBefore = useSessionStore.getState().restored;
      useSessionStore.getState().undoExclusion(token);
      const state = useSessionStore.getState();
      expect(state.excluded.has("A")).toBe(false);
      expect(state.excluded).not.toBe(excludedBefore);
      expect(excludedBefore.has("A")).toBe(true);
      expect(state.restored).toBe(restoredBefore);
      expect(state.restored.has("A")).toBe(false);
    });

    it("undoExclusion of an exclusion that replaced a restored uuid puts it back in restored (WR-01)", () => {
      useSessionStore.setState({ restored: new Set(["A"]) });
      const token = useSessionStore.getState().excludeInvoice("A");
      useSessionStore.getState().undoExclusion(token);
      const state = useSessionStore.getState();
      expect(state.excluded.has("A")).toBe(false);
      expect(state.restored.has("A")).toBe(true);
    });

    it("undoExclusion only touches its own uuid (WR-01)", () => {
      useSessionStore.setState({ restored: new Set(["B"]) });
      const token = useSessionStore.getState().excludeInvoice("A");
      useSessionStore.getState().excludeInvoice("C");
      useSessionStore.getState().undoExclusion(token);
      const state = useSessionStore.getState();
      expect(state.excluded.has("C")).toBe(true);
      expect(state.restored.has("B")).toBe(true);
      expect(state.excluded.has("A")).toBe(false);
    });

    it("reincludeInvoice without an override only removes from excluded and keeps the restored instance (WR-01)", () => {
      useSessionStore.getState().excludeInvoice("A");
      const excludedBefore = useSessionStore.getState().excluded;
      const restoredBefore = useSessionStore.getState().restored;
      useSessionStore.getState().reincludeInvoice("A", { overrideSubstitution: false });
      const state = useSessionStore.getState();
      expect(state.excluded.has("A")).toBe(false);
      expect(state.excluded).not.toBe(excludedBefore);
      expect(state.restored).toBe(restoredBefore);
      expect(state.restored.has("A")).toBe(false);
      expect(excludedBefore.has("A")).toBe(true);
    });

    it("reincludeInvoice with an override removes from excluded and adds to restored, replacing both sets (WR-01)", () => {
      useSessionStore.getState().excludeInvoice("A");
      const excludedBefore = useSessionStore.getState().excluded;
      const restoredBefore = useSessionStore.getState().restored;
      useSessionStore.getState().reincludeInvoice("A", { overrideSubstitution: true });
      const state = useSessionStore.getState();
      expect(state.excluded.has("A")).toBe(false);
      expect(state.restored.has("A")).toBe(true);
      expect(state.excluded).not.toBe(excludedBefore);
      expect(state.restored).not.toBe(restoredBefore);
      expect(excludedBefore.has("A")).toBe(true);
      expect(restoredBefore.size).toBe(0);
    });

    it("excluding a restored uuid again takes it out of restored", () => {
      useSessionStore.getState().excludeInvoice("A");
      useSessionStore.getState().reincludeInvoice("A", { overrideSubstitution: true });
      useSessionStore.getState().excludeInvoice("A");
      const state = useSessionStore.getState();
      expect(state.excluded.has("A")).toBe(true);
      expect(state.restored.has("A")).toBe(false);
    });

    it("setRange, setSuppliers and setFormas replace the filters slice immutably", () => {
      const initial = useSessionStore.getState().filters;
      useSessionStore.getState().setRange(RANGE);
      const afterRange = useSessionStore.getState().filters;
      expect(afterRange.range).toEqual(RANGE);
      expect(afterRange).not.toBe(initial);
      const suppliers = new Set(["RFC1"]);
      useSessionStore.getState().setSuppliers(suppliers);
      const afterSuppliers = useSessionStore.getState().filters;
      expect(afterSuppliers.suppliers).toBe(suppliers);
      expect(afterSuppliers.range).toEqual(RANGE);
      expect(afterSuppliers).not.toBe(afterRange);
      const formas = new Set(["03"]);
      useSessionStore.getState().setFormas(formas);
      const afterFormas = useSessionStore.getState().filters;
      expect(afterFormas.formas).toBe(formas);
      expect(afterFormas.suppliers).toBe(suppliers);
      expect(initial).toEqual(EMPTY_FILTERS);
    });

    it("setCategories replaces the category selection and clears the focus request", () => {
      const initial = useSessionStore.getState().filters;
      const suppliers = new Set(["RFC1"]);
      useSessionStore.getState().setSuppliers(suppliers);
      useSessionStore.getState().requestFocus("A");
      const categories = new Set(["seed:servicios"]);
      useSessionStore.getState().setCategories(categories);
      const state = useSessionStore.getState();
      expect(state.filters.categories).toBe(categories);
      expect(state.filters.suppliers).toBe(suppliers);
      expect(state.focusRequest).toBeNull();
      expect(initial.categories.size).toBe(0);
    });

    it("clearFilters and clearAll empty the category selection", () => {
      useSessionStore.getState().setCategories(new Set(["seed:servicios"]));
      useSessionStore.getState().clearFilters();
      expect(useSessionStore.getState().filters.categories.size).toBe(0);
      useSessionStore.getState().setCategories(new Set(["seed:servicios"]));
      useSessionStore.getState().clearAll();
      expect(useSessionStore.getState().filters.categories.size).toBe(0);
    });

    it("dropCategoryFromFilter removes only that id and replaces the set (T-03-38)", () => {
      useSessionStore.getState().setCategories(new Set(["seed:servicios", "seed:otros"]));
      const before = useSessionStore.getState().filters.categories;
      useSessionStore.getState().dropCategoryFromFilter("seed:servicios");
      const after = useSessionStore.getState().filters.categories;
      expect([...after]).toEqual(["seed:otros"]);
      expect(after).not.toBe(before);
      expect(before.has("seed:servicios")).toBe(true);
    });

    it("dropCategoryFromFilter keeps the other filters and changes nothing when the id is absent", () => {
      useSessionStore.getState().setSuppliers(new Set(["RFC1"]));
      useSessionStore.getState().setCategories(new Set(["seed:otros"]));
      const before = useSessionStore.getState().filters;
      useSessionStore.getState().dropCategoryFromFilter("seed:servicios");
      expect(useSessionStore.getState().filters).toBe(before);
      useSessionStore.getState().dropCategoryFromFilter("seed:otros");
      const after = useSessionStore.getState().filters;
      expect(after.categories.size).toBe(0);
      expect([...after.suppliers]).toEqual(["RFC1"]);
    });

    it("a category selection is never written to browser storage (D-15, CARGA-06)", () => {
      useSessionStore.getState().setCategories(new Set(["seed:servicios", SIN_CATEGORIA]));
      useSessionStore.getState().dropCategoryFromFilter("seed:servicios");
      // Writing a setting makes the persisted store flush, which is the only thing allowed to touch storage.
      useSettingsStore.getState().setIvaMode("sin");
      useSettingsStore.getState().setIvaMode("con");
      expect(window.localStorage.length).toBe(1);
      expect(window.localStorage.key(0)).toBe("invoicechecker:settings");
      expect(window.sessionStorage.length).toBe(0);
      const raw = window.localStorage.getItem("invoicechecker:settings") ?? "";
      expect(raw).not.toContain(SIN_CATEGORIA);
      expect(raw).not.toContain("filters");
    });

    it("setRange(null) goes back to the whole loaded span", () => {
      useSessionStore.getState().setRange(RANGE);
      useSessionStore.getState().setRange(null);
      expect(useSessionStore.getState().filters.range).toBeNull();
    });

    it("requestFocus sets the uuid, a growing nonce and the dashboard tab", () => {
      useSessionStore.getState().setActiveTab("calidad");
      useSessionStore.getState().requestFocus("A");
      const first = useSessionStore.getState();
      expect(first.focusRequest?.uuid).toBe("A");
      expect(first.activeTab).toBe("dashboard");
      const firstNonce = first.focusRequest?.nonce ?? -1;
      useSessionStore.getState().requestFocus("A");
      const secondNonce = useSessionStore.getState().focusRequest?.nonce ?? -1;
      expect(secondNonce).toBeGreaterThan(firstNonce);
    });

    it("clearFocusRequest empties the request", () => {
      useSessionStore.getState().requestFocus("A");
      useSessionStore.getState().clearFocusRequest();
      expect(useSessionStore.getState().focusRequest).toBeNull();
    });

    it("editing the range, suppliers or formas clears a pending focus request", () => {
      const edits: Array<() => void> = [
        () => useSessionStore.getState().setRange(RANGE),
        () => useSessionStore.getState().setSuppliers(new Set(["RFC1"])),
        () => useSessionStore.getState().setFormas(new Set(["03"])),
      ];
      for (const edit of edits) {
        useSessionStore.getState().requestFocus("A");
        expect(useSessionStore.getState().focusRequest).not.toBeNull();
        edit();
        expect(useSessionStore.getState().focusRequest).toBeNull();
      }
    });

    it("clearFilters restores EMPTY_FILTERS and keeps the focus request", () => {
      useSessionStore.getState().setRange(RANGE);
      useSessionStore.getState().setSuppliers(new Set(["RFC1"]));
      useSessionStore.getState().requestFocus("A");
      useSessionStore.getState().clearFilters();
      const state = useSessionStore.getState();
      expect(state.filters).toEqual(EMPTY_FILTERS);
      expect(state.focusRequest?.uuid).toBe("A");
    });

    it("setActiveTab changes the tab", () => {
      useSessionStore.getState().setActiveTab("importacion");
      expect(useSessionStore.getState().activeTab).toBe("importacion");
    });

    it("requestImportFocus sets importFocus and switches to the import tab; clearImportFocus empties it", () => {
      useSessionStore.getState().requestImportFocus("duplicados");
      const state = useSessionStore.getState();
      expect(state.importFocus).toBe("duplicados");
      expect(state.activeTab).toBe("importacion");
      useSessionStore.getState().clearImportFocus();
      expect(useSessionStore.getState().importFocus).toBeNull();
    });

    it("a batch that adds invoices resets the range to null and keeps suppliers and formas", () => {
      const suppliers = new Set(["RFC1"]);
      const formas = new Set(["03"]);
      useSessionStore.getState().setRange(RANGE);
      useSessionStore.getState().setSuppliers(suppliers);
      useSessionStore.getState().setFormas(formas);
      const generation = useSessionStore.getState().generation;
      const summary = useSessionStore
        .getState()
        .applyBatch([parsed("a.xml", "U1")], generation);
      expect(summary?.added).toBe(1);
      const filters = useSessionStore.getState().filters;
      expect(filters.range).toBeNull();
      expect(filters.suppliers).toBe(suppliers);
      expect(filters.formas).toBe(formas);
    });

    it("a batch that adds nothing (all duplicates) keeps the range", () => {
      const generation = useSessionStore.getState().generation;
      useSessionStore.getState().applyBatch([parsed("a.xml", "U1")], generation);
      useSessionStore.getState().setRange(RANGE);
      const summary = useSessionStore
        .getState()
        .applyBatch([parsed("a-again.xml", "U1")], generation);
      expect(summary?.added).toBe(0);
      expect(useSessionStore.getState().filters.range).toEqual(RANGE);
    });

    it("a stale-generation batch changes neither the invoices nor the filters", () => {
      const stale = useSessionStore.getState().generation;
      useSessionStore.getState().clearAll();
      useSessionStore.getState().setRange(RANGE);
      const result = useSessionStore
        .getState()
        .applyBatch([parsed("a.xml", "U1")], stale);
      expect(result).toBeNull();
      expect(useSessionStore.getState().filters.range).toEqual(RANGE);
      expect(useSessionStore.getState().invoices).toEqual([]);
    });

    it("clearAll resets every new field and bumps the generation", () => {
      const store = useSessionStore.getState();
      store.setRange(RANGE);
      store.setSuppliers(new Set(["RFC1"]));
      store.setFormas(new Set(["03"]));
      store.excludeInvoice("A");
      store.excludeInvoice("B");
      store.reincludeInvoice("B", { overrideSubstitution: true });
      expect(useSessionStore.getState().restored.has("B")).toBe(true);
      store.requestFocus("A");
      store.requestImportFocus("rechazados");
      const generation = useSessionStore.getState().generation;
      useSessionStore.getState().clearAll();
      const after = useSessionStore.getState();
      expect(after.filters).toEqual(EMPTY_FILTERS);
      expect(after.excluded.size).toBe(0);
      expect(after.restored.size).toBe(0);
      expect(after.activeTab).toBe("dashboard");
      expect(after.focusRequest).toBeNull();
      expect(after.importFocus).toBeNull();
      expect(after.generation).toBe(generation + 1);
    });
  });
});
