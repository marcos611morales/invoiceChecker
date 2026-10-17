/**
 * Category of a supplier and of a concept line. Lookups are Maps built once, so
 * an RFC such as "__proto__" is plain data. Only ids that exist in the category
 * list count; an assignment to a missing id resolves to «Sin categoría».
 * Concept rules (Plan 03-04) will sit behind the same `resolve` signature.
 */
import { SIN_CATEGORIA, type SettingsData } from "./types";

export interface Resolver {
  /** Category id of one concept line of a supplier, or SIN_CATEGORIA. */
  resolve(rfc: string, descripcion: string): string;
  /** Category id of a supplier, or SIN_CATEGORIA. */
  supplierCategory(rfc: string): string;
}

export function makeResolver(settings: SettingsData): Resolver {
  const existing = new Set<string>(settings.categories.map((category) => category.id));
  const bySupplier = new Map<string, string>();
  for (const assignment of settings.supplierCategories) {
    if (existing.has(assignment.categoryId)) bySupplier.set(assignment.rfc, assignment.categoryId);
  }
  const supplierCategory = (rfc: string): string => bySupplier.get(rfc) ?? SIN_CATEGORIA;
  return {
    resolve: (rfc) => supplierCategory(rfc),
    supplierCategory,
  };
}
