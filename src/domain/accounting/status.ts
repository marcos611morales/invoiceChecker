/**
 * What a ledger entry is to the reader: the state the invoices table attenuates or labels
 * (`rowState`) and the finer status the Excel «Estado» column spells out (`entryStatus`).
 * Both read the same two facts, in the same precedence, so the table and the workbook can
 * never tell different stories about one invoice (D-20, D-27, D-28).
 */
import type { LedgerEntry } from "./ledger";

/** What the row shows and how it is attenuated or labelled (D-27, D-28). */
export type RowState = "normal" | "no-suma" | "excluida" | "sustituida";

/** Precedence: the entry cannot sum, then a manual exclusion, then a substitution. */
export function rowState(entry: LedgerEntry): RowState {
  if (entry.noSuma !== null) return "no-suma";
  if (entry.exclusion === "manual") return "excluida";
  if (entry.exclusion === "sustituida") return "sustituida";
  return "normal";
}

/** The reason an entry does or does not add to the spend, one value per Estado text. */
export type EntryStatus =
  | "suma"
  | "pago"
  | "traslado"
  | "nomina"
  | "cero"
  | "moneda-sin-tc"
  | "invalido"
  | "excluida"
  | "sustituida";

/**
 * Same precedence as `rowState`. A type that does not sum is named by its kind. The ledger
 * only marks a Pago, Traslado or Nómina that way; any other kind carrying that mark would be
 * an inconsistent entry and reads as invalid data rather than as a silent «Suma».
 */
export function entryStatus(entry: LedgerEntry): EntryStatus {
  switch (entry.noSuma) {
    case "tipo":
      switch (entry.kind) {
        case "pago":
          return "pago";
        case "traslado":
          return "traslado";
        case "nomina":
          return "nomina";
        case "ingreso":
        case "nota-credito":
          return "invalido";
      }
      break;
    case "cero":
      return "cero";
    case "moneda-sin-tc":
      return "moneda-sin-tc";
    case "invalido":
      return "invalido";
    case null:
      break;
  }
  if (entry.exclusion === "manual") return "excluida";
  if (entry.exclusion === "sustituida") return "sustituida";
  return "suma";
}
