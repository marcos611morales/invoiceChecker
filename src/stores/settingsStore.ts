import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { IvaMode } from "@/domain/accounting/aggregate";
import {
  removeConceptRule,
  removeSupplierAssignment,
  restoreConceptRule,
  restoreSupplierAssignment,
  setConceptRule,
  setSupplierCategory,
  type RuleResult,
  type SupplierResult,
} from "@/domain/settings/assignments";
import {
  addCategory,
  deleteCategory,
  renameCategory,
  restoreCategory,
  type DeleteSnapshot,
  type NameError,
} from "@/domain/settings/categories";
import { resolvePersisted } from "@/domain/settings/migrate";
import {
  acceptProduct,
  deleteProduct,
  moveProductMember,
  removeProductMember,
  renameProduct,
  restoreProduct,
  setProductCategory,
  undoMemberChange,
  type AcceptProductError,
  type MemberUndo,
  type ProductNameError,
  type ProductSnapshot,
} from "@/domain/settings/products";
import {
  SETTINGS_VERSION,
  defaultSettings,
  type Category,
  type ConceptRule,
  type Product,
  type ProductMember,
  type SettingsData,
  type SupplierAssignment,
} from "@/domain/settings/types";
import { createSafeStorage } from "./safeStorage";
import { useStorageStatusStore } from "./storageStatusStore";

/**
 * The only persisted store of the app (D-06). Invoices, exclusions, filters and
 * the active tab live in sessionStore and are never written anywhere (D-30,
 * CARGA-06). Contract (Phase 4): key `invoicechecker:settings`,
 * `{ state: { ivaMode, categories, supplierCategories, conceptRules, products,
 * ungroupedConcepts }, version: 3 }`.
 * The Phase 3 contract (version 2, the first four fields) is migrated on load keeping all of
 * it, with no products and no «No agrupar» marks (D-13).
 * The Phase 2 contract `{ state: { ivaMode }, version: 1 }` is migrated on load:
 * the user keeps the IVA mode and receives the nine suggested categories (D-25).
 * Nothing about invoices is ever stored: no amounts, UUIDs, folios, dates or receptor.
 */
const STORAGE_KEY = "invoicechecker:settings";

interface SettingsState extends SettingsData {
  setIvaMode: (mode: IvaMode) => void;
  /**
   * Sets (id) or removes (null) the default category of a supplier and keeps its name
   * next to the RFC. Only an ok result is applied, in one `set`, so persist writes once
   * and a refused result ("limit", "unknown-category") changes nothing.
   */
  setSupplierCategory: (rfc: string, name: string, categoryId: string | null) => SupplierResult;
  /**
   * Removes the saved category of one supplier and returns the removed assignment for
   * «Deshacer», or null when there was none (nothing is written then).
   */
  removeSupplierAssignment: (rfc: string) => SupplierAssignment | null;
  /**
   * Undo of `removeSupplierAssignment`: puts back the removed assignment. A refused restore
   * (the category no longer exists, the list is at its limit) changes and writes nothing.
   */
  restoreSupplierAssignment: (removed: SupplierAssignment) => void;
  /**
   * Adds a category with a fresh `cat_` id (CAT-01). A refused name (empty, reserved,
   * duplicate, too long) or the 200-category limit changes and writes nothing.
   */
  addCategory: (name: string) => { ok: true; category: Category } | { ok: false; reason: NameError };
  /** Renames keeping the id (D-04); a refused name changes and writes nothing. */
  renameCategory: (id: string, name: string) => { ok: true } | { ok: false; reason: NameError };
  /**
   * Deletes a category and moves its supplier assignments, concept rules and products to
   * `target` (an id) or to «Sin categoría» (null), in one `set` (CAT-05, D-05, D-13). Returns
   * the snapshot that `restoreCategory` needs, or null when nothing was deleted.
   */
  deleteCategory: (id: string, target: string | null) => DeleteSnapshot | null;
  /** Undo of `deleteCategory`: puts back the category, its assignments, its rules and its products' category. */
  restoreCategory: (snapshot: DeleteSnapshot) => void;
  /**
   * Stores the category of one concept description of one supplier (CAT-03, D-09):
   * a category id, or null for an explicit «Sin categoría». Only an ok result is applied,
   * in one `set`; a refused result ("limit", "unknown-category") changes nothing.
   */
  setConceptRule: (rfc: string, description: string, categoryId: string | null) => RuleResult;
  /**
   * Removes the rule of one concept (rfc plus normalized key) and returns the removed rule
   * for «Deshacer», or null when there was none (nothing is written then).
   */
  removeConceptRule: (rfc: string, key: string) => ConceptRule | null;
  /**
   * Undo of a rule change: puts back exactly `previous` (the rule before the change), or
   * removes the rule when there was none. A refused restore (the category no longer
   * exists, the list is at its limit) changes and writes nothing.
   */
  restoreConceptRule: (rfc: string, key: string, previous: ConceptRule | null) => void;
  /**
   * Accepts a suggestion as a product with a fresh `prod_` id and no category (LLM-04, D-06).
   * Only an ok result is applied, in one `set` of `products`; a refusal (reserved, repeated or
   * empty name, a member already taken, a limit) changes and writes nothing.
   */
  acceptProduct: (input: {
    name: string;
    members: readonly ProductMember[];
  }) => { ok: true; product: Product } | { ok: false; reason: AcceptProductError };
  /**
   * Renames a product keeping its id, category and members (D-14). A refused name (empty,
   * reserved, repeated, too long) changes and writes nothing, and so does an unchanged name.
   */
  renameProduct: (id: string, name: string) => { ok: true } | { ok: false; reason: ProductNameError };
  /**
   * Gives a product a category (an id) or none (null) (CAT-04, D-16). Only an ok result that
   * changes something is applied, in one `set` of `products`; an unknown category id, an unknown
   * product or an unchanged category writes nothing.
   */
  setProductCategory: (
    id: string,
    categoryId: string | null,
  ) => { ok: true } | { ok: false; reason: "unknown-category" };
  /**
   * Deletes a product; its descriptions are free again (D-14, D-15). Returns the snapshot
   * `restoreProduct` needs, or null when the id is unknown (nothing is written then).
   */
  deleteProduct: (id: string) => ProductSnapshot | null;
  /** Undo of `deleteProduct`. A refused restore (something it needs is taken again) writes nothing. */
  restoreProduct: (snapshot: ProductSnapshot) => void;
  /**
   * Takes one member (`key` is `ruleMapKey(rfc, key)`) out of a product (D-15); the only member
   * of a product deletes the product too. Returns what `undoMemberChange` needs, or null when
   * the product or the member is unknown.
   */
  removeProductMember: (productId: string, key: string) => MemberUndo | null;
  /**
   * Moves one member to the end of another product (D-15); the only member of the source
   * deletes the source too. Returns what `undoMemberChange` needs, or null for an unknown or
   * identical product or an unknown member.
   */
  moveProductMember: (fromId: string, key: string, toId: string) => MemberUndo | null;
  /** Undo of `removeProductMember` and `moveProductMember`. A refused undo writes nothing. */
  undoMemberChange: (undo: MemberUndo) => void;
  /**
   * Replaces all six stored fields with an already validated settings value, in one `set`
   * (AJUS-02, D-08), so persist writes once and a reader never sees a half-replaced state.
   */
  replaceAll: (data: SettingsData) => void;
}

