import { create } from "zustand";
import {
  EMPTY_FILTERS,
  type DateRange,
  type Filters,
} from "@/domain/accounting/filters";
import { effectiveSelection } from "@/domain/accounting/view";
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

export type AppTab = "dashboard" | "categorias" | "calidad" | "importacion";

/** One-shot "focus this invoice" request; the nonce makes a repeated request for the same uuid observable. */
export interface FocusRequest {
  uuid: string;
  nonce: number;
}

export type ImportFocus = "duplicados" | "rechazados";

/**
 * How "Volver a incluir" treats a TipoRelacion-04 substitution. `overrideSubstitution`
 * is true only when the entry has a loaded substitute at click time (WR-01).
 */
export interface ReincludeOptions {
  overrideSubstitution: boolean;
}

/**
 * What an exclusion replaced for one invoice, so its undo can return exactly that
 * uuid to its previous state: `wasRestored` is true when the invoice had a
 * TipoRelacion-04 substitution override that the exclusion took away (WR-01).
 */
export interface ExclusionUndo {
  uuid: string;
  wasRestored: boolean;
}

interface SessionState extends ImportState {
  /** Bumped by clearAll so async work started before a clear cannot write after it (Pitfall 12). */
  generation: number;
  progress: ImportProgress;
  lastSummary: BatchSummary | null;
  filters: Filters;
  /** Invoices the user excluded by hand (REGLA-08). Replaced, never mutated. */
  excluded: ReadonlySet<string>;
  /**
   * Invoices whose TipoRelacion-04 substitution the user overrode (D-28, D-42, WR-01).
   * A plain re-include or undo of a manual exclusion never lands here. Replaced, never mutated.
   */
  restored: ReadonlySet<string>;
  activeTab: AppTab;
  focusRequest: FocusRequest | null;
  /**
   * Counter of «show me these invoices» requests from a category or supplier row (D-18). The
   * Facturas table scrolls into view and takes focus whenever it grows; 0 means none yet.
   */
  revealRequest: number;
  importFocus: ImportFocus | null;
  /** Returns null and changes nothing when `generation` is stale. */
  applyBatch: (
    batch: readonly BatchEntry[],
    generation: number,
  ) => BatchSummary | null;
  setProgress: (progress: ImportProgress) => void;
  setRange: (range: DateRange | null) => void;
  setSuppliers: (next: ReadonlySet<string>) => void;
  setFormas: (next: ReadonlySet<string>) => void;
  /** Category ids plus the reserved SIN_CATEGORIA key; in memory only, like every filter (D-15). */
  setCategories: (next: ReadonlySet<string>) => void;
  /** Takes a deleted category out of the category filter; changes nothing when the id is not selected (T-03-38). */
  dropCategoryFromFilter: (id: string) => void;
  /**
   * Keeps in the category filter only SIN_CATEGORIA and the ids in `known` (effectiveSelection). Called
   * after the settings are replaced so no category id from the old settings stays selected (WR-01);
   * changes nothing, with no set call, when no id is dropped.
   */
  pruneCategoryFilter: (known: ReadonlySet<string>) => void;
  /**
   * Adds the category to the category filter (a set: one already selected stays as it is), clears any
   * pending focus request and bumps `revealRequest` so the Facturas table comes into view (D-18).
   */
  revealCategory: (key: string) => void;
  /** Same as `revealCategory` for the supplier filter, keyed by RFC (D-18). */
  revealSupplier: (rfc: string) => void;
  /** Keeps a pending focus request so "Quitar filtros" can still reveal the row. */
  clearFilters: () => void;
  /** Returns the token that `undoExclusion` needs to put this uuid back exactly as it was. */
  excludeInvoice: (uuid: string) => ExclusionUndo;
  /** "Deshacer exclusión": touches only the token's uuid and never reads the ledger (D-29, WR-01). */
  undoExclusion: (undo: ExclusionUndo) => void;
  /** The caller decides from the entry it rendered; the store never reads the ledger (D-28, D-42, WR-01). */
  reincludeInvoice: (uuid: string, options: ReincludeOptions) => void;
  setActiveTab: (tab: AppTab) => void;
  requestFocus: (uuid: string) => void;
  clearFocusRequest: () => void;
  requestImportFocus: (kind: ImportFocus) => void;
  clearImportFocus: () => void;
  clearAll: () => void;
}

/** Module-level counter: every focus request gets a bigger nonce. */
let focusNonce = 0;

