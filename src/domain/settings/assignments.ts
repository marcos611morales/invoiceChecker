import type { SettingsData } from "./types";

export type SupplierResult =
  | { ok: true; next: SettingsData }
  | { ok: false; reason: "limit" | "unknown-category" };

export function setSupplierCategory(
  settings: SettingsData,
  _rfc: string,
  _name: string,
  _categoryId: string | null,
): SupplierResult {
  return { ok: true, next: settings };
}
