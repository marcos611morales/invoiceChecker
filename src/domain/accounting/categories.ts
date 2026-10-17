/**
 * Per-concept split of a ledger entry and the per-category breakdown (D-12,
 * D-13, D-16). The ledger itself stays mode-independent and settings-independent:
 * the split is computed on top of it with a resolver, and both IVA modes are
 * carried in every part, so toggling the mode never recomputes anything.
 *
 * Exactness: a concept contributes its own amount (`conceptAmounts`) to its
 * category, and the exact big.js difference between the invoice amount and the
 * sum of its concepts goes to the supplier's category (D-13). The parts of an
 * entry therefore add up to the invoice amount exactly in both modes, and the
 * sum of all categories equals `totalSpend`. Groupings use Map (categories and
 * RFCs come from stored text and XML). No amount goes through a float, and no
 * division runs on a zero divisor.
 */
import type Big from "big.js";
import type { Resolver } from "../settings/resolver";
import { totalSpend, type IvaMode } from "./aggregate";
import { conceptAmounts } from "./amounts";
import { ZERO, fromInteger, sum } from "./decimal";
import type { LedgerEntry } from "./ledger";

/** Spanish order, accents and case ignored (the same rule as the supplier ranking). */
const COLLATOR = new Intl.Collator("es", { sensitivity: "base" });

export interface EntryPart {
  /** Category id, or the reserved SIN_CATEGORIA key. */
  category: string;
  /** Index of the concepto in XML order; null for the rounding difference part. */
  concept: number | null;
  /** Amount in Con IVA, signed like the invoice. */
  con: Big;
  /** Amount in Sin IVA, signed like the invoice. */
  sin: Big;
}

/**
 * One part per concepto in XML order, plus one part with the exact difference
 * between the entry amounts and the sum of its concepts when either differs
 * (D-13). An unusable concept amount counts as zero. Concept parts are emitted
 * even when the entry has no amount, because non-summing entries need the
 * categories of their lines later; the difference part needs both amounts.
 */
export function splitEntry(entry: LedgerEntry, resolver: Resolver): EntryPart[] {
  const parts: EntryPart[] = [];
  let sumCon = ZERO;
  let sumSin = ZERO;
  entry.invoice.conceptos.forEach((concepto, index) => {
    const amounts = conceptAmounts(concepto, entry.invoice);
    const con = amounts.conIva ?? ZERO;
    const sin = amounts.sinIva ?? ZERO;
    sumCon = sumCon.plus(con);
    sumSin = sumSin.plus(sin);
    parts.push({
      category: resolver.resolve(entry.supplierRfc, concepto.descripcion),
      concept: index,
      con,
      sin,
    });
  });
  const { conIva, sinIva } = entry;
  if (conIva !== null && sinIva !== null) {
    const differenceCon = conIva.minus(sumCon);
    const differenceSin = sinIva.minus(sumSin);
    if (!differenceCon.eq(ZERO) || !differenceSin.eq(ZERO)) {
      parts.push({
        category: resolver.supplierCategory(entry.supplierRfc),
        concept: null,
        con: differenceCon,
        sin: differenceSin,
      });
    }
  }
  return parts;
}

export interface CategoryRow {
  /** Category id, or the reserved SIN_CATEGORIA key. */
  category: string;
  /** Net spend: credit notes subtract from the category their lines resolve to (D-12). */
  net: Big;
  /** Share of the total spend as a fraction; null when that total is not above zero. */
  pct: Big | null;
  /** net over the calendar months of the range; zero when there are no months. */
  promedio: Big;
}

/**
 * Spend per category over the counted entries of the visible set, in the given
 * IVA mode, highest net first; a negative net sorts after every non-negative
 * one. A category is listed when at least one part of a counted entry carries
 * it. Ties break by the Spanish-collated name from `nameOf`, then by key.
 */
export function categoryBreakdown(
  visible: readonly LedgerEntry[],
  resolver: Resolver,
  mode: IvaMode,
  months: number,
  nameOf: (category: string) => string,
): CategoryRow[] {
  const perCategory = new Map<string, Big[]>();
  for (const entry of visible) {
    if (!entry.counted) continue;
    for (const part of splitEntry(entry, resolver)) {
      const amount = mode === "con" ? part.con : part.sin;
      const known = perCategory.get(part.category);
      if (known === undefined) perCategory.set(part.category, [amount]);
      else known.push(amount);
    }
  }

  const total = totalSpend(visible, mode);
  const divisor = fromInteger(months);
  const rows: CategoryRow[] = [];
  for (const [category, amounts] of perCategory) {
    const net = sum(amounts);
    rows.push({
      category,
      net,
      pct: total.gt(ZERO) ? net.div(total) : null,
      promedio: months > 0 ? net.div(divisor) : ZERO,
    });
  }
  return rows.sort((a, b) => {
    const byNet = b.net.cmp(a.net);
    if (byNet !== 0) return byNet;
    const byName = COLLATOR.compare(nameOf(a.category), nameOf(b.category));
    if (byName !== 0) return byName;
    return a.category < b.category ? -1 : a.category > b.category ? 1 : 0;
  });
}

/** Stub of the RED step: replaced by the real count in the GREEN commit. */
export function ruleLineCounts(entries: readonly LedgerEntry[]): Map<string, number> {
  void entries;
  return new Map<string, number>();
}
