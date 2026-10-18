// @vitest-environment jsdom
import Big from "big.js";
import { describe, expect, it } from "vitest";
import {
  readFixture,
  withFecha,
  withMoneda,
  withTipoCambio,
  withTotal,
  withUuid,
} from "../../../tests/support/cfdiVariants";
import { contextFor, viewFor } from "../../../tests/support/exportFactory";
import { loaded, TEST_FECHA_CONTEXT } from "../../../tests/support/ledgerFactory";
import {
  expectCategoriesAddUp,
  expectConceptosReconcileWithFacturas,
  expectTotalsEqualDashboard,
  facturasMontoSum,
  parameterRow,
  sheetNamed,
  totalRowOf,
} from "../../../tests/support/workbookReader";
import type { IvaMode } from "@/domain/accounting/aggregate";
import { totalSpend } from "@/domain/accounting/aggregate";
import { toMoneyString } from "@/domain/accounting/decimal";
import { buildLedger, type LedgerEntry, type LedgerOverrides } from "@/domain/accounting/ledger";
import type { DashboardView } from "@/domain/accounting/view";
import { parseCfdi } from "@/domain/cfdi/parseCfdi";
import type { ParsedInvoice } from "@/domain/cfdi/types";
import {
  setConceptRule,
  setSupplierCategory,
  type RuleResult,
  type SupplierResult,
} from "@/domain/settings/assignments";
import { OTROS_ID, SIN_CATEGORIA, defaultSettings, type SettingsData } from "@/domain/settings/types";
import { es } from "@/lib/copy/es";
import { buildWorkbook } from "./workbook";

// Workbook versus Dashboard (XLS-03, DASH-03, D-13, D-23, D-27) over anonymized XML: the same
// selectView feeds the expected Dashboard figures and buildWorkbook, and the cells are read
// from the SheetModel (no unzipping, D-29). Every document goes through parseCfdi.

const INSUMOS_ID = "seed:insumos-cafeteria";
const SERVICIOS_ID = "seed:servicios";

const SUPPLIER_ONE = "AAA010101AAA";
const SUPPLIER_TWO = "BBB020202BBB";
const SUPPLIER_THREE = "CCC030303CCC";

const MULTI_XML = readFixture("ingreso-multiconcepto-descuento.xml");
const DESCUENTO_XML = readFixture("anon/anon-ingreso-descuento.xml");
const IEPS_XML = readFixture("anon/anon-ingreso-ieps.xml");
const SIN_IMPUESTOS_XML = readFixture("ingreso-sin-impuestos.xml");
const EGRESO_XML = readFixture("anon/anon-egreso.xml");
const PAGO_XML = readFixture("anon/anon-pago.xml");

let uuidCounter = 0;

/** A synthetic UUID that is never a real identifier. */
function syntheticUuid(): string {
  uuidCounter += 1;
  return `00000000-0000-4000-8000-${String(uuidCounter).padStart(12, "0")}`;
}

/** Replaces the Rfc attribute of the Emisor element. */
function withEmisorRfc(xml: string, rfc: string): string {
  const pattern = /(<(?:[\w-]+:)?Emisor\b[^>]*?\sRfc=")[^"]*(")/;
  if (!pattern.test(xml)) throw new Error("fixture value not found (Emisor.Rfc)");
  return xml.replace(pattern, (_match, head: string, tail: string) => `${head}${rfc}${tail}`);
}

/** A copy of a document as a different invoice: new UUID, supplier and day. */
function variant(xml: string, rfc: string, fecha: string): string {
  return withFecha(withEmisorRfc(withUuid(xml, syntheticUuid()), rfc), fecha);
}

function firstGroup(xml: string, pattern: RegExp, label: string): string {
  const value = pattern.exec(xml)?.[1];
  if (value === undefined) throw new Error(`fixture value not found (${label})`);
  return value;
}

function parseOk(xml: string): ParsedInvoice {
  const result = parseCfdi(xml);
  if (!result.ok) throw new Error(`expected ok, got ${result.reason} ${result.detail ?? ""}`);
  return result.invoice;
}

/** UUID the credit note relates to, read from its XML. */
const RELATED_UUID = firstGroup(
  EGRESO_XML,
  /<(?:[\w-]+:)?CfdiRelacionado\b[^>]*?\sUUID="([^"]+)"/,
  "CfdiRelacionado.UUID",
);

const EXCLUDED_XML = variant(DESCUENTO_XML, SUPPLIER_TWO, "2025-06-30T10:00:00");

interface Dataset {
  label: string;
  ledger: LedgerEntry[];
  /** True when every amount is an MXN figure with at most two decimals. */
  twoDecimals: boolean;
}

function datasetOf(label: string, documents: readonly string[], twoDecimals: boolean): Dataset {
  const overrides: LedgerOverrides = {
    excluded: new Set<string>([parseOk(EXCLUDED_XML).uuid]),
    restored: new Set<string>(),
  };
  return {
    label,
    twoDecimals,
    ledger: buildLedger(
      documents.map((xml) => loaded(parseOk(xml))),
      overrides,
      TEST_FECHA_CONTEXT,
    ),
  };
}

