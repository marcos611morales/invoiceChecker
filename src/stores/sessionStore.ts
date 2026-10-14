import { create } from "zustand";
import { applyBatch, emptyImportState } from "@/domain/import/applyBatch";
import type {
  BatchEntry,
  BatchSummary,
  ImportState,
} from "@/domain/import/types";

export type ImportProgress =
  | { phase: "idle" }
  | { phase: "listing" }
  | { phase: "parsing"; done: number; total: number };

interface SessionState extends ImportState {
  /** Bumped by clearAll so async work started before a clear cannot write after it (Pitfall 12). */
  generation: number;
  progress: ImportProgress;
  lastSummary: BatchSummary | null;
  /** Returns null and changes nothing when `generation` is stale. */
  applyBatch: (
    batch: readonly BatchEntry[],
    generation: number,
  ) => BatchSummary | null;
  setProgress: (progress: ImportProgress) => void;
  clearAll: () => void;
}

// In-memory only: no middleware, nothing is written to browser storage (CARGA-06).
export const useSessionStore = create<SessionState>()((set, get) => ({
  ...emptyImportState(),
  generation: 0,
  progress: { phase: "idle" },
  lastSummary: null,
  applyBatch: (batch, generation) => {
    const current = get();
    if (generation !== current.generation) return null;
    const { state, summary } = applyBatch(current, batch);
    set({ ...state, lastSummary: summary });
    return summary;
  },
  setProgress: (progress) => set({ progress }),
  clearAll: () =>
    set((current) => ({
      ...emptyImportState(),
      progress: { phase: "idle" },
      lastSummary: null,
      generation: current.generation + 1,
    })),
}));
