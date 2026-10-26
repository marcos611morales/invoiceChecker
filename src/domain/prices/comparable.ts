/**
 * Default «no comparable» classification of products (Phase 5, D-16, D-17, D-18, D-27, D-31).
 *
 * A purchase line is fuel, a service or a product by the ClaveProdServ the supplier wrote on it. A
 * product is not comparable by default only when every one of its purchases is a service or fuel
 * line; one product-keyed purchase keeps it comparable. The default is computed over all counted
 * Ingreso purchases of the product with every filter ignored, so a filter never changes it. The
 * user's own choice (a stored override) wins over the default.
 *
 * Keys are untrusted XML text: they are only read as strings (prefixes), never as property names.
 */
import type { PriceOverride } from "../settings/types";
import type { Purchase } from "./purchases";

export type KeyClass = "product" | "service" | "fuel";

/** Key prefixes of fuels: 1510… (combustibles) and 151115… (gas LP) (D-27). */
const FUEL_PREFIXES: readonly string[] = ["1510", "151115"];

/** First two digits of the service segments 70 to 94 (D-27). */
const FIRST_SERVICE_SEGMENT = 70;
const LAST_SERVICE_SEGMENT = 94;

const TWO_DIGITS = /^\d{2}$/;

/**
 * Class of one ClaveProdServ. A malformed or empty key is a product, so a damaged key never hides a
 * product by accident (D-16). The key is never converted to a number as a whole.
 */
export function classifyClave(claveProdServ: string): KeyClass {
  const clave = claveProdServ.trim();
  if (FUEL_PREFIXES.some((prefix) => clave.startsWith(prefix))) return "fuel";
  const segment = clave.slice(0, 2);
  if (TWO_DIGITS.test(segment)) {
    const value = Number(segment);
    if (value >= FIRST_SERVICE_SEGMENT && value <= LAST_SERVICE_SEGMENT) return "service";
  }
  return "product";
}

/**
 * True unless the product has purchases and every one is a service or fuel line (D-17). A product
 * with no purchases is comparable.
 */
export function defaultComparable(claves: readonly string[]): boolean {
  if (claves.length === 0) return true;
  return claves.some((clave) => classifyClave(clave) === "product");
}

/**
 * The default of every product that has purchases, from all its counted Ingreso purchases with
 * every filter ignored (D-31). A product without purchases is absent from the map.
 */
export function defaultsByProduct(allPurchases: readonly Purchase[]): Map<string, boolean> {
  const claves = new Map<string, string[]>();
  for (const purchase of allPurchases) {
    const group = claves.get(purchase.productId) ?? [];
    group.push(purchase.claveProdServ);
    claves.set(purchase.productId, group);
  }
  const defaults = new Map<string, boolean>();
  for (const [productId, group] of claves) defaults.set(productId, defaultComparable(group));
  return defaults;
}

/** Whether a product is compared, and whether that is its default or the user's choice. */
export interface Comparability {
  comparable: boolean;
  /** True when a stored override decides it (D-18). */
  byUser: boolean;
  defaultComparable: boolean;
}

function overrideOf(
  productId: string,
  overrides: readonly PriceOverride[] | ReadonlyMap<string, boolean>,
): boolean | undefined {
  if ("get" in overrides) return overrides.get(productId);
  return overrides.find((override) => override.productId === productId)?.comparable;
}

/**
 * The effective state of a product: its override when it has one, else the default. A product
 * absent from the defaults map is comparable.
 */
export function comparabilityOf(
  productId: string,
  defaults: ReadonlyMap<string, boolean>,
  overrides: readonly PriceOverride[] | ReadonlyMap<string, boolean>,
): Comparability {
  const byDefault = defaults.get(productId) ?? true;
  const chosen = overrideOf(productId, overrides);
  if (chosen === undefined) {
    return { comparable: byDefault, byUser: false, defaultComparable: byDefault };
  }
  return { comparable: chosen, byUser: true, defaultComparable: byDefault };
}
