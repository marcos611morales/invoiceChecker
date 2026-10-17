import { create } from "zustand";
import { persist, type PersistStorage } from "zustand/middleware";
import { z } from "zod";
import type { IvaMode } from "@/domain/accounting/aggregate";
import { resolvePersisted } from "@/domain/settings/migrate";
import { SETTINGS_VERSION, defaultSettings, type SettingsData } from "@/domain/settings/types";

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
    (set) => ({
      ...defaultSettings(),
      setIvaMode: (ivaMode) => set({ ivaMode }),
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
