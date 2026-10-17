/**
 * Settings data model (Phase 3, D-06). This is the stored shape under the key
 * `invoicechecker:settings` (version 2) and, later, inside the backup file.
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

export interface SettingsData {
  ivaMode: IvaMode;
  categories: Category[];
  supplierCategories: SupplierAssignment[];
  conceptRules: ConceptRule[];
}

/** Version of the stored contract (the Phase 2 contract was version 1). */
export const SETTINGS_VERSION = 2;

/** Limits applied when reading stored settings and backup files (D-30). */
export const LIMITS = {
  categories: 200,
  supplierCategories: 5000,
  conceptRules: 20000,
  categoryName: 60,
  backupBytes: 1048576,
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

/** Fresh settings: Con IVA, the nine suggestions, no assignments. New arrays on every call. */
export function defaultSettings(): SettingsData {
  return {
    ivaMode: "con",
    categories: SEED_CATEGORIES.map((category) => ({ ...category })),
    supplierCategories: [],
    conceptRules: [],
  };
}
