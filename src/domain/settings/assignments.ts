/**
 * Pure reducers over the stored settings for supplier assignments (CAT-02, D-03,
 * D-04, D-30). They return a new SettingsData and never mutate their input, and
 * they refuse any change that would make the stored settings fail validation on
 * the next load (an id that is not a category, a list over its limit), so the
 * store only ever holds data the schema accepts.
 */
import { LIMITS, type SettingsData } from "./types";

export type SupplierResult =
  | { ok: true; next: SettingsData }
  | { ok: false; reason: "limit" | "unknown-category" };

/**
 * Sets, refreshes or removes the default category of one supplier.
 * - `categoryId` null removes the assignment of that rfc (a no-op when there is none).
 * - A category id refreshes name and category of an existing assignment, or appends one.
 * - An id that is not in `categories` gives "unknown-category".
 * - Appending when LIMITS.supplierCategories assignments already exist gives "limit";
 *   changing or removing an existing one is always allowed.
 */
export function setSupplierCategory(
  settings: SettingsData,
  rfc: string,
  name: string,
  categoryId: string | null,
): SupplierResult {
  if (categoryId === null) {
    return {
      ok: true,
      next: {
        ...settings,
        supplierCategories: settings.supplierCategories.filter(
          (assignment) => assignment.rfc !== rfc,
        ),
      },
    };
  }
  if (!settings.categories.some((category) => category.id === categoryId)) {
    return { ok: false, reason: "unknown-category" };
  }
  const exists = settings.supplierCategories.some((assignment) => assignment.rfc === rfc);
  if (!exists && settings.supplierCategories.length >= LIMITS.supplierCategories) {
    return { ok: false, reason: "limit" };
  }
  const entry = { rfc, name, categoryId };
  return {
    ok: true,
    next: {
      ...settings,
      supplierCategories: exists
        ? settings.supplierCategories.map((assignment) =>
            assignment.rfc === rfc ? entry : assignment,
          )
        : [...settings.supplierCategories, entry],
    },
  };
}
