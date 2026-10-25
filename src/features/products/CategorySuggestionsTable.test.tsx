// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { cutText } from "@/domain/llm/candidates";
import type { CategorySuggestion } from "@/domain/llm/suggestions";
import { makeResolver } from "@/domain/settings/resolver";
import {
  LIMITS,
  SIN_CATEGORIA,
  type Category,
  type Product,
  type ProductMember,
} from "@/domain/settings/types";
import { useSettingsStore } from "@/stores/settingsStore";
import { useSuggestionsStore } from "@/stores/suggestionsStore";
import "../../../tests/support/domPolyfills";
import { resetSettingsStore } from "../../../tests/support/settingsStorage";
import { resetSuggestionsStore } from "../../../tests/support/suggestionsStorage";
import { CategorySuggestionsTable } from "./CategorySuggestionsTable";
import { ProductsTab } from "./ProductsTab";

interface ToastOptions {
  duration?: number;
  action?: { label: string; onClick: () => void };
}
const toastMock = vi.hoisted(() => vi.fn<(message: string, options?: ToastOptions) => void>());
vi.mock("sonner", () => ({ toast: toastMock }));

const UNO = { rfc: "AAA010101AAA", nombre: "Tienda Uno" };
const DOS = { rfc: "BBB020202BBB", nombre: "Tienda Dos" };
const ABARROTES = "seed:abarrotes-despensa";
const OTROS = "seed:otros";

function member(rfc: string, key: string, description: string): ProductMember {
  return { rfc, key, description, supplierName: "Tienda" };
}

const LECHE: Product = {
  id: "prod_leche",
  name: "Leche entera",
  categoryId: null,
  members: [
    member(UNO.rfc, "mm leche ent", "MM LECHE ENT"),
    member(DOS.rfc, "leche entera 1l", "LECHE ENTERA 1L"),
    member(DOS.rfc, "leche deslactosada", "LECHE DESLACTOSADA"),
  ],
};

const ROW_UNO: CategorySuggestion = {
  id: "cat_1",
  kind: "supplier",
  rfc: UNO.rfc,
  name: UNO.nombre,
  choice: { kind: "existing", categoryId: ABARROTES },
};
const ROW_DOS: CategorySuggestion = {
  id: "cat_2",
  kind: "supplier",
  rfc: DOS.rfc,
  name: DOS.nombre,
  choice: { kind: "new", name: "Bebidas" },
};
const ROW_LECHE: CategorySuggestion = {
  id: "cat_3",
  kind: "product",
  productId: LECHE.id,
  name: LECHE.name,
  choice: { kind: "new", name: "Bebidas" },
};

const announced: string[] = [];
const emptied = vi.fn<() => void>();

/** The table the way the tab mounts it: from the queue store, and not at all without rows. */
function Harness() {
  const rows = useSuggestionsStore((s) => s.categories);
  if (rows.length === 0) return null;
  return (
    <CategorySuggestionsTable
      rows={rows}
      onAnnounce={(text) => announced.push(text)}
      onEmptied={emptied}
    />
  );
}

function seed(rows: readonly CategorySuggestion[], products: readonly Product[] = [LECHE]): void {
  act(() => {
    useSettingsStore.setState({ products: [...products] });
    useSuggestionsStore.setState({ categories: [...rows] });
  });
}

function storedCategories(): Category[] {
  return useSettingsStore.getState().categories;
}

function selectOf(name: string): HTMLElement {
  return screen.getByRole("combobox", { name: `Categoría sugerida para ${name}` });
}

function rowOf(name: string): HTMLElement {
  const row = selectOf(name).closest("tr");
  if (row === null) throw new Error(`no row for ${name}`);
  return row;
}

function acceptButton(name: string): HTMLElement {
  return screen.getByRole("button", { name: `Aceptar la sugerencia «${name}»` });
}

function rejectButton(name: string): HTMLElement {
  return screen.getByRole("button", { name: `Rechazar la sugerencia «${name}»` });
}

function optionTexts(): string[] {
  return screen.getAllByRole("option").map((option) => option.textContent);
}

function choose(name: string, optionText: string): void {
  fireEvent.click(selectOf(name));
  const option = screen.getByRole("option", { name: optionText });
  // Base UI commits a mouse selection only when the pointer went down on the item.
  fireEvent.pointerDown(option);
  fireEvent.click(option);
}

function press(button: HTMLElement): void {
  fireEvent.click(button);
}

/** The last call of the toast with this message: its options, or fail. */
function toastOptions(message: string): ToastOptions {
  for (let index = toastMock.mock.calls.length - 1; index >= 0; index -= 1) {
    const [text, options] = toastMock.mock.calls[index] ?? [];
    if (text === message) return options ?? {};
  }
  throw new Error(`no toast «${message}»`);
}

function categoryOfLine(rfc: string, description: string): string {
  return makeResolver(useSettingsStore.getState()).resolve(rfc, description);
}

beforeEach(() => {
  toastMock.mockClear();
  announced.length = 0;
  emptied.mockClear();
  window.localStorage.clear();
  resetSuggestionsStore();
  resetSettingsStore();
});

afterEach(async () => {
  // The bulk action asks the tab for the focus on a zero-delay timer: let it fire in its own test.
  await new Promise<void>((resolve) => {
    window.setTimeout(resolve, 0);
  });
  cleanup();
  window.localStorage.clear();
  resetSuggestionsStore();
  resetSettingsStore();
});

