/**
 * Category reducers and display order (CAT-01, CAT-05, D-02, D-04, D-05, D-30).
 *
 * Pure functions over SettingsData: they never mutate their input and they refuse any
 * change that would make the stored settings fail validation on the next load (a
 * reserved or repeated name, a repeated id, a list over its limit). Ids are generated
 * by the caller, never here, so the domain stays deterministic.
 */
import {
  LIMITS,
  OTROS_ID,
  SIN_CATEGORIA,
  type Category,
  type ConceptRule,
  type Product,
  type SettingsData,
  type SupplierAssignment,
} from "./types";

const COLLATOR = new Intl.Collator("es", { sensitivity: "base" });

/**
 * Display order of the categories (UI-SPEC, D-02): Spanish alphabetical order with
 * accents and case ignored, and the suggested «Otros» last. «Otros» is identified by
 * its stable seed id, never by its current name, so renaming it does not move it.
 * A new array; the input is not mutated.
 */
export function orderedCategories(categories: readonly Category[]): Category[] {
  const rest = categories
    .filter((category) => category.id !== OTROS_ID)
    .sort((a, b) => COLLATOR.compare(a.name, b.name));
  const otros = categories.filter((category) => category.id === OTROS_ID);
  return [...rest, ...otros];
}

export type NameError = "empty" | "duplicate" | "reserved" | "too-long" | "limit";

/**
 * Name comparison of D-04: edge spaces and case ignored, accents kept (research A10),
 * the same rule as the stored-settings schema.
 */
function comparableName(name: string): string {
  return name.trim().toLowerCase();
}

const RESERVED_NAME = comparableName("Sin categoría");

/**
 * Checks a typed name (D-04). Trims it first. `exceptId` is the category being renamed,
 * which is left out of the duplicate check so only its case can change.
 */
export function validateCategoryName(
  settings: SettingsData,
  raw: string,
  exceptId: string | null,
): { ok: true; name: string } | { ok: false; reason: NameError } {
  const name = raw.trim();
  if (name === "") return { ok: false, reason: "empty" };
  if (name.length > LIMITS.categoryName) return { ok: false, reason: "too-long" };
  const comparable = comparableName(name);
  if (comparable === RESERVED_NAME) return { ok: false, reason: "reserved" };
  const taken = settings.categories.some(
    (category) => category.id !== exceptId && comparableName(category.name) === comparable,
  );
  if (taken) return { ok: false, reason: "duplicate" };
  return { ok: true, name };
}

/**
 * Appends a category with the given id. Refused with the name error, with "limit" when
 * LIMITS.categories already exist, and with "duplicate" when the id is the reserved key
 * or is already a category id.
 */
export function addCategory(
  settings: SettingsData,
  raw: string,
  id: string,
): { ok: true; next: SettingsData; category: Category } | { ok: false; reason: NameError } {
  const checked = validateCategoryName(settings, raw, null);
  if (!checked.ok) return checked;
  if (id === SIN_CATEGORIA || settings.categories.some((category) => category.id === id)) {
    return { ok: false, reason: "duplicate" };
  }
  if (settings.categories.length >= LIMITS.categories) return { ok: false, reason: "limit" };
  const category: Category = { id, name: checked.name };
  return { ok: true, next: { ...settings, categories: [...settings.categories, category] }, category };
}

/**
 * Renames a category keeping its id and its position, so every assignment and rule
 * that points at the id keeps it. An unknown id is no change: `next` is the very same
 * settings object.
 */
export function renameCategory(
  settings: SettingsData,
  id: string,
  raw: string,
): { ok: true; next: SettingsData } | { ok: false; reason: NameError } {
  if (!settings.categories.some((category) => category.id === id)) {
    return { ok: true, next: settings };
  }
  const checked = validateCategoryName(settings, raw, id);
  if (!checked.ok) return checked;
  return {
    ok: true,
    next: {
      ...settings,
      categories: settings.categories.map((category) =>
        category.id === id ? { id: category.id, name: checked.name } : category,
      ),
    },
  };
}

/** What points at a category: supplier assignments, concept rules and products (D-13). */
export interface CategoryUsage {
  suppliers: number;
  concepts: number;
  products: number;
}

/** How many supplier assignments, concept rules and products point at the category (loaded or not). */
export function categoryUsage(settings: SettingsData, id: string): CategoryUsage {
  return {
    suppliers: settings.supplierCategories.filter((assignment) => assignment.categoryId === id)
      .length,
    concepts: settings.conceptRules.filter((rule) => rule.categoryId === id).length,
    products: settings.products.filter((product) => product.categoryId === id).length,
  };
}

/**
 * `categoryUsage` of every category in one pass (the list shows all rows at once).
 * Only ids that something points at have an entry; read a missing id as zero.
 */
export function usageByCategory(settings: SettingsData): Map<string, CategoryUsage> {
  const usage = new Map<string, CategoryUsage>();
  const entry = (id: string): CategoryUsage => {
    const found = usage.get(id) ?? { suppliers: 0, concepts: 0, products: 0 };
    usage.set(id, found);
    return found;
  };
  for (const assignment of settings.supplierCategories) entry(assignment.categoryId).suppliers += 1;
  for (const rule of settings.conceptRules) {
    if (rule.categoryId !== null) entry(rule.categoryId).concepts += 1;
  }
  for (const product of settings.products) {
    if (product.categoryId !== null) entry(product.categoryId).products += 1;
  }
  return usage;
}

