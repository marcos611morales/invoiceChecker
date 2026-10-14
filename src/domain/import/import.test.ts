import { describe, expect, it } from "vitest";
import type {
  ParseResult,
  ParsedInvoice,
  TipoComprobante,
} from "@/domain/cfdi/types";
import { applyBatch, emptyImportState } from "./applyBatch";
import { classifyFile } from "./classifyFile";
import {
  hasReport,
  receptorDistinto,
  receptorMasFrecuente,
  reportCounts,
} from "./report";
import type {
  BatchEntry,
  FileRef,
  ImportState,
  LoadedInvoice,
} from "./types";

function makeInvoice(
  uuid: string,
  tipo: TipoComprobante = "I",
  receptorRfc = "CAF010101AAA",
): ParsedInvoice {
  return {
    uuid,
    version: "4.0",
    fecha: "2025-01-15T10:00:00",
    tipo,
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
    receptor: { rfc: receptorRfc, nombre: null },
    conceptos: [],
    relacionados: [],
    pagos: [],
  };
}

function file(name: string): FileRef {
  return { name, path: `carpeta/${name}` };
}

function parsedEntry(
  name: string,
  uuid: string,
  tipo: TipoComprobante = "I",
  receptorRfc = "CAF010101AAA",
): BatchEntry {
  return {
    kind: "parsed",
    file: file(name),
    result: { ok: true, invoice: makeInvoice(uuid, tipo, receptorRfc) },
  };
}

function rejectedEntry(name: string, result: ParseResult): BatchEntry {
  return { kind: "parsed", file: file(name), result };
}

function loaded(
  name: string,
  uuid: string,
  receptorRfc: string,
): LoadedInvoice {
  return { file: file(name), invoice: makeInvoice(uuid, "I", receptorRfc) };
}

describe("classifyFile", () => {
  it.each([
    ["a.XML", "xml"],
    ["b.pdf", "pdf"],
    ["c.ZIP", "zip"],
    ["d.txt", "other"],
    ["sin-extension", "other"],
    [".DS_Store", "hidden"],
    ["Thumbs.db", "hidden"],
    ["thumbs.DB", "hidden"],
    ["._a.xml", "hidden"],
  ] as const)("%s is %s", (name, kind) => {
    expect(classifyFile(name)).toBe(kind);
  });
});

describe("applyBatch", () => {
  it("accepts a parsed ok entry and records the first file by UUID", () => {
    const { state, summary } = applyBatch(emptyImportState(), [
      parsedEntry("a.xml", "UUID-1"),
    ]);
    expect(state.invoices).toHaveLength(1);
    expect(state.firstFileByUuid["UUID-1"]).toEqual(file("a.xml"));
    expect(summary).toEqual({
      added: 1,
      duplicates: 0,
      rejected: 0,
      ignored: 0,
    });
  });

  it("sends a repeated UUID inside one batch to duplicates; first wins", () => {
    const { state, summary } = applyBatch(emptyImportState(), [
      parsedEntry("a.xml", "UUID-1"),
      parsedEntry("copy.xml", "UUID-1"),
    ]);
    expect(state.invoices.map((i) => i.file.name)).toEqual(["a.xml"]);
    expect(state.duplicates).toEqual([
      { file: file("copy.xml"), originalFile: file("a.xml"), uuid: "UUID-1" },
    ]);
    expect(summary.duplicates).toBe(1);
    expect(summary.added).toBe(1);
  });

  it("sends a UUID already loaded in a previous batch to duplicates", () => {
    const first = applyBatch(emptyImportState(), [
      parsedEntry("a.xml", "UUID-1"),
    ]);
    const second = applyBatch(first.state, [
      parsedEntry("again.xml", "UUID-1"),
      parsedEntry("b.xml", "UUID-2"),
    ]);
    expect(second.state.invoices.map((i) => i.file.name)).toEqual([
      "a.xml",
      "b.xml",
    ]);
    expect(second.state.duplicates).toEqual([
      {
        file: file("again.xml"),
        originalFile: file("a.xml"),
        uuid: "UUID-1",
      },
    ]);
    expect(second.summary).toEqual({
      added: 1,
      duplicates: 1,
      rejected: 0,
      ignored: 0,
    });
  });

  it("records parsed rejections with reason and detail", () => {
    const { state, summary } = applyBatch(emptyImportState(), [
      rejectedEntry("v33.xml", { ok: false, reason: "cfdi-3x", detail: "3.3" }),
    ]);
    expect(state.rejected).toEqual([
      { file: file("v33.xml"), reason: "cfdi-3x", detail: "3.3" },
    ]);
    expect(summary.rejected).toBe(1);
  });

  it("records unreadable entries as rejected with reason unreadable", () => {
    const { state } = applyBatch(emptyImportState(), [
      { kind: "unreadable", file: file("x.xml") },
    ]);
    expect(state.rejected).toEqual([
      { file: file("x.xml"), reason: "unreadable" },
    ]);
  });

  it("records ignored entries with their kind", () => {
    const { state, summary } = applyBatch(emptyImportState(), [
      { kind: "ignored", file: file("a.pdf"), ignoredKind: "pdf" },
      { kind: "ignored", file: file("b.zip"), ignoredKind: "zip" },
    ]);
    expect(state.ignored).toEqual([
      { file: file("a.pdf"), kind: "pdf" },
      { file: file("b.zip"), kind: "zip" },
    ]);
    expect(summary.ignored).toBe(2);
  });

  it("never mutates the input state", () => {
    const base = applyBatch(emptyImportState(), [
      parsedEntry("a.xml", "UUID-1"),
    ]).state;
    const snapshot = structuredClone(base);
    applyBatch(base, [
      parsedEntry("copy.xml", "UUID-1"),
      parsedEntry("b.xml", "UUID-2"),
      { kind: "unreadable", file: file("x.xml") },
      { kind: "ignored", file: file("a.pdf"), ignoredKind: "pdf" },
    ]);
    expect(base).toEqual(snapshot);
  });

  it("keeps the no-silent-drop invariant across batches", () => {
    const batches: BatchEntry[][] = [
      [
        parsedEntry("a.xml", "U1"),
        parsedEntry("b.xml", "U1"),
        { kind: "ignored", file: file("a.pdf"), ignoredKind: "pdf" },
      ],
      [
        parsedEntry("c.xml", "U2"),
        parsedEntry("d.xml", "U1"),
        { kind: "unreadable", file: file("e.xml") },
        rejectedEntry("f.xml", { ok: false, reason: "not-cfdi" }),
      ],
      [{ kind: "ignored", file: file("g.txt"), ignoredKind: "other" }],
    ];
    let state: ImportState = emptyImportState();
    let total = 0;
    for (const batch of batches) {
      state = applyBatch(state, batch).state;
      total += batch.length;
    }
    expect(
      state.invoices.length +
        state.duplicates.length +
        state.rejected.length +
        state.ignored.length,
    ).toBe(total);
  });
});

