/**
 * Selectors over the ledger. The IVA mode only picks which of the two stored
 * amounts is read; it never recomputes the ledger.
 */
import type Big from "big.js";
import { sum } from "./decimal";
import type { LedgerEntry } from "./ledger";

export type IvaMode = "con" | "sin";

export function entryAmount(entry: LedgerEntry, mode: IvaMode): Big | null {
  return mode === "con" ? entry.conIva : entry.sinIva;
}

/** Sum of every counted entry: Ingreso positive, Egreso already negative. */
export function totalSpend(
  entries: readonly LedgerEntry[],
  mode: IvaMode,
): Big {
  const amounts: Big[] = [];
  for (const entry of entries) {
    if (!entry.counted) continue;
    const amount = entryAmount(entry, mode);
    if (amount !== null) amounts.push(amount);
  }
  return sum(amounts);
}
