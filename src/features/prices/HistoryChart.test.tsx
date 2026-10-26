// @vitest-environment jsdom
import Big from "big.js";
import { cloneElement, isValidElement, type ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { compareProduct, type ProductComparison } from "@/domain/prices/compare";
import { assignSlots, historySeries } from "@/domain/prices/history";
import type { Purchase } from "@/domain/prices/purchases";
import { makeProduct } from "../../../tests/support/pricesFactory";
import {
  HistoryChart,
  HistoryTooltip,
  historyChartConfig,
  historyDatum,
  isHistoryDatum,
} from "./HistoryChart";
import { ProductDetail } from "./ProductDetail";

interface Size {
  width?: number;
  height?: number;
}

// jsdom measures every element as 0 px, so the responsive container would draw nothing. A fixed
// size lets recharts draw the real SVG; the geometry itself is checked in a browser by Plan 05-12.
vi.mock("recharts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("recharts")>();
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: ReactElement<Size> }) =>
      isValidElement(children) ? cloneElement(children, { width: 640, height: 288 }) : null,
  };
});

const PRODUCT = makeProduct("Leche entera", [
  { rfc: "AAA010101AAA", descripcion: "LECHE", supplierName: "x" },
]);

let sequence = 0;

interface Buy {
  unidad?: string;
  cantidad?: string;
  amount?: string | null;
  fecha?: string;
  folio?: string | null;
}

