/**
 * Resolution of any stored value into valid settings. Total: it uses `safeParse`
 * only and never throws, because zustand swallows an exception from `migrate` or
 * `merge` and would silently reset the store (Pitfall 5). A valid stored state is
 * returned as it is, including one with zero categories: the suggestions are
 * never re-seeded over it (Pitfall 7).
 */
import {
  legacySettingsSchema,
  pruneDanglingOverrides,
  settingsDataSchema,
  settingsDataSchemaV2,
  settingsDataSchemaV3,
} from "./schema";
import { defaultSettings, type SettingsData } from "./types";

/**
 * absent: nothing stored; ok: a valid stored value; migrated: an older contract
 * (version 1, 2 or 3) was upgraded; unreadable: a stored value that could not be used.
 */
export type PersistStatus = "absent" | "ok" | "migrated" | "unreadable";

export function resolvePersisted(
  raw: unknown,
  version: number | undefined,
): { data: SettingsData; status: PersistStatus } {
  if (raw === undefined) return { data: defaultSettings(), status: "absent" };
  if (version === 1) {
    // Phase 2 contract (D-25): keep the IVA mode, give the user the suggestions.
    const legacy = legacySettingsSchema.safeParse(raw);
    if (!legacy.success) return { data: defaultSettings(), status: "unreadable" };
    return { data: { ...defaultSettings(), ivaMode: legacy.data.ivaMode }, status: "migrated" };
  }
  if (version === 2) {
    // Phase 3 contract (D-13): keep every category, assignment, rule and the IVA mode; the
    // products, the «No agrupar» marks, the content corrections and the «no comparable» marks
    // start empty. safeParse only, so it stays total (Pitfall 5).
    const previous = settingsDataSchemaV2.safeParse(raw);
    if (!previous.success) return { data: defaultSettings(), status: "unreadable" };
    return {
      data: {
        ...previous.data,
        products: [],
        ungroupedConcepts: [],
        contentCorrections: [],
        priceOverrides: [],
      },
      status: "migrated",
    };
  }
  if (version === 3) {
    // Phase 4 contract (D-15, D-19): keep everything the user saved; the content corrections and
    // the «no comparable» marks start empty. safeParse only, so it stays total (Pitfall 5).
    const previous = settingsDataSchemaV3.safeParse(raw);
    if (!previous.success) return { data: defaultSettings(), status: "unreadable" };
    return {
      data: { ...previous.data, contentCorrections: [], priceOverrides: [] },
      status: "migrated",
    };
  }
  const parsed = settingsDataSchema.safeParse(raw);
  if (!parsed.success) return { data: defaultSettings(), status: "unreadable" };
  // An override of a product that no longer exists is dropped, never a reason to refuse the value.
  return { data: pruneDanglingOverrides(parsed.data), status: "ok" };
}
