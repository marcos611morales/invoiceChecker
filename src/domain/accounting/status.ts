import type { LedgerEntry } from "./ledger";

export type RowState = "normal" | "no-suma" | "excluida" | "sustituida";

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

// RED skeleton: replaced by the implementation in the GREEN commit.
export function rowState(entry: LedgerEntry): RowState {
  void entry;
  return "normal";
}

// RED skeleton: replaced by the implementation in the GREEN commit.
export function entryStatus(entry: LedgerEntry): EntryStatus {
  void entry;
  return "suma";
}
