import { create } from "zustand";
import type { ParseResult } from "@/domain/cfdi/types";

export interface ParsedFile {
  name: string;
  result: ParseResult;
}

export interface IgnoredFile {
  name: string;
}

interface SessionState {
  parsed: ParsedFile[];
  ignored: IgnoredFile[];
  addBatch: (parsed: ParsedFile[], ignored: IgnoredFile[]) => void;
}

// In-memory only: no middleware, nothing is written to browser storage (CARGA-06).
export const useSessionStore = create<SessionState>()((set) => ({
  parsed: [],
  ignored: [],
  addBatch: (parsed, ignored) =>
    set((state) => ({
      parsed: [...state.parsed, ...parsed],
      ignored: [...state.ignored, ...ignored],
    })),
}));