function buy(rfc: string, name: string, options: Buy = {}): Purchase {
  sequence += 1;
  const amount = options.amount === undefined ? "10.00" : options.amount;
  return {
    productId: PRODUCT.id,
    productName: PRODUCT.name,
    storeRfc: rfc,
    storeName: name,
    memberKey: `${rfc}\u0000leche`,
    descripcion: "LECHE",
    claveProdServ: "50161800",
    claveUnidad: options.unidad ?? "KGM",
    cantidad: options.cantidad ?? "1",
    fecha: options.fecha ?? "2025-01-15T10:00:00",
    folio: options.folio === undefined ? null : options.folio,
    uuid: `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
    conceptIndex: 0,
    amount: amount === null ? null : new Big(amount),
  };
}

/** `n` stores named «Tienda A», «Tienda B»… each with one purchase, a month apart. */
function manyStores(n: number): ProductComparison {
  const purchases = Array.from({ length: n }, (_, index) =>
    buy(
      `RFC${String(index)}`,
      `Tienda ${String.fromCharCode(65 + index)}`,
      { fecha: `2025-${String(index + 1).padStart(2, "0")}-10T10:00:00`, amount: String(10 + index) },
    ),
  );
  return compareProduct(PRODUCT, purchases);
}

function renderChart(row: ProductComparison) {
  return render(<HistoryChart row={row} slots={assignSlots(row.stores)} />);
}

afterEach(() => {
  cleanup();
});

describe("HistoryChart: legend and accessible name (E7 long-text, PREC-06)", () => {
  it("lists six stores and the folded one, each with a glyph", () => {
    const row = manyStores(7);
    renderChart(row);
    const items = screen.getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "Tienda A",
      "Tienda B",
      "Tienda C",
      "Tienda D",
      "Tienda E",
      "Tienda F",
      "Otras tiendas (1)",
    ]);
    for (const item of items) expect(item.querySelector("svg")).not.toBeNull();
  });

  it("names the product and the first and last dates on the image wrapper", () => {
    renderChart(manyStores(3));
    expect(
      screen.getByRole("img", {
        name: "Historial de precios de Leche entera: una línea por tienda, del 10 de enero de 2025 al 10 de marzo de 2025. La tabla de compras de abajo tiene los mismos datos.",
      }),
    ).toBeInTheDocument();
  });

  it("keeps long store names as wrapping text in the legend", () => {
    const long = "Distribuidora de abarrotes y productos del campo de la región norte sociedad anónima";
    const row = compareProduct(PRODUCT, [buy("AAA010101AAA", long)]);
    renderChart(row);
    const item = screen.getByText(long);
    expect(item.className).toContain("wrap-break-word");
  });

  it("shows the unit of the price as the Y axis title", () => {
    renderChart(manyStores(2));
    expect(screen.getByText("$/kg")).toBeInTheDocument();
  });
});

describe("HistoryChart: captions (E7 empty and partial)", () => {
  it("states that the history starts at the second purchase when only one is plotted", () => {
    renderChart(compareProduct(PRODUCT, [buy("AAA010101AAA", "Tienda A")]));
    expect(
      screen.getByText(
        "Hay una sola compra normalizada de este producto. El historial aparece desde la segunda.",
      ),
    ).toBeInTheDocument();
  });

  it("does not show the single-purchase sentence with two plotted purchases", () => {
    renderChart(manyStores(2));
    expect(screen.queryByText(/Hay una sola compra normalizada/)).toBeNull();
  });

  it("counts the purchases left out because they are not normalized", () => {
    const row = compareProduct(PRODUCT, [
      buy("AAA010101AAA", "Tienda A"),
      buy("AAA010101AAA", "Tienda A", { fecha: "2025-02-10T10:00:00" }),
      buy("AAA010101AAA", "Tienda A", { unidad: "MTR" }),
      buy("AAA010101AAA", "Tienda A", { amount: "0" }),
    ]);
    renderChart(row);
    expect(
      screen.getByText("2 compras no aparecen en la gráfica porque no están normalizadas."),
    ).toBeInTheDocument();
  });

  it("uses the singular for one purchase left out", () => {
    const row = compareProduct(PRODUCT, [
      buy("AAA010101AAA", "Tienda A"),
      buy("AAA010101AAA", "Tienda A", { fecha: "2025-02-10T10:00:00" }),
      buy("AAA010101AAA", "Tienda A", { unidad: "MTR" }),
    ]);
    renderChart(row);
    expect(
      screen.getByText("1 compra no aparece en la gráfica porque no está normalizada."),
    ).toBeInTheDocument();
  });
});

describe("HistoryChart: nothing to plot (E6 + E7 empty)", () => {
  const unnormalized = () => compareProduct(PRODUCT, [buy("AAA010101AAA", "Tienda A", { unidad: "MTR" })]);

  it("renders no chart for a product with zero normalized purchases", () => {
    const { container } = renderChart(unnormalized());
    expect(container).toBeEmptyDOMElement();
  });

  it("shows no history section in the product panel for it", () => {
    render(<ProductDetail row={unnormalized()} />);
    expect(screen.queryByText("Historial de precios")).toBeNull();
    expect(screen.queryByRole("img")).toBeNull();
  });
});

describe("HistoryChart: product panel wiring", () => {
  it("shows the section between the per-store table and the purchases", () => {
    const row = manyStores(2);
    render(<ProductDetail row={row} slots={assignSlots(row.stores)} />);
    const headings = screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent);
    expect(headings).toEqual(["Precios por tienda", "Historial de precios", "Compras"]);
  });
});

describe("HistoryChart: ScatterChart with a joined line per store (D-33)", () => {
  it("draws one Scatter per series, a line for the colored ones only and no LineChart", () => {
    const { container } = renderChart(manyStores(7));
    expect(container.querySelectorAll(".recharts-scatter")).toHaveLength(7);
    // Six colored series with a single point each draw no segment, so give them two points below.
    expect(container.querySelector(".recharts-line")).toBeNull();
  });

  it("joins the purchases of a store and leaves the folded series without a line", () => {
    const purchases: Purchase[] = [];
    for (let index = 0; index < 7; index += 1) {
      const rfc = `RFC${String(index)}`;
      const name = `Tienda ${String.fromCharCode(65 + index)}`;
      purchases.push(buy(rfc, name, { fecha: "2025-01-10T10:00:00", amount: "10" }));
      purchases.push(buy(rfc, name, { fecha: "2025-03-10T10:00:00", amount: "12" }));
    }
    const row = compareProduct(PRODUCT, purchases);
    const { container } = renderChart(row);
    expect(container.querySelectorAll(".recharts-scatter-line")).toHaveLength(6);
    // One transparent 24 px hit circle per plotted purchase: a tooltip per purchase, never per date.
    expect(container.querySelectorAll('circle[r="12"]')).toHaveLength(14);
  });
});

describe("HistoryChart: tooltip per purchase (D-33)", () => {
  it("shows the tooltip of the purchase under the pointer, naming its store", () => {
    const row = compareProduct(PRODUCT, [
      buy("AAA010101AAA", "Tienda A", {
        fecha: "2025-05-28T17:38:18",
        cantidad: "2",
        amount: "100",
        folio: "A-1",
      }),
      buy("BBB010101BBB", "Tienda B", {
        fecha: "2025-05-28T18:00:00",
        cantidad: "1",
        amount: "60",
        folio: "B-7",
      }),
    ]);
    const { container } = renderChart(row);
    const symbols = container.querySelectorAll(".recharts-scatter-symbol");
    expect(symbols).toHaveLength(2);
    const second = symbols[1];
    if (second === undefined) throw new Error("no marker");
    fireEvent.mouseEnter(second);
    // The store name is in the legend and, now, in the tooltip too.
    expect(screen.getAllByText("Tienda B")).toHaveLength(2);
    expect(screen.getAllByText("Tienda A")).toHaveLength(1);
    expect(screen.getByText("28 de mayo de 2025")).toBeInTheDocument();
    expect(screen.getByText("$60.00 / kg")).toBeInTheDocument();
    expect(screen.getByText("Contenido: 1 kg")).toBeInTheDocument();
    expect(screen.getByText("Folio: B-7")).toBeInTheDocument();
    expect(screen.queryByText("Folio: A-1")).toBeNull();
  });
});

describe("HistoryChart: static chart config (T-02-19, T-05-17)", () => {
  it("has exactly the keys tienda1..tienda6 and otras", () => {
    expect(Object.keys(historyChartConfig)).toEqual([
      "tienda1",
      "tienda2",
      "tienda3",
      "tienda4",
      "tienda5",
      "tienda6",
      "otras",
    ]);
  });

  it("never writes a store name into the injected style block", () => {
    const hostile = 'Tienda </style><script>alert("x")</script> --color-x: red';
    const row = compareProduct(PRODUCT, [buy("AAA010101AAA", hostile)]);
    const { container } = renderChart(row);
    const css = container.querySelector("style")?.textContent ?? "";
    expect(css).toContain("--color-tienda1: var(--series-1);");
    expect(css).toContain("--color-tienda6: var(--series-6);");
    expect(css).toContain("--color-otras: var(--chart-1);");
    expect(css).not.toContain("Tienda");
    expect(css).not.toContain("<");
    expect(container.querySelectorAll("style")).toHaveLength(1);
    // The name is still readable in the legend as text.
    expect(screen.getByText(hostile)).toBeInTheDocument();
  });
});

describe("HistoryTooltip (D-33)", () => {
  function datumOf() {
    const row = compareProduct(PRODUCT, [
      buy("AAA010101AAA", "Tienda A", {
        fecha: "2025-05-28T17:38:18",
        cantidad: "2",
        amount: "100",
        folio: "A-1",
      }),
    ]);
    const point = historySeries(row, assignSlots(row.stores)).series[0]?.points[0];
    if (point === undefined) throw new Error("no point");
    return historyDatum(point);
  }

  it("shows the long date, the store, the unit price, the content and the folio", () => {
    const { container } = render(<HistoryTooltip active payload={[{ payload: datumOf() }]} />);
    expect(screen.getByText("28 de mayo de 2025")).toBeInTheDocument();
    expect(screen.getByText("Tienda A")).toBeInTheDocument();
    expect(screen.getByText("$50.00 / kg")).toBeInTheDocument();
    expect(screen.getByText("Contenido: 2 kg")).toBeInTheDocument();
    expect(screen.getByText("Folio: A-1")).toBeInTheDocument();
    expect(within(container).getAllByText(/./)).toHaveLength(5);
  });

  it("writes a dash when the invoice has no folio", () => {
    const row = compareProduct(PRODUCT, [buy("AAA010101AAA", "Tienda A")]);
    const point = historySeries(row, assignSlots(row.stores)).series[0]?.points[0];
    if (point === undefined) throw new Error("no point");
    render(<HistoryTooltip active payload={[{ payload: historyDatum(point) }]} />);
    expect(screen.getByText("Folio: —")).toBeInTheDocument();
  });

  it("renders nothing for an unexpected payload", () => {
    const cases: (readonly unknown[] | undefined)[] = [
      undefined,
      [],
      [null],
      [{}],
      [{ payload: "x" }],
      [{ payload: { x: 1, y: 2 } }],
      [{ payload: { ...datumOf(), slot: "tienda9" } }],
      [{ payload: { ...datumOf(), folioText: 7 } }],
    ];
    for (const payload of cases) {
      const { container, unmount } = render(<HistoryTooltip active payload={payload} />);
      expect(container).toBeEmptyDOMElement();
      unmount();
    }
  });

  it("renders nothing while it is not active", () => {
    const { container } = render(<HistoryTooltip active={false} payload={[{ payload: datumOf() }]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("guards the datum shape", () => {
    expect(isHistoryDatum(datumOf())).toBe(true);
    expect(isHistoryDatum(null)).toBe(false);
    expect(isHistoryDatum({ ...datumOf(), x: "1" })).toBe(false);
  });
});
