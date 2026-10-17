// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useSettingsStore } from "@/stores/settingsStore";
import "../../../tests/support/domPolyfills";
import { resetSettingsStore } from "../../../tests/support/settingsStorage";
import { CategoryList } from "./CategoryList";

interface ToastOptions {
  duration?: number;
  action?: { label: string; onClick: () => void };
}
const toastMock = vi.hoisted(() => vi.fn<(message: string, options?: ToastOptions) => void>());
vi.mock("sonner", () => ({ toast: toastMock }));

const SERVICIOS = "seed:servicios";
const LIMPIEZA = "seed:limpieza-higiene";

beforeEach(() => {
  resetSettingsStore();
  toastMock.mockReset();
});

afterEach(() => {
  cleanup();
  resetSettingsStore();
});

function newInput(): HTMLInputElement {
  const input = screen.getByLabelText("Nueva categoría");
  if (!(input instanceof HTMLInputElement)) throw new Error("expected an input");
  return input;
}

function type(input: HTMLElement, value: string): void {
  fireEvent.change(input, { target: { value } });
}

function submitAdd(value: string): void {
  type(newInput(), value);
  fireEvent.click(screen.getByRole("button", { name: "Agregar categoría" }));
}

/** The visible name of every row, in order (the first paragraph of each list item). */
function rowNames(): (string | undefined)[] {
  const list = screen.getByRole("list");
  return within(list)
    .getAllByRole("listitem")
    .map((item) => item.querySelector("p")?.textContent);
}

function row(name: string): HTMLElement {
  const item = within(screen.getByRole("list"))
    .getAllByRole("listitem")
    .find((candidate) => candidate.querySelector("p")?.textContent === name);
  if (item === undefined) throw new Error(`no row named ${name}`);
  return item;
}

function renameInput(name: string): HTMLInputElement {
  const input = screen.getByRole("textbox", { name: `Nuevo nombre de la categoría ${name}` });
  if (!(input instanceof HTMLInputElement)) throw new Error("expected an input");
  return input;
}

function pencil(name: string): HTMLElement {
  return screen.getByRole("button", { name: `Renombrar categoría ${name}` });
}

function liveRegion(): HTMLElement {
  const region = document.querySelector('[aria-live="polite"]');
  if (!(region instanceof HTMLElement)) throw new Error("no polite live region");
  return region;
}

const SORTED_SEEDS = [
  "Abarrotes y despensa",
  "Comisiones bancarias",
  "Insumos de cafetería",
  "Limpieza e higiene",
  "Mantenimiento y reparaciones",
  "Papelería y oficina",
  "Servicios (luz, agua, internet, teléfono)",
  "Software y suscripciones",
  "Otros",
];

