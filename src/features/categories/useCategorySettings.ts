"use client";

import { useMemo } from "react";
import { makeResolver, type Resolver } from "@/domain/settings/resolver";
import { SIN_CATEGORIA, type Category, type SettingsData } from "@/domain/settings/types";
import { es } from "@/lib/copy/es";
import { useSettingsStore } from "@/stores/settingsStore";

/**
 * Name of a category key for display. The reserved «Sin categoría» key and any key
 * that is not a category (a stale id) both read «Sin categoría».
 */
export function makeNameOf(categories: readonly Category[]): (key: string) => string {
  const names = new Map<string, string>(categories.map((category) => [category.id, category.name]));
  return (key) => (key === SIN_CATEGORIA ? undefined : names.get(key)) ?? es.categories.none;
}

/**
 * The settings, the resolver and the category-name lookup, memoized on the eight
 * stored fields with separate primitive selectors. The Dashboard and the
 * Categorías tab both call it, so they read the same data and rebuild the maps
 * only when a stored field changes.
 */
export function useCategorySettings(): {
  settings: SettingsData;
  resolver: Resolver;
  nameOf: (key: string) => string;
} {
  const ivaMode = useSettingsStore((s) => s.ivaMode);
  const categories = useSettingsStore((s) => s.categories);
  const supplierCategories = useSettingsStore((s) => s.supplierCategories);
  const conceptRules = useSettingsStore((s) => s.conceptRules);
  const products = useSettingsStore((s) => s.products);
  const ungroupedConcepts = useSettingsStore((s) => s.ungroupedConcepts);
  const contentCorrections = useSettingsStore((s) => s.contentCorrections);
  const priceOverrides = useSettingsStore((s) => s.priceOverrides);
  const settings = useMemo<SettingsData>(
    () => ({
      ivaMode,
      categories,
      supplierCategories,
      conceptRules,
      products,
      ungroupedConcepts,
      contentCorrections,
      priceOverrides,
    }),
    [
      ivaMode,
      categories,
      supplierCategories,
      conceptRules,
      products,
      ungroupedConcepts,
      contentCorrections,
      priceOverrides,
    ],
  );
  const resolver = useMemo(() => makeResolver(settings), [settings]);
  const nameOf = useMemo(() => makeNameOf(categories), [categories]);
  return useMemo(() => ({ settings, resolver, nameOf }), [settings, resolver, nameOf]);
}
