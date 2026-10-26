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
 */
import { LIMITS, type PriceOverride, type SettingsData } from "./types";

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