function withoutUuid(set: ReadonlySet<string>, uuid: string): ReadonlySet<string> {
  const next = new Set(set);
  next.delete(uuid);
  return next;
}

function withUuid(set: ReadonlySet<string>, uuid: string): ReadonlySet<string> {
  const next = new Set(set);
  next.add(uuid);
  return next;
}

// In-memory only: no middleware, nothing is written to browser storage (CARGA-06, D-30).
export const useSessionStore = create<SessionState>()((set, get) => ({
  ...emptyImportState(),
  generation: 0,
  progress: { phase: "idle" },
  lastSummary: null,
  filters: EMPTY_FILTERS,
  excluded: new Set<string>(),
  restored: new Set<string>(),
  activeTab: "dashboard",
  focusRequest: null,
  revealRequest: 0,
  importFocus: null,
  applyBatch: (batch, generation) => {
    const current = get();
    if (generation !== current.generation) return null;
    const { state, summary } = applyBatch(current, batch);
    // A batch that adds invoices goes back to the full loaded span (D-12, UI-SPEC decision 11).
    const filters =
      summary.added > 0 ? { ...current.filters, range: null } : current.filters;
    set({ ...state, lastSummary: summary, filters });
    return summary;
  },
  setProgress: (progress) => set({ progress }),
  setRange: (range) =>
    set((current) => ({
      filters: { ...current.filters, range },
      focusRequest: null,
    })),
  setSuppliers: (suppliers) =>
    set((current) => ({
      filters: { ...current.filters, suppliers },
      focusRequest: null,
    })),
  setFormas: (formas) =>
    set((current) => ({
      filters: { ...current.filters, formas },
      focusRequest: null,
    })),
  setCategories: (categories) =>
    set((current) => ({
      filters: { ...current.filters, categories },
      focusRequest: null,
    })),
  dropCategoryFromFilter: (id) => {
    const { filters } = get();
    if (!filters.categories.has(id)) return;
    set({ filters: { ...filters, categories: withoutUuid(filters.categories, id) } });
  },
  pruneCategoryFilter: (known) => {
    const { filters } = get();
    const effective = effectiveSelection(filters.categories, known);
    if (effective.size === filters.categories.size) return;
    set({ filters: { ...filters, categories: effective } });
  },
  revealCategory: (key) =>
    set((current) => ({
      filters: current.filters.categories.has(key)
        ? current.filters
        : { ...current.filters, categories: withUuid(current.filters.categories, key) },
      focusRequest: null,
      revealRequest: current.revealRequest + 1,
    })),
  revealSupplier: (rfc) =>
    set((current) => ({
      filters: current.filters.suppliers.has(rfc)
        ? current.filters
        : { ...current.filters, suppliers: withUuid(current.filters.suppliers, rfc) },
      focusRequest: null,
      revealRequest: current.revealRequest + 1,
    })),
  clearFilters: () => set({ filters: EMPTY_FILTERS }),
  excludeInvoice: (uuid) => {
    const wasRestored = get().restored.has(uuid);
    set((current) => ({
      excluded: withUuid(current.excluded, uuid),
      restored: withoutUuid(current.restored, uuid),
    }));
    return { uuid, wasRestored };
  },
  undoExclusion: ({ uuid, wasRestored }) =>
    set((current) => ({
      excluded: withoutUuid(current.excluded, uuid),
      restored: wasRestored ? withUuid(current.restored, uuid) : current.restored,
    })),
  reincludeInvoice: (uuid, { overrideSubstitution }) =>
    set((current) => ({
      excluded: withoutUuid(current.excluded, uuid),
      restored: overrideSubstitution ? withUuid(current.restored, uuid) : current.restored,
    })),
  setActiveTab: (activeTab) => set({ activeTab }),
  requestFocus: (uuid) => {
    focusNonce += 1;
    set({ focusRequest: { uuid, nonce: focusNonce }, activeTab: "dashboard" });
  },
  clearFocusRequest: () => set({ focusRequest: null }),
  requestImportFocus: (importFocus) =>
    set({ importFocus, activeTab: "importacion" }),
  clearImportFocus: () => set({ importFocus: null }),
  clearAll: () =>
    set((current) => ({
      ...emptyImportState(),
      progress: { phase: "idle" },
      lastSummary: null,
      filters: EMPTY_FILTERS,
      excluded: new Set<string>(),
      restored: new Set<string>(),
      activeTab: "dashboard",
      focusRequest: null,
      revealRequest: 0,
      importFocus: null,
      generation: current.generation + 1,
    })),
}));
