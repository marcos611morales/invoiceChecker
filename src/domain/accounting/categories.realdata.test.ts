// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { viewFor } from "../../../tests/support/exportFactory";
import {
  hasSample,
  loadSampleLedger,
  realScenarios,
  type RealScenario,
} from "../../../tests/support/realSample";
import { makeResolver } from "../settings/resolver";
import { SIN_CATEGORIA } from "../settings/types";
import { totalSpend, type IvaMode } from "./aggregate";
import { categoryBreakdown, scopeToCategories } from "./categories";
import { sum } from "./decimal";
import type { LedgerEntry } from "./ledger";

// Local identity test against the real 2025 sample (DASH-03, D-13): the categories always add up
// to the Gasto total, whatever the suppliers, rules and mode. Facturas/ is gitignored, so the suite
// is skipped where the folder is absent. Assertions are identities only: no RFC, name, UUID or
// amount is ever asserted as a literal or printed, so every comparison is reduced to a boolean.
const MODES: IvaMode[] = ["con", "sin"];
const SCENARIO_INDEXES = [0, 1, 2, 3];

interface Sample {
  entries: LedgerEntry[];
  scenarios: RealScenario[];
}

describe.skipIf(!hasSample)("categorías sobre la muestra real 2025", () => {
  // Lazy: describe.skipIf still runs this body when collecting, and the folder may be absent.
  let cache: Sample | null = null;
  function sample(): Sample {
    if (cache === null) {
      const entries = loadSampleLedger();
      cache = { entries, scenarios: realScenarios(entries) };
    }
    return cache;
  }

  function scenarioAt(index: number): { entries: LedgerEntry[]; scenario: RealScenario } {
    const { entries, scenarios } = sample();
    const scenario = scenarios[index];
    if (scenario === undefined) throw new Error("scenario missing");
    return { entries, scenario };
  }

  it("builds the scenarios from a non-empty sample", () => {
    const { entries, scenarios } = sample();
    expect(entries.length).toBeGreaterThan(0);
    expect(scenarios).toHaveLength(SCENARIO_INDEXES.length);
    expect((scenarios[1]?.settings.supplierCategories.length ?? 0) > 0).toBe(true);
    expect((scenarios[2]?.settings.conceptRules.length ?? 0) > 0).toBe(true);
    expect((scenarios[3]?.settings.conceptRules.length ?? 0) > 0).toBe(true);
  });

  for (const mode of MODES) {
    for (const index of SCENARIO_INDEXES) {
      it(`the sum of all categories equals Gasto total (${mode}, scenario ${index + 1})`, () => {
        const { entries, scenario } = scenarioAt(index);
        const resolver = makeResolver(scenario.settings);
        const rows = categoryBreakdown(
          scopeToCategories(entries, new Set<string>(), resolver),
          mode,
          12,
          (key) => key,
        );
        expect(sum(rows.map((row) => row.net)).eq(totalSpend(entries, mode))).toBe(true);

        const view = viewFor(entries, null, mode, scenario.settings);
        expect(sum(view.categories.map((row) => row.net)).eq(view.current.gasto)).toBe(true);
        expect(view.current.gasto.eq(totalSpend(entries, mode))).toBe(true);
      });

      it(`choosing every category plus «Sin categoría» keeps the same Gasto total (${mode}, scenario ${index + 1})`, () => {
        const { entries, scenario } = scenarioAt(index);
        const everyId = [
          ...scenario.settings.categories.map((category) => category.id),
          SIN_CATEGORIA,
        ];
        const all = viewFor(entries, null, mode, scenario.settings, everyId);
        const none = viewFor(entries, null, mode, scenario.settings);
        expect(all.current.gasto.eq(totalSpend(entries, mode))).toBe(true);
        expect(all.current.facturas === none.current.facturas).toBe(true);
        expect(sum(all.categories.map((row) => row.net)).eq(all.current.gasto)).toBe(true);
      });
    }
  }
});
