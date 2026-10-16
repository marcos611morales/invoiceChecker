import { describe, expect, it } from "vitest";
import type { Concepto, ParsedInvoice } from "@/domain/cfdi/types";
import { buildLedger, EMPTY_OVERRIDES, PPD_SIN_COMPLEMENTO } from "./ledger";
import type { LedgerEntry } from "./ledger";
import {
  AMOUNT_CHANGING_TYPES,
  INCIDENT_ORDER,
  qualityIncidents,
  qualitySummary,
} from "./quality";
import type { Incident, IncidentType } from "./quality";
import { loaded, makeEntry, makeInvoice, TEST_FECHA_CONTEXT } from "../../../tests/support/ledgerFactory";

function concepto(importe: string): Concepto {
  return {
    claveProdServ: "01010101",
    noIdentificacion: null,
    cantidad: "1",
    claveUnidad: "H87",
    unidad: null,
    descripcion: "Concepto",
    valorUnitario: importe,
    importe,
    descuento: null,
    objetoImp: null,
    traslados: [],
    retenciones: [],
  };
}

function creditNote(overrides: Partial<LedgerEntry> = {}): LedgerEntry {
  return makeEntry({ kind: "nota-credito", ...overrides });
}

function typesOf(incidents: readonly Incident[]): IncidentType[] {
  return incidents.map((incident) => incident.type);
}

function only(incidents: readonly Incident[], type: IncidentType): Incident[] {
  return incidents.filter((incident) => incident.type === type);
}

function firstOf(incidents: readonly Incident[], type: IncidentType): Incident {
  const found = only(incidents, type)[0];
  if (found === undefined) throw new Error(`no incident of type ${type}`);
  return found;
}

/** An entry whose XML amounts are inconsistent by the given Total. */
function entryWithTotal(total: string, overrides: Partial<ParsedInvoice> = {}): LedgerEntry {
  return makeEntry({
    invoice: makeInvoice({
      subTotal: "100.00",
      total,
      totalImpuestosTrasladados: "16.00",
      ...overrides,
    }),
  });
}

describe("INCIDENT_ORDER and AMOUNT_CHANGING_TYPES", () => {
  it("lists the ten types in the fixed order", () => {
    expect(INCIDENT_ORDER).toEqual([
      "nc-sin-relacionada",
      "nc-varias-relacionadas",
      "sustituciones",
      "moneda-sin-tc",
      "datos-invalidos",
      "cero",
      "redondeo",
      "ppd-sin-complemento",
      "excluidas",
      "sustituidas",
    ]);
  });

  it("marks exactly four types as amount-changing and never nc-varias-relacionadas", () => {
    expect([...AMOUNT_CHANGING_TYPES].sort()).toEqual(
      ["datos-invalidos", "moneda-sin-tc", "nc-sin-relacionada", "sustituciones"].sort(),
    );
    expect(AMOUNT_CHANGING_TYPES.has("nc-varias-relacionadas")).toBe(false);
  });
});

