/**
 * Settings file contract, versions 1, 2 and 3 (Phase 3 D-07, D-08, D-30; Phase 4 D-13, D-31;
 * Phase 5 D-15, D-19).
 *
 * THIS FILE DEFINES A PUBLISHED CONTRACT. A downloaded settings file lives on the user's disk
 * for as long as they keep it, so every later build must keep reading versions 1, 2 and 3. When
 * the format grows again (version 4), add `BackupFile4` and `fromBackupFile4` next to the
 * pieces below and branch on the file version in `parseBackupText`; never edit
 * `backupFile1Schema`, `fromBackupFile1`, `backupFile2Schema`, `fromBackupFile2`,
 * `backupFile3Schema` or `fromBackupFile3`. The golden files
 * `tests/fixtures/settings/ajustes-archivo-1.json`, `ajustes-archivo-2.json` and
 * `ajustes-archivo-3.json` must keep loading.
 *
 * The file version is independent of the store version (`SETTINGS_VERSION`), and each file
 * version schema is declared here, separately from `settingsDataSchema`, so a change to the
 * stored shape cannot silently change what an old file means. The only things shared are the
 * pure integrity checks.
 *
 * Version 1 (Phase 3) holds four settings fields: the IVA mode, the categories, the supplier
 * assignments and the concept rules. Version 2 (Phase 4) adds the accepted products (id, name,
 * category or null, members with RFC, key, description and supplier name) and the «No agrupar»
 * marks. Version 3 (Phase 5) adds the content corrections (RFC, key, description, supplier name,
 * pieces per pack, content number as decimal text and its unit) and the «no comparable» overrides
 * (product id and a boolean). This build writes version 3 and reads all three; a version-1 file
 * loads with no products and no marks, and a version-1 or 2 file with no corrections and no
 * overrides. A file never holds pending suggestions or anything about invoices: no amounts,
 * prices, UUIDs, folios, dates or receptor (T-03-18, T-04-24, T-05-08).
 */
import { z } from "zod";
import {
  contentAmountIssue,
  priceIntegrityIssues,
  productIntegrityIssues,
  pruneDanglingOverrides,
  settingsIntegrityIssues,
} from "./schema";
import { LIMITS, type SettingsData, type SettingsDataV2, type SettingsDataV3 } from "./types";

export const BACKUP_APP = "invoicechecker-settings";
/** Highest file version this build can read and the one it writes. */
export const BACKUP_FILE_VERSION = 3;

/** Why a file was refused; each maps to one sentence in the UI (D-08). */
export type BackupFailure = "not-invoicechecker" | "damaged" | "newer" | "too-large";

/** What a valid file holds, shown before it replaces the current settings (UI-SPEC 346-347). */
export interface BackupSummary {
  categories: number;
  suppliers: number;
  concepts: number;
  products: number;
  /** Descriptions grouped in the products: the sum of the members of all products. */
  members: number;
  /** Content corrections the file holds (Phase 5, D-15). */
  corrections: number;
  /** «No comparable» marks the file holds, after the ones for missing products are dropped (D-19). */
  overrides: number;
}

/** Size gate, checked on `file.size` before the file is read into memory (D-30, D-31, T-03-16). */
export function checkBackupSize(bytes: number): BackupFailure | null {
  return bytes > LIMITS.backupBytes ? "too-large" : null;
}

