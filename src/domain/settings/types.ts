/**
 * Settings data model (Phase 3, D-06). This is the stored shape under the key
 * `invoicechecker:settings` (version 3, Phase 4: products and «No agrupar» marks) and,
 * later, inside the backup file.
 * Lists of entries, never records keyed by RFC or description: those texts come
 * from XML and a key such as "__proto__" must stay plain data (Pitfall 8).
 * Lookups are built as Maps in memory by the resolver.
 */
import type { IvaMode } from "../accounting/aggregate";

/**
 * Reserved key of the implicit «Sin categoría» value in filters and parts.
 * It is never a category id and never a category name the user can store.
 */
export const SIN_CATEGORIA = "sin-categoria";

export interface Category {
  /** Stable internal id; assignments point here, never at the name (D-04). */
  id: string;
  name: string;
}

/** Default category of a supplier, kept with the readable name (D-03). */
export interface SupplierAssignment {
  rfc: string;
  name: string;
  categoryId: string;
}

/**
 * Category of one concept description of one supplier (D-09). `key` is the
 * normalized description, `description` the original readable text.
 * `categoryId: null` is an explicit «Sin categoría» (UI-SPEC Q4).
 */
export interface ConceptRule {
  rfc: string;
  key: string;
  description: string;
  categoryId: string | null;
}

/**
 * One concept of one supplier that belongs to a product (Phase 4, D-09). `rfc` plus `key`
 * (the normalized description, as in `ConceptRule`) identify it; the readable description
 * and the supplier name are kept so the Productos tab can show where each member comes from.
 * A member belongs to at most one product (D-10).
 */
export interface ProductMember {
  rfc: string;
  key: string;
  description: string;
  supplierName: string;
}

/**
 * An accepted product (D-12): a stable internal id, a readable name that is unique ignoring
 * case and edge spaces, an optional category (`null` adds no level, D-16) and its members.
 */
export interface Product {
  id: string;
  name: string;
  categoryId: string | null;
  members: ProductMember[];
}

/**
 * A description marked «No agrupar esta descripción» (D-22): never sent to DeepSeek again.
 * Same identity and readable fields as a member, and never also a member of a product.
 */
export interface UngroupedConcept {
  rfc: string;
  key: string;
  description: string;
  supplierName: string;
}

/**
 * The frozen Phase 3 shape (stored version 2 and settings file version 1). Never add a field
 * here: it is what those two published contracts mean.
 */
export interface SettingsDataV2 {
  ivaMode: IvaMode;
  categories: Category[];
  supplierCategories: SupplierAssignment[];
  conceptRules: ConceptRule[];
}

/** The current settings (stored version 3, Phase 4, D-13). */
export interface SettingsData extends SettingsDataV2 {
  products: Product[];
  ungroupedConcepts: UngroupedConcept[];
}

/** Version of the stored contract (the Phase 2 contract was version 1, Phase 3 was 2). */
export const SETTINGS_VERSION = 3;

/**
 * Limits applied when reading stored settings and backup files (D-30, Phase 4 D-13).
 * `productMembers` counts the members of all products together; `productName` is the same
 * 60 characters as a category name. `backupBytes` is the largest settings file the app reads,
 * in bytes (4 MB, D-31: raised from 1 MB so every file the app writes at the product limits
 * can be uploaded again).
 */
export const LIMITS = {
  categories: 200,
  supplierCategories: 5000,
  conceptRules: 20000,
  categoryName: 60,
  products: 2000,
  productMembers: 5000,
  ungroupedConcepts: 5000,
  productName: 60,
  backupBytes: 4194304,
} as const;

/** The nine suggested categories of D-02, in D-02 order, with stable ids. */
export const SEED_CATEGORIES: readonly Category[] = [
  { id: "seed:insumos-cafeteria", name: "Insumos de cafetería" },
  { id: "seed:abarrotes-despensa", name: "Abarrotes y despensa" },
  { id: "seed:limpieza-higiene", name: "Limpieza e higiene" },
  { id: "seed:servicios", name: "Servicios (luz, agua, internet, teléfono)" },
  { id: "seed:software-suscripciones", name: "Software y suscripciones" },
  { id: "seed:comisiones-bancarias", name: "Comisiones bancarias" },
  { id: "seed:mantenimiento-reparaciones", name: "Mantenimiento y reparaciones" },
  { id: "seed:papeleria-oficina", name: "Papelería y oficina" },
  { id: "seed:otros", name: "Otros" },
];

/** Id of «Otros», which the UI sorts last (UI-SPEC). */
export const OTROS_ID = "seed:otros";

/** Fresh settings: Con IVA, the nine suggestions, no assignments, no products. New arrays on every call. */
export function defaultSettings(): SettingsData {
  return {
    ivaMode: "con",
    categories: SEED_CATEGORIES.map((category) => ({ ...category })),
    supplierCategories: [],
    conceptRules: [],
    products: [],
    ungroupedConcepts: [],
  };
}