describe("qualityIncidents: order", () => {
  it("returns [] for a clean ledger", () => {
    expect(qualityIncidents([makeEntry(), makeEntry()])).toEqual([]);
    expect(qualityIncidents([])).toEqual([]);
  });

  it("orders by type, not by ledger position, and keeps ledger order inside a type", () => {
    const relatedA = makeEntry({ ownMonth: "2025-05", month: "2025-05" });
    const relatedB = makeEntry({ ownMonth: "2025-07", month: "2025-07" });
    const sustituida = makeEntry({
      exclusion: "sustituida",
      counted: false,
      substitutedBy: "SUSTITUYE",
    });
    const sustituye = makeEntry({ substitutes: [sustituida.uuid] });
    const ledger: LedgerEntry[] = [
      sustituida,
      makeEntry({ exclusion: "manual", counted: false }),
      makeEntry({ formas: [PPD_SIN_COMPLEMENTO] }),
      entryWithTotal("116.50"),
      makeEntry({ noSuma: "cero", counted: false }),
      makeEntry({ noSuma: "invalido", invalidField: "Total", counted: false }),
      makeEntry({
        noSuma: "moneda-sin-tc",
        counted: false,
        invoice: makeInvoice({ moneda: "USD" }),
      }),
      sustituye,
      creditNote({
        relatedLoaded: [relatedA.uuid, relatedB.uuid],
        relatedCount: 2,
        month: "2025-05",
      }),
      relatedA,
      relatedB,
      creditNote({ relatedLoaded: [] }),
    ];
    expect(typesOf(qualityIncidents(ledger))).toEqual([
      "nc-sin-relacionada",
      "nc-varias-relacionadas",
      "sustituciones",
      "moneda-sin-tc",
      "datos-invalidos",
      "cero",
      "redondeo",
      "ppd-sin-complemento",
      "excluidas",
      "sustituidas",
    ]);
  });

  it("keeps ledger order within one type", () => {
    const first = makeEntry({ noSuma: "cero", counted: false });
    const second = makeEntry({ noSuma: "cero", counted: false });
    const found = only(qualityIncidents([first, second]), "cero");
    expect(found.map((incident) => incident.entry.uuid)).toEqual([first.uuid, second.uuid]);
  });

  it("gives every incident a unique key", () => {
    const original = makeEntry();
    const substituting = makeEntry({ substitutes: [original.uuid, "OTRA-NO-CARGADA"] });
    const both = makeEntry({ noSuma: "cero", counted: false, formas: [PPD_SIN_COMPLEMENTO] });
    const keys = qualityIncidents([original, substituting, both]).map((incident) => incident.key);
    expect(keys.length).toBe(4);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("does not mutate the ledger", () => {
    const entry = makeEntry({ noSuma: "cero", counted: false });
    const ledger = Object.freeze([entry]);
    expect(() => qualityIncidents(ledger)).not.toThrow();
    expect(ledger).toEqual([entry]);
  });
});

describe("nc-sin-relacionada", () => {
  it("lists a counted credit note with no related invoice loaded", () => {
    const note = creditNote({ relatedLoaded: [], relatedCount: 0, ownMonth: "2025-03", month: "2025-03" });
    const incidents = qualityIncidents([note]);
    expect(typesOf(incidents)).toEqual(["nc-sin-relacionada"]);
    expect(incidents[0]?.detail).toEqual({ kind: "nc-sin-relacionada", month: "2025-03" });
  });

  it("also lists it when the XML names related invoices that are not loaded", () => {
    const note = creditNote({ relatedLoaded: [], relatedCount: 2 });
    expect(typesOf(qualityIncidents([note]))).toEqual(["nc-sin-relacionada"]);
  });

  it("does not list a credit note with a loaded related invoice", () => {
    const related = makeEntry();
    const note = creditNote({ relatedLoaded: [related.uuid], relatedCount: 1 });
    expect(qualityIncidents([related, note])).toEqual([]);
  });

  it("does not list an uncounted credit note", () => {
    const note = creditNote({ counted: false, exclusion: "manual" });
    expect(only(qualityIncidents([note]), "nc-sin-relacionada")).toEqual([]);
  });

  it("does not list an Ingreso", () => {
    expect(qualityIncidents([makeEntry({ relatedLoaded: [] })])).toEqual([]);
  });
});

describe("nc-varias-relacionadas (D-34, D-46)", () => {
  it("yields one incident with the oldest related month and the loaded count", () => {
    const julio = makeEntry({ ownMonth: "2025-07", month: "2025-07" });
    const mayoA = makeEntry({ ownMonth: "2025-05", month: "2025-05" });
    const mayoB = makeEntry({ ownMonth: "2025-05", month: "2025-05" });
    const note = creditNote({
      relatedLoaded: [mayoA.uuid, mayoB.uuid, julio.uuid],
      relatedCount: 3,
      month: "2025-05",
    });
    const incidents = qualityIncidents([julio, mayoA, mayoB, note]);
    expect(typesOf(incidents)).toEqual(["nc-varias-relacionadas"]);
    expect(incidents[0]?.detail).toEqual({
      kind: "nc-varias-relacionadas",
      month: "2025-05",
      relatedLoadedCount: 3,
    });
    expect(incidents[0]?.entry.uuid).toBe(note.uuid);
  });

  it("takes the month from the credit note, not from the order of the related list", () => {
    const julio = makeEntry({ ownMonth: "2025-07", month: "2025-07" });
    const mayo = makeEntry({ ownMonth: "2025-05", month: "2025-05" });
    const note = creditNote({ relatedLoaded: [julio.uuid, mayo.uuid], month: "2025-05" });
    const incident = firstOf(qualityIncidents([julio, mayo, note]), "nc-varias-relacionadas");
    expect(incident.detail).toMatchObject({ month: "2025-05", relatedLoadedCount: 2 });
  });

  it("gives no incident when all loaded related invoices share one month", () => {
    const a = makeEntry({ ownMonth: "2025-05", month: "2025-05" });
    const b = makeEntry({ ownMonth: "2025-05", month: "2025-05" });
    const note = creditNote({ relatedLoaded: [a.uuid, b.uuid], month: "2025-05" });
    expect(qualityIncidents([a, b, note])).toEqual([]);
  });

  it("gives no incident when only one related invoice is loaded", () => {
    const a = makeEntry({ ownMonth: "2025-05", month: "2025-05" });
    const note = creditNote({ relatedLoaded: [a.uuid], relatedCount: 3, month: "2025-05" });
    expect(qualityIncidents([a, note])).toEqual([]);
  });

  it("is only nc-sin-relacionada when none is loaded (one entry never holds both types)", () => {
    const note = creditNote({ relatedLoaded: [], relatedCount: 2 });
    expect(typesOf(qualityIncidents([note]))).toEqual(["nc-sin-relacionada"]);
  });

  it("gives no incident when the credit note is not counted", () => {
    const julio = makeEntry({ ownMonth: "2025-07", month: "2025-07" });
    const mayo = makeEntry({ ownMonth: "2025-05", month: "2025-05" });
    const note = creditNote({
      relatedLoaded: [julio.uuid, mayo.uuid],
      month: "2025-05",
      counted: false,
      exclusion: "manual",
    });
    expect(only(qualityIncidents([julio, mayo, note]), "nc-varias-relacionadas")).toEqual([]);
  });

  it("ignores related uuids missing from the ledger or without an own month", () => {
    const mayo = makeEntry({ ownMonth: "2025-05", month: "2025-05" });
    const sinMes = makeEntry({ ownMonth: null, month: null });
    const note = creditNote({
      relatedLoaded: [mayo.uuid, sinMes.uuid, "NO-ESTA-EN-EL-LIBRO"],
      month: "2025-05",
    });
    expect(only(qualityIncidents([mayo, sinMes, note]), "nc-varias-relacionadas")).toEqual([]);
  });

  it("counts in the total but never raises the amount-changing flag", () => {
    const julio = makeEntry({ ownMonth: "2025-07", month: "2025-07" });
    const mayo = makeEntry({ ownMonth: "2025-05", month: "2025-05" });
    const note = creditNote({ relatedLoaded: [julio.uuid, mayo.uuid], month: "2025-05" });
    const summary = qualitySummary([julio, mayo, note]);
    expect(summary.total).toBe(1);
    expect(summary.amountChanging).toBe(false);
    expect(summary.byType.get("nc-varias-relacionadas")?.length).toBe(1);
  });

  it("derives the imputation month from the real ledger (oldest related invoice)", () => {
    const julio = makeInvoice({ fecha: "2025-07-10T10:00:00" });
    const mayo = makeInvoice({ fecha: "2025-05-20T10:00:00" });
    const note = makeInvoice({
      tipo: "E",
      fecha: "2025-08-02T10:00:00",
      relacionados: [{ tipoRelacion: "01", uuids: [julio.uuid, mayo.uuid] }],
    });
    const ledger = buildLedger([loaded(julio), loaded(mayo), loaded(note)], EMPTY_OVERRIDES, TEST_FECHA_CONTEXT);
    const incidents = qualityIncidents(ledger);
    expect(typesOf(incidents)).toEqual(["nc-varias-relacionadas"]);
    expect(incidents[0]?.detail).toEqual({
      kind: "nc-varias-relacionadas",
      month: "2025-05",
      relatedLoadedCount: 2,
    });
  });
});

describe("sustituciones", () => {
  it("is excluida when the loaded original is currently substituted", () => {
    const original = makeEntry({ exclusion: "sustituida", counted: false });
    const substituting = makeEntry({ substitutes: [original.uuid] });
    const incident = firstOf(qualityIncidents([original, substituting]), "sustituciones");
    expect(incident.entry.uuid).toBe(substituting.uuid);
    expect(incident.detail).toEqual({
      kind: "sustituciones",
      targetUuid: original.uuid,
      state: "excluida",
    });
  });

  it("is excluida when the loaded original is excluded by hand", () => {
    const original = makeEntry({ exclusion: "manual", counted: false });
    const substituting = makeEntry({ substitutes: [original.uuid] });
    expect(firstOf(qualityIncidents([original, substituting]), "sustituciones").detail).toMatchObject({
      state: "excluida",
    });
  });

  it("is reincluida when the loaded original is no longer excluded", () => {
    const original = makeEntry({ exclusion: null });
    const substituting = makeEntry({ substitutes: [original.uuid] });
    expect(firstOf(qualityIncidents([original, substituting]), "sustituciones").detail).toMatchObject({
      state: "reincluida",
    });
  });

  it("is no-cargada when the original is not in the ledger", () => {
    const substituting = makeEntry({ substitutes: ["ORIGINAL-AUSENTE"] });
    expect(firstOf(qualityIncidents([substituting]), "sustituciones").detail).toEqual({
      kind: "sustituciones",
      targetUuid: "ORIGINAL-AUSENTE",
      state: "no-cargada",
    });
  });

  it("yields one incident per listed uuid", () => {
    const original = makeEntry({ exclusion: "sustituida", counted: false });
    const substituting = makeEntry({ substitutes: [original.uuid, "OTRA-1", "OTRA-2"] });
    const found = only(qualityIncidents([original, substituting]), "sustituciones");
    expect(found.map((incident) => incident.detail)).toEqual([
      { kind: "sustituciones", targetUuid: original.uuid, state: "excluida" },
      { kind: "sustituciones", targetUuid: "OTRA-1", state: "no-cargada" },
      { kind: "sustituciones", targetUuid: "OTRA-2", state: "no-cargada" },
    ]);
  });
});

describe("types that come from noSuma, exclusion and formas", () => {
  it("moneda-sin-tc carries the invoice currency", () => {
    const entry = makeEntry({
      noSuma: "moneda-sin-tc",
      counted: false,
      invoice: makeInvoice({ moneda: "USD" }),
    });
    const incidents = qualityIncidents([entry]);
    expect(typesOf(incidents)).toEqual(["moneda-sin-tc"]);
    expect(incidents[0]?.detail).toEqual({ kind: "moneda-sin-tc", moneda: "USD" });
  });

  it("datos-invalidos carries the damaged field untouched", () => {
    const total = makeEntry({ noSuma: "invalido", invalidField: "Total", counted: false });
    const fecha = makeEntry({ noSuma: "invalido", invalidField: "Fecha", counted: false });
    const found = only(qualityIncidents([total, fecha]), "datos-invalidos");
    expect(found.map((incident) => incident.detail)).toEqual([
      { kind: "datos-invalidos", field: "Total" },
      { kind: "datos-invalidos", field: "Fecha" },
    ]);
  });

  it("datos-invalidos turns a field outside the closed list into null", () => {
    const unknown = makeEntry({ noSuma: "invalido", invalidField: "Folio", counted: false });
    const missing = makeEntry({ noSuma: "invalido", invalidField: null, counted: false });
    const found = only(qualityIncidents([unknown, missing]), "datos-invalidos");
    expect(found.map((incident) => incident.detail)).toEqual([
      { kind: "datos-invalidos", field: null },
      { kind: "datos-invalidos", field: null },
    ]);
  });

  it("accepts every field of the closed list", () => {
    const fields = ["Total", "SubTotal", "Descuento", "Importe", "Fecha"];
    const ledger = fields.map((field) =>
      makeEntry({ noSuma: "invalido", invalidField: field, counted: false }),
    );
    const found = only(qualityIncidents(ledger), "datos-invalidos");
    expect(found.map((incident) => incident.detail)).toEqual(
      fields.map((field) => ({ kind: "datos-invalidos", field })),
    );
  });

  it("cero comes from noSuma cero", () => {
    const incidents = qualityIncidents([makeEntry({ noSuma: "cero", counted: false })]);
    expect(incidents.map((incident) => incident.detail)).toEqual([{ kind: "cero" }]);
  });

  it("tipo noSuma (Pago, Traslado, Nomina) is not an incident", () => {
    const entries = (["pago", "traslado", "nomina"] as const).map((kind) =>
      makeEntry({ kind, noSuma: "tipo", counted: false }),
    );
    expect(qualityIncidents(entries)).toEqual([]);
  });

  it("excluidas comes from a manual exclusion", () => {
    const incidents = qualityIncidents([makeEntry({ exclusion: "manual", counted: false })]);
    expect(incidents.map((incident) => incident.detail)).toEqual([{ kind: "excluidas" }]);
  });

  it("sustituidas comes from a substituted exclusion and names the substituting invoice", () => {
    const entry = makeEntry({ exclusion: "sustituida", counted: false, substitutedBy: "NUEVA" });
    const incidents = qualityIncidents([entry]);
    expect(typesOf(incidents)).toEqual(["sustituidas"]);
    expect(incidents[0]?.detail).toEqual({ kind: "sustituidas", substitutedBy: "NUEVA" });
  });

  it("ppd-sin-complemento comes from formas equal to the sentinel", () => {
    const ppd = makeEntry({ formas: [PPD_SIN_COMPLEMENTO] });
    const withComplement = makeEntry({ formas: ["03"] });
    const found = qualityIncidents([ppd, withComplement]);
    expect(typesOf(found)).toEqual(["ppd-sin-complemento"]);
    expect(found[0]?.entry.uuid).toBe(ppd.uuid);
  });

  it("an invoice can appear in several types", () => {
    const entry = makeEntry({
      noSuma: "cero",
      counted: false,
      formas: [PPD_SIN_COMPLEMENTO],
      exclusion: "manual",
    });
    expect(typesOf(qualityIncidents([entry]))).toEqual(["cero", "ppd-sin-complemento", "excluidas"]);
  });
});

describe("redondeo (D-09, REGLA-04 boundary)", () => {
  it("is not an incident at exactly 0.01", () => {
    expect(qualityIncidents([entryWithTotal("116.01")])).toEqual([]);
    expect(qualityIncidents([entryWithTotal("115.99")])).toEqual([]);
  });

  it("is not an incident when the amounts agree", () => {
    expect(qualityIncidents([entryWithTotal("116.00")])).toEqual([]);
  });

  it("is an incident at 0.011 and keeps the exact difference", () => {
    const incidents = qualityIncidents([entryWithTotal("116.011")]);
    expect(typesOf(incidents)).toEqual(["redondeo"]);
    const detail = incidents[0]?.detail;
    expect(detail?.kind).toBe("redondeo");
    if (detail?.kind !== "redondeo") throw new Error("expected redondeo detail");
    expect(detail.totalDiff?.toString()).toBe("0.011");
    expect(detail.conceptsDiff).toBeNull();
  });

  it("reports the absolute difference when the Total is lower", () => {
    const detail = firstOf(qualityIncidents([entryWithTotal("115.90")]), "redondeo").detail;
    if (detail.kind !== "redondeo") throw new Error("expected redondeo detail");
    expect(detail.totalDiff?.toString()).toBe("0.1");
  });

  it("subtracts Descuento and retenciones and adds traslados", () => {
    // 100 - 10 + 14.4 - 1.5 = 102.9
    const ok = entryWithTotal("102.90", {
      descuento: "10.00",
      totalImpuestosTrasladados: "14.40",
      totalImpuestosRetenidos: "1.50",
    });
    expect(qualityIncidents([ok])).toEqual([]);
    const off = entryWithTotal("103.00", {
      descuento: "10.00",
      totalImpuestosTrasladados: "14.40",
      totalImpuestosRetenidos: "1.50",
    });
    expect(typesOf(qualityIncidents([off]))).toEqual(["redondeo"]);
  });

  it("counts absent TotalImpuestos attributes as zero", () => {
    const entry = makeEntry({
      invoice: makeInvoice({
        subTotal: "100.00",
        total: "100.00",
        totalImpuestosTrasladados: null,
        totalImpuestosRetenidos: null,
      }),
    });
    expect(qualityIncidents([entry])).toEqual([]);
  });

  it("flags a concept sum that differs from SubTotal by more than 0.01", () => {
    const entry = makeEntry({
      invoice: makeInvoice({ conceptos: [concepto("99.98")] }),
    });
    const incidents = qualityIncidents([entry]);
    expect(typesOf(incidents)).toEqual(["redondeo"]);
    const detail = incidents[0]?.detail;
    if (detail?.kind !== "redondeo") throw new Error("expected redondeo detail");
    expect(detail.totalDiff).toBeNull();
    expect(detail.conceptsDiff?.toString()).toBe("0.02");
  });

  it("does not flag a concept sum that differs by exactly 0.01", () => {
    const entry = makeEntry({
      invoice: makeInvoice({ conceptos: [concepto("60.00"), concepto("39.99")] }),
    });
    expect(qualityIncidents([entry])).toEqual([]);
  });

  it("gives one incident with both differences when both conditions hold", () => {
    const entry = makeEntry({
      invoice: makeInvoice({
        total: "117.00",
        conceptos: [concepto("99.00")],
      }),
    });
    const incidents = qualityIncidents([entry]);
    expect(typesOf(incidents)).toEqual(["redondeo"]);
    const detail = incidents[0]?.detail;
    if (detail?.kind !== "redondeo") throw new Error("expected redondeo detail");
    expect(detail.totalDiff?.toString()).toBe("1");
    expect(detail.conceptsDiff?.toString()).toBe("1");
  });

  it("skips a non-numeric Total without error", () => {
    const entry = makeEntry({
      noSuma: "invalido",
      invalidField: "Total",
      counted: false,
      invoice: makeInvoice({ total: "abc" }),
    });
    expect(() => qualityIncidents([entry])).not.toThrow();
    expect(typesOf(qualityIncidents([entry]))).toEqual(["datos-invalidos"]);
  });

  it("skips a non-numeric concept importe without error but still checks the Total", () => {
    const entry = makeEntry({
      invoice: makeInvoice({ total: "120.00", conceptos: [concepto("1e5")] }),
    });
    const incidents = qualityIncidents([entry]);
    const detail = firstOf(incidents, "redondeo").detail;
    if (detail.kind !== "redondeo") throw new Error("expected redondeo detail");
    expect(detail.totalDiff?.toString()).toBe("4");
    expect(detail.conceptsDiff).toBeNull();
  });

  it("skips damaged TotalImpuestos without error", () => {
    const entry = makeEntry({
      invoice: makeInvoice({ total: "999.00", totalImpuestosTrasladados: "x" }),
    });
    expect(qualityIncidents([entry])).toEqual([]);
  });

  it("never checks Pago, Traslado or Nomina entries", () => {
    const entries = (["pago", "traslado", "nomina"] as const).map((kind) =>
      makeEntry({
        kind,
        noSuma: "tipo",
        counted: false,
        invoice: makeInvoice({ total: "999.00", conceptos: [concepto("1.00")] }),
      }),
    );
    expect(qualityIncidents(entries)).toEqual([]);
  });

  it("checks a credit note too", () => {
    const note = creditNote({
      relatedLoaded: ["X"],
      invoice: makeInvoice({ tipo: "E", total: "120.00" }),
    });
    // relatedLoaded "X" is not in the ledger, so only the rounding check fires
    expect(typesOf(qualityIncidents([note]))).toEqual(["redondeo"]);
  });

  it("compares in the invoice's own currency without converting", () => {
    const entry = makeEntry({
      invoice: makeInvoice({ moneda: "USD", tipoCambio: "17.5", total: "116.00" }),
    });
    expect(qualityIncidents([entry])).toEqual([]);
  });
});

describe("qualitySummary", () => {
  it("has an entry for every type, even empty ones, and a zero total for a clean ledger", () => {
    const summary = qualitySummary([makeEntry()]);
    expect(summary.total).toBe(0);
    expect(summary.amountChanging).toBe(false);
    for (const type of INCIDENT_ORDER) {
      expect(summary.byType.get(type)).toEqual([]);
    }
  });

  it("total equals the number of incident rows", () => {
    const entry = makeEntry({
      noSuma: "cero",
      counted: false,
      formas: [PPD_SIN_COMPLEMENTO],
    });
    const substituting = makeEntry({ substitutes: ["AUSENTE"] });
    const ledger = [entry, substituting];
    expect(qualitySummary(ledger).total).toBe(qualityIncidents(ledger).length);
    expect(qualitySummary(ledger).total).toBe(3);
  });

  it("groups incidents by type in ledger order", () => {
    const a = makeEntry({ noSuma: "cero", counted: false });
    const b = makeEntry({ noSuma: "cero", counted: false });
    const grouped = qualitySummary([a, b]).byType.get("cero");
    expect(grouped?.map((incident) => incident.entry.uuid)).toEqual([a.uuid, b.uuid]);
  });

  describe("amountChanging", () => {
    it("is true for a credit note without a related invoice", () => {
      expect(qualitySummary([creditNote({ relatedLoaded: [] })]).amountChanging).toBe(true);
    });

    it("is true for a substitution whose original is excluded", () => {
      const original = makeEntry({ exclusion: "sustituida", counted: false });
      const substituting = makeEntry({ substitutes: [original.uuid] });
      expect(qualitySummary([original, substituting]).amountChanging).toBe(true);
    });

    it("is true for a foreign invoice without rate", () => {
      const entry = makeEntry({ noSuma: "moneda-sin-tc", counted: false });
      expect(qualitySummary([entry]).amountChanging).toBe(true);
    });

    it("is true for a damaged-data invoice", () => {
      const entry = makeEntry({ noSuma: "invalido", invalidField: "Fecha", counted: false });
      expect(qualitySummary([entry]).amountChanging).toBe(true);
    });

    it("is false when only cero, redondeo, ppd, excluidas or sustituidas exist", () => {
      const ledger = [
        makeEntry({ noSuma: "cero", counted: false }),
        entryWithTotal("120.00"),
        makeEntry({ formas: [PPD_SIN_COMPLEMENTO] }),
        makeEntry({ exclusion: "manual", counted: false }),
        makeEntry({ exclusion: "sustituida", counted: false, substitutedBy: "NUEVA" }),
      ];
      const summary = qualitySummary(ledger);
      expect(summary.total).toBe(5);
      expect(summary.amountChanging).toBe(false);
    });

    it("is false for substitutions whose original is re-included or not loaded", () => {
      const reincluded = makeEntry({ exclusion: null });
      const a = makeEntry({ substitutes: [reincluded.uuid] });
      const b = makeEntry({ substitutes: ["AUSENTE"] });
      const summary = qualitySummary([reincluded, a, b]);
      expect(summary.total).toBe(2);
      expect(summary.amountChanging).toBe(false);
    });
  });
});
