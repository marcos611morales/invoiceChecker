/**
 * Pure reducers over the stored settings for supplier assignments and concept
 * rules (CAT-02, CAT-03, D-03, D-04, D-09, D-30). They return a new SettingsData and never mutate their input, and
 * they refuse any change that would make the stored settings fail validation on
 * the next load (an id that is not a category, a list over its limit), so the
 * store only ever holds data the schema accepts.
 */
import { normalizeDescription } from "./normalize";
import { LIMITS, type ConceptRule, type SettingsData } from "./types";

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

export type RuleResult =
  | { ok: true; next: SettingsData; previous: ConceptRule | null }
  | { ok: false; reason: "limit" | "unknown-category" };

/**
 * Sets the category of one concept description of one supplier (CAT-03, D-09).
 * The rule key is the RFC plus the normalized description (D-10, D-26), so it
 * applies to every equal line of that supplier and to invoices loaded later.
 * - `categoryId` null is an explicit «Sin categoría» that beats the supplier's category.
 * - An id that is not in `categories` gives "unknown-category".
 * - An existing rule (same rfc and key) is replaced in place and returned as `previous`
 *   (the readable description is refreshed to the text just chosen).
 * - Appending when LIMITS.conceptRules rules already exist gives "limit" (D-30);
 *   changing an existing rule is always allowed.
 */
export function setConceptRule(
  settings: SettingsData,
  rfc: string,
  description: string,
  categoryId: string | null,
): RuleResult {
  if (categoryId !== null && !settings.categories.some((category) => category.id === categoryId)) {
    return { ok: false, reason: "unknown-category" };
  }
  const key = normalizeDescription(description);
  const index = settings.conceptRules.findIndex((rule) => rule.rfc === rfc && rule.key === key);
  const rule: ConceptRule = { rfc, key, description, categoryId };
  if (index < 0) {
    if (settings.conceptRules.length >= LIMITS.conceptRules) {
      return { ok: false, reason: "limit" };
    }
    return {
      ok: true,
      next: { ...settings, conceptRules: [...settings.conceptRules, rule] },
      previous: null,
    };
  }
  return {
    ok: true,
    next: {
      ...settings,
      conceptRules: settings.conceptRules.map((existing, position) =>
        position === index ? rule : existing,
      ),
    },
    previous: settings.conceptRules[index] ?? null,
  };
}
