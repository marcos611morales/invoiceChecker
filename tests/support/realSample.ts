/**
 * Test helper for the local real-data tests: the 2025 sample of Facturas/ (gitignored). Reading is
 * read-only. FACTURAS_DIR overrides the default <cwd>/Facturas (useful from git worktrees). Nothing
 * from the sample is ever printed or asserted as a literal. Not imported by production code.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { EMPTY_OVERRIDES, buildLedger, type LedgerEntry } from "@/domain/accounting/ledger";
import { parseCfdi } from "@/domain/cfdi/parseCfdi";
import type { ParsedInvoice } from "@/domain/cfdi/types";
import {
  setConceptRule,
  setSupplierCategory,
  type RuleResult,
  type SupplierResult,
} from "@/domain/settings/assignments";
import { OTROS_ID, defaultSettings, type SettingsData } from "@/domain/settings/types";
import { loaded, TEST_FECHA_CONTEXT } from "./ledgerFactory";

const facturasRoot = process.env.FACTURAS_DIR ?? resolve(process.cwd(), "Facturas");
const sampleDir = join(facturasRoot, "2025");

/** True where the local sample exists (false on Vercel, CI and other machines). */
export const hasSample = existsSync(sampleDir);

/** Parses the sample and dedupes by uuid keeping the first file, as the import does. */
export function loadSample(): ParsedInvoice[] {
  const names = readdirSync(sampleDir)
    .filter((name) => name.toLowerCase().endsWith(".xml"))
    .sort();
  const byUuid = new Map<string, ParsedInvoice>();
  for (const name of names) {
    const result = parseCfdi(readFileSync(join(sampleDir, name), "utf8"));
    if (result.ok && !byUuid.has(result.invoice.uuid)) {
      byUuid.set(result.invoice.uuid, result.invoice);
    }
  }
  return [...byUuid.values()];
}

/** The ledger of the sample with no manual overrides. Call it inside a test, never at module scope. */
export function loadSampleLedger(): LedgerEntry[] {
  return buildLedger(loadSample().map(loaded), EMPTY_OVERRIDES, TEST_FECHA_CONTEXT);
}

function settingsOf(result: SupplierResult | RuleResult): SettingsData {
  if (!result.ok) throw new Error("settings change refused");
  return result.next;
}

export interface RealScenario {
  label: string;
  settings: SettingsData;
}

/** How many concept rules the scenarios derive from the sample's own first descriptions. */
const DERIVED_RULES = 3;

/**
 * The settings the real-data tests run under: empty, every supplier of the sample assigned to
 * «Otros», a few concept rules derived from the sample's own first descriptions, and both together.
 * Every RFC, name and description is read from the sample at run time and stays inside the process.
 */
export function realScenarios(entries: readonly LedgerEntry[]): RealScenario[] {
  const empty = defaultSettings();

  let suppliers = defaultSettings();
  const seenSuppliers = new Set<string>();
  for (const entry of entries) {
    if (seenSuppliers.has(entry.supplierRfc)) continue;
    seenSuppliers.add(entry.supplierRfc);
    suppliers = settingsOf(setSupplierCategory(suppliers, entry.supplierRfc, entry.supplierName, OTROS_ID));
  }

  // null is an explicit «Sin categoría»; the others are seeded categories.
  const targets: (string | null)[] = ["seed:insumos-cafeteria", null, "seed:servicios"];
  let rules = defaultSettings();
  const seenPairs = new Set<string>();
  for (const entry of entries) {
    for (const concepto of entry.invoice.conceptos) {
      if (seenPairs.size >= DERIVED_RULES) break;
      const pair = `${entry.supplierRfc}\u0000${concepto.descripcion}`;
      if (seenPairs.has(pair)) continue;
      const target = targets[seenPairs.size % targets.length] ?? null;
      seenPairs.add(pair);
      rules = settingsOf(setConceptRule(rules, entry.supplierRfc, concepto.descripcion, target));
    }
  }

  let both = suppliers;
  for (const rule of rules.conceptRules) {
    both = settingsOf(setConceptRule(both, rule.rfc, rule.description, rule.categoryId));
  }

  return [
    { label: "sin asignaciones ni reglas", settings: empty },
    { label: "todos los proveedores en Otros", settings: suppliers },
    { label: "reglas derivadas de la muestra", settings: rules },
    { label: "proveedores en Otros y reglas", settings: both },
  ];
}
