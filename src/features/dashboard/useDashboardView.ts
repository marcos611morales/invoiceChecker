"use client";

import { useMemo } from "react";
import type { IvaMode } from "@/domain/accounting/aggregate";
import type { LedgerEntry } from "@/domain/accounting/ledger";
import type { Filters } from "@/domain/accounting/filters";
import { selectView, type DashboardView } from "@/domain/accounting/view";
import type { Resolver } from "@/domain/settings/resolver";
import type { SettingsData } from "@/domain/settings/types";
import { useCategorySettings } from "@/features/categories/useCategorySettings";
import { useSessionStore } from "@/stores/sessionStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useLedger } from "./useLedger";

export interface DashboardViewState {
  ledger: LedgerEntry[];
  filters: Filters;
  settings: SettingsData;
  resolver: Resolver;
  nameOf: (key: string) => string;
  mode: IvaMode;
  view: DashboardView;
}

/**
 * The one hook that turns the session, the settings and the filters into the figures of the
 * Dashboard (FILT-05). The Dashboard and the Excel export button both call it, so what the
 * user sees and what the export writes come from the same `selectView` result and cannot
 * disagree. Everything is memoized on its inputs: a filter change recomputes only the view.
 */
export function useDashboardView(): DashboardViewState {
  const ledger = useLedger();
  const filters = useSessionStore((s) => s.filters);
  const { settings, resolver, nameOf } = useCategorySettings();
  const mode = useSettingsStore((s) => s.ivaMode);
  const knownCategories = useMemo<ReadonlySet<string>>(
    () => new Set(settings.categories.map((category) => category.id)),
    [settings.categories],
  );
  const view = useMemo(
    () => selectView({ ledger, filters, resolver, mode, nameOf, knownCategories }),
    [ledger, filters, resolver, mode, nameOf, knownCategories],
  );
  return { ledger, filters, settings, resolver, nameOf, mode, view };
}