describe("the table and its rows (D-23, E5 populated)", () => {
  it("shows the heading with the count, the intro, the column headers and the 760px table", () => {
    seed([ROW_UNO, ROW_DOS, ROW_LECHE]);
    render(<Harness />);
    const heading = screen.getByRole("heading", { name: "Sugerencias de categoría · 3" });
    expect(heading).toHaveAttribute("tabindex", "-1");
    expect(
      screen.getByText(
        "DeepSeek propone una categoría para cada proveedor y producto que aún no tiene. Puedes cambiarla antes de aceptar.",
      ),
    ).toBeInTheDocument();
    for (const header of ["Tipo", "Nombre", "Categoría sugerida", "Acciones"]) {
      expect(screen.getByRole("columnheader", { name: header })).toBeInTheDocument();
    }
    expect(screen.getByRole("table").className).toContain("min-w-[760px]");
  });

  it("is not rendered without rows", () => {
    seed([]);
    render(<Harness />);
    expect(screen.queryByRole("heading", { name: /Sugerencias de categoría/ })).toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("gives each row its type Badge, its name and a Select named after it", () => {
    seed([ROW_UNO, ROW_LECHE]);
    render(<Harness />);
    expect(within(rowOf("Tienda Uno")).getByText("Proveedor")).toBeInTheDocument();
    expect(within(rowOf("Leche entera")).getByText("Producto")).toBeInTheDocument();
    expect(within(rowOf("Tienda Uno")).getByText("Tienda Uno")).toBeInTheDocument();
    expect(acceptButton("Tienda Uno")).toHaveTextContent("Aceptar");
    expect(rejectButton("Tienda Uno")).toHaveTextContent("Rechazar");
  });

  it("preselects an existing suggested category", () => {
    seed([ROW_UNO]);
    render(<Harness />);
    expect(selectOf("Tienda Uno")).toHaveTextContent("Abarrotes y despensa");
  });

  it("preselects «Nueva: {nombre}» for a new one, and lists it first, then the user's categories, without «Sin categoría»", () => {
    seed([ROW_DOS]);
    render(<Harness />);
    expect(selectOf("Tienda Dos")).toHaveTextContent("Nueva: Bebidas");
    fireEvent.click(selectOf("Tienda Dos"));
    const texts = optionTexts();
    expect(texts[0]).toBe("Nueva: Bebidas");
    expect(texts).toHaveLength(1 + 9);
    expect(texts).toContain("Abarrotes y despensa");
    expect(texts.at(-1)).toBe("Otros");
    expect(texts).not.toContain("Sin categoría");
  });

  it("does not list a «Nueva» item for a row whose choice is an existing category", () => {
    seed([ROW_UNO]);
    render(<Harness />);
    fireEvent.click(selectOf("Tienda Uno"));
    expect(optionTexts().some((text) => text.startsWith("Nueva:"))).toBe(false);
  });

  it("shows the first two member descriptions of a product row and «+{k}» for the rest", () => {
    seed([ROW_LECHE]);
    render(<Harness />);
    const row = rowOf("Leche entera");
    expect(within(row).getByText("MM LECHE ENT · LECHE ENTERA 1L")).toBeInTheDocument();
    expect(within(row).getByText("+1")).toBeInTheDocument();
  });

  it("shows no «+{k}» when the product has two members or fewer, and no caption on a supplier row", () => {
    const small: Product = { ...LECHE, members: LECHE.members.slice(0, 2) };
    seed([ROW_UNO, ROW_LECHE], [small]);
    render(<Harness />);
    expect(within(rowOf("Leche entera")).queryByText(/^\+\d+$/)).toBeNull();
    expect(within(rowOf("Tienda Uno")).queryByText(/·/)).toBeNull();
  });
});

describe("changing the Select (D-17)", () => {
  it("stores the chosen category on the row and applies nothing to the settings (LLM-04)", () => {
    seed([ROW_DOS]);
    render(<Harness />);
    const before = {
      categories: storedCategories(),
      supplierCategories: useSettingsStore.getState().supplierCategories,
      products: useSettingsStore.getState().products,
    };
    choose("Tienda Dos", "Otros");
    expect(selectOf("Tienda Dos")).toHaveTextContent("Otros");
    expect(useSuggestionsStore.getState().categories[0]?.choice).toEqual({
      kind: "existing",
      categoryId: OTROS,
    });
    expect(useSettingsStore.getState().categories).toEqual(before.categories);
    expect(useSettingsStore.getState().supplierCategories).toEqual(before.supplierCategories);
    expect(useSettingsStore.getState().products).toEqual(before.products);
  });

  it("picking the «Nueva» item of a row that already shows it changes nothing", () => {
    seed([ROW_DOS]);
    render(<Harness />);
    choose("Tienda Dos", "Nueva: Bebidas");
    expect(useSuggestionsStore.getState().categories[0]?.choice).toEqual({
      kind: "new",
      name: "Bebidas",
    });
  });
});

describe("the model's proposed new category stays selectable (IN-02)", () => {
  const ROW_PROPOSED: CategorySuggestion = { ...ROW_DOS, proposedNew: "Bebidas" };

  it("lists «Nueva: …» for a row whose choice is an existing category but that has a proposal", () => {
    seed([{ ...ROW_PROPOSED, choice: { kind: "existing", categoryId: OTROS } }]);
    render(<Harness />);
    expect(selectOf("Tienda Dos")).toHaveTextContent("Otros");
    fireEvent.click(selectOf("Tienda Dos"));
    expect(optionTexts()[0]).toBe("Nueva: Bebidas");
  });

  it("goes back to the proposal after the user picked an existing category, without changing the settings", () => {
    seed([ROW_PROPOSED]);
    render(<Harness />);
    const before = storedCategories();
    choose("Tienda Dos", "Otros");
    expect(useSuggestionsStore.getState().categories[0]?.choice).toEqual({
      kind: "existing",
      categoryId: OTROS,
    });
    choose("Tienda Dos", "Nueva: Bebidas");
    expect(useSuggestionsStore.getState().categories[0]?.choice).toEqual({
      kind: "new",
      name: "Bebidas",
    });
    expect(selectOf("Tienda Dos")).toHaveTextContent("Nueva: Bebidas");
    expect(storedCategories()).toEqual(before);
  });

  it("works the same on a product row", () => {
    seed([{ ...ROW_LECHE, proposedNew: "Lácteos", choice: { kind: "existing", categoryId: OTROS } }]);
    render(<Harness />);
    choose("Leche entera", "Nueva: Lácteos");
    expect(useSuggestionsStore.getState().categories[0]?.choice).toEqual({
      kind: "new",
      name: "Lácteos",
    });
  });
});

describe("«Aceptar» on a supplier row (D-18)", () => {
  it("stores the supplier's default category with its RFC and name and moves its lines", () => {
    seed([ROW_UNO]);
    render(<Harness />);
    expect(categoryOfLine(UNO.rfc, "MM LECHE ENT")).toBe(SIN_CATEGORIA);
    press(acceptButton("Tienda Uno"));
    expect(useSettingsStore.getState().supplierCategories).toEqual([
      { rfc: UNO.rfc, name: UNO.nombre, categoryId: ABARROTES },
    ]);
    expect(categoryOfLine(UNO.rfc, "MM LECHE ENT")).toBe(ABARROTES);
    expect(useSuggestionsStore.getState().categories).toEqual([]);
    expect(screen.queryByRole("table")).toBeNull();
    expect(toastMock).toHaveBeenCalledWith("Categoría de «Tienda Uno»: Abarrotes y despensa");
  });

  it("applies the category the user picked in the Select, not the suggested one", () => {
    seed([ROW_UNO]);
    render(<Harness />);
    choose("Tienda Uno", "Otros");
    press(acceptButton("Tienda Uno"));
    expect(useSettingsStore.getState().supplierCategories).toEqual([
      { rfc: UNO.rfc, name: UNO.nombre, categoryId: OTROS },
    ]);
    expect(toastMock).toHaveBeenCalledWith("Categoría de «Tienda Uno»: Otros");
  });

  it("cuts the name to 40 characters in the toast, the last one being «…»", () => {
    const long = "T".repeat(50);
    seed([{ ...ROW_UNO, name: long }]);
    render(<Harness />);
    press(acceptButton(long));
    expect(toastMock).toHaveBeenCalledWith(`Categoría de «${"T".repeat(39)}…»: Abarrotes y despensa`);
  });

  it("stores the full supplier name when the displayed name is the cut one, and keeps showing the cut name (WR-01)", () => {
    const full = `Comercializadora de Abarrotes y Servicios Integrales del Centro ${"X".repeat(26)}`;
    expect(full).toHaveLength(90);
    const cut = cutText(full, 60);
    expect(cut).not.toBe(full);
    seed([{ ...ROW_UNO, name: cut, fullName: full }]);
    render(<Harness />);
    press(acceptButton(cut));
    expect(useSettingsStore.getState().supplierCategories).toEqual([
      { rfc: UNO.rfc, name: full, categoryId: ABARROTES },
    ]);
    expect(toastMock).toHaveBeenCalledWith(
      `Categoría de «${cut.slice(0, 39)}…»: Abarrotes y despensa`,
    );
  });

  it("stores row.name when the row has no fullName (a queue saved before it existed) (WR-01)", () => {
    seed([ROW_UNO]);
    render(<Harness />);
    expect("fullName" in ROW_UNO).toBe(false);
    press(acceptButton("Tienda Uno"));
    expect(useSettingsStore.getState().supplierCategories).toEqual([
      { rfc: UNO.rfc, name: "Tienda Uno", categoryId: ABARROTES },
    ]);
  });

  it("announces the acceptance and how many suggestions remain", () => {
    seed([ROW_UNO, ROW_DOS, ROW_LECHE]);
    render(<Harness />);
    press(acceptButton("Tienda Uno"));
    expect(announced).toEqual(["Categoría sugerida aceptada para «Tienda Uno». Quedan 2 sugerencias."]);
    press(acceptButton("Tienda Dos"));
    expect(announced.at(-1)).toBe("Categoría sugerida aceptada para «Tienda Dos». Queda 1 sugerencia.");
    press(acceptButton("Leche entera"));
    expect(announced.at(-1)).toBe("Categoría sugerida aceptada para «Leche entera». No quedan sugerencias.");
  });
});

describe("«Aceptar» on a product row (D-18)", () => {
  it("stores the product's category and leaves the other fields alone", () => {
    seed([ROW_LECHE]);
    render(<Harness />);
    choose("Leche entera", "Otros");
    press(acceptButton("Leche entera"));
    expect(useSettingsStore.getState().products).toEqual([{ ...LECHE, categoryId: OTROS }]);
    expect(useSettingsStore.getState().supplierCategories).toEqual([]);
    expect(toastMock).toHaveBeenCalledWith("Categoría de «Leche entera»: Otros");
    expect(useSuggestionsStore.getState().categories).toEqual([]);
  });
});

describe("a new category (D-17)", () => {
  it("is created only when the user accepts, and the toast says so", () => {
    seed([ROW_DOS]);
    render(<Harness />);
    expect(storedCategories()).toHaveLength(9);
    press(acceptButton("Tienda Dos"));
    expect(storedCategories()).toHaveLength(10);
    const created = storedCategories().find((category) => category.name === "Bebidas");
    expect(created).toBeDefined();
    expect(useSettingsStore.getState().supplierCategories).toEqual([
      { rfc: DOS.rfc, name: DOS.nombre, categoryId: created?.id },
    ]);
    expect(toastMock).toHaveBeenCalledWith("Categoría «Bebidas» creada y asignada a «Tienda Dos»");
  });

  it("is created by the first accepted row and reused by a later row with the same name", () => {
    seed([ROW_DOS, ROW_LECHE]);
    render(<Harness />);
    press(acceptButton("Tienda Dos"));
    press(acceptButton("Leche entera"));
    const bebidas = storedCategories().filter((category) => category.name === "Bebidas");
    expect(bebidas).toHaveLength(1);
    expect(storedCategories()).toHaveLength(10);
    expect(useSettingsStore.getState().products[0]?.categoryId).toBe(bebidas[0]?.id);
    expect(toastMock).toHaveBeenCalledWith("Categoría «Bebidas» creada y asignada a «Tienda Dos»");
    expect(toastMock).toHaveBeenCalledWith("Categoría de «Leche entera»: Bebidas");
  });

  it("reuses the existing category whose name matches, ignoring case and edge spaces", () => {
    seed([{ ...ROW_DOS, choice: { kind: "new", name: "  ABARROTES y despensa " } }]);
    render(<Harness />);
    press(acceptButton("Tienda Dos"));
    expect(storedCategories()).toHaveLength(9);
    expect(useSettingsStore.getState().supplierCategories).toEqual([
      { rfc: DOS.rfc, name: DOS.nombre, categoryId: ABARROTES },
    ]);
    expect(toastMock).toHaveBeenCalledWith("Categoría de «Tienda Dos»: Abarrotes y despensa");
  });

  it("is not created by a row that is only shown or changed", () => {
    seed([ROW_DOS]);
    render(<Harness />);
    choose("Tienda Dos", "Otros");
    expect(storedCategories()).toHaveLength(9);
  });
});

describe("refusals of «Aceptar» (E5 error)", () => {
  function twoHundredCategories(): Category[] {
    return Array.from({ length: LIMITS.categories }, (_unused, index) => ({
      id: `cat_${String(index)}`,
      name: `Categoría ${String(index)}`,
    }));
  }

  it("shows the 200-category limit under the row, keeps the row and creates nothing", () => {
    seed([ROW_DOS]);
    act(() => {
      useSettingsStore.setState({ categories: twoHundredCategories() });
    });
    render(<Harness />);
    press(acceptButton("Tienda Dos"));
    const message = "Alcanzaste el límite de 200 categorías. Elige una existente.";
    const text = within(rowOf("Tienda Dos")).getByText(message);
    expect(acceptButton("Tienda Dos")).toHaveAttribute("aria-describedby", text.id);
    expect(storedCategories()).toHaveLength(LIMITS.categories);
    expect(useSettingsStore.getState().supplierCategories).toEqual([]);
    expect(useSuggestionsStore.getState().categories).toHaveLength(1);
    expect(toastMock).not.toHaveBeenCalled();
  });

  it("lets the user pick an existing category after the limit message, and the message goes away", () => {
    seed([ROW_DOS]);
    act(() => {
      useSettingsStore.setState({ categories: twoHundredCategories() });
    });
    render(<Harness />);
    press(acceptButton("Tienda Dos"));
    choose("Tienda Dos", "Categoría 7");
    expect(screen.queryByText(/Alcanzaste el límite/)).toBeNull();
    press(acceptButton("Tienda Dos"));
    expect(useSettingsStore.getState().supplierCategories).toEqual([
      { rfc: DOS.rfc, name: DOS.nombre, categoryId: "cat_7" },
    ]);
  });

  it("refuses a proposed new category named «Sin categoría» with the reserved-name text", () => {
    seed([{ ...ROW_DOS, choice: { kind: "new", name: "Sin categoría" } }]);
    render(<Harness />);
    press(acceptButton("Tienda Dos"));
    expect(within(rowOf("Tienda Dos")).getByText("«Sin categoría» es un nombre reservado.")).toBeInTheDocument();
    expect(storedCategories()).toHaveLength(9);
    expect(useSettingsStore.getState().supplierCategories).toEqual([]);
    expect(useSuggestionsStore.getState().categories).toHaveLength(1);
  });

  it("creates no category when the 5,000-supplier limit refuses the assignment", () => {
    seed([ROW_DOS]);
    act(() => {
      useSettingsStore.setState({
        supplierCategories: Array.from({ length: LIMITS.supplierCategories }, (_unused, index) => ({
          rfc: `RFC${String(index)}`,
          name: `Proveedor ${String(index)}`,
          categoryId: OTROS,
        })),
      });
    });
    render(<Harness />);
    press(acceptButton("Tienda Dos"));
    expect(
      within(rowOf("Tienda Dos")).getByText("Llegaste al máximo de 5,000 proveedores con categoría."),
    ).toBeInTheDocument();
    expect(storedCategories()).toHaveLength(9);
    expect(useSuggestionsStore.getState().categories).toHaveLength(1);
  });

  it("shows «Elige una categoría» when the suggested category no longer exists, and Aceptar stays aria-disabled", () => {
    seed([{ ...ROW_UNO, choice: { kind: "existing", categoryId: "cat_borrada" } }]);
    render(<Harness />);
    expect(selectOf("Tienda Uno")).toHaveTextContent("Elige una categoría");
    expect(acceptButton("Tienda Uno")).toHaveAttribute("aria-disabled", "true");
    expect(acceptButton("Tienda Uno")).not.toBeDisabled();
    press(acceptButton("Tienda Uno"));
    expect(useSettingsStore.getState().supplierCategories).toEqual([]);
    expect(useSuggestionsStore.getState().categories).toHaveLength(1);
    expect(toastMock).not.toHaveBeenCalled();
    choose("Tienda Uno", "Otros");
    expect(acceptButton("Tienda Uno")).not.toHaveAttribute("aria-disabled", "true");
    press(acceptButton("Tienda Uno"));
    expect(useSettingsStore.getState().supplierCategories).toEqual([
      { rfc: UNO.rfc, name: UNO.nombre, categoryId: OTROS },
    ]);
  });

  it("treats a row with no choice like a category that no longer exists", () => {
    seed([{ ...ROW_UNO, choice: null }]);
    render(<Harness />);
    expect(selectOf("Tienda Uno")).toHaveTextContent("Elige una categoría");
    expect(acceptButton("Tienda Uno")).toHaveAttribute("aria-disabled", "true");
  });
});

describe("«Rechazar» and «Deshacer» (D-22)", () => {
  it("removes the row with «Sugerencia rechazada» and a six-second «Deshacer», and changes no setting", () => {
    seed([ROW_UNO, ROW_DOS]);
    render(<Harness />);
    const before = useSettingsStore.getState().supplierCategories;
    press(rejectButton("Tienda Uno"));
    expect(useSuggestionsStore.getState().categories.map((row) => row.id)).toEqual(["cat_2"]);
    expect(screen.queryByRole("combobox", { name: "Categoría sugerida para Tienda Uno" })).toBeNull();
    const options = toastOptions("Sugerencia rechazada");
    expect(options.duration).toBe(6000);
    expect(options.action?.label).toBe("Deshacer");
    expect(useSettingsStore.getState().supplierCategories).toEqual(before);
    expect(announced.at(-1)).toBe("Sugerencia rechazada. Queda 1 sugerencia.");
  });

  it("«Deshacer» puts the row back where it was, with its choice", () => {
    seed([ROW_UNO, ROW_DOS, ROW_LECHE]);
    render(<Harness />);
    press(rejectButton("Tienda Dos"));
    expect(screen.queryByRole("combobox", { name: "Categoría sugerida para Tienda Dos" })).toBeNull();
    act(() => {
      toastOptions("Sugerencia rechazada").action?.onClick();
    });
    expect(useSuggestionsStore.getState().categories.map((row) => row.id)).toEqual([
      "cat_1",
      "cat_2",
      "cat_3",
    ]);
    expect(selectOf("Tienda Dos")).toHaveTextContent("Nueva: Bebidas");
  });
});

describe("focus after a row leaves (a11y)", () => {
  // The table lists suppliers by name, then products: «Tienda Dos», «Tienda Uno», «Leche entera».
  it("moves to the Select of the next row after «Aceptar»", () => {
    seed([ROW_UNO, ROW_DOS, ROW_LECHE]);
    render(<Harness />);
    press(acceptButton("Tienda Dos"));
    expect(selectOf("Tienda Uno")).toHaveFocus();
  });

  it("moves to the next row's Select after «Rechazar» too", () => {
    seed([ROW_UNO, ROW_DOS]);
    render(<Harness />);
    press(rejectButton("Tienda Dos"));
    expect(selectOf("Tienda Uno")).toHaveFocus();
  });

  it("moves to the heading when the row was the last of several", () => {
    seed([ROW_UNO, ROW_DOS]);
    render(<Harness />);
    press(acceptButton("Tienda Uno"));
    expect(screen.getByRole("heading", { name: "Sugerencias de categoría · 1" })).toHaveFocus();
    expect(emptied).not.toHaveBeenCalled();
  });

  it("asks the tab to take the focus when the section leaves with its only row", () => {
    seed([ROW_UNO]);
    render(<Harness />);
    press(acceptButton("Tienda Uno"));
    expect(emptied).toHaveBeenCalledTimes(1);
  });
});

describe("a row whose target got a category by other means (D-07, D-18, D-34, A-3)", () => {
  it("is dropped by «Aceptar», never applied over the category the user chose", () => {
    seed([ROW_UNO, ROW_DOS]);
    render(<Harness />);
    act(() => {
      useSettingsStore.setState({
        supplierCategories: [{ rfc: DOS.rfc, name: DOS.nombre, categoryId: OTROS }],
      });
    });
    // «Tienda Dos» is listed first, so the focus goes to «Tienda Uno».
    press(acceptButton("Tienda Dos"));
    expect(useSettingsStore.getState().supplierCategories).toEqual([
      { rfc: DOS.rfc, name: DOS.nombre, categoryId: OTROS },
    ]);
    expect(useSuggestionsStore.getState().categories.map((row) => row.id)).toEqual(["cat_1"]);
    expect(toastMock).not.toHaveBeenCalled();
    expect(selectOf("Tienda Uno")).toHaveFocus();
  });

  it("is dropped by «Aceptar» when its product was deleted, creating nothing", () => {
    seed([ROW_LECHE]);
    render(<Harness />);
    act(() => {
      useSettingsStore.setState({ products: [] });
    });
    press(acceptButton("Leche entera"));
    expect(useSuggestionsStore.getState().categories).toEqual([]);
    expect(storedCategories()).toHaveLength(9);
    expect(toastMock).not.toHaveBeenCalled();
  });

  it("leaves the tab's table by itself when the supplier gets a category in Categorías", () => {
    seed([ROW_UNO, ROW_DOS]);
    render(<ProductsTab />);
    expect(screen.getByRole("heading", { name: "Sugerencias de categoría · 2" })).toBeInTheDocument();
    act(() => {
      useSettingsStore.getState().setSupplierCategory(UNO.rfc, UNO.nombre, OTROS);
    });
    expect(screen.getByRole("heading", { name: "Sugerencias de categoría · 1" })).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Categoría sugerida para Tienda Uno" })).toBeNull();
    expect(useSettingsStore.getState().supplierCategories).toEqual([
      { rfc: UNO.rfc, name: UNO.nombre, categoryId: OTROS },
    ]);
  });

  it("leaves the tab's table when the product gets a category or is deleted", () => {
    const other: Product = {
      id: "prod_cafe",
      name: "Café molido",
      categoryId: null,
      members: [member(UNO.rfc, "cafe molido", "CAFE MOLIDO")],
    };
    seed(
      [
        ROW_LECHE,
        { id: "cat_4", kind: "product", productId: other.id, name: other.name, choice: null },
      ],
      [LECHE, other],
    );
    render(<ProductsTab />);
    act(() => {
      useSettingsStore.getState().setProductCategory(LECHE.id, OTROS);
    });
    expect(screen.getByRole("heading", { name: "Sugerencias de categoría · 1" })).toBeInTheDocument();
    act(() => {
      useSettingsStore.getState().deleteProduct(other.id);
    });
    expect(screen.queryByRole("heading", { name: /Sugerencias de categoría/ })).toBeNull();
    expect(useSettingsStore.getState().products.map((product) => product.categoryId)).toEqual([OTROS]);
  });

  it("keeps the rows whose targets still need a category", () => {
    seed([ROW_UNO, ROW_DOS, ROW_LECHE]);
    render(<ProductsTab />);
    expect(screen.getByRole("heading", { name: "Sugerencias de categoría · 3" })).toBeInTheDocument();
  });
});

describe("the table inside the tab (LLM-04)", () => {
  it("replaces the read-only rows: every row has its Select and its two buttons", () => {
    seed([ROW_UNO, ROW_DOS]);
    render(<ProductsTab />);
    expect(selectOf("Tienda Uno")).toBeInTheDocument();
    expect(selectOf("Tienda Dos")).toBeInTheDocument();
    expect(acceptButton("Tienda Dos")).toBeInTheDocument();
    expect(rejectButton("Tienda Dos")).toBeInTheDocument();
  });

  it("changes nothing in the settings before «Aceptar»", () => {
    seed([ROW_UNO, ROW_DOS, ROW_LECHE]);
    const before = {
      categories: storedCategories(),
      supplierCategories: useSettingsStore.getState().supplierCategories,
      products: useSettingsStore.getState().products,
    };
    render(<ProductsTab />);
    choose("Tienda Uno", "Otros");
    press(rejectButton("Leche entera"));
    expect(useSettingsStore.getState().categories).toEqual(before.categories);
    expect(useSettingsStore.getState().supplierCategories).toEqual(before.supplierCategories);
    expect(useSettingsStore.getState().products).toEqual(before.products);
  });

  it("announces through the tab's live region and gives the focus to the tab heading with the last row", () => {
    seed([ROW_UNO]);
    render(<ProductsTab />);
    press(acceptButton("Tienda Uno"));
    expect(screen.getByRole("heading", { name: "Productos" })).toHaveFocus();
    expect(
      screen.getByText("Categoría sugerida aceptada para «Tienda Uno». No quedan sugerencias."),
    ).toBeInTheDocument();
  });
});

function supplierRow(n: number, name: string, choice: CategorySuggestion["choice"]): CategorySuggestion {
  return {
    id: `cat_s${String(n)}`,
    kind: "supplier",
    rfc: `RFC${String(n).padStart(9, "0")}`,
    name,
    choice,
  };
}

function productRowOf(n: number, name: string): { row: CategorySuggestion; product: Product } {
  const product: Product = {
    id: `prod_${String(n)}`,
    name,
    categoryId: null,
    members: [member(UNO.rfc, `desc ${String(n)}`, `DESC ${String(n)}`)],
  };
  return {
    row: {
      id: `cat_p${String(n)}`,
      kind: "product",
      productId: product.id,
      name,
      choice: { kind: "existing", categoryId: OTROS },
    },
    product,
  };
}

/** The names of the rows on the page, in order, read from their Selects. */
function shownNames(): string[] {
  return screen
    .getAllByRole("combobox")
    .map((select) => (select.getAttribute("aria-label") ?? "").replace("Categoría sugerida para ", ""));
}

function dialogOf(): HTMLElement {
  return screen.getByRole("alertdialog");
}

describe("order, «Mostrar más» and overflow (D-23, E5)", () => {
  it("orders suppliers first, then products, each by name with the es collator", () => {
    const leche = productRowOf(1, "Zeta");
    const alfa = productRowOf(2, "alfa");
    seed(
      [
        leche.row,
        supplierRow(1, "Zorro", { kind: "existing", categoryId: OTROS }),
        alfa.row,
        supplierRow(2, "Beta", { kind: "existing", categoryId: OTROS }),
        supplierRow(3, "Árbol", { kind: "existing", categoryId: OTROS }),
      ],
      [leche.product, alfa.product],
    );
    render(<Harness />);
    expect(shownNames()).toEqual(["Árbol", "Beta", "Zorro", "alfa", "Zeta"]);
  });

  it("shows 50 rows at first and «Mostrar {n} más» adds up to 50 each time", () => {
    seed(
      Array.from({ length: 120 }, (_unused, index) =>
        supplierRow(index, `Proveedor ${String(index).padStart(3, "0")}`, {
          kind: "existing",
          categoryId: OTROS,
        }),
      ),
    );
    render(<Harness />);
    expect(shownNames()).toHaveLength(50);
    expect(shownNames()[0]).toBe("Proveedor 000");
    expect(screen.getByRole("heading", { name: "Sugerencias de categoría · 120" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mostrar 50 más" }));
    expect(shownNames()).toHaveLength(100);
    expect(shownNames()[99]).toBe("Proveedor 099");
    fireEvent.click(screen.getByRole("button", { name: "Mostrar 20 más" }));
    expect(shownNames()).toHaveLength(120);
    expect(screen.queryByRole("button", { name: /Mostrar/ })).toBeNull();
  });

  it("puts the focus on the first new row after «Mostrar más»", async () => {
    seed(
      Array.from({ length: 60 }, (_unused, index) =>
        supplierRow(index, `Proveedor ${String(index).padStart(3, "0")}`, {
          kind: "existing",
          categoryId: OTROS,
        }),
      ),
    );
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Mostrar 10 más" }));
    await waitFor(() => {
      expect(selectOf("Proveedor 050")).toHaveFocus();
    });
  });

  it("keeps the 760px table inside a horizontally scrollable container", () => {
    seed([ROW_UNO]);
    render(<Harness />);
    const table = screen.getByRole("table");
    expect(table.className).toContain("min-w-[760px]");
    expect(table.closest("[data-slot=table-container]")?.className).toContain("overflow-x-auto");
  });
});

describe("«Aceptar todas» (D-23, UI-SPEC OQ6)", () => {
  const ROW_SIN: CategorySuggestion = { ...ROW_UNO, id: "cat_0", name: "Tienda Cero", choice: null };

  it("is aria-disabled with no row that has a category, and opens nothing", () => {
    seed([ROW_SIN]);
    render(<Harness />);
    const button = screen.getByRole("button", { name: "Aceptar todas" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(button);
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("states the count, counts the rows without a category as skipped and focuses «Volver a revisar»", async () => {
    seed([ROW_UNO, ROW_DOS, ROW_SIN]);
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Aceptar todas" }));
    const dialog = dialogOf();
    expect(within(dialog).getByText("¿Aceptar 2 sugerencias de categoría?")).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        "Cada una de las 2 filas recibirá la categoría que muestra su selector. Una categoría nueva se crea una sola vez. Se omitirá 1 fila sin categoría elegida.",
      ),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(within(dialog).getByRole("button", { name: "Volver a revisar" })).toHaveFocus();
    });
    expect(within(dialog).getByRole("button", { name: "Aceptar 2 sugerencias" })).toBeInTheDocument();
  });

  it("says nothing about skipped rows when every row has a category", () => {
    seed([ROW_UNO]);
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Aceptar todas" }));
    const dialog = dialogOf();
    expect(within(dialog).getByText("¿Aceptar 1 sugerencia de categoría?")).toBeInTheDocument();
    expect(within(dialog).queryByText(/omit/i)).toBeNull();
  });

  it("«Volver a revisar» closes it and changes nothing", () => {
    seed([ROW_UNO, ROW_DOS]);
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Aceptar todas" }));
    fireEvent.click(within(dialogOf()).getByRole("button", { name: "Volver a revisar" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(useSuggestionsStore.getState().categories).toHaveLength(2);
    expect(useSettingsStore.getState().supplierCategories).toEqual([]);
    expect(toastMock).not.toHaveBeenCalled();
  });

  it("applies every row with its Select value, creating a shared new name once, and skips the empty ones", () => {
    seed([ROW_UNO, ROW_DOS, ROW_LECHE, ROW_SIN]);
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Aceptar todas" }));
    fireEvent.click(within(dialogOf()).getByRole("button", { name: "Aceptar 3 sugerencias" }));
    const bebidas = storedCategories().filter((category) => category.name === "Bebidas");
    expect(bebidas).toHaveLength(1);
    expect(storedCategories()).toHaveLength(10);
    expect(useSettingsStore.getState().supplierCategories).toEqual([
      { rfc: DOS.rfc, name: DOS.nombre, categoryId: bebidas[0]?.id },
      { rfc: UNO.rfc, name: UNO.nombre, categoryId: ABARROTES },
    ]);
    expect(useSettingsStore.getState().products[0]?.categoryId).toBe(bebidas[0]?.id);
    expect(useSuggestionsStore.getState().categories.map((row) => row.id)).toEqual(["cat_0"]);
    expect(toastMock).toHaveBeenCalledWith("3 sugerencias aplicadas");
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("uses the category the user chose in the Select of a row, not the suggested one", () => {
    seed([ROW_DOS]);
    render(<Harness />);
    choose("Tienda Dos", "Otros");
    fireEvent.click(screen.getByRole("button", { name: "Aceptar todas" }));
    fireEvent.click(within(dialogOf()).getByRole("button", { name: "Aceptar 1 sugerencia" }));
    expect(storedCategories()).toHaveLength(9);
    expect(useSettingsStore.getState().supplierCategories).toEqual([
      { rfc: DOS.rfc, name: DOS.nombre, categoryId: OTROS },
    ]);
  });

  it("applies the rows that «Mostrar más» has not shown yet", () => {
    seed(
      Array.from({ length: 60 }, (_unused, index) =>
        supplierRow(index, `Proveedor ${String(index).padStart(3, "0")}`, {
          kind: "existing",
          categoryId: OTROS,
        }),
      ),
    );
    render(<Harness />);
    expect(shownNames()).toHaveLength(50);
    fireEvent.click(screen.getByRole("button", { name: "Aceptar todas" }));
    expect(within(dialogOf()).getByText("¿Aceptar 60 sugerencias de categoría?")).toBeInTheDocument();
    fireEvent.click(within(dialogOf()).getByRole("button", { name: "Aceptar 60 sugerencias" }));
    expect(useSettingsStore.getState().supplierCategories).toHaveLength(60);
    expect(useSuggestionsStore.getState().categories).toEqual([]);
    expect(toastMock).toHaveBeenCalledWith("60 sugerencias aplicadas");
  });

  it("gives the focus to the tab heading when the last row leaves", async () => {
    seed([ROW_UNO]);
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Aceptar todas" }));
    fireEvent.click(within(dialogOf()).getByRole("button", { name: "Aceptar 1 sugerencia" }));
    await waitFor(() => {
      expect(emptied).toHaveBeenCalledTimes(1);
    });
    expect(announced.at(-1)).toBe("1 sugerencia aplicada");
  });

  it("leaves a row refused by the 200-category limit with its message and applies the others", () => {
    seed([ROW_UNO, ROW_DOS]);
    act(() => {
      useSettingsStore.setState({
        categories: Array.from({ length: LIMITS.categories }, (_unused, index) => ({
          id: `cat_${String(index)}`,
          name: `Categoría ${String(index)}`,
        })),
      });
      useSuggestionsStore.setState({
        categories: [
          { ...ROW_UNO, choice: { kind: "existing", categoryId: "cat_3" } },
          ROW_DOS,
        ],
      });
    });
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Aceptar todas" }));
    fireEvent.click(within(dialogOf()).getByRole("button", { name: "Aceptar 2 sugerencias" }));
    expect(useSettingsStore.getState().supplierCategories).toEqual([
      { rfc: UNO.rfc, name: UNO.nombre, categoryId: "cat_3" },
    ]);
    expect(useSuggestionsStore.getState().categories.map((row) => row.id)).toEqual(["cat_2"]);
    expect(
      within(rowOf("Tienda Dos")).getByText("Alcanzaste el límite de 200 categorías. Elige una existente."),
    ).toBeInTheDocument();
    expect(storedCategories()).toHaveLength(LIMITS.categories);
    expect(toastMock).toHaveBeenCalledWith("1 sugerencia aplicada; 1 quedó en la tabla");
    expect(emptied).not.toHaveBeenCalled();
  });

  it("drops, without applying, a row whose supplier got a category by other means", () => {
    seed([ROW_UNO, ROW_DOS]);
    render(<Harness />);
    act(() => {
      useSettingsStore.setState({
        supplierCategories: [{ rfc: UNO.rfc, name: UNO.nombre, categoryId: OTROS }],
      });
    });
    fireEvent.click(screen.getByRole("button", { name: "Aceptar todas" }));
    fireEvent.click(within(dialogOf()).getByRole("button", { name: "Aceptar 2 sugerencias" }));
    const bebidas = storedCategories().find((category) => category.name === "Bebidas");
    expect(useSettingsStore.getState().supplierCategories).toEqual([
      { rfc: UNO.rfc, name: UNO.nombre, categoryId: OTROS },
      { rfc: DOS.rfc, name: DOS.nombre, categoryId: bebidas?.id },
    ]);
    expect(useSuggestionsStore.getState().categories).toEqual([]);
    expect(toastMock).toHaveBeenCalledWith("1 sugerencia aplicada");
  });
});
