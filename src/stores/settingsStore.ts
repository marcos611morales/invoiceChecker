import { create } from "zustand";
import { persist, type PersistStorage } from "zustand/middleware";
import { z } from "zod";
import type { IvaMode } from "@/domain/accounting/aggregate";

/**
 * The only persisted store of the app (D-06). Invoices, exclusions, filters and
 * the active tab live in sessionStore and are never written anywhere (D-30,
 * CARGA-06). Contract for Phase 3: key `invoicechecker:settings`,
 * `{ state: { ivaMode }, version: 1 }`.
 */
const STORAGE_KEY = "invoicechecker:settings";

const ivaModeSchema = z.enum(["con", "sin"]);

const persistedSchema = z.object({ ivaMode: ivaModeSchema });
type Persisted = z.infer<typeof persistedSchema>;

const envelopeSchema = z.object({
  state: persistedSchema,
  version: z.number().optional(),
});

interface SettingsState {
  ivaMode: IvaMode;
  setIvaMode: (mode: IvaMode) => void;
}

/**
 * Every storage access is inside try/catch: blocked storage, private mode,
 * quota and the server (no window) all become "nothing stored" or a no-op.
 * getItem validates the whole envelope, so no type assertion is needed.
 */
const safeStorage: PersistStorage<Persisted> = {
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
      // Quota or blocked storage: the mode still works for this session.
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
  persist(
    (set) => ({
      ivaMode: "con",
      setIvaMode: (ivaMode) => set({ ivaMode }),
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      // Rehydrated from an effect in the app shell, so server and first client render agree.
      skipHydration: true,
      storage: safeStorage,
      partialize: (state): Persisted => ({ ivaMode: state.ivaMode }),
      merge: (persisted, current) => {
        const parsed = persistedSchema.safeParse(persisted);
        return {
          ...current,
          ivaMode: parsed.success ? parsed.data.ivaMode : "con",
        };
      },
    },
  ),
);
