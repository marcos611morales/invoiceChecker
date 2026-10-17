import { create } from "zustand";
import { persist, type PersistStorage } from "zustand/middleware";
import { z } from "zod";
import type { IvaMode } from "@/domain/accounting/aggregate";
import { setSupplierCategory, type SupplierResult } from "@/domain/settings/assignments";
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
  type SettingsData,
} from "@/domain/settings/types";

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
}

/** The four stored fields of the current state, as the domain reducers take them. */
function dataOf(state: SettingsData): SettingsData {
  const { ivaMode, categories, supplierCategories, conceptRules } = state;
  return { ivaMode, categories, supplierCategories, conceptRules };
}

/**
 * Every storage access is inside try/catch: blocked storage, private mode,
 * quota and the server (no window) all become "nothing stored" or a no-op.
 * The adapter never calls `set` (Pitfall 6): persist calls `setItem` after every
 * `set`, so setting state from here would loop.
 */
const safeStorage: PersistStorage<unknown> = {
  getItem: (name) => {
    try {
      const raw = window.localStorage.getItem(name);
      if (raw === null) return null;
      const parsed = envelopeSchema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      window.localStorage.setItem(name, JSON.stringify(value));
    } catch {
      // Quota or blocked storage: the settings still work for this session.
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
      migrate: (persisted, version) => resolvePersisted(persisted, version).data,
      // set(..., true) replaces the state, so merge returns the full state with the actions.
      merge: (persisted, current) => ({
        ...current,
        ...resolvePersisted(persisted, SETTINGS_VERSION).data,
      }),
    },
  ),
);