/** MXN invoices with cent-level rounding gaps, a credit note, a Pago and an excluded invoice. */
const MXN_DOCUMENTS: string[] = [
  variant(MULTI_XML, SUPPLIER_ONE, "2025-02-20T12:00:00"),
  variant(MULTI_XML, SUPPLIER_TWO, "2025-01-10T09:00:00"),
  // The Total misses the sum of the concepts by a cent (the gap goes to the supplier's category).
  withTotal(variant(MULTI_XML, SUPPLIER_THREE, "2025-03-05T09:00:00"), "259.61"),
  withUuid(withEmisorRfc(DESCUENTO_XML, SUPPLIER_ONE), RELATED_UUID),
  variant(IEPS_XML, SUPPLIER_THREE, "2025-06-05T22:20:44"),
  variant(SIN_IMPUESTOS_XML, SUPPLIER_TWO, "2025-03-05T09:15:00"),
  withEmisorRfc(EGRESO_XML, SUPPLIER_ONE),
  withEmisorRfc(PAGO_XML, SUPPLIER_ONE),
  EXCLUDED_XML,
];

/** The same plus amounts with more than two decimals and invoices that cannot be summed. */
const MIXED_DOCUMENTS: string[] = [
  ...MXN_DOCUMENTS,
  // Half a cent: the exact Total has three decimals.
  withTotal(variant(MULTI_XML, SUPPLIER_TWO, "2025-04-12T09:00:00"), "259.605"),
  // A USD invoice with a three-decimal exchange rate.
  withTipoCambio(withMoneda(variant(MULTI_XML, SUPPLIER_THREE, "2025-04-20T09:00:00"), "USD"), "18.237"),
  // A USD invoice without TipoCambio does not sum.
  withMoneda(variant(DESCUENTO_XML, SUPPLIER_ONE, "2025-05-02T09:00:00"), "USD").replace(
    /\sTipoCambio="[^"]*"/,
    "",
  ),
];

const DATASETS: Dataset[] = [
  datasetOf("MXN con huecos de redondeo", MXN_DOCUMENTS, true),
  datasetOf("mezcla con USD y fracciones", MIXED_DOCUMENTS, false),
];

function settingsOf(result: SupplierResult | RuleResult): SettingsData {
  if (!result.ok) throw new Error("settings change refused");
  return result.next;
}

/** Suppliers assigned to a category and rules on some descriptions of the fixtures. */
function assignedSettings(): SettingsData {
  let settings = defaultSettings();
  settings = settingsOf(setSupplierCategory(settings, SUPPLIER_ONE, "Proveedor uno", INSUMOS_ID));
  settings = settingsOf(setSupplierCategory(settings, SUPPLIER_TWO, "Proveedor dos", OTROS_ID));
  settings = settingsOf(
    setConceptRule(settings, SUPPLIER_ONE, "PRODUCTO DE PRUEBA UNO", SERVICIOS_ID),
  );
  settings = settingsOf(setConceptRule(settings, SUPPLIER_TWO, "concepto 2", OTROS_ID));
  // An explicit «Sin categoría» beats the supplier's category.
  return settingsOf(setConceptRule(settings, SUPPLIER_ONE, "CONCEPTO 3", null));
}

const SETTINGS_CASES: { label: string; settings: SettingsData }[] = [
  { label: "sin asignaciones", settings: defaultSettings() },
  { label: "con proveedores y reglas", settings: assignedSettings() },
];

/** Every category of the settings plus «Sin categoría». */
function allCategoryIds(settings: SettingsData): string[] {
  return [...settings.categories.map((category) => category.id), SIN_CATEGORIA];
}

interface Selection {
  label: string;
  ids: (settings: SettingsData) => string[];
}

const SELECTIONS: Selection[] = [
  { label: "sin filtro de categoría", ids: () => [] },
  { label: "una categoría", ids: () => [INSUMOS_ID] },
  { label: "solo Sin categoría", ids: () => [SIN_CATEGORIA] },
  { label: "todas las categorías y Sin categoría", ids: allCategoryIds },
];

const MODES: IvaMode[] = ["con", "sin"];

function viewOf(
  dataset: Dataset,
  settings: SettingsData,
  mode: IvaMode,
  ids: readonly string[],
): DashboardView {
  return viewFor(dataset.ledger, null, mode, settings, ids);
}