/**
 * The file as written by this build: only the fields of the contract (file version 3, the eight
 * settings fields), picked one by one and two-space indented. Any other field of `settings`, of
 * a product, of a member, of a mark, of a correction or of an override is left out on purpose
 * (T-04-24, T-05-08).
 */
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
      products: settings.products.map(({ id, name, categoryId, members }) => ({
        id,
        name,
        categoryId,
        members: members.map(({ rfc, key, description, supplierName }) => ({
          rfc,
          key,
          description,
          supplierName,
        })),
      })),
      ungroupedConcepts: settings.ungroupedConcepts.map(
        ({ rfc, key, description, supplierName }) => ({ rfc, key, description, supplierName }),
      ),
      contentCorrections: settings.contentCorrections.map(
        ({ rfc, key, description, supplierName, packs, amount, unit }) => ({
          rfc,
          key,
          description,
          supplierName,
          packs,
          amount,
          unit,
        }),
      ),
      priceOverrides: settings.priceOverrides.map(({ productId, comparable }) => ({
        productId,
        comparable,
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

/**
 * Converter from the version-1 file to the Phase 3 settings shape (the file never carried
 * products). Later versions add their own.
 */
export function fromBackupFile1(file: BackupFile1): SettingsDataV2 {
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

// Version 2 of the file (Phase 4, D-13). Declared on its own, not imported from
// `settingsDataSchema`, so the stored shape can change without changing what this file means.
// Same caps as the stored settings (`LIMITS`) and both integrity rule sets: a hostile or
// damaged file is refused whole and nothing is applied (T-04-22). Unknown keys are stripped.
// No bound on rfc, supplier name, key or description: they come from XML text.
const conceptRef2Schema = z.object({
  rfc: z.string(),
  key: z.string(),
  description: z.string(),
  supplierName: z.string(),
});

const backupFile2Schema = z.object({
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
      products: z
        .array(
          z.object({
            id: z.string().min(1),
            name: z.string().trim().min(1).max(LIMITS.productName),
            categoryId: z.string().nullable(),
            members: z.array(conceptRef2Schema).max(LIMITS.productMembers),
          }),
        )
        .max(LIMITS.products),
      ungroupedConcepts: z.array(conceptRef2Schema).max(LIMITS.ungroupedConcepts),
    })
    .superRefine((settings, ctx) => {
      for (const issue of [
        ...settingsIntegrityIssues(settings),
        ...productIntegrityIssues(settings),
      ]) {
        ctx.addIssue({ code: "custom", message: issue.message, path: issue.path });
      }
    }),
});

export type BackupFile2 = z.infer<typeof backupFile2Schema>;

/** Converter from the version-2 file to the Phase 4 settings shape, field by field. */
export function fromBackupFile2(file: BackupFile2): SettingsDataV3 {
  const { ivaMode, categories, supplierCategories, conceptRules, products, ungroupedConcepts } =
    file.settings;
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
    products: products.map(({ id, name, categoryId, members }) => ({
      id,
      name,
      categoryId,
      members: members.map(({ rfc, key, description, supplierName }) => ({
        rfc,
        key,
        description,
        supplierName,
      })),
    })),
    ungroupedConcepts: ungroupedConcepts.map(({ rfc, key, description, supplierName }) => ({
      rfc,
      key,
      description,
      supplierName,
    })),
  };
}

// Version 3 of the file (Phase 5, D-15 and D-19). Declared on its own, not imported from
// `settingsDataSchema`, so the stored shape can change without changing what this file means.
// Same caps as the stored settings (`LIMITS`) and the three integrity rule sets: a hostile or
// damaged file is refused whole and nothing is applied (T-05-07). An override of a product the
// file does not hold is not a defect: `fromBackupFile3` drops it. `amount` is decimal text
// checked by `contentAmountIssue`, never a number. Unknown keys are stripped.
const contentUnit3Schema = z.enum(["g", "kg", "ml", "l", "piezas"]);

const backupFile3Schema = z.object({
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
      products: z
        .array(
          z.object({
            id: z.string().min(1),
            name: z.string().trim().min(1).max(LIMITS.productName),
            categoryId: z.string().nullable(),
            members: z.array(conceptRef2Schema).max(LIMITS.productMembers),
          }),
        )
        .max(LIMITS.products),
      ungroupedConcepts: z.array(conceptRef2Schema).max(LIMITS.ungroupedConcepts),
      contentCorrections: z
        .array(
          z.object({
            rfc: z.string(),
            key: z.string(),
            description: z.string(),
            supplierName: z.string(),
            packs: z.number().int().min(1).max(LIMITS.contentPacks),
            amount: z.string().superRefine((amount, ctx) => {
              const issue = contentAmountIssue(amount);
              if (issue !== null) ctx.addIssue({ code: "custom", message: issue });
            }),
            unit: contentUnit3Schema,
          }),
        )
        .max(LIMITS.contentCorrections),
      priceOverrides: z
        .array(z.object({ productId: z.string().min(1), comparable: z.boolean() }))
        .max(LIMITS.priceOverrides),
    })
    .superRefine((settings, ctx) => {
      for (const issue of [
        ...settingsIntegrityIssues(settings),
        ...productIntegrityIssues(settings),
        ...priceIntegrityIssues(settings),
      ]) {
        ctx.addIssue({ code: "custom", message: issue.message, path: issue.path });
      }
    }),
});

