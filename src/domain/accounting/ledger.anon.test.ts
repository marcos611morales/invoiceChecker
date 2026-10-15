// @vitest-environment jsdom
import Big from "big.js";
import { describe, expect, it } from "vitest";
import {
  readFixture,
  withFecha,
  withFormaPago,
  withMetodoPago,
  withMoneda,
  withTipo,
  withTipoCambio,
  withTipoRelacion,
  withUuid,
} from "../../../tests/support/cfdiVariants";
import { loaded } from "../../../tests/support/ledgerFactory";
import { parseCfdi } from "../cfdi/parseCfdi";
import type { ParsedInvoice } from "../cfdi/types";
import {
  EMPTY_OVERRIDES,
  PPD_SIN_COMPLEMENTO,
  buildLedger,
  type LedgerEntry,
  type LedgerOverrides,
} from "./ledger";

// Amount and ledger rules over XML (DEV-03): every document goes through
// parseCfdi and then buildLedger. Bases are the anonymized fixtures; the
// variants are synthetic edits of them.

const INGRESO_XML = readFixture("anon/anon-ingreso-descuento.xml");
const EGRESO_XML = readFixture("anon/anon-egreso.xml");
const PAGO_XML = readFixture("anon/anon-pago.xml");

function parseOk(xml: string): ParsedInvoice {
  const result = parseCfdi(xml);
  if (!result.ok) {
    throw new Error(`expected ok, got ${result.reason} ${result.detail ?? ""}`);
  }
  return result.invoice;
}

function firstGroup(xml: string, pattern: RegExp, label: string): string {
  const match = pattern.exec(xml);
  const value = match?.[1];
  if (value === undefined) throw new Error(`fixture value not found (${label})`);
  return value;
}

function ledgerOf(
  documents: readonly string[],
  overrides: LedgerOverrides = EMPTY_OVERRIDES,
): LedgerEntry[] {
  return buildLedger(documents.map((xml) => loaded(parseOk(xml))), overrides);
}

function entryOf(entries: readonly LedgerEntry[], xml: string): LedgerEntry {
  const uuid = parseOk(xml).uuid;
  const found = entries.find((entry) => entry.uuid === uuid);
  if (found === undefined) throw new Error("entry not found for the given document");
  return found;
}

/** UUID the Egreso fixture lists in CfdiRelacionados, read from the XML, not hard-coded. */
const RELATED_UUID = firstGroup(
  EGRESO_XML,
  /<(?:[\w-]+:)?CfdiRelacionado\b[^>]*?\sUUID="([^"]+)"/,
  "CfdiRelacionado.UUID",
);
/** The Ingreso fixture re-UUIDed to the document the Egreso relates to. */
const RELATED_INGRESO_XML = withUuid(INGRESO_XML, RELATED_UUID);
const ID_DOCUMENTO = firstGroup(PAGO_XML, /\sIdDocumento="([^"]+)"/, "IdDocumento");
const FORMA_DE_PAGO_P = firstGroup(PAGO_XML, /\sFormaDePagoP="([^"]+)"/, "FormaDePagoP");
const PPD_INGRESO_XML = withUuid(
  withFormaPago(withMetodoPago(INGRESO_XML, "PPD"), "99"),
  ID_DOCUMENTO,
);

describe("ledger over anonymized XML: credit note imputation (REGLA-02)", () => {
  it("imputes a credit note dated 2025-09 to the 2025-06 month of its loaded Ingreso", () => {
    const entries = ledgerOf([RELATED_INGRESO_XML, EGRESO_XML]);
    const egreso = entryOf(entries, EGRESO_XML);
    expect(egreso.kind).toBe("nota-credito");
    expect(egreso.ownMonth).toBe("2025-09");
    expect(egreso.month).toBe("2025-06");
    expect(egreso.relatedLoaded).toEqual([RELATED_UUID]);
    expect(egreso.counted).toBe(true);
    expect(egreso.conIva?.lt(new Big("0"))).toBe(true);
    expect(entryOf(entries, RELATED_INGRESO_XML).month).toBe("2025-06");
  });

  it("keeps the own month when the credit note is loaded alone", () => {
    const egreso = entryOf(ledgerOf([EGRESO_XML]), EGRESO_XML);
    expect(egreso.month).toBe("2025-09");
    expect(egreso.relatedLoaded).toEqual([]);
    expect(egreso.relatedCount).toBe(1);
  });
});