describe("reportCounts", () => {
  it("counts by tipo, duplicates, rejected and ignored split PDF vs otros", () => {
    let state: ImportState = emptyImportState();
    state = applyBatch(state, [
      parsedEntry("i1.xml", "U1", "I"),
      parsedEntry("i2.xml", "U2", "I"),
      parsedEntry("e1.xml", "U3", "E"),
      parsedEntry("p1.xml", "U4", "P"),
      parsedEntry("t1.xml", "U5", "T"),
      parsedEntry("n1.xml", "U6", "N"),
      parsedEntry("dup.xml", "U1", "I"),
      rejectedEntry("bad.xml", { ok: false, reason: "malformed" }),
      { kind: "ignored", file: file("a.pdf"), ignoredKind: "pdf" },
      { kind: "ignored", file: file("b.zip"), ignoredKind: "zip" },
      { kind: "ignored", file: file("c.txt"), ignoredKind: "other" },
    ]).state;
    expect(reportCounts(state)).toEqual({
      ingreso: 2,
      egreso: 1,
      pago: 1,
      traslado: 1,
      nomina: 1,
      duplicados: 1,
      rechazados: 1,
      ignorados: 3,
      ignoradosPdf: 1,
      ignoradosOtros: 2,
    });
  });
});

describe("receptor selectors", () => {
  it("returns null with no invoices", () => {
    expect(receptorMasFrecuente([])).toBeNull();
    expect(receptorDistinto([])).toEqual([]);
  });

  it("returns the most frequent receptor RFC", () => {
    const invoices = [
      loaded("a.xml", "U1", "AAA"),
      loaded("b.xml", "U2", "BBB"),
      loaded("c.xml", "U3", "BBB"),
    ];
    expect(receptorMasFrecuente(invoices)).toBe("BBB");
  });

  it("breaks ties by first appearance", () => {
    const invoices = [
      loaded("a.xml", "U1", "AAA"),
      loaded("b.xml", "U2", "BBB"),
      loaded("c.xml", "U3", "BBB"),
      loaded("d.xml", "U4", "AAA"),
    ];
    expect(receptorMasFrecuente(invoices)).toBe("AAA");
  });

  it("lists every invoice whose receptor differs from the most frequent", () => {
    const invoices = [
      loaded("a.xml", "U1", "AAA"),
      loaded("b.xml", "U2", "AAA"),
      loaded("c.xml", "U3", "ZZZ"),
    ];
    expect(receptorDistinto(invoices)).toEqual([
      { file: file("c.xml"), rfc: "ZZZ" },
    ]);
  });
});

describe("hasReport", () => {
  it("is false for an empty state", () => {
    expect(hasReport(emptyImportState())).toBe(false);
  });

  it("is true after a batch containing only ignored files", () => {
    const { state } = applyBatch(emptyImportState(), [
      { kind: "ignored", file: file("a.pdf"), ignoredKind: "pdf" },
    ]);
    expect(hasReport(state)).toBe(true);
  });
});