describe("CategoryList: the list", () => {
  it("shows the nine suggestions alphabetically with Otros last, then the locked row", () => {
    render(<CategoryList />);
    expect(rowNames()).toEqual([...SORTED_SEEDS, "Sin categoría"]);
  });

  it("shows the heading and the count", () => {
    render(<CategoryList />);
    expect(screen.getByRole("heading", { name: "Mis categorías" })).toBeInTheDocument();
    expect(screen.getByText("9 categorías")).toBeInTheDocument();
  });

  it("reads 1 categoría for a single category", () => {
    useSettingsStore.setState({ categories: [{ id: "cat_1", name: "Café" }] });
    render(<CategoryList />);
    expect(screen.getByText("1 categoría")).toBeInTheDocument();
  });

  it("locks the Sin categoría row: caption, no actions", () => {
    render(<CategoryList />);
    const locked = row("Sin categoría");
    expect(
      within(locked).getByText(
        "Es el valor cuando no hay otra categoría. No se puede renombrar ni borrar.",
      ),
    ).toBeInTheDocument();
    expect(within(locked).queryAllByRole("button")).toHaveLength(0);
  });

  it("gives every other row a rename and a delete button named after the category", () => {
    render(<CategoryList />);
    for (const name of SORTED_SEEDS) {
      expect(within(row(name)).getByRole("button", { name: `Renombrar categoría ${name}` })).toBeInTheDocument();
      expect(within(row(name)).getByRole("button", { name: `Borrar categoría ${name}` })).toBeInTheDocument();
    }
  });

  it("reads Sin uso for the unused categories and omits a zero part of the caption", () => {
    useSettingsStore.getState().setSupplierCategory("AAA010101AAA", "A", SERVICIOS);
    useSettingsStore.setState({
      conceptRules: [
        { rfc: "AAA010101AAA", key: "luz", description: "Luz", categoryId: SERVICIOS },
        { rfc: "AAA010101AAA", key: "agua", description: "Agua", categoryId: SERVICIOS },
        { rfc: "BBB010101BBB", key: "cloro", description: "Cloro", categoryId: LIMPIEZA },
      ],
    });
    render(<CategoryList />);
    const servicios = row("Servicios (luz, agua, internet, teléfono)");
    expect(within(servicios).getByText("1 proveedor · 2 conceptos")).toBeInTheDocument();
    expect(within(row("Limpieza e higiene")).getByText("1 concepto")).toBeInTheDocument();
    expect(within(row("Otros")).getByText("Sin uso")).toBeInTheDocument();
  });

  it("uses plurals and the singular for suppliers", () => {
    const store = useSettingsStore.getState();
    store.setSupplierCategory("AAA010101AAA", "A", LIMPIEZA);
    store.setSupplierCategory("BBB010101BBB", "B", LIMPIEZA);
    store.setSupplierCategory("CCC010101CCC", "C", SERVICIOS);
    render(<CategoryList />);
    expect(within(row("Limpieza e higiene")).getByText("2 proveedores")).toBeInTheDocument();
    expect(within(row("Servicios (luz, agua, internet, teléfono)")).getByText("1 proveedor")).toBeInTheDocument();
  });

  it("renders a hostile name as plain text and wraps it", () => {
    useSettingsStore.setState({
      categories: [{ id: "cat_1", name: '<img src=x onerror="alert(1)">' }],
    });
    const { container } = render(<CategoryList />);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText('<img src=x onerror="alert(1)">')).toHaveClass("break-words");
  });

  it("is a 720 px card that grows with the page", () => {
    const { container } = render(<CategoryList />);
    const card = container.firstElementChild;
    expect(card).toHaveClass("max-w-[720px]");
    expect(card).toHaveClass("p-6");
  });
});

