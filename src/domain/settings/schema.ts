/**
 * zod schemas of the stored settings. Everything read from browser storage (or,
 * later, from a backup file) is untrusted: the shape, the D-30 limits and the
 * referential integrity are all checked here, and a failure is a plain
 * `safeParse` failure that the caller turns into the suggestions.
 *
 * No length bound on rfc, supplier name, key or description: they come from XML
 * and a bound could make a valid stored state unreadable.
 */
import { z } from "zod";
import { LIMITS, SIN_CATEGORIA, type SettingsData } from "./types";

export const ivaModeSchema = z.enum(["con", "sin"]);

const categorySchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(LIMITS.categoryName),
});

const supplierAssignmentSchema = z.object({
  rfc: z.string(),
  name: z.string(),
  categoryId: z.string(),
});

const conceptRuleSchema = z.object({
  rfc: z.string(),
  key: z.string(),
  description: z.string(),
  categoryId: z.string().nullable(),
});

/** Name comparison of D-04: edge spaces and case ignored. */
function comparableName(name: string): string {
  return name.trim().toLowerCase();
}

const RESERVED_NAME = comparableName("Sin categoría");

/** Separator that cannot appear in a normalized key or an RFC from XML text. */
const KEY_SEPARATOR = "\u0000";

/**
 * Phase 3 stored data (version 2) with the D-30 caps and the integrity rules:
 * unique ids, an id that is never the reserved key, unique names (D-04), no
 * reserved name, assignments and rules pointing at existing ids, no repeated
 * supplier and no repeated supplier plus key.
 */
export const settingsDataSchema: z.ZodType<SettingsData> = z
  .object({
    ivaMode: ivaModeSchema,
    categories: z.array(categorySchema).max(LIMITS.categories),
    supplierCategories: z.array(supplierAssignmentSchema).max(LIMITS.supplierCategories),
    conceptRules: z.array(conceptRuleSchema).max(LIMITS.conceptRules),
  })
  .superRefine((data, ctx) => {
    const ids = new Set<string>();
    const names = new Set<string>();
    for (const [index, category] of data.categories.entries()) {
      if (category.id === SIN_CATEGORIA || ids.has(category.id)) {
        ctx.addIssue({ code: "custom", message: "invalid category id", path: ["categories", index, "id"] });
      }
      ids.add(category.id);
      const name = comparableName(category.name);
      if (name === RESERVED_NAME || names.has(name)) {
        ctx.addIssue({ code: "custom", message: "invalid category name", path: ["categories", index, "name"] });
      }
      names.add(name);
    }
    const suppliers = new Set<string>();
    for (const [index, assignment] of data.supplierCategories.entries()) {
      if (!ids.has(assignment.categoryId) || suppliers.has(assignment.rfc)) {
        ctx.addIssue({ code: "custom", message: "invalid supplier assignment", path: ["supplierCategories", index] });
      }
      suppliers.add(assignment.rfc);
    }
    const rules = new Set<string>();
    for (const [index, rule] of data.conceptRules.entries()) {
      const composite = `${rule.rfc}${KEY_SEPARATOR}${rule.key}`;
      if ((rule.categoryId !== null && !ids.has(rule.categoryId)) || rules.has(composite)) {
        ctx.addIssue({ code: "custom", message: "invalid concept rule", path: ["conceptRules", index] });
      }
      rules.add(composite);
    }
  });

/** The Phase 2 stored state (version 1): only the IVA mode. */
export const legacySettingsSchema = z.object({ ivaMode: ivaModeSchema });
