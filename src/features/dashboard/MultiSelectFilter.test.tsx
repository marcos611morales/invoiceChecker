// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { FilterOption } from "@/domain/accounting/filters";
import { noFormaMatch, noSupplierMatch } from "@/lib/copy/messages";
import "../../../tests/support/domPolyfills";
import { MultiSelectFilter } from "./MultiSelectFilter";

afterEach(cleanup);

const OPTIONS: readonly FilterOption[] = [
  { key: "AAA010101AAA", label: "Abarrotes del Sur", count: 12 },
  { key: "BBB010101BBB", label: "Café Árbol", count: 5 },
  { key: "CCC010101CCC", label: "Papelería López", count: 5 },
  { key: "DDD010101DDD", label: "Zeta", count: 1 },
];

interface Harness {
  onChange: ReturnType<typeof vi.fn<(next: ReadonlySet<string>) => void>>;
  rerender: (selected: ReadonlySet<string>) => void;
}

function renderFilter(
  options: readonly FilterOption[] = OPTIONS,
  selected: ReadonlySet<string> = new Set<string>(),
): Harness {
  const onChange = vi.fn<(next: ReadonlySet<string>) => void>();
  const element = (current: ReadonlySet<string>) => (
    <MultiSelectFilter
      label="Proveedor"
      options={options}
      selected={current}
      onChange={onChange}
      searchPlaceholder="Buscar proveedor"
      clearLabel="Limpiar proveedores"
      noMatch={noSupplierMatch}
      widthClass="w-[360px]"
    />
  );
  const view = render(element(selected));
  return { onChange, rerender: (next) => view.rerender(element(next)) };
}

function openPopover(): void {
  fireEvent.click(screen.getByRole("button", { name: /^Proveedor/ }));
}

function rowTexts(): string[] {
  return screen.getAllByRole("option").map((row) => row.textContent ?? "");
}

function search(text: string): void {
  fireEvent.change(screen.getByPlaceholderText("Buscar proveedor"), {
    target: { value: text },
  });
}

describe("MultiSelectFilter rows", () => {
  it("shows every option as '{nombre} ({n})' in the order it was given", () => {
    renderFilter();
    openPopover();
    expect(rowTexts()).toEqual([
      "Abarrotes del Sur (12)",
      "Café Árbol (5)",
      "Papelería López (5)",
      "Zeta (1)",
    ]);
  });

  it("marks each selected option as checked and no other", () => {
    renderFilter(OPTIONS, new Set(["BBB010101BBB"]));
    openPopover();
    const states = screen.getAllByRole("option").map((row) => row.getAttribute("aria-checked"));
    expect(states).toEqual(["false", "true", "false", "false"]);
    expect(screen.getByRole("listbox")).toHaveAttribute("aria-multiselectable", "true");
  });

  it("keeps checked rows where they are (they do not jump to the top)", () => {
    const harness = renderFilter();
    openPopover();
    const before = rowTexts();
    harness.rerender(new Set(["DDD010101DDD"]));
    expect(rowTexts()).toEqual(before);
  });
});

describe("MultiSelectFilter selection", () => {
  it("adds the key of a clicked row in a new Set", () => {
    const selected = new Set(["AAA010101AAA"]);
    const { onChange } = renderFilter(OPTIONS, selected);
    openPopover();
    fireEvent.click(screen.getByText("Café Árbol"));
    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0]?.[0];
    expect(next).not.toBe(selected);
    expect([...(next ?? [])].sort()).toEqual(["AAA010101AAA", "BBB010101BBB"]);
    // The previous Set is never mutated.
    expect([...selected]).toEqual(["AAA010101AAA"]);
  });

  it("removes the key of a row that is already selected", () => {
    const { onChange } = renderFilter(OPTIONS, new Set(["AAA010101AAA", "ZZZ"]));
    openPopover();
    fireEvent.click(screen.getByText("Abarrotes del Sur"));
    expect([...(onChange.mock.calls[0]?.[0] ?? [])]).toEqual(["ZZZ"]);
  });

  it("toggles when the whole row is clicked, not only the checkbox", () => {
    const { onChange } = renderFilter();
    openPopover();
    const row = screen.getAllByRole("option")[3];
    expect(row).toBeDefined();
    if (row === undefined) return;
    fireEvent.click(row);
    expect([...(onChange.mock.calls[0]?.[0] ?? [])]).toEqual(["DDD010101DDD"]);
  });

  it("toggles the highlighted row with Enter from the search box", () => {
    const { onChange } = renderFilter();
    openPopover();
    const input = screen.getByPlaceholderText("Buscar proveedor");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0].size).toBe(1);
  });

  it("clears with an empty Set from the footer button", () => {
    const { onChange } = renderFilter(OPTIONS, new Set(["AAA010101AAA"]));
    openPopover();
    fireEvent.click(screen.getByRole("button", { name: "Limpiar proveedores" }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0].size).toBe(0);
  });
});