/** A copy that shares nothing with the original, so a snapshot never aliases the settings. */
function copyProduct(product: Product): Product {
  return {
    id: product.id,
    name: product.name,
    categoryId: product.categoryId,
    members: product.members.map((member) => ({ ...member })),
  };
}

/** What a delete took away, enough to put it back exactly (D-05, undo). */
export interface DeleteSnapshot {
  category: Category;
  /** Position in the stored list. */
  index: number;
  /** Copies of the supplier assignments the category had, as they were. */
  suppliers: SupplierAssignment[];
  /** Copies of the concept rules the category had, as they were. */
  rules: ConceptRule[];
  /** Copies of the products that had the category, as they were (D-13). */
  products: Product[];
}

/**
 * Deletes a category and moves what pointed at it (D-05, Q4, D-13).
 * - `target` null is «Sin categoría»: its supplier assignments are removed, each of its
 *   concept rules becomes an explicit null rule, and its products lose their category.
 * - `target` an id moves the three to that category.
 * No stored product ever points at a deleted category: that would fail the stored-settings
 * validation on the next load and reset everything.
 * Returns null when the category does not exist, or the target is the category itself
 * or is not a category.
 */
export function deleteCategory(
  settings: SettingsData,
  id: string,
  target: string | null,
): { next: SettingsData; snapshot: DeleteSnapshot } | null {
  const index = settings.categories.findIndex((category) => category.id === id);
  const category = settings.categories[index];
  if (category === undefined) return null;
  if (target !== null && (target === id || !settings.categories.some((c) => c.id === target))) {
    return null;
  }
  const suppliers = settings.supplierCategories.filter((assignment) => assignment.categoryId === id);
  const rules = settings.conceptRules.filter((rule) => rule.categoryId === id);
  const products = settings.products.filter((product) => product.categoryId === id);
  const next: SettingsData = {
    ...settings,
    categories: settings.categories.filter((candidate) => candidate.id !== id),
    supplierCategories:
      target === null
        ? settings.supplierCategories.filter((assignment) => assignment.categoryId !== id)
        : settings.supplierCategories.map((assignment) =>
            assignment.categoryId === id ? { ...assignment, categoryId: target } : assignment,
          ),
    conceptRules: settings.conceptRules.map((rule) =>
      rule.categoryId === id ? { ...rule, categoryId: target } : rule,
    ),
    products: settings.products.map((product) =>
      product.categoryId === id ? { ...product, categoryId: target } : product,
    ),
  };
  return {
    next,
    snapshot: {
      category: { ...category },
      index,
      suppliers: suppliers.map((assignment) => ({ ...assignment })),
      rules: rules.map((rule) => ({ ...rule })),
      products: products.map(copyProduct),
    },
  };
}

/**
 * Puts a deleted category back at min(index, length) with its id, and sets each
 * snapshot assignment (by rfc) and rule (by rfc and key) back, replacing the current
 * one or re-adding it, and gives each snapshot product that still exists (by id) its category
 * back; a product deleted in the meantime stays deleted. Everything else stays. When the result would not pass the stored
 * validation (the id or the name is taken again, or a list would pass its limit) the
 * settings come back unchanged, the very same object.
 */
export function restoreCategory(settings: SettingsData, snapshot: DeleteSnapshot): SettingsData {
  const { category } = snapshot;
  const name = comparableName(category.name);
  const taken =
    category.id === SIN_CATEGORIA ||
    settings.categories.some(
      (candidate) => candidate.id === category.id || comparableName(candidate.name) === name,
    );
  if (taken || settings.categories.length >= LIMITS.categories) return settings;

  const position = Math.min(Math.max(snapshot.index, 0), settings.categories.length);
  const categories = [
    ...settings.categories.slice(0, position),
    { ...category },
    ...settings.categories.slice(position),
  ];

  const restoredSuppliers = new Map(snapshot.suppliers.map((a) => [a.rfc, a]));
  const supplierCategories = settings.supplierCategories.map((assignment) => {
    const back = restoredSuppliers.get(assignment.rfc);
    if (back === undefined) return assignment;
    restoredSuppliers.delete(assignment.rfc);
    return { ...back };
  });
  for (const back of restoredSuppliers.values()) supplierCategories.push({ ...back });

  const ruleId = (rule: ConceptRule): string => JSON.stringify([rule.rfc, rule.key]);
  const restoredRules = new Map(snapshot.rules.map((rule) => [ruleId(rule), rule]));
  const conceptRules = settings.conceptRules.map((rule) => {
    const back = restoredRules.get(ruleId(rule));
    if (back === undefined) return rule;
    restoredRules.delete(ruleId(rule));
    return { ...back };
  });
  for (const back of restoredRules.values()) conceptRules.push({ ...back });

  // Products deleted in the meantime stay deleted; the others get their category back by id.
  const restoredProducts = new Map(snapshot.products.map((product) => [product.id, product.categoryId]));
  const products = settings.products.map((product) =>
    restoredProducts.has(product.id)
      ? { ...product, categoryId: restoredProducts.get(product.id) ?? null }
      : product,
  );

  if (
    supplierCategories.length > LIMITS.supplierCategories ||
    conceptRules.length > LIMITS.conceptRules
  ) {
    return settings;
  }
  return { ...settings, categories, supplierCategories, conceptRules, products };
}
