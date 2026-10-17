import { create } from "zustand";
import { persist, type PersistStorage } from "zustand/middleware";
import { z } from "zod";
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
  SETTINGS_VERSION,
  defaultSettings,
  type Category,
  type ConceptRule,
  type SettingsData,
  type SupplierAssignment,
} from "@/domain/settings/types";
import { useStorageStatusStore } from "./storageStatusStore";

/**
 * The only persisted store of the app (D-06). Invoices, exclusions, filters and
 * the active tab live in sessionStore and are never written anywhere (D-30,
 * CARGA-06). Contract (Phase 3): key `invoicechecker:settings`,
 * `{ state: { ivaMode, categories, supplierCategories, conceptRules }, version: 2 }`.
 * The Phase 2 contract `{ state: { ivaMode }, version: 1 }` is migrated on load:
 * the user keeps the IVA mode and receives the nine suggested categories (D-25).
 * Nothing about invoices is ever stored: no amounts, UUIDs, folios, dates or receptor.
 */
const STORAGE_KEY = "invoicechecker:settings";

/**
 * Only the envelope is checked here; the state stays `unknown` and is validated
 * by `resolvePersisted` in `migrate` and `merge`. Validating the state against
 * the new schema here would turn a stored version 1 into "nothing stored" and
 * lose the IVA mode (Pitfall 4).
 */
const envelopeSchema = z.object({
  state: z.unknown(),
  version: z.number().optional(),
});

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
   * Deletes a category and moves its supplier assignments and concept rules to `target`
   * (an id) or to «Sin categoría» (null), in one `set` (CAT-05, D-05). Returns the snapshot
   * that `restoreCategory` needs, or null when nothing was deleted.
   */
  deleteCategory: (id: string, target: string | null) => DeleteSnapshot | null;
  /** Undo of `deleteCategory`: puts back the category, its assignments and its rules. */
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
   * Replaces all four stored fields with an already validated settings value, in one `set`
   * (AJUS-02, D-08), so persist writes once and a reader never sees a half-replaced state.
   */
  replaceAll: (data: SettingsData) => void;
}

/** The four stored fields of the current state, as the domain reducers take them. */
function dataOf(state: SettingsData): SettingsData {
  const { ivaMode, categories, supplierCategories, conceptRules } = state;
  return { ivaMode, categories, supplierCategories, conceptRules };
}

/**
 * Every storage access is inside try/catch: blocked storage, private mode,
 * quota and the server (no window) all become "nothing stored" or a no-op.
 * The adapter never calls `set` on the settings store (Pitfall 6): persist calls
 * `setItem` after every `set`, so setting state from here would loop. It only reports
 * failures to the separate, non-persisted `useStorageStatusStore` (Q8): a stored value
 * that exists but is not usable (`getItem`) and a write that fails (`setItem`). A
 * `getItem` that itself throws is not a read failure: nothing is known to be stored.
 */
const safeStorage: PersistStorage<unknown> = {
  getItem: (name) => {
    let raw: string | null;
    try {
      raw = window.localStorage.getItem(name);
    } catch {
      return null;
    }
    if (raw === null) return null;
    try {
      const parsed = envelopeSchema.safeParse(JSON.parse(raw));
      if (parsed.success) return parsed.data;
    } catch {
      // Not JSON: reported below like a wrong envelope.
    }
    useStorageStatusStore.getState().markReadFailed();
    return null;
  },
  setItem: (name, value) => {
    try {
      window.localStorage.setItem(name, JSON.stringify(value));
      useStorageStatusStore.getState().setWriteFailed(false);
    } catch {
      // Quota or blocked storage: the settings still work for this session.
      useStorageStatusStore.getState().setWriteFailed(true);
    }
  },
  removeItem: (name) => {
    try {
      window.localStorage.removeItem(name);
    } catch {
      // Blocked storage: nothing to remove.
    }
  },
};

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
        const { ivaMode, categories, supplierCategories, conceptRules } = get();
        const result = setSupplierCategory(
          { ivaMode, categories, supplierCategories, conceptRules },
          rfc,
          name,
          categoryId,
        );
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
      replaceAll: (data) => {
        set({
          ivaMode: data.ivaMode,
          categories: data.categories,
          supplierCategories: data.supplierCategories,
          conceptRules: data.conceptRules,
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
