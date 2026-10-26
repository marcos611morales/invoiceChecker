// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { Concepto, ParsedInvoice } from "@/domain/cfdi/types";
import { defaultSettings, type PriceOverride, type Product } from "@/domain/settings/types";
import { useSessionStore } from "@/stores/sessionStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { makeInvoice } from "../../../tests/support/ledgerFactory";
import { makeProduct } from "../../../tests/support/pricesFactory";
import { resetSettingsStore } from "../../../tests/support/settingsStorage";
import { usePricesView } from "./usePricesView";

const RFC_A = "AAA010101AAA";
const RFC_B = "BBB010101BBB";
const NAME_A = "Tienda Alfa";
const NAME_B = "Tienda Beta";

const SUGAR = "AZUCAR ESTANDAR";
const ADS = "GOOGLE ADS";
const MIXED = "BLUEBERRIES";

/** A KGM concept with a given ClaveProdServ; the price per kilogram is importe / cantidad. */
function concept(descripcion: string, clave: string, cantidad: string, importe: string): Concepto {
  return {
    claveProdServ: clave,
    noIdentificacion: null,
    cantidad,
    claveUnidad: "KGM",
    unidad: "Kilogramo",
    descripcion,
    valorUnitario: importe,
    importe,
    descuento: null,
    objetoImp: "01",
    traslados: [],
    retenciones: [],
  };
}

function line(
  rfc: string,
  nombre: string,
  fecha: string,
  descripcion: string,
  clave: string,
  cantidad: string,
  importe: string,
): ParsedInvoice {
  return makeInvoice({
    fecha,
    emisor: { rfc, nombre },
    conceptos: [concept(descripcion, clave, cantidad, importe)],
    subTotal: importe,
    total: importe,
    totalImpuestosTrasladados: null,
  });
}

function productOf(name: string, descripcion: string): Product {
  return makeProduct(
    name,
    [
      { rfc: RFC_A, descripcion, supplierName: NAME_A },
      { rfc: RFC_B, descripcion, supplierName: NAME_B },
    ],
    `prod-${name}`,
  );
}

const INVOICES: ParsedInvoice[] = [
  // Sugar: product key, 2 stores, B is 10 / kg and A is 20 / kg.
  line(RFC_A, NAME_A, "2025-01-10T10:00:00", SUGAR, "50161800", "1", "20.00"),
  line(RFC_B, NAME_B, "2025-01-11T10:00:00", SUGAR, "50161800", "1", "10.00"),
  // Ads: service key only, 2 stores: would add a saving if it were compared.
  line(RFC_A, NAME_A, "2025-01-12T10:00:00", ADS, "84111506", "1", "300.00"),
  line(RFC_B, NAME_B, "2025-01-13T10:00:00", ADS, "84111506", "1", "100.00"),
  // Mixed: a service key in January and a product key in February.
  line(RFC_A, NAME_A, "2025-01-14T10:00:00", MIXED, "84111506", "1", "50.00"),
  line(RFC_B, NAME_B, "2025-02-14T10:00:00", MIXED, "50302700", "1", "40.00"),
];

function load(invoices: readonly ParsedInvoice[]): void {
  act(() => {
    const store = useSessionStore.getState();
    store.applyBatch(
      invoices.map((invoice) => ({
        kind: "parsed" as const,
        file: { name: `${invoice.uuid}.xml`, path: `${invoice.uuid}.xml` },
        result: { ok: true as const, invoice },
      })),
      store.generation,
    );
  });
}

function setOverrides(priceOverrides: PriceOverride[]): void {
  act(() => {
    useSettingsStore.setState({ priceOverrides });
  });
}

beforeEach(() => {
  window.localStorage.clear();
  resetSettingsStore();
  act(() => {
    useSettingsStore.setState({
      ...defaultSettings(),
      products: [
        productOf("Azúcar", SUGAR),
        productOf("Ads", ADS),
        productOf("Mixto", MIXED),
      ],
    });
  });
  load(INVOICES);
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  act(() => {
    useSessionStore.getState().clearAll();
  });
  resetSettingsStore();
});