describe("ledger over anonymized XML: PPD payment forms (REGLA-09)", () => {
  it("takes the FormaDePagoP of the Pago that references the PPD Ingreso", () => {
    const entries = ledgerOf([PPD_INGRESO_XML, PAGO_XML]);
    const ppd = entryOf(entries, PPD_INGRESO_XML);
    expect(ppd.formas).toEqual([FORMA_DE_PAGO_P]);
    expect(ppd.counted).toBe(true);
    const pago = entryOf(entries, PAGO_XML);
    expect(pago.noSuma).toBe("tipo");
    expect(pago.counted).toBe(false);
  });

  it("uses the sentinel when the Pago complement is not loaded", () => {
    const ppd = entryOf(ledgerOf([PPD_INGRESO_XML]), PPD_INGRESO_XML);
    expect(ppd.formas).toEqual([PPD_SIN_COMPLEMENTO]);
  });
});

describe("ledger over anonymized XML: TipoRelacion 04 substitution (D-08, D-42)", () => {
  const SUBSTITUTE_XML = withTipoRelacion(withTipo(EGRESO_XML, "I"), "04");

  it("marks the loaded original as sustituida and not counted", () => {
    const entries = ledgerOf([RELATED_INGRESO_XML, SUBSTITUTE_XML]);
    const original = entryOf(entries, RELATED_INGRESO_XML);
    const substitute = entryOf(entries, SUBSTITUTE_XML);
    expect(substitute.kind).toBe("ingreso");
    expect(substitute.substitutes).toEqual([RELATED_UUID]);
    expect(original.exclusion).toBe("sustituida");
    expect(original.counted).toBe(false);
    expect(original.substitutedBy).toBe(substitute.uuid);
    expect(original.conIva).not.toBeNull();
  });

  it("counts the original again once its uuid is in restored", () => {
    const restored: LedgerOverrides = {
      excluded: new Set<string>(),
      restored: new Set<string>([RELATED_UUID]),
    };
    const entries = ledgerOf([RELATED_INGRESO_XML, SUBSTITUTE_XML], restored);
    const original = entryOf(entries, RELATED_INGRESO_XML);
    expect(original.exclusion).toBeNull();
    expect(original.counted).toBe(true);
  });

  it("leaves a 07 relation alone", () => {
    const entries = ledgerOf([RELATED_INGRESO_XML, EGRESO_XML]);
    expect(entryOf(entries, RELATED_INGRESO_XML).exclusion).toBeNull();
  });
});

describe("ledger over anonymized XML: boundary dates (REGLA-05)", () => {
  it("keeps 2025-08-31T21:20:35 in 2025-08", () => {
    const xml = withFecha(INGRESO_XML, "2025-08-31T21:20:35");
    expect(entryOf(ledgerOf([xml]), xml).month).toBe("2025-08");
  });

  it("puts 2025-09-01T00:00:05 in 2025-09", () => {
    const xml = withFecha(INGRESO_XML, "2025-09-01T00:00:05");
    expect(entryOf(ledgerOf([xml]), xml).month).toBe("2025-09");
  });
});

describe("ledger over anonymized XML: foreign currency (REGLA-07)", () => {
  it("converts a USD Ingreso with the exact decimal product", () => {
    const xml = withTipoCambio(withMoneda(INGRESO_XML, "USD"), "18.2");
    const entry = entryOf(ledgerOf([xml]), xml);
    const expected = new Big(parseOk(xml).total).times("18.2");
    expect(entry.noSuma).toBeNull();
    expect(entry.counted).toBe(true);
    expect(entry.conIva?.eq(expected)).toBe(true);
  });

  it("does not sum a USD Ingreso without TipoCambio", () => {
    const xml = withMoneda(INGRESO_XML, "USD").replace(/\sTipoCambio="[^"]*"/, "");
    const entry = entryOf(ledgerOf([xml]), xml);
    expect(entry.noSuma).toBe("moneda-sin-tc");
    expect(entry.counted).toBe(false);
    expect(entry.conIva).toBeNull();
  });
});