export type BackupFile3 = z.infer<typeof backupFile3Schema>;

/**
 * Converter from the version-3 file to the current settings shape, field by field. The overrides
 * of products the file does not hold are dropped (D-19), so they never reach the store.
 */
export function fromBackupFile3(file: BackupFile3): SettingsData {
  const {
    ivaMode,
    categories,
    supplierCategories,
    conceptRules,
    products,
    ungroupedConcepts,
    contentCorrections,
    priceOverrides,
  } = file.settings;
  return pruneDanglingOverrides({
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
    products: products.map(({ id, name, categoryId, members }) => ({
      id,
      name,
      categoryId,
      members: members.map(({ rfc, key, description, supplierName }) => ({
        rfc,
        key,
        description,
        supplierName,
      })),
    })),
    ungroupedConcepts: ungroupedConcepts.map(({ rfc, key, description, supplierName }) => ({
      rfc,
      key,
      description,
      supplierName,
    })),
    contentCorrections: contentCorrections.map(
      ({ rfc, key, description, supplierName, packs, amount, unit }) => ({
        rfc,
        key,
        description,
        supplierName,
        packs,
        amount,
        unit,
      }),
    ),
    priceOverrides: priceOverrides.map(({ productId, comparable }) => ({ productId, comparable })),
  });
}

function summaryOf(settings: SettingsData): BackupSummary {
  return {
    categories: settings.categories.length,
    suppliers: settings.supplierCategories.length,
    concepts: settings.conceptRules.length,
    products: settings.products.length,
    members: settings.products.reduce((total, product) => total + product.members.length, 0),
    corrections: settings.contentCorrections.length,
    overrides: settings.priceOverrides.length,
  };
}

/**
 * Reads a settings file text. Never throws and applies nothing: the caller decides what to do
 * with a valid result. Order: JSON (a failure is «damaged» when the text carries the app
 * marker and «not-invoicechecker» otherwise), then the header («not-invoicechecker»), then the
 * version («newer», before the body is read because an unknown version has no schema), then
 * the full schema of that file version with the D-30 limits and the integrity rules («damaged»).
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
  if (header.data.version === 1) {
    const file = backupFile1Schema.safeParse(raw);
    if (!file.success) return { ok: false, reason: "damaged" };
    // A version-1 file has no products, no «No agrupar» marks (D-13), no corrections and no overrides.
    const settings: SettingsData = {
      ...fromBackupFile1(file.data),
      products: [],
      ungroupedConcepts: [],
      contentCorrections: [],
      priceOverrides: [],
    };
    return { ok: true, settings, summary: summaryOf(settings) };
  }
  if (header.data.version === 2) {
    const file = backupFile2Schema.safeParse(raw);
    if (!file.success) return { ok: false, reason: "damaged" };
    // A version-2 file has no content corrections and no «no comparable» marks (D-15, D-19).
    const settings: SettingsData = {
      ...fromBackupFile2(file.data),
      contentCorrections: [],
      priceOverrides: [],
    };
    return { ok: true, settings, summary: summaryOf(settings) };
  }
  const file = backupFile3Schema.safeParse(raw);
  if (!file.success) return { ok: false, reason: "damaged" };
  const settings = fromBackupFile3(file.data);
  return { ok: true, settings, summary: summaryOf(settings) };
}