describe("usePricesView comparability (D-16, D-17, D-18, D-22, D-31)", () => {
  it("a product with only service keys is not comparable by default and is counted as hidden", () => {
    const { result } = renderHook(() => usePricesView());
    const ads = result.current.comparability.get("prod-Ads");
    expect(ads).toEqual({ comparable: false, byUser: false, defaultComparable: false });
    expect(result.current.comparability.get("prod-Azúcar")?.comparable).toBe(true);
    expect(result.current.comparability.get("prod-Mixto")?.comparable).toBe(true);
    expect(result.current.hiddenCount).toBe(1);
    // rows keeps every row with purchases
    expect(result.current.rows.map((row) => row.productId)).toEqual([
      "prod-Azúcar",
      "prod-Ads",
      "prod-Mixto",
    ]);
  });

  it("the savings card counts comparable products only", () => {
    const { result } = renderHook(() => usePricesView());
    const comparable = result.current.rows.filter(
      (row) => result.current.comparability.get(row.productId)?.comparable === true,
    );
    expect(comparable.map((row) => row.productId)).toEqual(["prod-Azúcar", "prod-Mixto"]);
    // Sugar: A buys at 20 and B at 10: the saving is 10. Mixed: A 50, B 40: the saving is 10.
    // Ads would add 200 if it were counted.
    expect(result.current.summary.products).toBe(2);
    expect(result.current.summary.total.toString()).toBe("20");
  });

  it("an override marks a default-comparable product as hidden and counts it", () => {
    setOverrides([{ productId: "prod-Azúcar", comparable: false }]);
    const { result } = renderHook(() => usePricesView());
    expect(result.current.comparability.get("prod-Azúcar")).toEqual({
      comparable: false,
      byUser: true,
      defaultComparable: true,
    });
    expect(result.current.hiddenCount).toBe(2);
    expect(result.current.summary.products).toBe(1);
    expect(result.current.summary.total.toString()).toBe("10");
  });

  it("an override comparable:true brings a default-hidden product into the summary", () => {
    setOverrides([{ productId: "prod-Ads", comparable: true }]);
    const { result } = renderHook(() => usePricesView());
    expect(result.current.comparability.get("prod-Ads")).toEqual({
      comparable: true,
      byUser: true,
      defaultComparable: false,
    });
    expect(result.current.hiddenCount).toBe(0);
    expect(result.current.summary.products).toBe(3);
    expect(result.current.summary.total.toString()).toBe("220");
  });

  it("hiddenCount ignores hidden products without purchases within the filters", () => {
    const { result } = renderHook(() => usePricesView());
    expect(result.current.hiddenCount).toBe(1);
    act(() => {
      useSessionStore.getState().setRange({ from: "2025-02", to: "2025-02" });
    });
    // February holds only the product-keyed purchase of Mixto.
    expect(result.current.hiddenCount).toBe(0);
    expect(result.current.rows.map((row) => row.productId)).toEqual(["prod-Mixto"]);
  });

  it("a date filter never changes the default (D-31)", () => {
    const { result } = renderHook(() => usePricesView());
    act(() => {
      useSessionStore.getState().setRange({ from: "2025-01", to: "2025-01" });
    });
    // In January Mixto only has its service-keyed purchase, yet its default stays comparable
    // because the February purchase counts for the default.
    expect(result.current.rows.map((row) => row.productId)).toContain("prod-Mixto");
    expect(result.current.comparability.get("prod-Mixto")).toEqual({
      comparable: true,
      byUser: false,
      defaultComparable: true,
    });
    expect(result.current.hiddenCount).toBe(1);
  });
});

describe("usePricesView content corrections (D-13, D-15, D-28)", () => {
  const EGGS = "HUEVO BLANCO";

  function pieces(
    rfc: string,
    nombre: string,
    fecha: string,
    cantidad: string,
    importe: string,
  ): ParsedInvoice {
    const base = concept(EGGS, "50131600", cantidad, importe);
    return makeInvoice({
      fecha,
      emisor: { rfc, nombre },
      conceptos: [{ ...base, claveUnidad: "H87", unidad: "Pieza" }],
      subTotal: importe,
      total: importe,
      totalImpuestosTrasladados: null,
    });
  }

  beforeEach(() => {
    act(() => {
      const { products } = useSettingsStore.getState();
      useSettingsStore.setState({ products: [...products, productOf("Huevo", EGGS)] });
    });
    load([
      pieces(RFC_A, NAME_A, "2025-01-10T10:00:00", "1", "60.00"),
      pieces(RFC_B, NAME_B, "2025-02-10T10:00:00", "1", "50.00"),
    ]);
  });

  function correct(rfc: string, amount: string): void {
    act(() => {
      useSettingsStore.getState().setContentCorrection({
        rfc,
        key: "huevo blanco",
        description: EGGS,
        supplierName: "Tienda",
        packs: 1,
        amount,
        unit: "piezas",
      });
    });
  }

  function eggRow(rows: ReturnType<typeof usePricesView>["rows"]) {
    return rows.find((row) => row.productId === "prod-Huevo");
  }

  it("without corrections the product is compared per piece, without a verified size", () => {
    const { result } = renderHook(() => usePricesView());
    expect(eggRow(result.current.rows)?.perPiece).toBe(true);
    expect(eggRow(result.current.rows)?.cheapest?.name).toBe(NAME_B);
  });

  it("saving a correction recomputes the rows at once (D-28)", () => {
    const { result } = renderHook(() => usePricesView());
    correct(RFC_A, "10");
    const row = eggRow(result.current.rows);
    expect(row?.perPiece).toBe(false);
    // Only the corrected member stays compared; the unsized one is set aside.
    expect(row?.stores.map((store) => store.name)).toEqual([NAME_A]);
    expect(row?.cheapest).toBeNull();
    correct(RFC_B, "10");
    const both = eggRow(result.current.rows);
    expect(both?.stores.map((store) => store.name)).toEqual([NAME_B, NAME_A]);
    expect(both?.cheapest?.name).toBe(NAME_B);
    expect(both?.saving?.toString()).toBe("10");
  });

  it("the unfiltered view uses the corrections too, so a date filter keeps the same store slots", () => {
    const { result } = renderHook(() => usePricesView());
    correct(RFC_A, "10");
    expect([...(result.current.historySlots.get("prod-Huevo")?.keys() ?? [])]).toEqual([RFC_A]);
    act(() => {
      useSessionStore.getState().setRange({ from: "2025-02", to: "2025-02" });
    });
    expect([...(result.current.historySlots.get("prod-Huevo")?.keys() ?? [])]).toEqual([RFC_A]);
  });

  it("removing the correction brings back the per-piece comparison", () => {
    const { result } = renderHook(() => usePricesView());
    correct(RFC_A, "10");
    act(() => {
      useSettingsStore.getState().removeContentCorrection(RFC_A, "huevo blanco");
    });
    expect(eggRow(result.current.rows)?.perPiece).toBe(true);
  });
});
