import { afterEach, describe, expect, it, vi } from "vitest";
import type { ParsedInvoice } from "@/domain/cfdi/types";
import type { BatchEntry } from "@/domain/import/types";
import { useSessionStore } from "./sessionStore";

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
});
