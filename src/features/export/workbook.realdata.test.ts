// @vitest-environment jsdom
import Big from "big.js";
import { describe, expect, it } from "vitest";
import { contextFor, viewFor } from "../../../tests/support/exportFactory";
import {
  hasSample,
  loadSampleLedger,
  realScenarios,
  type RealScenario,
} from "../../../tests/support/realSample";
import {
  expectCategoriesAddUp,
  expectConceptosReconcileWithFacturas,
  expectTotalsEqualDashboard,
  facturasMontoSum,
  parameterRow,
  sheetNamed,
  totalRowOf,
} from "../../../tests/support/workbookReader";
import { entryAmount, type IvaMode } from "@/domain/accounting/aggregate";
import { toMoneyString } from "@/domain/accounting/decimal";
import type { LedgerEntry } from "@/domain/accounting/ledger";
import { SIN_CATEGORIA } from "@/domain/settings/types";
import { es } from "@/lib/copy/es";
import { buildWorkbook } from "./workbook";

// Local identity test against the real 2025 sample (XLS-03, DASH-03, D-13, D-23, D-27): the workbook
// of the whole sample says what the Dashboard says. Facturas/ is gitignored, so the suite is skipped
// where the folder is absent. Assertions are identities only: no RFC, name, UUID or amount is ever
// asserted as a literal or printed, so every comparison is reduced to a boolean.
const MODES: IvaMode[] = ["con", "sin"];
const SCENARIO_INDEXES = [0, 1, 2, 3];
const HALF_CENT = new Big("0.005");

interface Sample {
  entries: LedgerEntry[];
  scenarios: RealScenario[];
}

/** True when every counted amount of the mode is exact to the cent, so the Monto cells add up exactly. */
function exactToTheCent(entries: readonly LedgerEntry[], mode: IvaMode): boolean {
  return entries.every((entry) => {
    const amount = entryAmount(entry, mode);
    return !entry.counted || amount === null || amount.round(2).eq(amount);
  });
}

describe.skipIf(!hasSample)("libro de Excel sobre la muestra real 2025", () => {
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

  for (const mode of MODES) {
    for (const index of SCENARIO_INDEXES) {
      describe(`${mode === "con" ? "Con IVA" : "Sin IVA"}, escenario ${index + 1}`, () => {
        it("every Total row equals the Dashboard figure", () => {
          const { entries, scenario } = scenarioAt(index);
          const view = viewFor(entries, null, mode, scenario.settings);
          const sheets = buildWorkbook(view, contextFor(scenario.settings, mode));
          expectTotalsEqualDashboard(sheets, view, mode);
        });

        it("the categories add up to Gasto total", () => {
          const { entries, scenario } = scenarioAt(index);
          const view = viewFor(entries, null, mode, scenario.settings);
          expectCategoriesAddUp(view, buildWorkbook(view, contextFor(scenario.settings, mode)));
        });

        it("the Conceptos rows of each invoice add up to its Facturas row", () => {
          const { entries, scenario } = scenarioAt(index);
          const view = viewFor(entries, null, mode, scenario.settings);
          expectConceptosReconcileWithFacturas(
            buildWorkbook(view, contextFor(scenario.settings, mode)),
            mode,
          );
        });

        it("the Facturas Monto column adds up to Gasto total (exactly when every amount is exact to the cent)", () => {
          const { entries, scenario } = scenarioAt(index);
          const view = viewFor(entries, null, mode, scenario.settings);
          const sheets = buildWorkbook(view, contextFor(scenario.settings, mode));
          const column = facturasMontoSum(sheets, mode);
          const gasto = new Big(toMoneyString(view.current.gasto));
          if (exactToTheCent(entries, mode)) {
            expect(column.eq(gasto)).toBe(true);
          } else {
            // Each counted invoice is rounded to the cent when written, so the column may drift
            // by at most half a cent per invoice.
            const bound = HALF_CENT.times(String(entries.length));
            expect(column.minus(view.current.gasto).abs().lte(bound)).toBe(true);
          }
        });

        it("choosing every category plus «Sin categoría» gives the same workbook totals", () => {
          const { entries, scenario } = scenarioAt(index);
          const everyId = [
            ...scenario.settings.categories.map((category) => category.id),
            SIN_CATEGORIA,
          ];
          const none = buildWorkbook(
            viewFor(entries, null, mode, scenario.settings),
            contextFor(scenario.settings, mode),
          );
          const every = buildWorkbook(
            viewFor(entries, null, mode, scenario.settings, everyId),
            contextFor(scenario.settings, mode),
          );
          for (const sheetName of [
            es.export.sheets.resumenCategoria,
            es.export.sheets.resumenProveedor,
            es.export.sheets.resumenMes,
          ]) {
            const same =
              JSON.stringify(totalRowOf(sheetNamed(every, sheetName))) ===
              JSON.stringify(totalRowOf(sheetNamed(none, sheetName)));
            expect(same).toBe(true);
          }
          const parametrosNone = sheetNamed(none, es.export.sheets.parametros);
          const parametrosEvery = sheetNamed(every, es.export.sheets.parametros);
          for (const label of [es.export.params.invoices, es.export.params.total]) {
            const same =
              JSON.stringify(parameterRow(parametrosEvery, label)) ===
              JSON.stringify(parameterRow(parametrosNone, label));
            expect(same).toBe(true);
          }
        });
      });
    }
  }
});
