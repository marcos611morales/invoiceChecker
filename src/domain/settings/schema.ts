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
import { LIMITS, SIN_CATEGORIA, type SettingsData, type SettingsDataV2 } from "./types";

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

/** One concept of one supplier: a product member (D-09) or a «No agrupar» mark (D-22). */
const conceptRefSchema = z.object({
  rfc: z.string(),
  key: z.string(),
  description: z.string(),
  supplierName: z.string(),
});

const productSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(LIMITS.productName),
  categoryId: z.string().nullable(),
  members: z.array(conceptRefSchema).max(LIMITS.productMembers),
});

/** Name comparison of D-04: edge spaces and case ignored. Shared with the product names (D-12). */
export function comparableName(name: string): string {
  return name.trim().toLowerCase();
}

const RESERVED_NAME = comparableName("Sin categoría");

/** Separator that cannot appear in a normalized key or an RFC from XML text. */
const KEY_SEPARATOR = "\u0000";

/** One broken integrity rule: a message and where it sits in the settings value. */
export interface IntegrityIssue {
  message: string;
  path: (string | number)[];
}

/**
 * The referential integrity rules shared by the stored settings schema and the settings
 * file schema: unique ids, an id that is never the reserved key, unique names (D-04), no
 * reserved name, assignments and rules pointing at existing ids, no repeated supplier and
 * no repeated supplier plus key. Pure and total: it only reads `data`. It takes the frozen
 * Phase 3 shape because the settings file of version 1 calls it with four fields; the product
 * rules live in `productIntegrityIssues`.
 */
export function settingsIntegrityIssues(data: SettingsDataV2): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const [index, category] of data.categories.entries()) {
    if (category.id === SIN_CATEGORIA || ids.has(category.id)) {
      issues.push({ message: "invalid category id", path: ["categories", index, "id"] });
    }
    ids.add(category.id);
    const name = comparableName(category.name);
    if (name === RESERVED_NAME || names.has(name)) {
      issues.push({ message: "invalid category name", path: ["categories", index, "name"] });
    }
    names.add(name);
  }
  const suppliers = new Set<string>();
  for (const [index, assignment] of data.supplierCategories.entries()) {
    if (!ids.has(assignment.categoryId) || suppliers.has(assignment.rfc)) {
      issues.push({ message: "invalid supplier assignment", path: ["supplierCategories", index] });
    }
    suppliers.add(assignment.rfc);
  }
  const rules = new Set<string>();
  for (const [index, rule] of data.conceptRules.entries()) {
    const composite = `${rule.rfc}${KEY_SEPARATOR}${rule.key}`;
    if ((rule.categoryId !== null && !ids.has(rule.categoryId)) || rules.has(composite)) {
      issues.push({ message: "invalid concept rule", path: ["conceptRules", index] });
    }
    rules.add(composite);
  }
  return issues;
}

/**
 * The integrity rules of the products and the «No agrupar» marks (D-09, D-10, D-12, D-22):
 * unique product ids that are never the reserved key, unique names (D-04) that are never
 * «Sin categoría», a category that is null or an existing id, at least one member per
 * product, a member (rfc plus key) in at most one product, no more than `LIMITS.productMembers`
 * members in total, and marks that are unique and never a member. Pure and total; the
 * per-list caps (products, marks) are in the schema. Member and mark identity is a Set of
 * composite strings, never an object keyed by RFC (Pitfall 8).
 */
export function productIntegrityIssues(data: SettingsData): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];
  const categoryIds = new Set(data.categories.map((category) => category.id));
  const ids = new Set<string>();
  const names = new Set<string>();
  const members = new Set<string>();
  let memberCount = 0;
  for (const [index, product] of data.products.entries()) {
    if (product.id === SIN_CATEGORIA || ids.has(product.id)) {
      issues.push({ message: "invalid product id", path: ["products", index, "id"] });
    }
    ids.add(product.id);
    const name = comparableName(product.name);
    if (name === RESERVED_NAME || names.has(name)) {
      issues.push({ message: "invalid product name", path: ["products", index, "name"] });
    }
    names.add(name);
    if (product.categoryId !== null && !categoryIds.has(product.categoryId)) {
      issues.push({ message: "invalid product category", path: ["products", index, "categoryId"] });
    }
    if (product.members.length === 0) {
      issues.push({ message: "product without members", path: ["products", index, "members"] });
    }
    for (const [memberIndex, member] of product.members.entries()) {
      const composite = `${member.rfc}${KEY_SEPARATOR}${member.key}`;
      if (members.has(composite)) {
        issues.push({
          message: "member in more than one product",
          path: ["products", index, "members", memberIndex],
        });
      }
      members.add(composite);
      memberCount += 1;
    }
  }
  if (memberCount > LIMITS.productMembers) {
    issues.push({ message: "too many product members", path: ["products"] });
  }
  const marks = new Set<string>();
  for (const [index, mark] of data.ungroupedConcepts.entries()) {
    const composite = `${mark.rfc}${KEY_SEPARATOR}${mark.key}`;
    if (members.has(composite) || marks.has(composite)) {
      issues.push({ message: "invalid ungrouped concept", path: ["ungroupedConcepts", index] });
    }
    marks.add(composite);
  }
  return issues;
}

/**
 * FROZEN. Phase 3 stored data (version 2) with the D-30 caps and the integrity rules of
 * `settingsIntegrityIssues`. Never edit: `resolvePersisted` uses it to read what a browser
 * stored at version 2, so a change here would change what that stored value means.
 */
export const settingsDataSchemaV2: z.ZodType<SettingsDataV2> = z
  .object({
    ivaMode: ivaModeSchema,
    categories: z.array(categorySchema).max(LIMITS.categories),
    supplierCategories: z.array(supplierAssignmentSchema).max(LIMITS.supplierCategories),
    conceptRules: z.array(conceptRuleSchema).max(LIMITS.conceptRules),
  })
  .superRefine((data, ctx) => {
    for (const issue of settingsIntegrityIssues(data)) {
      ctx.addIssue({ code: "custom", message: issue.message, path: issue.path });
    }
  });

/**
 * Current stored data (version 3, Phase 4): the four Phase 3 fields plus the products and the
 * «No agrupar» marks, with the caps of `LIMITS` and both integrity rule sets. No length bound
 * on rfc, key, description or supplier name: they come from XML text.
 */
export const settingsDataSchema: z.ZodType<SettingsData> = z
  .object({
    ivaMode: ivaModeSchema,
    categories: z.array(categorySchema).max(LIMITS.categories),
    supplierCategories: z.array(supplierAssignmentSchema).max(LIMITS.supplierCategories),
    conceptRules: z.array(conceptRuleSchema).max(LIMITS.conceptRules),
    products: z.array(productSchema).max(LIMITS.products),
    ungroupedConcepts: z.array(conceptRefSchema).max(LIMITS.ungroupedConcepts),
  })
  .superRefine((data, ctx) => {
    for (const issue of [...settingsIntegrityIssues(data), ...productIntegrityIssues(data)]) {
      ctx.addIssue({ code: "custom", message: issue.message, path: issue.path });
    }
  });

/** The Phase 2 stored state (version 1): only the IVA mode. */
export const legacySettingsSchema = z.object({ ivaMode: ivaModeSchema });