describe("CategoryList: empty state", () => {
  it("shows the Empty block with zero categories and keeps the form and the locked row", () => {
    useSettingsStore.setState({ categories: [] });
    render(<CategoryList />);
    expect(screen.getByText("No tienes categorías")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Crea una arriba para empezar a clasificar tu gasto. Mientras tanto, todo queda en «Sin categoría».",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("0 categorías")).toBeInTheDocument();
    expect(rowNames()).toEqual(["Sin categoría"]);
    submitAdd("Café");
    expect(rowNames()).toEqual(["Café", "Sin categoría"]);
    expect(screen.queryByText("No tienes categorías")).toBeNull();
  });
});

describe("CategoryList: adding", () => {
  it("adds the trimmed name in its sorted place, clears and keeps focus, and announces it", () => {
    render(<CategoryList />);
    submitAdd("  Café  ");
    expect(rowNames()).toEqual([
      "Abarrotes y despensa",
      "Café",
      "Comisiones bancarias",
      "Insumos de cafetería",
      "Limpieza e higiene",
      "Mantenimiento y reparaciones",
      "Papelería y oficina",
      "Servicios (luz, agua, internet, teléfono)",
      "Software y suscripciones",
      "Otros",
      "Sin categoría",
    ]);
    expect(newInput()).toHaveValue("");
    expect(newInput()).toHaveFocus();
    expect(liveRegion()).toHaveTextContent("Categoría «Café» agregada");
    expect(screen.getByText("10 categorías")).toBeInTheDocument();
  });

  it("adds with Enter (form submit)", () => {
    render(<CategoryList />);
    type(newInput(), "Café");
    const form = newInput().form;
    if (form === null) throw new Error("the input must be inside a form");
    fireEvent.submit(form);
    expect(rowNames()).toContain("Café");
  });

  it("stores the added category so it survives a reload", () => {
    render(<CategoryList />);
    submitAdd("Café");
    const raw = window.localStorage.getItem("invoicechecker:settings");
    expect(raw).not.toBeNull();
    expect(raw).toContain("Café");
  });

  it("limits the input to 60 characters and shows the label and the hint", () => {
    render(<CategoryList />);
    expect(newInput()).toHaveAttribute("maxlength", "60");
    expect(newInput()).toHaveAttribute("placeholder", "Nombre de la categoría");
  });

  it("shows the empty-name error wired with aria-invalid and aria-describedby, and clears it on typing", () => {
    render(<CategoryList />);
    fireEvent.click(screen.getByRole("button", { name: "Agregar categoría" }));
    const message = screen.getByText("Escribe un nombre para la categoría.");
    expect(newInput()).toHaveAttribute("aria-invalid", "true");
    expect(newInput()).toHaveAttribute("aria-describedby", message.id);
    type(newInput(), "C");
    expect(screen.queryByText("Escribe un nombre para la categoría.")).toBeNull();
    expect(newInput()).not.toHaveAttribute("aria-invalid");
    expect(newInput()).not.toHaveAttribute("aria-describedby");
  });

  it("refuses a duplicate ignoring case and edge spaces without saving", () => {
    render(<CategoryList />);
    submitAdd("  otros ");
    expect(screen.getByText("Ya existe una categoría con ese nombre.")).toBeInTheDocument();
    expect(useSettingsStore.getState().categories).toHaveLength(9);
    expect(newInput()).toHaveValue("  otros ");
  });

  it("refuses Sin categoría in any case as a reserved name", () => {
    render(<CategoryList />);
    for (const raw of ["Sin categoría", "SIN CATEGORÍA"]) {
      submitAdd(raw);
      expect(screen.getByText("«Sin categoría» es un nombre reservado.")).toBeInTheDocument();
    }
    expect(useSettingsStore.getState().categories).toHaveLength(9);
  });

  it("refuses the 201st category with the limit message", () => {
    useSettingsStore.setState({
      categories: Array.from({ length: 200 }, (_, index) => ({
        id: `cat_${String(index)}`,
        name: `Categoría ${String(index).padStart(3, "0")}`,
      })),
    });
    render(<CategoryList />);
    submitAdd("Una más");
    expect(screen.getByText("Llegaste al máximo de 200 categorías.")).toBeInTheDocument();
    expect(useSettingsStore.getState().categories).toHaveLength(200);
  });
});

describe("CategoryList: inline rename", () => {
  it("opens an input with the current name selected and the two icon buttons", () => {
    render(<CategoryList />);
    fireEvent.click(pencil("Limpieza e higiene"));
    const input = renameInput("Limpieza e higiene");
    expect(input).toHaveValue("Limpieza e higiene");
    expect(input).toHaveAttribute("maxlength", "60");
    expect(input).toHaveFocus();
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe("Limpieza e higiene".length);
    expect(screen.getByRole("button", { name: "Guardar nombre" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancelar cambio de nombre" })).toBeInTheDocument();
  });

  it("cancels with Esc, restores the row and focuses its pencil", () => {
    render(<CategoryList />);
    fireEvent.click(pencil("Limpieza e higiene"));
    type(renameInput("Limpieza e higiene"), "Aseo");
    fireEvent.keyDown(renameInput("Limpieza e higiene"), { key: "Escape" });
    expect(screen.queryByRole("textbox", { name: /Nuevo nombre de la categoría/ })).toBeNull();
    expect(rowNames()).toContain("Limpieza e higiene");
    expect(pencil("Limpieza e higiene")).toHaveFocus();
  });

  it("cancels with the X button", () => {
    render(<CategoryList />);
    fireEvent.click(pencil("Otros"));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar cambio de nombre" }));
    expect(rowNames()).toContain("Otros");
    expect(pencil("Otros")).toHaveFocus();
  });

  it("saves with Enter, announces, keeps the id and focuses the pencil of the renamed row", () => {
    render(<CategoryList />);
    fireEvent.click(pencil("Servicios (luz, agua, internet, teléfono)"));
    const input = renameInput("Servicios (luz, agua, internet, teléfono)");
    type(input, "  Luz y agua ");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(rowNames()).toContain("Luz y agua");
    expect(rowNames()).not.toContain("Servicios (luz, agua, internet, teléfono)");
    expect(liveRegion()).toHaveTextContent("Categoría renombrada a «Luz y agua»");
    expect(pencil("Luz y agua")).toHaveFocus();
    expect(useSettingsStore.getState().categories.find((c) => c.id === SERVICIOS)?.name).toBe("Luz y agua");
  });

  it("saves with the Check button", () => {
    render(<CategoryList />);
    fireEvent.click(pencil("Otros"));
    type(renameInput("Otros"), "Varios");
    fireEvent.click(screen.getByRole("button", { name: "Guardar nombre" }));
    expect(rowNames()).toContain("Varios");
  });

  it("keeps the assignments of the renamed category", () => {
    useSettingsStore.getState().setSupplierCategory("AAA010101AAA", "A", LIMPIEZA);
    render(<CategoryList />);
    fireEvent.click(pencil("Limpieza e higiene"));
    type(renameInput("Limpieza e higiene"), "Aseo");
    fireEvent.keyDown(renameInput("Limpieza e higiene"), { key: "Enter" });
    expect(within(row("Aseo")).getByText("1 proveedor")).toBeInTheDocument();
    expect(useSettingsStore.getState().supplierCategories).toEqual([
      { rfc: "AAA010101AAA", name: "A", categoryId: LIMPIEZA },
    ]);
  });

  it("allows the same name in another case", () => {
    render(<CategoryList />);
    fireEvent.click(pencil("Limpieza e higiene"));
    type(renameInput("Limpieza e higiene"), "LIMPIEZA E HIGIENE");
    fireEvent.keyDown(renameInput("Limpieza e higiene"), { key: "Enter" });
    expect(rowNames()).toContain("LIMPIEZA E HIGIENE");
  });

  it("shows a refusal under the input and stays in edit mode", () => {
    render(<CategoryList />);
    fireEvent.click(pencil("Limpieza e higiene"));
    const input = renameInput("Limpieza e higiene");
    type(input, "otros");
    fireEvent.keyDown(input, { key: "Enter" });
    const message = screen.getByText("Ya existe una categoría con ese nombre.");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", message.id);
    expect(useSettingsStore.getState().categories.find((c) => c.id === LIMPIEZA)?.name).toBe("Limpieza e higiene");
    type(input, "otros2");
    expect(screen.queryByText("Ya existe una categoría con ese nombre.")).toBeNull();
  });

  it("does nothing on blur", () => {
    render(<CategoryList />);
    fireEvent.click(pencil("Otros"));
    const input = renameInput("Otros");
    type(input, "Varios");
    fireEvent.blur(input);
    expect(renameInput("Otros")).toHaveValue("Varios");
    expect(useSettingsStore.getState().categories.find((c) => c.id === "seed:otros")?.name).toBe("Otros");
  });

  it("edits one row at a time", () => {
    render(<CategoryList />);
    fireEvent.click(pencil("Limpieza e higiene"));
    fireEvent.click(pencil("Otros"));
    expect(screen.getAllByRole("textbox", { name: /Nuevo nombre de la categoría/ })).toHaveLength(1);
    expect(renameInput("Otros")).toBeInTheDocument();
    expect(rowNames()).toContain("Limpieza e higiene");
  });
});

const SERVICIOS_NAME = "Servicios (luz, agua, internet, teléfono)";

function trash(name: string): HTMLElement {
  return screen.getByRole("button", { name: `Borrar categoría ${name}` });
}

function dialog(): HTMLElement {
  return screen.getByRole("alertdialog");
}

function target(): HTMLElement {
  return within(dialog()).getByRole("combobox", { name: "Pasarlos a" });
}

function optionTexts(): string[] {
  return screen.getAllByRole("option").map((option) => option.textContent);
}

function chooseTarget(optionText: string): void {
  fireEvent.click(target());
  const option = screen.getByRole("option", { name: optionText });
  // Base UI commits a mouse selection only when the pointer went down on the item.
  fireEvent.pointerDown(option);
  fireEvent.click(option);
}

function confirmDelete(): void {
  fireEvent.click(within(dialog()).getByRole("button", { name: "Borrar categoría" }));
}

/** One supplier and one concept on Servicios, one supplier on Limpieza. */
function seedUsage(): void {
  const store = useSettingsStore.getState();
  store.setSupplierCategory("AAA010101AAA", "A", SERVICIOS);
  store.setSupplierCategory("BBB010101BBB", "B", SERVICIOS);
  store.setSupplierCategory("CCC010101CCC", "C", LIMPIEZA);
  useSettingsStore.setState({
    conceptRules: [
      { rfc: "AAA010101AAA", key: "luz", description: "Luz", categoryId: SERVICIOS },
      { rfc: "CCC010101CCC", key: "cloro", description: "Cloro", categoryId: null },
    ],
  });
}

describe("CategoryList: delete dialog", () => {
  it("asks about an unused category with only the body and focus on Conservar categoría", async () => {
    render(<CategoryList />);
    fireEvent.click(trash("Otros"));
    expect(within(dialog()).getByText("¿Borrar la categoría «Otros»?")).toBeInTheDocument();
    expect(
      within(dialog()).getByText("No está asignada a ningún proveedor ni concepto."),
    ).toBeInTheDocument();
    expect(within(dialog()).queryByRole("combobox")).toBeNull();
    await waitFor(() =>
      expect(within(dialog()).getByRole("button", { name: "Conservar categoría" })).toHaveFocus(),
    );
    expect(within(dialog()).getByRole("button", { name: "Borrar categoría" })).toBeInTheDocument();
  });

  it("dismisses with Esc and changes nothing", async () => {
    render(<CategoryList />);
    fireEvent.click(trash("Otros"));
    fireEvent.keyDown(dialog(), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(useSettingsStore.getState().categories).toHaveLength(9);
    expect(toastMock).not.toHaveBeenCalled();
  });

  it("dismisses with Conservar categoría and changes nothing", async () => {
    render(<CategoryList />);
    fireEvent.click(trash("Otros"));
    fireEvent.click(within(dialog()).getByRole("button", { name: "Conservar categoría" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(useSettingsStore.getState().categories).toHaveLength(9);
  });

  it("says how many suppliers and concepts use a category, omitting a zero part", async () => {
    seedUsage();
    render(<CategoryList />);
    fireEvent.click(trash(SERVICIOS_NAME));
    expect(within(dialog()).getByText("La usan 2 proveedores y 1 concepto.")).toBeInTheDocument();
    fireEvent.keyDown(dialog(), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    fireEvent.click(trash("Limpieza e higiene"));
    expect(within(dialog()).getByText("La usan 1 proveedor.")).toBeInTheDocument();
  });

  it("starts the Pasarlos a Select on Sin categoría and lists the other categories in list order", () => {
    seedUsage();
    render(<CategoryList />);
    fireEvent.click(trash(SERVICIOS_NAME));
    expect(target()).toHaveTextContent("Sin categoría");
    fireEvent.click(target());
    expect(optionTexts()).toEqual([
      "Sin categoría",
      ...SORTED_SEEDS.filter((name) => name !== SERVICIOS_NAME),
    ]);
  });

  it("keeps the dialog open when an option is chosen", () => {
    seedUsage();
    render(<CategoryList />);
    fireEvent.click(trash(SERVICIOS_NAME));
    chooseTarget("Otros");
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(target()).toHaveTextContent("Otros");
  });

  it("offers only Sin categoría when no other category exists", () => {
    useSettingsStore.setState({ categories: [{ id: "cat_1", name: "Café" }] });
    useSettingsStore.getState().setSupplierCategory("AAA010101AAA", "A", "cat_1");
    render(<CategoryList />);
    fireEvent.click(trash("Café"));
    fireEvent.click(target());
    expect(optionTexts()).toEqual(["Sin categoría"]);
  });

  it("moves the assignments and the adjustments to the chosen category", () => {
    seedUsage();
    render(<CategoryList />);
    fireEvent.click(trash(SERVICIOS_NAME));
    chooseTarget("Otros");
    confirmDelete();
    const state = useSettingsStore.getState();
    expect(state.categories.some((category) => category.id === SERVICIOS)).toBe(false);
    expect(state.supplierCategories.filter((a) => a.categoryId === "seed:otros").map((a) => a.rfc)).toEqual([
      "AAA010101AAA",
      "BBB010101BBB",
    ]);
    expect(state.conceptRules.find((rule) => rule.key === "luz")?.categoryId).toBe("seed:otros");
    expect(rowNames()).not.toContain(SERVICIOS_NAME);
    expect(within(row("Otros")).getByText("2 proveedores · 1 concepto")).toBeInTheDocument();
  });

  it("with Sin categoría removes the supplier assignments and makes the adjustments explicit nulls", () => {
    seedUsage();
    render(<CategoryList />);
    fireEvent.click(trash(SERVICIOS_NAME));
    confirmDelete();
    const state = useSettingsStore.getState();
    expect(state.supplierCategories).toEqual([{ rfc: "CCC010101CCC", name: "C", categoryId: LIMPIEZA }]);
    expect(state.conceptRules.find((rule) => rule.key === "luz")?.categoryId).toBeNull();
  });

  it("shows the Categoría borrada toast with Deshacer for 6 s and focuses the Mis categorías heading", async () => {
    render(<CategoryList />);
    fireEvent.click(trash("Otros"));
    confirmDelete();
    expect(toastMock).toHaveBeenCalledTimes(1);
    const [message, options] = toastMock.mock.calls[0] ?? [];
    expect(message).toBe("Categoría borrada");
    expect(options?.duration).toBe(6000);
    expect(options?.action?.label).toBe("Deshacer");
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Mis categorías" })).toHaveFocus(),
    );
  });

  it("restores the category in its place with its assignments and adjustments on Deshacer", () => {
    seedUsage();
    const before = {
      categories: useSettingsStore.getState().categories,
      supplierCategories: useSettingsStore.getState().supplierCategories,
      conceptRules: useSettingsStore.getState().conceptRules,
    };
    render(<CategoryList />);
    fireEvent.click(trash(SERVICIOS_NAME));
    chooseTarget("Otros");
    confirmDelete();
    const [, options] = toastMock.mock.calls[0] ?? [];
    const undo = options?.action?.onClick;
    if (undo === undefined) throw new Error("the toast must offer Deshacer");
    act(() => {
      undo();
    });
    const state = useSettingsStore.getState();
    expect(state.categories).toEqual(before.categories);
    expect(state.supplierCategories).toEqual(before.supplierCategories);
    expect(state.conceptRules).toEqual(before.conceptRules);
    expect(rowNames()).toEqual([...SORTED_SEEDS, "Sin categoría"]);
  });

  it("renders a hostile category name as plain text in the title", () => {
    useSettingsStore.setState({
      categories: [{ id: "cat_1", name: '<img src=x onerror="alert(1)">' }],
    });
    render(<CategoryList />);
    fireEvent.click(trash('<img src=x onerror="alert(1)">'));
    expect(within(dialog()).getByText('¿Borrar la categoría «<img src=x onerror="alert(1)">»?')).toBeInTheDocument();
    expect(dialog().querySelector("img")).toBeNull();
  });
});