describe("MultiSelectFilter search", () => {
  it("ignores accents and case in the label and keeps the data order", () => {
    renderFilter();
    openPopover();
    search("ARBOL");
    expect(rowTexts()).toEqual(["Café Árbol (5)"]);
    search("ar");
    expect(rowTexts()).toEqual(["Abarrotes del Sur (12)", "Café Árbol (5)"]);
    search("cafe");
    expect(rowTexts()).toEqual(["Café Árbol (5)"]);
  });

  it("shows the supplier no-match text and no rows", () => {
    renderFilter();
    openPopover();
    search("zzz");
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(
      screen.getByText("Ningún proveedor coincide con «zzz». Revisa la búsqueda."),
    ).toBeInTheDocument();
  });

  it("uses the noMatch prop, so the forma de pago text can be passed", () => {
    render(
      <MultiSelectFilter
        label="Forma de pago"
        options={[{ key: "03", label: "Transferencia electrónica de fondos", count: 4 }]}
        selected={new Set<string>()}
        onChange={() => {}}
        searchPlaceholder="Buscar forma de pago"
        clearLabel="Limpiar formas de pago"
        noMatch={noFormaMatch}
        widthClass="w-[320px]"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^Forma de pago/ }));
    fireEvent.change(screen.getByPlaceholderText("Buscar forma de pago"), {
      target: { value: "cheque" },
    });
    expect(
      screen.getByText("Ninguna forma de pago coincide con «cheque». Revisa la búsqueda."),
    ).toBeInTheDocument();
  });

  it("shows all rows again when the search is cleared", () => {
    renderFilter();
    openPopover();
    search("zzz");
    search("");
    expect(screen.getAllByRole("option")).toHaveLength(OPTIONS.length);
  });
});

describe("MultiSelectFilter with many options", () => {
  const MANY: FilterOption[] = Array.from({ length: 60 }, (_, index) => ({
    key: `RFC${String(index).padStart(9, "0")}`,
    label: `Proveedor ${String(index).padStart(3, "0")}`,
    count: 60 - index,
  }));

  it("lists all 60 rows inside a list capped at 288 px", () => {
    renderFilter(MANY);
    openPopover();
    expect(screen.getAllByRole("option")).toHaveLength(60);
    expect(screen.getByRole("listbox").className).toContain("max-h-72");
  });

  it("reaches any of the 60 suppliers by search", () => {
    renderFilter(MANY);
    openPopover();
    search("059");
    expect(rowTexts()).toEqual(["Proveedor 059 (1)"]);
  });
});

describe("MultiSelectFilter trigger", () => {
  it("shows only the label when nothing is selected", () => {
    renderFilter();
    expect(screen.getByRole("button", { name: /^Proveedor/ }).textContent).toBe("Proveedor");
  });

  it("shows a muted, truncated summary of the selected names", () => {
    renderFilter(OPTIONS, new Set(["AAA010101AAA", "BBB010101BBB"]));
    const trigger = screen.getByRole("button", { name: /^Proveedor/ });
    expect(trigger.textContent).toContain("Abarrotes del Sur, Café Árbol");
    const summary = within(trigger).getByText("Abarrotes del Sur, Café Árbol");
    expect(summary.className).toContain("truncate");
    expect(summary.className).toContain("max-w-[200px]");
    expect(summary.className).toContain("text-muted-foreground");
  });

  it("falls back to the key for a selected value no longer in the options", () => {
    renderFilter(OPTIONS, new Set(["GONE010101XXX"]));
    expect(screen.getByRole("button", { name: /^Proveedor/ }).textContent).toContain(
      "GONE010101XXX",
    );
  });

  it("is 36 px high and 44 px under 640 px", () => {
    renderFilter();
    const trigger = screen.getByRole("button", { name: /^Proveedor/ });
    expect(trigger.className).toContain("h-9");
    expect(trigger.className).toContain("max-sm:h-11");
  });

  it("closes with Escape and returns focus to the trigger", async () => {
    renderFilter();
    openPopover();
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    fireEvent.keyDown(screen.getByPlaceholderText("Buscar proveedor"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
  });
});

describe("MultiSelectFilter hostile text (T-02-15)", () => {
  it("renders markup in a supplier name as plain text", () => {
    const hostile = '<img src=x onerror="alert(1)">';
    renderFilter([{ key: "EVIL010101AAA", label: hostile, count: 1 }]);
    openPopover();
    expect(document.querySelector("img")).toBeNull();
    expect(rowTexts()).toEqual([`${hostile} (1)`]);
  });
});
