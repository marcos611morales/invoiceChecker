import { describe, expect, it } from "vitest";
import { makeEntry } from "../../../tests/support/ledgerFactory";
import type { LedgerEntry } from "./ledger";
import { entryStatus, rowState } from "./status";

function entry(overrides: Partial<LedgerEntry>): LedgerEntry {
  return makeEntry(overrides);
}

describe("entryStatus (D-20)", () => {
  it("reads «suma» for an entry that nothing prevents", () => {
    expect(entryStatus(entry({}))).toBe("suma");
  });

  it("names the kind when the type does not sum", () => {
    expect(entryStatus(entry({ kind: "pago", noSuma: "tipo", counted: false }))).toBe("pago");
    expect(entryStatus(entry({ kind: "traslado", noSuma: "tipo", counted: false }))).toBe(
      "traslado",
    );
    expect(entryStatus(entry({ kind: "nomina", noSuma: "tipo", counted: false }))).toBe("nomina");
  });

  it("maps the other no-suma reasons to themselves", () => {
    expect(entryStatus(entry({ noSuma: "cero", counted: false }))).toBe("cero");
    expect(entryStatus(entry({ noSuma: "moneda-sin-tc", counted: false }))).toBe("moneda-sin-tc");
    expect(entryStatus(entry({ noSuma: "invalido", counted: false }))).toBe("invalido");
  });

  it("reads an exclusion when nothing else prevents the sum", () => {
    expect(entryStatus(entry({ exclusion: "manual", counted: false }))).toBe("excluida");
    expect(entryStatus(entry({ exclusion: "sustituida", counted: false }))).toBe("sustituida");
  });

  it("lets noSuma win over an exclusion", () => {
    expect(entryStatus(entry({ noSuma: "cero", exclusion: "manual", counted: false }))).toBe(
      "cero",
    );
    expect(
      entryStatus(entry({ kind: "pago", noSuma: "tipo", exclusion: "sustituida", counted: false })),
    ).toBe("pago");
  });
});

describe("rowState", () => {
  it("gives noSuma first, then manual exclusion, then substitution, else normal", () => {
    expect(rowState(entry({}))).toBe("normal");
    expect(rowState(entry({ noSuma: "cero", counted: false }))).toBe("no-suma");
    expect(rowState(entry({ exclusion: "manual", counted: false }))).toBe("excluida");
    expect(rowState(entry({ exclusion: "sustituida", counted: false }))).toBe("sustituida");
    expect(rowState(entry({ noSuma: "cero", exclusion: "manual", counted: false }))).toBe(
      "no-suma",
    );
  });
});
