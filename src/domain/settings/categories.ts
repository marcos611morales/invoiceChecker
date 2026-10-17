/**
 * Pure reducers over the stored categories (CAT-01, CAT-05, D-04, D-05, D-30) and
 * the display order (UI-SPEC, D-02). RED stubs: neutral values.
 */
import {
  OTROS_ID,
  type Category,
  type ConceptRule,
  type SettingsData,
  type SupplierAssignment,
} from "./types";

const COLLATOR = new Intl.Collator("es", { sensitivity: "base" });

/** A new array; the input is not mutated. */
export function orderedCategories(categories: readonly Category[]): Category[] {
  const rest = categories
    .filter((category) => category.id !== OTROS_ID)
    .sort((a, b) => COLLATOR.compare(a.name, b.name));
  const otros = categories.filter((category) => category.id === OTROS_ID);
  return [...rest, ...otros];
}

export type NameError = "empty" | "duplicate" | "reserved" | "too-long" | "limit";

export function validateCategoryName(
  _settings: SettingsData,
  raw: string,
  _exceptId: string | null,
): { ok: true; name: string } | { ok: false; reason: NameError } {
  return { ok: true, name: raw };
}

export function addCategory(
  settings: SettingsData,
  raw: string,
  id: string,
): { ok: true; next: SettingsData; category: Category } | { ok: false; reason: NameError } {
  return { ok: true, next: settings, category: { id, name: raw } };
}

export function renameCategory(
  settings: SettingsData,
  _id: string,
  _raw: string,
): { ok: true; next: SettingsData } | { ok: false; reason: NameError } {
  return { ok: true, next: { ...settings } };
}

export function categoryUsage(
  _settings: SettingsData,
  _id: string,
): { suppliers: number; concepts: number } {
  return { suppliers: 0, concepts: 0 };
}

export interface DeleteSnapshot {
  category: Category;
  index: number;
  suppliers: SupplierAssignment[];
  rules: ConceptRule[];
}

export function deleteCategory(
  settings: SettingsData,
  id: string,
  _target: string | null,
): { next: SettingsData; snapshot: DeleteSnapshot } | null {
  return {
    next: settings,
    snapshot: { category: { id, name: "" }, index: 0, suppliers: [], rules: [] },
  };
}

export function restoreCategory(settings: SettingsData, _snapshot: DeleteSnapshot): SettingsData {
  return settings;
}
