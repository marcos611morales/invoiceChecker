// @vitest-environment jsdom
import Big from "big.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { CategoryRow } from "@/domain/accounting/categories";
import { CategorySpend } from "./CategorySpend";

interface RowOptions {
  /** Fraction as a decimal string, or null for "no comparable month". */
  variation?: string | null;
  pct?: string | null;
}

function row(category: string, net: string, options: RowOptions = {}): CategoryRow {
  const { variation = null, pct = "0.5" } = options;
  return {
    category,
    net: new Big(net),
    pct: pct === null ? null : new Big(pct),
    promedio: new Big(net).div(new Big("12")),
    variation: variation === null ? null : new Big(variation),
  };
}

const nameOf = (key: string): string => (key === "sin-categoria" ? "Sin categoría" : key);
const PAIR = { last: "2025-12", previous: "2025-11" };

function renderBlock(
  rows: readonly CategoryRow[],
  overrides: {
    months?: number;
    variationMonths?: { last: string; previous: string } | null;
    showHint?: boolean;
    onGoToCategories?: () => void;
  } = {},
) {
  return render(
    <CategorySpend
      rows={rows}
      months={overrides.months ?? 12}
      variationMonths={overrides.variationMonths === undefined ? PAIR : overrides.variationMonths}
      nameOf={nameOf}
      showHint={overrides.showHint ?? false}
      onGoToCategories={overrides.onGoToCategories ?? (() => {})}
    />,
  );
}

afterEach(() => {
  cleanup();
});

describe("CategorySpend: variation per row (DASH-07, D-17)", () => {
  it("shows an increase in the foreground color with an up arrow, the plus sign and 'subió'", () => {
    renderBlock([row("Limpieza", "250.00", { variation: "0.25" })]);
    const delta = screen.getByTestId("category-delta-0-delta");
    expect(delta).toHaveTextContent("+25.0 % vs. nov 2025");
    expect(within(delta).getByText("subió", { exact: false }).className).toContain("sr-only");
    expect(delta.className).toContain("text-foreground");
    expect(delta.className).not.toContain("text-positive");
    expect(delta.querySelector("svg")?.getAttribute("class") ?? "").toContain("lucide-arrow-up");
  });

  it("shows a decrease in the positive color with a down arrow, a true minus and 'bajó'", () => {
    renderBlock([row("Limpieza", "200.00", { variation: "-0.2" })]);
    const delta = screen.getByTestId("category-delta-0-delta");
    expect(delta).toHaveTextContent("−20.0 % vs. nov 2025");
    expect(within(delta).getByText("bajó", { exact: false }).className).toContain("sr-only");
    expect(delta.className).toContain("text-positive");
    expect(delta.querySelector("svg")?.getAttribute("class") ?? "").toContain("lucide-arrow-down");
  });

  it("shows an equal amount as 0.0 % in neutral without a stated direction", () => {
    renderBlock([row("Limpieza", "200.00", { variation: "0" })]);
    const delta = screen.getByTestId("category-delta-0-delta");
    expect(delta).toHaveTextContent("0.0 % vs. nov 2025");
    expect(delta).not.toHaveTextContent("subió");
    expect(delta).not.toHaveTextContent("bajó");
    expect(delta.querySelector("svg")).toBeNull();
    expect(delta.className).not.toContain("text-positive");
  });

  it("shows 'Sin dato del mes anterior' muted for a null variation, with no percent and no arrow", () => {
    renderBlock([row("Limpieza", "200.00", { variation: null })]);
    const delta = screen.getByTestId("category-delta-0-delta");
    expect(delta).toHaveTextContent("Sin dato del mes anterior");
    expect(delta.className).toContain("text-muted-foreground");
    expect(delta.querySelector("svg")).toBeNull();
    expect(delta).not.toHaveTextContent("%");
  });

  it("keeps the caption and the variation as siblings of the third line", () => {
    renderBlock([row("Limpieza", "250.00", { variation: "0.25" })]);
    const item = screen.getAllByRole("listitem")[0];
    if (item === undefined) throw new Error("no row");
    expect(within(item).getByText(/50\.0 % del total · Promedio mensual \$20\.83$/)).toBeInTheDocument();
    expect(within(item).getByTestId("category-delta-0-delta")).toBeInTheDocument();
  });
});

