/**
 * Category of a supplier and of a concept line. Lookups are Maps built once, so
 * an RFC such as "__proto__" is plain data. Only ids that exist in the category
 * list count; an assignment or a rule that points at a missing id is skipped.
 *
 * Precedence in this phase (D-09, D-11, UI-SPEC Q4): the concept rule of the
 * supplier RFC plus the normalized description, then the supplier's category,
 * then «Sin categoría». A rule with a null category is an explicit «Sin
 * categoría» and beats the supplier's category.
 */
import { normalizeDescription, ruleMapKey } from "./normalize";
import { SIN_CATEGORIA, type SettingsData } from "./types";

/** Where the category of a line came from: a concept rule, its supplier, or nothing. */
export type CategorySource = "regla" | "proveedor" | "ninguna";

export interface Resolver {
  /** Category id of one concept line of a supplier, or SIN_CATEGORIA. */
  resolve(rfc: string, descripcion: string): string;
  /** The same category plus the source it came from (for the selector of the line). */
  explain(rfc: string, descripcion: string): { category: string; source: CategorySource };
  /** Category id of a supplier, or SIN_CATEGORIA. */
  supplierCategory(rfc: string): string;
}

export function makeResolver(settings: SettingsData): Resolver {
  const existing = new Set<string>(settings.categories.map((category) => category.id));
  const bySupplier = new Map<string, string>();
  for (const assignment of settings.supplierCategories) {
    if (existing.has(assignment.categoryId)) bySupplier.set(assignment.rfc, assignment.categoryId);
  }
  // null is kept: an explicit «Sin categoría» must beat the supplier's category.
  const byRule = new Map<string, string | null>();
  for (const rule of settings.conceptRules) {
    if (rule.categoryId === null || existing.has(rule.categoryId)) {
      byRule.set(ruleMapKey(rule.rfc, rule.key), rule.categoryId);
    }
  }
  const supplierCategory = (rfc: string): string => bySupplier.get(rfc) ?? SIN_CATEGORIA;
  const explain = (
    rfc: string,
    descripcion: string,
  ): { category: string; source: CategorySource } => {
    const ruleKey = ruleMapKey(rfc, normalizeDescription(descripcion));
    if (byRule.has(ruleKey)) {
      return { category: byRule.get(ruleKey) ?? SIN_CATEGORIA, source: "regla" };
    }
    const supplier = bySupplier.get(rfc);
    if (supplier !== undefined) return { category: supplier, source: "proveedor" };
    return { category: SIN_CATEGORIA, source: "ninguna" };
  };
  return {
    resolve: (rfc, descripcion) => explain(rfc, descripcion).category,
    explain,
    supplierCategory,
  };
}
