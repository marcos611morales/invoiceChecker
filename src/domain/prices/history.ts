/**
 * Price history of a product (Phase 5, PREC-06, D-24, D-33). Pure and exact: the points keep the
 * exact normalized price as `Big`; only the chart rounds, and only for geometry.
 *
 * Each store keeps one series slot whatever the filters: the slot is the store's position in the
 * Spanish alphabetical list of the stores that sold the product among the unfiltered compared
 * purchases, so a date or supplier filter never repaints a surviving store (UI-SPEC OQ1). Stores
 * beyond the sixth fold into one neutral slot, `otras`. The X value of a point is the day number
 * of the literal invoice date, never a Date built from the string in local time (REGLA-05).
 */
import type Big from "big.js";
import type { ProductComparison } from "./compare";
import type { UnitFamily } from "./units";

/** The six colored slots, in the validated order that is never cycled or reordered. */
export const STORE_SLOTS = ["tienda1", "tienda2", "tienda3", "tienda4", "tienda5", "tienda6"] as const;

export type SeriesSlot = (typeof STORE_SLOTS)[number] | "otras";

/** Spanish order, accents and case ignored (same rule as the stores of the comparison, D-30). */
const COLLATOR = new Intl.Collator("es", { sensitivity: "base" });

const MS_PER_DAY = 86_400_000;

/**
 * Slot of each store (by RFC): the Spanish alphabetical order of the names, the RFC breaking a
 * tie, the first six to `tienda1`..`tienda6` and the rest to `otras`. The result is a `Map`, so
 * an RFC such as "__proto__" is an ordinary key.
 */
export function assignSlots(
  stores: readonly { rfc: string; name: string }[],
): Map<string, SeriesSlot> {
  const ordered = [...stores].sort((a, b) => {
    const byName = COLLATOR.compare(a.name, b.name);
    if (byName !== 0) return byName;
    return a.rfc < b.rfc ? -1 : a.rfc > b.rfc ? 1 : 0;
  });
  const slots = new Map<string, SeriesSlot>();
  ordered.forEach((store, index) => {
    slots.set(store.rfc, STORE_SLOTS[index] ?? "otras");
  });
  return slots;
}

const ISO_DATE_PREFIX = /^(\d{4})-(\d{2})-(\d{2})/;

/**
 * Days since 1970-01-01 of the literal `YYYY-MM-DD` prefix of a `Fecha`, or null when it is not a
 * real calendar date. The date parts are read from the string and built as UTC, so no local time
 * zone can shift the day (REGLA-05).
 */
export function dayNumber(fecha: string): number | null {
  const match = ISO_DATE_PREFIX.exec(fecha);
  if (match === null) return null;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (month < 1 || month > 12 || day < 1) return null;
  // setUTCFullYear keeps years below 100 as written (Date.UTC would map them to 19xx).
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  // A day past the end of the month rolls into the next one: reject it.
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return date.getTime() / MS_PER_DAY;
}

/** One plotted purchase: a compared purchase at its date and exact normalized price. */
export interface HistoryPoint {
  /** `dayNumber` of the literal fecha: the X value. */
  day: number;
  /** The literal invoice Fecha. */
  fecha: string;
  /** Normalized price, exact. */
  price: Big;
  /** Kg, L or pieces bought. */
  content: Big;
  family: UnitFamily;
  storeRfc: string;
  storeName: string;
  folio: string | null;
  slot: SeriesSlot;
}

export interface HistorySeries {
  slot: SeriesSlot;
  /** The stores of the series: one for a colored slot, one or more for `otras`. By name. */
  stores: { rfc: string; name: string }[];
  /** Date ascending, then by the literal fecha, so two purchases of one day keep their time order. */
  points: HistoryPoint[];
}

export interface History {
  /** Series in slot order (`tienda1`..`tienda6`, then `otras`); only the slots that have points. */
  series: HistorySeries[];
  plotted: number;
  /** Purchases left out of the chart: not normalized (or without a usable date). */
  excluded: number;
  /** Earliest and latest literal fecha among the plotted points; null when none is plotted. */
  firstFecha: string | null;
  lastFecha: string | null;
}

const SLOT_ORDER: readonly SeriesSlot[] = [...STORE_SLOTS, "otras"];

function comparePoints(a: HistoryPoint, b: HistoryPoint): number {
  if (a.day !== b.day) return a.day - b.day;
  return a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0;
}

/**
 * The per-store series of a product. Only compared purchases are plotted (a not-normalized
 * purchase has no price); the others are counted in `excluded`. A store missing from `slots` goes
 * to `otras`, so a store that the unfiltered list did not have never repaints another one.
 */
export function historySeries(
  row: ProductComparison,
  slots: ReadonlyMap<string, SeriesSlot>,
): History {
  const bySlot = new Map<SeriesSlot, HistoryPoint[]>();
  let plotted = 0;
  let excluded = 0;
  let first: string | null = null;
  let last: string | null = null;
  for (const purchase of row.purchases) {
    if (purchase.status !== "compared") {
      excluded += 1;
      continue;
    }
    const day = dayNumber(purchase.fecha);
    if (day === null) {
      excluded += 1;
      continue;
    }
    const slot = slots.get(purchase.storeRfc) ?? "otras";
    const points = bySlot.get(slot) ?? [];
    points.push({
      day,
      fecha: purchase.fecha,
      price: purchase.price,
      content: purchase.content,
      family: purchase.family,
      storeRfc: purchase.storeRfc,
      storeName: purchase.storeName,
      folio: purchase.folio,
      slot,
    });
    bySlot.set(slot, points);
    plotted += 1;
    if (first === null || purchase.fecha < first) first = purchase.fecha;
    if (last === null || purchase.fecha > last) last = purchase.fecha;
  }

  const series: HistorySeries[] = [];
  for (const slot of SLOT_ORDER) {
    const points = bySlot.get(slot);
    if (points === undefined) continue;
    points.sort(comparePoints);
    const stores = new Map<string, string>();
    for (const point of points) stores.set(point.storeRfc, point.storeName);
    series.push({
      slot,
      stores: [...stores]
        .map(([rfc, name]) => ({ rfc, name }))
        .sort((a, b) => COLLATOR.compare(a.name, b.name) || (a.rfc < b.rfc ? -1 : 1)),
      points,
    });
  }
  return { series, plotted, excluded, firstFecha: first, lastFecha: last };
}
