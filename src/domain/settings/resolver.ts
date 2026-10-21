/**
 * Category of a supplier and of a concept line. Lookups are Maps built once, so
 * an RFC such as "__proto__" is plain data. Only ids that exist in the category
 * list count; an assignment, a rule or a product that points at a missing id is skipped.
 *
 * Precedence (CAT-04, D-09, D-11, D-16, UI-SPEC Q4), first match wins:
 *   1. the concept rule of the supplier RFC plus the normalized description. A rule with a
 *      null category is an explicit «Sin categoría» and beats everything below;
 *   2. the category of the accepted product the line is a member of (RFC plus normalized
 *      description). A product without category, or whose category no longer exists, adds
 *      no level;
 *   3. the supplier's category;
 *   4. «Sin categoría».
 */
import { normalizeDescription, ruleMapKey } from "./normalize";
import { SIN_CATEGORIA, type SettingsData } from "./types";

/** Where the category of a line came from: a concept rule, its product, its supplier, or nothing. */
export type CategorySource = "regla" | "producto" | "proveedor" | "ninguna";

export interface Resolver {
  /** Category id of one concept line of a supplier, or SIN_CATEGORIA. */
  resolve(rfc: string, descripcion: string): string;
  /**
   * The same category plus the source it came from (for the selector of the line and the
   * origin column of the Excel). `product` is set only when the source is "producto".
   */
  explain(
    rfc: string,
    descripcion: string,
  ): { category: string; source: CategorySource; product: { id: string; name: string } | null };
  /** Category id of a supplier, or SIN_CATEGORIA. */
  supplierCategory(rfc: string): string;
}

/** What a member of a product with a usable category resolves to. */
interface ProductLevel {
  id: string;
  name: string;
  categoryId: string;
}

export function makeResolver(settings: SettingsData): Resolver {
  const existing = new Set<string>(settings.categories.map((category) => category.id));
  const bySupplier = new Map<string, string>();
  for (const assignment of settings.supplierCategories) {
    if (existing.has(assignment.categoryId)) bySupplier.set(assignment.rfc, assignment.categoryId);
  }
  // null is kept: an explicit «Sin categoría» must beat the product and the supplier.
  const byRule = new Map<string, string | null>();
  for (const rule of settings.conceptRules) {
    if (rule.categoryId === null || existing.has(rule.categoryId)) {
      byRule.set(ruleMapKey(rule.rfc, rule.key), rule.categoryId);
    }
  }
  // A product adds a level only with a category that exists; members are unique across
  // products (D-10), so each key has at most one product.
  const byMember = new Map<string, ProductLevel>();
  for (const product of settings.products) {
    if (product.categoryId === null || !existing.has(product.categoryId)) continue;
    for (const member of product.members) {
      byMember.set(ruleMapKey(member.rfc, member.key), {
        id: product.id,
        name: product.name,
        categoryId: product.categoryId,
      });
    }
  }
  const supplierCategory = (rfc: string): string => bySupplier.get(rfc) ?? SIN_CATEGORIA;
  const explain = (
    rfc: string,
    descripcion: string,
  ): { category: string; source: CategorySource; product: { id: string; name: string } | null } => {
    const key = ruleMapKey(rfc, normalizeDescription(descripcion));
    if (byRule.has(key)) {
      return { category: byRule.get(key) ?? SIN_CATEGORIA, source: "regla", product: null };
    }
    const product = byMember.get(key);
    if (product !== undefined) {
      return {
        category: product.categoryId,
        source: "producto",
        product: { id: product.id, name: product.name },
      };
    }
    const supplier = bySupplier.get(rfc);
    if (supplier !== undefined) return { category: supplier, source: "proveedor", product: null };
    return { category: SIN_CATEGORIA, source: "ninguna", product: null };
  };
  return {
    resolve: (rfc, descripcion) => explain(rfc, descripcion).category,
    explain,
    supplierCategory,
  };
}
