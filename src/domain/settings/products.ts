/**
 * Product reducers (Phase 4, D-06, D-09, D-10, D-12). Skeleton: the behavior arrives in the
 * GREEN commit of this task.
 */
import type { Product, ProductMember, SettingsData } from "./types";

export type ProductNameError = "empty" | "duplicate" | "reserved" | "too-long";

export function validateProductName(
  _settings: SettingsData,
  raw: string,
  _exceptId: string | null,
): { ok: true; name: string } | { ok: false; reason: ProductNameError } {
  return { ok: true, name: raw };
}

export type AcceptProductError = ProductNameError | "limit" | "members-taken" | "no-members";

export function acceptProduct(
  _settings: SettingsData,
  _input: { name: string; members: readonly ProductMember[] },
  _id: string,
): { ok: true; next: SettingsData; product: Product } | { ok: false; reason: AcceptProductError } {
  return { ok: false, reason: "empty" };
}

export function productMemberKeys(_settings: SettingsData): Set<string> {
  return new Set<string>();
}
