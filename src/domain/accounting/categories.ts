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
import { normalizeDescription, ruleMapKey } from "../settings/normalize";
import type { Resolver } from "../settings/resolver";
import { SIN_CATEGORIA, type Category } from "../settings/types";
import { deltaFraction, totalSpend, type IvaMode } from "./aggregate";
import { conceptAmounts } from "./amounts";
import { ZERO, fromInteger, sum } from "./decimal";
import { compareOptions, type FilterOption } from "./filters";
import type { LedgerEntry } from "./ledger";
import type { MonthKey } from "./months";

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
  /**
   * Change of the last month of the range against the previous calendar month, as a
   * fraction (0.25 is +25 %). Null when there is nothing comparable: no variation pair,
   * no spend in the previous month, or a previous total not above zero (D-17).
   */
  variation: Big | null;
}

/**
 * The totals per category of the last month of the range and of the month before it,
 * read from the scoped entries of that pair of months (D-17).
 */
export interface VariationTotals {
  last: ReadonlyMap<string, Big>;
  previous: ReadonlyMap<string, Big>;
}

/**
 * An entry restricted to a category selection (D-14, D-27). `conIva` and `sinIva` hold
 * only the amount of the kept parts, so every selector of aggregate.ts reads the partial
 * figure without knowing about categories; the full amounts stay in `fullConIva` and
 * `fullSinIva`. `parts` are the kept parts (all of them for an empty selection).
 */
export type ScopedEntry = LedgerEntry & {
  fullConIva: Big | null;
  fullSinIva: Big | null;
  parts: EntryPart[];
};

/**
 * Restricts the entries to the selected categories. An entry belongs to the selection when
 * any part of its amount falls in it, a concept line or the rounding difference that D-13
 * sends to the supplier's category (D-27). With an empty selection every entry is kept with
 * its full amounts. Otherwise only the parts of the selected categories stay, an entry with
 * none is dropped, and `conIva`/`sinIva` become the exact sum of the kept parts (null stays
 * null: a Pago or an invalid row has no amount to scale). An entry whose every part is kept
 * keeps its original amounts untouched. Input order is kept and the input is never mutated.
 */
export function scopeToCategories(
  entries: readonly LedgerEntry[],
  selected: ReadonlySet<string>,
  resolver: Resolver,
): ScopedEntry[] {
  const scoped: ScopedEntry[] = [];
  for (const entry of entries) {
    const parts = splitEntry(entry, resolver);
    const kept = selected.size === 0 ? parts : parts.filter((part) => selected.has(part.category));
    // An empty selection keeps every entry, even one with no part (no line and no amount).
    if (selected.size > 0 && kept.length === 0) continue;
    const whole = kept.length === parts.length;
    scoped.push({
      ...entry,
      conIva: whole || entry.conIva === null ? entry.conIva : sum(kept.map((part) => part.con)),
      sinIva: whole || entry.sinIva === null ? entry.sinIva : sum(kept.map((part) => part.sin)),
      fullConIva: entry.conIva,
      fullSinIva: entry.sinIva,
      parts: kept,
    });
  }
  return scoped;
}

/**
 * Options of the category filter (D-15, D-28): every category of the settings plus
 * «Sin categoría», each with the number of entries that have any part in it. Pass the
 * whole ledger: the counts ignore the other filters, the counted state and exclusions.
 * An entry counts once per category however many of its parts fall there. Sorted by count
 * descending, then name, then key.
 */
export function categoryOptions(
  entries: readonly LedgerEntry[],
  resolver: Resolver,
  categories: readonly Category[],
  nameOf: (key: string) => string,
): FilterOption[] {
  const counts = new Map<string, number>();
  for (const category of categories) counts.set(category.id, 0);
  counts.set(SIN_CATEGORIA, 0);
  for (const entry of entries) {
    const reached = new Set<string>();
    for (const part of splitEntry(entry, resolver)) reached.add(part.category);
    for (const key of reached) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const options: FilterOption[] = [];
  for (const [key, count] of counts) options.push({ key, label: nameOf(key), count });
  return options.sort(compareOptions);
}

/**
 * Net amount per category of the counted entries whose imputation month is `month`, in the
 * given IVA mode (D-17). It reads the `parts` of each scoped entry, like `categoryBreakdown`.
 * A category with no part in that month is absent from the map.
 */
export function categoryMonthTotals(
  scoped: readonly ScopedEntry[],
  month: MonthKey,
  mode: IvaMode,
): Map<string, Big> {
  const perCategory = new Map<string, Big[]>();
  for (const entry of scoped) {
    if (!entry.counted || entry.month !== month) continue;
    for (const part of entry.parts) {
      const amount = mode === "con" ? part.con : part.sin;
      const known = perCategory.get(part.category);
      if (known === undefined) perCategory.set(part.category, [amount]);
      else known.push(amount);
    }
  }
  const totals = new Map<string, Big>();
  for (const [category, amounts] of perCategory) totals.set(category, sum(amounts));
  return totals;
}

/**
 * Spend per category over the counted entries of a scoped set, in the given IVA mode,
 * highest net first; a negative net sorts after every non-negative one. It reads the
 * `parts` of each scoped entry and never splits again, because a scoped entry's own
 * amounts are already partial. A category is listed when at least one part of a counted
 * entry carries it. The share is relative to the total of the scoped set, so a filtered
 * view adds up to 100 %. Ties break by the Spanish-collated name from `nameOf`, then by key.
 *
 * `variation` carries the monthly totals of the last month of the range and of the month
 * before it (D-17). Each row's change is `deltaFraction(last, previous)`: a category absent
 * from the previous month, or with a previous total not above zero, gets null, so a
 * percentage against $0 is never computed. Without a pair every variation is null.
 */
export function categoryBreakdown(
  scoped: readonly ScopedEntry[],
  mode: IvaMode,
  months: number,
  nameOf: (category: string) => string,
  variation: VariationTotals | null = null,
): CategoryRow[] {
  const perCategory = new Map<string, Big[]>();
  for (const entry of scoped) {
    if (!entry.counted) continue;
    for (const part of entry.parts) {
      const amount = mode === "con" ? part.con : part.sin;
      const known = perCategory.get(part.category);
      if (known === undefined) perCategory.set(part.category, [amount]);
      else known.push(amount);
    }
  }

  const total = totalSpend(scoped, mode);
  const divisor = fromInteger(months);
  const rows: CategoryRow[] = [];
  for (const [category, amounts] of perCategory) {
    const net = sum(amounts);
    rows.push({
      category,
      net,
      pct: total.gt(ZERO) ? net.div(total) : null,
      promedio: months > 0 ? net.div(divisor) : ZERO,
      variation:
        variation === null
          ? null
          : deltaFraction(variation.last.get(category) ?? ZERO, variation.previous.get(category) ?? null),
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

/**
 * Number of concept lines each rule key reaches among the loaded entries (D-09).
 * Every line of every entry counts, whatever its kind and whether the entry sums or
 * not (Pago, excluded, credit notes), because the caption says how far the rule
 * reaches before and after a change. The key is `ruleMapKey(supplierRfc,
 * normalizeDescription(descripcion))`, the same one the resolver and the stored
 * rules use; a Map keeps RFCs and descriptions such as "__proto__" as plain data.
 */
export function ruleLineCounts(entries: readonly LedgerEntry[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    for (const concepto of entry.invoice.conceptos) {
      const key = ruleMapKey(entry.supplierRfc, normalizeDescription(concepto.descripcion));
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}
