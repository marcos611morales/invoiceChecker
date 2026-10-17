/**
 * Settings file contract, version 1 (Phase 3, D-07, D-08, D-30).
 *
 * THIS FILE DEFINES A PUBLISHED CONTRACT. A downloaded settings file lives on the user's disk
 * for as long as they keep it, so every later build must keep reading version 1. When the
 * format grows (Phase 4 adds grouped products), add `BackupFile2` and `fromBackupFile2` next
 * to the version-1 pieces below and branch on the file version in `parseBackupText`; never
 * edit `backupFile1Schema` or `fromBackupFile1`. The golden file in
 * `tests/fixtures/settings/ajustes-archivo-1.json` must keep loading.
 *
 * The file version is independent of the store version (`SETTINGS_VERSION`), and the
 * version-1 schema is declared here, separately from `settingsDataSchema`, so a change to the
 * stored shape cannot silently change what an old file means. The only thing shared is the
 * pure integrity check.
 *
 * The file holds the four settings fields and nothing about invoices: no amounts, UUIDs,
 * folios, dates or receptor (T-03-18).
 */
import { z } from "zod";
import { settingsIntegrityIssues } from "./schema";
import { LIMITS, type SettingsData } from "./types";

export const BACKUP_APP = "invoicechecker-settings";
/** Highest file version this build can read and the one it writes. */
export const BACKUP_FILE_VERSION = 1;

/** Why a file was refused; each maps to one sentence in the UI (D-08). */
export type BackupFailure = "not-invoicechecker" | "damaged" | "newer" | "too-large";

export interface BackupSummary {
  categories: number;
  suppliers: number;
  concepts: number;
}

/** Size gate, checked on `file.size` before the file is read into memory (D-30, T-03-16). */
export function checkBackupSize(bytes: number): BackupFailure | null {
  return bytes > LIMITS.backupBytes ? "too-large" : null;
}

/** The file as written by this build: only the fields of the contract, two-space indented. */
export function buildBackupText(settings: SettingsData): string {
  const file = {
    app: BACKUP_APP,
    version: BACKUP_FILE_VERSION,
    settings: {
      ivaMode: settings.ivaMode,
      categories: settings.categories.map(({ id, name }) => ({ id, name })),
      supplierCategories: settings.supplierCategories.map(({ rfc, name, categoryId }) => ({
        rfc,
        name,
        categoryId,
      })),
      conceptRules: settings.conceptRules.map(({ rfc, key, description, categoryId }) => ({
        rfc,
        key,
        description,
        categoryId,
      })),
    },
  };
  return JSON.stringify(file, null, 2);
}

/** `invoicechecker-ajustes-AAAA-MM-DD.json` from the (local) date parts (D-07). */
export function backupFileName(date: { year: number; month: number; day: number }): string {
  const month = String(date.month).padStart(2, "0");
  const day = String(date.day).padStart(2, "0");
  return `invoicechecker-ajustes-${String(date.year)}-${month}-${day}.json`;
}

/** Only what every version shares, so a newer file is recognized before its body is read. */
const headerSchema = z.object({
  app: z.literal(BACKUP_APP),
  version: z.number().int().min(1),
});

// Version 1 of the file. Unknown keys are stripped (zod default), which keeps a version-1 file
// readable if a later build writes extra, ignorable keys. No bound on rfc, supplier name, key
// or description: they come from XML and a bound could make a valid file unreadable.
const backupFile1Schema = z.object({
  settings: z
    .object({
      ivaMode: z.enum(["con", "sin"]),
      categories: z
        .array(
          z.object({
            id: z.string().min(1),
            name: z.string().trim().min(1).max(LIMITS.categoryName),
          }),
        )
        .max(LIMITS.categories),
      supplierCategories: z
        .array(z.object({ rfc: z.string(), name: z.string(), categoryId: z.string() }))
        .max(LIMITS.supplierCategories),
      conceptRules: z
        .array(
          z.object({
            rfc: z.string(),
            key: z.string(),
            description: z.string(),
            categoryId: z.string().nullable(),
          }),
        )
        .max(LIMITS.conceptRules),
    })
    .superRefine((settings, ctx) => {
      for (const issue of settingsIntegrityIssues(settings)) {
        ctx.addIssue({ code: "custom", message: issue.message, path: issue.path });
      }
    }),
});

export type BackupFile1 = z.infer<typeof backupFile1Schema>;

/** Converter from the version-1 file to the app's settings. Later versions add their own. */
export function fromBackupFile1(file: BackupFile1): SettingsData {
  const { ivaMode, categories, supplierCategories, conceptRules } = file.settings;
  return {
    ivaMode,
    categories: categories.map(({ id, name }) => ({ id, name })),
    supplierCategories: supplierCategories.map(({ rfc, name, categoryId }) => ({
      rfc,
      name,
      categoryId,
    })),
    conceptRules: conceptRules.map(({ rfc, key, description, categoryId }) => ({
      rfc,
      key,
      description,
      categoryId,
    })),
  };
}

/**
 * Reads a settings file text. Never throws and applies nothing: the caller decides what to do
 * with a valid result. Order: JSON (a failure is «damaged» when the text carries the app
 * marker and «not-invoicechecker» otherwise), then the header («not-invoicechecker»), then the
 * version («newer», before the body is read because an unknown version has no schema), then the
 * full version-1 schema with the D-30 limits and the integrity rules («damaged»).
 */
export function parseBackupText(
  text: string,
): { ok: true; settings: SettingsData; summary: BackupSummary } | { ok: false; reason: BackupFailure } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: text.includes(BACKUP_APP) ? "damaged" : "not-invoicechecker" };
  }
  const header = headerSchema.safeParse(raw);
  if (!header.success) return { ok: false, reason: "not-invoicechecker" };
  if (header.data.version > BACKUP_FILE_VERSION) return { ok: false, reason: "newer" };
  const file = backupFile1Schema.safeParse(raw);
  if (!file.success) return { ok: false, reason: "damaged" };
  const settings = fromBackupFile1(file.data);
  return {
    ok: true,
    settings,
    summary: {
      categories: settings.categories.length,
      suppliers: settings.supplierCategories.length,
      concepts: settings.conceptRules.length,
    },
  };
}
