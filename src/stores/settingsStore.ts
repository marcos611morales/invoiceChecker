import { create } from "zustand";
import type { IvaMode } from "@/domain/accounting/aggregate";

interface SettingsState {
  ivaMode: IvaMode;
  setIvaMode: (mode: IvaMode) => void;
}

// RED skeleton: no persistence yet.
export const useSettingsStore = create<SettingsState>()((set) => ({
  ivaMode: "con",
  setIvaMode: (ivaMode) => set({ ivaMode }),
}));
