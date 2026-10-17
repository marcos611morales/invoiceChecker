/**
 * Resolution of any stored value into valid settings. Total: it uses `safeParse`
 * only and never throws, because zustand swallows an exception from `migrate` or
 * `merge` and would silently reset the store (Pitfall 5). A valid stored state is
 * returned as it is, including one with zero categories: the suggestions are
 * never re-seeded over it (Pitfall 7).
 */
import { legacySettingsSchema, settingsDataSchema } from "./schema";
import { defaultSettings, type SettingsData } from "./types";

/**
 * absent: nothing stored; ok: a valid stored value; migrated: the Phase 2
 * contract was upgraded; unreadable: a stored value that could not be used.
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
  const parsed = settingsDataSchema.safeParse(raw);
  if (!parsed.success) return { data: defaultSettings(), status: "unreadable" };
  return { data: parsed.data, status: "ok" };
}