describe("CategorySpend: sub-caption (DASH-05, D-16)", () => {
  it("states the calendar months of the divisor and the pair of months of the variation", () => {
    renderBlock([row("Limpieza", "250.00")]);
    expect(
      screen.getByText(
        "Promedio mensual entre 12 meses del calendario · Variación: dic 2025 vs. nov 2025",
      ),
    ).toBeInTheDocument();
  });

  it("uses the singular and a previous month outside the range for a one-month range", () => {
    renderBlock([row("Limpieza", "250.00")], {
      months: 1,
      variationMonths: { last: "2025-01", previous: "2024-12" },
    });
    expect(
      screen.getByText(
        "Promedio mensual entre 1 mes del calendario · Variación: ene 2025 vs. dic 2024",
      ),
    ).toBeInTheDocument();
  });

  it("keeps only the average part when there is no variation pair", () => {
    renderBlock([row("Limpieza", "250.00")], { variationMonths: null });
    expect(screen.getByText("Promedio mensual entre 12 meses del calendario")).toBeInTheDocument();
  });
});

describe("CategorySpend: nothing classified yet (E6 empty)", () => {
  it("shows the hint Alert and the link button above the single Sin categoría row", () => {
    const go = vi.fn();
    renderBlock([row("sin-categoria", "250.00", { pct: "1" })], { showHint: true, onGoToCategories: go });
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(
      "Todavía no clasificaste ningún proveedor ni concepto. Asigna categorías en la pestaña Categorías.",
    );
    fireEvent.click(within(alert).getByRole("button", { name: "Ir a Categorías" }));
    expect(go).toHaveBeenCalledTimes(1);
    const list = screen.getByRole("list", { name: "Gasto por categoría" });
    expect(alert.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(list).getAllByRole("listitem")).toHaveLength(1);
  });

  it("shows no hint once something is classified", () => {
    renderBlock([row("sin-categoria", "250.00", { pct: "1" })], { showHint: false });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("button", { name: "Ir a Categorías" })).toBeNull();
  });
});

describe("CategorySpend: rows (E6 populated, partial, overflow)", () => {
  it("lists twenty categories with spend, with no 'Ver todas'", () => {
    const rows = Array.from({ length: 20 }, (_, index) => row(`Categoría ${String(index + 1)}`, `${String(200 - index)}.00`));
    renderBlock(rows);
    expect(screen.getAllByRole("listitem")).toHaveLength(20);
    expect(screen.queryByText(/Ver todas/)).toBeNull();
    expect(screen.queryByRole("button", { name: /Ver todo/ })).toBeNull();
  });

  it("gives a zero net no fill and a negative net the tick with its caption", () => {
    renderBlock([
      row("Positiva", "100.00", { variation: "0.1" }),
      row("Cero", "0.00", { variation: null, pct: "0" }),
      row("Negativa", "-30.00", { variation: null, pct: null }),
    ]);
    const items = screen.getAllByRole("listitem");
    const [positive, zero, negative] = items;
    if (positive === undefined || zero === undefined || negative === undefined) throw new Error("rows");
    expect(within(positive).getByTestId("category-fill")).toBeInTheDocument();
    expect(within(zero).queryByTestId("category-fill")).toBeNull();
    expect(within(zero).queryByTestId("category-tick")).toBeNull();
    expect(within(negative).getByTestId("category-tick")).toBeInTheDocument();
    expect(
      within(negative).getByText("Neto negativo: las notas de crédito superan las compras"),
    ).toBeInTheDocument();
  });

  it("renders a category name as text, never as markup", () => {
    renderBlock([row("<img src=x onerror=alert(1)>", "100.00")]);
    expect(screen.getByText("<img src=x onerror=alert(1)>")).toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
  });
});
