/**
 * Reducers for the «no comparable» overrides of products (Phase 5, D-18, D-19).
 *
 * Pure functions over SettingsData: they never mutate their input and they only ever touch the
 * `priceOverrides` list, which holds lists of entries (never a record keyed by an id). Only a
 * difference from the default is stored: marking a default-comparable product stores
 * `{ productId, comparable: false }`, bringing a default-hidden product back stores
 * `{ productId, comparable: true }`, and returning to the default removes the entry. Each change
 * reports the entry it replaced so «Deshacer» can put it back exactly. A refusal or a no-op comes
 * back as the very same settings object.
 *
 * It also holds the reducers for the content corrections (Plan 05-10, D-13, D-14, D-15), which
 * touch only the `contentCorrections` list: a list of entries identified by RFC plus normalized
 * key, never an object keyed by text. A correction follows its member, so product changes never
 * reach it.
 */
import { contentAmountIssue } from "./schema";
import {
  LIMITS,
  type ContentCorrection,
  type ContentUnit,
  type PriceOverride,
  type SettingsData,
} from "./types";

export type SetOverrideResult =
  | { ok: true; next: SettingsData; previous: PriceOverride | null }
  | { ok: false; reason: "unknown-product" | "limit" };

function copyOverride(override: PriceOverride): PriceOverride {
  return { productId: override.productId, comparable: override.comparable };
}

function productExists(settings: SettingsData, productId: string): boolean {
  return settings.products.some((product) => product.id === productId);
}

function overrideOf(settings: SettingsData, productId: string): PriceOverride | null {
  const found = settings.priceOverrides.find((override) => override.productId === productId);
  return found === undefined ? null : copyOverride(found);
}

function withOverrides(settings: SettingsData, priceOverrides: PriceOverride[]): SettingsData {
  return { ...settings, priceOverrides };
}

/**
 * Writes `wanted` as the only entry of the product (null removes it). The same settings object when
 * the list already says that; null when appending would pass the limit.
 */
function applyOverride(
  settings: SettingsData,
  productId: string,
  wanted: PriceOverride | null,
): SettingsData | null {
  const current = settings.priceOverrides.find((override) => override.productId === productId);
  if (wanted === null) {
    if (current === undefined) return settings;
    return withOverrides(
      settings,
      settings.priceOverrides.filter((override) => override.productId !== productId),
    );
  }
  if (current === undefined) {
    if (settings.priceOverrides.length >= LIMITS.priceOverrides) return null;
    return withOverrides(settings, [...settings.priceOverrides, copyOverride(wanted)]);
  }
  if (current.comparable === wanted.comparable) return settings;
  return withOverrides(
    settings,
    settings.priceOverrides.map((override) =>
      override.productId === productId ? copyOverride(wanted) : override,
    ),
  );
}

/**
 * Sets whether a product is compared (D-18). When `comparable` equals the product's default
 * (`defaultComparable`) the entry is removed, otherwise it is stored or replaced. `previous` is the
 * entry before the change (null when there was none). An unknown product id is refused as
 * "unknown-product" and the 2,001st entry as "limit".
 */
export function setPriceOverride(
  settings: SettingsData,
  productId: string,
  comparable: boolean,
  defaultComparable: boolean,
): SetOverrideResult {
  if (!productExists(settings, productId)) return { ok: false, reason: "unknown-product" };
  const previous = overrideOf(settings, productId);
  const wanted = comparable === defaultComparable ? null : { productId, comparable };
  const next = applyOverride(settings, productId, wanted);
  if (next === null) return { ok: false, reason: "limit" };
  return { ok: true, next, previous };
}

/**
 * Undo of `setPriceOverride`: writes back exactly `previous` (the entry before the change), or
 * removes the entry when there was none (D-19). A product that no longer exists, or a restore that
 * would pass the limit, leaves the settings unchanged, the very same object.
 */
export function restorePriceOverride(
  settings: SettingsData,
  productId: string,
  previous: PriceOverride | null,
): SettingsData {
  if (!productExists(settings, productId)) return settings;
  const wanted = previous === null ? null : { productId, comparable: previous.comparable };
  return applyOverride(settings, productId, wanted) ?? settings;
}

// --- Content corrections (Plan 05-10, D-13, D-14, D-15) ---

export type SetCorrectionResult =
  | { ok: true; next: SettingsData; previous: ContentCorrection | null }
  | { ok: false; reason: "limit" | "invalid" };