/** The six stored fields of the current state, as the domain reducers take them. */
function dataOf(state: SettingsData): SettingsData {
  const {
    ivaMode,
    categories,
    supplierCategories,
    conceptRules,
    products,
    ungroupedConcepts,
  } = state;
  return { ivaMode, categories, supplierCategories, conceptRules, products, ungroupedConcepts };
}

/**
 * The shared never-throwing adapter (Pitfall 6), reporting to the settings' own status store
 * (Q8): the pending queue has its own adapter and its own status.
 */
const safeStorage = createSafeStorage(() => useStorageStatusStore.getState());

/**
 * Resolves a stored value into valid settings and reports an unusable one (Q8). Both
 * `migrate` and `merge` use it. It touches only the status store, never the persisted one.
 */
function resolveAndReport(raw: unknown, version: number | undefined): SettingsData {
  const { data, status } = resolvePersisted(raw, version);
  if (status === "unreadable") useStorageStatusStore.getState().markReadFailed();
  return data;
}

export const useSettingsStore = create<SettingsState>()(
  persist<SettingsState, [], [], unknown>(
    (set, get) => ({
      ...defaultSettings(),
      setIvaMode: (ivaMode) => set({ ivaMode }),
      setSupplierCategory: (rfc, name, categoryId) => {
        const result = setSupplierCategory(dataOf(get()), rfc, name, categoryId);
        if (result.ok) set({ supplierCategories: result.next.supplierCategories });
        return result;
      },
      removeSupplierAssignment: (rfc) => {
        const result = removeSupplierAssignment(dataOf(get()), rfc);
        if (result.removed !== null) set({ supplierCategories: result.next.supplierCategories });
        return result.removed;
      },
      restoreSupplierAssignment: (removed) => {
        const current = dataOf(get());
        const next = restoreSupplierAssignment(current, removed);
        // A refused restore comes back as the same object: nothing to write.
        if (next === current) return;
        set({ supplierCategories: next.supplierCategories });
      },
      addCategory: (name) => {
        const result = addCategory(dataOf(get()), name, `cat_${crypto.randomUUID()}`);
        if (!result.ok) return result;
        set({ categories: result.next.categories });
        return { ok: true, category: result.category };
      },
      renameCategory: (id, name) => {
        const current = dataOf(get());
        const result = renameCategory(current, id, name);
        if (!result.ok) return result;
        // An unknown id comes back as the same object: nothing to write.
        if (result.next !== current) set({ categories: result.next.categories });
        return { ok: true };
      },
      deleteCategory: (id, target) => {
        const result = deleteCategory(dataOf(get()), id, target);
        if (result === null) return null;
        set({
          categories: result.next.categories,
          supplierCategories: result.next.supplierCategories,
          conceptRules: result.next.conceptRules,
          products: result.next.products,
        });
        return result.snapshot;
      },
      restoreCategory: (snapshot) => {
        const current = dataOf(get());
        const next = restoreCategory(current, snapshot);
        // A refused restore comes back as the same object: nothing to write.
        if (next === current) return;
        set({
          categories: next.categories,
          supplierCategories: next.supplierCategories,
          conceptRules: next.conceptRules,
          products: next.products,
        });
      },
      setConceptRule: (rfc, description, categoryId) => {
        const result = setConceptRule(dataOf(get()), rfc, description, categoryId);
        if (result.ok) set({ conceptRules: result.next.conceptRules });
        return result;
      },
      removeConceptRule: (rfc, key) => {
        const result = removeConceptRule(dataOf(get()), rfc, key);
        if (result.previous !== null) set({ conceptRules: result.next.conceptRules });
        return result.previous;
      },
      restoreConceptRule: (rfc, key, previous) => {
        const current = dataOf(get());
        const next = restoreConceptRule(current, rfc, key, previous);
        // A refused or empty restore comes back as the same object: nothing to write.
        if (next === current) return;
        set({ conceptRules: next.conceptRules });
      },
      acceptProduct: (input) => {
        const result = acceptProduct(dataOf(get()), input, `prod_${crypto.randomUUID()}`);
        if (!result.ok) return result;
        set({ products: result.next.products });
        return { ok: true, product: result.product };
      },
      renameProduct: (id, name) => {
        const current = dataOf(get());
        const result = renameProduct(current, id, name);
        if (!result.ok) return result;
        // An unknown id or an unchanged name comes back as the same object: nothing to write.
        if (result.next !== current) set({ products: result.next.products });
        return { ok: true };
      },
      setProductCategory: (id, categoryId) => {
        const current = dataOf(get());
        const result = setProductCategory(current, id, categoryId);
        if (!result.ok) return result;
        // An unknown product or an unchanged category comes back as the same object: nothing to write.
        if (result.next !== current) set({ products: result.next.products });
        return { ok: true };
      },
      deleteProduct: (id) => {
        const result = deleteProduct(dataOf(get()), id);
        if (result === null) return null;
        set({ products: result.next.products });
        return result.snapshot;
      },
      restoreProduct: (snapshot) => {
        const current = dataOf(get());
        const next = restoreProduct(current, snapshot);
        // A refused restore comes back as the same object: nothing to write.
        if (next === current) return;
        set({ products: next.products });
      },
      removeProductMember: (productId, key) => {
        const result = removeProductMember(dataOf(get()), productId, key);
        if (result === null) return null;
        set({ products: result.next.products });
        return result.undo;
      },
      moveProductMember: (fromId, key, toId) => {
        const result = moveProductMember(dataOf(get()), fromId, key, toId);
        if (result === null) return null;
        set({ products: result.next.products });
        return result.undo;
      },
      undoMemberChange: (undo) => {
        const current = dataOf(get());
        const next = undoMemberChange(current, undo);
        // A refused undo comes back as the same object: nothing to write.
        if (next === current) return;
        set({ products: next.products });
      },
      replaceAll: (data) => {
        set({
          ivaMode: data.ivaMode,
          categories: data.categories,
          supplierCategories: data.supplierCategories,
          conceptRules: data.conceptRules,
          products: data.products,
          ungroupedConcepts: data.ungroupedConcepts,
        });
      },
    }),
    {
      name: STORAGE_KEY,
      version: SETTINGS_VERSION,
      // Rehydrated from an effect in the app shell, so server and first client render agree.
      skipHydration: true,
      storage: safeStorage,
      partialize: (state): SettingsData => ({
        ivaMode: state.ivaMode,
        categories: state.categories,
        supplierCategories: state.supplierCategories,
        conceptRules: state.conceptRules,
        products: state.products,
        ungroupedConcepts: state.ungroupedConcepts,
      }),
      // Both delegate to the total resolvePersisted: an exception here would be
      // swallowed by zustand and silently reset the store (Pitfall 5).
      migrate: (persisted, version) => resolveAndReport(persisted, version),
      // set(..., true) replaces the state, so merge returns the full state with the actions.
      merge: (persisted, current) => ({
        ...current,
        ...resolveAndReport(persisted, SETTINGS_VERSION),
      }),
    },
  ),
);