describe("el libro de Excel coincide con el Dashboard (anonimizado)", () => {
  for (const dataset of DATASETS) {
    for (const { label: settingsLabel, settings } of SETTINGS_CASES) {
      for (const mode of MODES) {
        for (const selection of SELECTIONS) {
          const name = `${dataset.label}, ${settingsLabel}, ${mode === "con" ? "Con IVA" : "Sin IVA"}, ${selection.label}`;
          describe(name, () => {
            const view = viewOf(dataset, settings, mode, selection.ids(settings));
            const sheets = buildWorkbook(view, contextFor(settings, mode));

            it("cada fila Total es la cifra del Dashboard al centavo", () => {
              expectTotalsEqualDashboard(sheets, view, mode);
              expect(view.current.gasto.eq(totalSpend(view.visible, mode))).toBe(true);
            });

            it("las categorías suman exactamente el Gasto total", () => {
              expectCategoriesAddUp(view, sheets);
            });

            it("los Monto de Conceptos de cada factura suman su Monto en Facturas", () => {
              expectConceptosReconcileWithFacturas(sheets, mode);
            });

            if (dataset.twoDecimals) {
              it("la columna Monto de Facturas suma el Gasto total", () => {
                expect(facturasMontoSum(sheets, mode).eq(new Big(toMoneyString(view.current.gasto)))).toBe(
                  true,
                );
              });
            }
          });
        }
      }
    }
  }
});

describe("elegir todas las categorías más Sin categoría equivale a no filtrar (D-27)", () => {
  for (const dataset of DATASETS) {
    for (const { label: settingsLabel, settings } of SETTINGS_CASES) {
      for (const mode of MODES) {
        it(`${dataset.label}, ${settingsLabel}, ${mode === "con" ? "Con IVA" : "Sin IVA"}`, () => {
          const none = buildWorkbook(viewOf(dataset, settings, mode, []), contextFor(settings, mode));
          const every = buildWorkbook(
            viewOf(dataset, settings, mode, allCategoryIds(settings)),
            contextFor(settings, mode),
          );
          for (const sheetName of [
            es.export.sheets.resumenCategoria,
            es.export.sheets.resumenProveedor,
            es.export.sheets.resumenMes,
          ]) {
            expect(totalRowOf(sheetNamed(every, sheetName))).toEqual(
              totalRowOf(sheetNamed(none, sheetName)),
            );
          }
          const parametrosNone = sheetNamed(none, es.export.sheets.parametros);
          const parametrosEvery = sheetNamed(every, es.export.sheets.parametros);
          for (const label of [es.export.params.invoices, es.export.params.total]) {
            expect(parameterRow(parametrosEvery, label)).toEqual(parameterRow(parametrosNone, label));
          }
          expect(facturasMontoSum(every, mode).eq(facturasMontoSum(none, mode))).toBe(true);
        });
      }
    }
  }
});

describe("con un rango explícito", () => {
  it("las filas Total siguen siendo las cifras del Dashboard y los meses vacíos cuentan", () => {
    const dataset = DATASETS[0];
    if (dataset === undefined) throw new Error("dataset missing");
    const settings = assignedSettings();
    for (const mode of MODES) {
      const view = viewFor(dataset.ledger, { from: "2025-02", to: "2025-07" }, mode, settings, []);
      const sheets = buildWorkbook(view, contextFor(settings, mode));
      expectTotalsEqualDashboard(sheets, view, mode);
      expectCategoriesAddUp(view, sheets);
      expectConceptosReconcileWithFacturas(sheets, mode);
      expect(view.current.months).toBe(6);
    }
  });
});

describe("los conjuntos de datos ejercitan los casos que dicen", () => {
  const dataset = DATASETS[0];
  const mixed = DATASETS[1];
  if (dataset === undefined || mixed === undefined) throw new Error("dataset missing");
  const settings = assignedSettings();

  it("tienen varias categorías, una nota de crédito, un Pago, una excluida y filas de redondeo", () => {
    const view = viewOf(dataset, settings, "con", []);
    const sheets = buildWorkbook(view, contextFor(settings, "con"));
    expect(view.categories.length).toBeGreaterThanOrEqual(3);
    expect(view.categories.some((row) => row.category === SIN_CATEGORIA)).toBe(true);
    expect(dataset.ledger.some((entry) => entry.kind === "nota-credito" && entry.counted)).toBe(
      true,
    );
    expect(dataset.ledger.some((entry) => entry.kind === "pago")).toBe(true);
    expect(dataset.ledger.some((entry) => entry.exclusion === "manual")).toBe(true);
    const conceptos = sheetNamed(sheets, es.export.sheets.conceptos);
    const roundingRows = conceptos.rows.filter((row) =>
      row.some((cell) => cell.kind === "text" && cell.value === es.export.roundingLine),
    );
    expect(roundingRows.length).toBeGreaterThan(0);
  });

  it("la mezcla tiene montos con más de dos decimales y una factura que no suma por moneda", () => {
    const view = viewOf(mixed, settings, "con", []);
    const sheets = buildWorkbook(view, contextFor(settings, "con"));
    expect(view.current.gasto.round(2).eq(view.current.gasto)).toBe(false);
    expect(mixed.ledger.some((entry) => entry.noSuma === "moneda-sin-tc")).toBe(true);
    expect(sheetNamed(sheets, es.export.sheets.facturas).rows).toHaveLength(mixed.ledger.length);
  });
});