const CONTENT_UNITS: readonly ContentUnit[] = ["g", "kg", "ml", "l", "piezas"];

/** Exactly the seven contract fields, picked one by one: nothing else of the input is ever kept. */
function copyCorrection(correction: ContentCorrection): ContentCorrection {
  return {
    rfc: correction.rfc,
    key: correction.key,
    description: correction.description,
    supplierName: correction.supplierName,
    packs: correction.packs,
    amount: correction.amount,
    unit: correction.unit,
  };
}

function sameCorrection(a: ContentCorrection, b: ContentCorrection): boolean {
  return (
    a.description === b.description &&
    a.supplierName === b.supplierName &&
    a.packs === b.packs &&
    a.amount === b.amount &&
    a.unit === b.unit
  );
}

function isContentUnit(unit: string): unit is ContentUnit {
  return CONTENT_UNITS.some((known) => known === unit);
}

/** The stored rules of a correction: integer packs 1..999, an exact decimal amount, a known unit. */
function isValidCorrection(correction: ContentCorrection): boolean {
  if (typeof correction.rfc !== "string" || correction.rfc === "") return false;
  if (typeof correction.key !== "string" || correction.key === "") return false;
  if (typeof correction.description !== "string") return false;
  if (typeof correction.supplierName !== "string") return false;
  const { packs } = correction;
  if (typeof packs !== "number" || !Number.isInteger(packs)) return false;
  if (packs < 1 || packs > LIMITS.contentPacks) return false;
  if (typeof correction.amount !== "string" || contentAmountIssue(correction.amount) !== null) {
    return false;
  }
  return typeof correction.unit === "string" && isContentUnit(correction.unit);
}

function correctionIndex(settings: SettingsData, rfc: string, key: string): number {
  return settings.contentCorrections.findIndex(
    (entry) => entry.rfc === rfc && entry.key === key,
  );
}

function withCorrections(
  settings: SettingsData,
  contentCorrections: ContentCorrection[],
): SettingsData {
  return { ...settings, contentCorrections };
}

/**
 * Saves the content a user typed for one member (D-13): a new member is appended and a saved one is
 * replaced in place, `previous` being the entry it replaced (null for a new one). Invalid pieces,
 * amount or unit are refused as "invalid"; a new member past the 2,000th is refused as "limit",
 * while replacing an existing member always works (T-05-23). Replacing with the very same values
 * comes back as the same settings object. Only the seven contract fields are stored (T-05-24).
 */
export function setContentCorrection(
  settings: SettingsData,
  correction: ContentCorrection,
): SetCorrectionResult {
  if (!isValidCorrection(correction)) return { ok: false, reason: "invalid" };
  const wanted = copyCorrection(correction);
  const at = correctionIndex(settings, wanted.rfc, wanted.key);
  if (at === -1) {
    if (settings.contentCorrections.length >= LIMITS.contentCorrections) {
      return { ok: false, reason: "limit" };
    }
    return {
      ok: true,
      next: withCorrections(settings, [...settings.contentCorrections, wanted]),
      previous: null,
    };
  }
  const current = settings.contentCorrections[at];
  if (current === undefined) return { ok: false, reason: "invalid" };
  const previous = copyCorrection(current);
  if (sameCorrection(current, wanted)) return { ok: true, next: settings, previous };
  return {
    ok: true,
    next: withCorrections(
      settings,
      settings.contentCorrections.map((entry, index) => (index === at ? wanted : entry)),
    ),
    previous,
  };
}

/**
 * Removes the correction of one member («Volver a lo detectado») and returns the removed entry for
 * «Deshacer»; null, and nothing changed, when the member has none.
 */
export function removeContentCorrection(
  settings: SettingsData,
  rfc: string,
  key: string,
): { next: SettingsData; removed: ContentCorrection } | null {
  const at = correctionIndex(settings, rfc, key);
  const found = settings.contentCorrections[at];
  if (found === undefined) return null;
  return {
    next: withCorrections(
      settings,
      settings.contentCorrections.filter((_, index) => index !== at),
    ),
    removed: copyCorrection(found),
  };
}

/**
 * Undo of a removal or of a replacement: writes `previous` back for its member (replacing what is
 * stored for it, or appending it). A value that no longer passes the rules, or an append past the
 * limit, leaves the settings unchanged, the very same object.
 */
export function restoreContentCorrection(
  settings: SettingsData,
  previous: ContentCorrection,
): SettingsData {
  const result = setContentCorrection(settings, previous);
  return result.ok ? result.next : settings;
}
