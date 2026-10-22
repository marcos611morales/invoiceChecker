// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { z } from "zod";
import type { Concepto, ParsedInvoice } from "@/domain/cfdi/types";
import type { ProductSuggestion } from "@/domain/llm/suggestions";
import { normalizeDescription } from "@/domain/settings/normalize";
import type { Product, ProductMember } from "@/domain/settings/types";
import { useSessionStore } from "@/stores/sessionStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useSuggestionsStore } from "@/stores/suggestionsStore";
import { makeInvoice } from "../../../tests/support/ledgerFactory";
import "../../../tests/support/domPolyfills";
import { cardOf, nameInput, nameInputs } from "../../../tests/support/reviewQueue";
import { resetSettingsStore } from "../../../tests/support/settingsStorage";
import { resetSuggestionsStore } from "../../../tests/support/suggestionsStorage";
import { ProductsTab } from "./ProductsTab";

// Order, search, filters, «Mostrar más», selection and bulk actions of the product queue
// (Plan 04-17, D-20, D-35, UI-SPEC E4). The cards themselves are tested in ReviewQueue.test.tsx.

const toastMock = vi.hoisted(() => vi.fn<(message: string, options?: unknown) => void>());
vi.mock("sonner", () => ({ toast: toastMock }));

const UNO = { rfc: "AAA010101AAA", nombre: "Tienda Uno" };
const DOS = { rfc: "BBB020202BBB", nombre: "Tienda Dos" };

function concepto(descripcion: string): Concepto {
  return {
    claveProdServ: "50202306",
    noIdentificacion: null,
    cantidad: "1",
    claveUnidad: "H87",
    unidad: null,
    descripcion,
    valorUnitario: "100.00",
    importe: "100.00",
    descuento: null,
    objetoImp: "01",
    traslados: [],
    retenciones: [],
  };
}

function invoice(emisor: { rfc: string; nombre: string }, descriptions: readonly string[]): ParsedInvoice {
  return makeInvoice({ emisor, conceptos: descriptions.map(concepto) });
}

/** Loaded lines: the coffee has two, the milk and the sugar one each; nothing else has any. */
function seedInvoices(): void {
  const invoices = [
    invoice(UNO, ["Leche entera 1L", "Café Molido 1kg", "Azúcar"]),
    invoice(DOS, ["LECHE ENTERA 1L"]),
    invoice(UNO, ["Café Molido 1kg"]),
  ];
  act(() => {
    const store = useSessionStore.getState();
    store.applyBatch(
      invoices.map((entry) => ({
        kind: "parsed" as const,
        file: { name: `${entry.uuid}.xml`, path: `${entry.uuid}.xml` },
        result: { ok: true as const, invoice: entry },
      })),
      store.generation,
    );
  });
}

function member(supplier: { rfc: string; nombre: string }, description: string): ProductMember {
  return {
    rfc: supplier.rfc,
    key: normalizeDescription(description),
    description,
    supplierName: supplier.nombre,
  };
}

const LECHE_UNO = member(UNO, "Leche entera 1L");
const LECHE_DOS = member(DOS, "LECHE ENTERA 1L");
const CAFE = member(UNO, "Café Molido 1kg");
const AZUCAR = member(UNO, "Azúcar");
const ACEITE = member(DOS, "Aceite vegetal 1L");

function card(id: string, name: string, members: ProductMember[], target: string | null = null): ProductSuggestion {
  return { id, name, target, members };
}

function enqueue(cards: ProductSuggestion[]): void {
  act(() => {
    useSuggestionsStore.setState({ products: cards });
  });
}

/** «Leche entera» (two members), «Café molido» and «Azúcar». */
function threeCards(): ProductSuggestion[] {
  return [
    card("sug_a", "Leche entera", [LECHE_UNO, LECHE_DOS]),
    card("sug_b", "Café molido", [CAFE]),
    card("sug_c", "Azúcar", [AZUCAR]),
  ];
}

/** `count` one-member cards «Producto 001»…; none has a loaded line, so they sort by name. */
function manyCards(count: number): ProductSuggestion[] {
  return Array.from({ length: count }, (_unused, index) => {
    const label = String(index + 1).padStart(3, "0");
    return card(`sug_p_${label}`, `Producto ${label}`, [member(UNO, `descripcion producto ${label}`)]);
  });
}

/** `count` two-member cards «Grupo 001»…, which sort before any singleton. */
function manyGroups(count: number): ProductSuggestion[] {
  return Array.from({ length: count }, (_unused, index) => {
    const label = String(index + 1).padStart(3, "0");
    return card(`sug_g_${label}`, `Grupo ${label}`, [
      member(UNO, `grupo ${label} a`),
      member(DOS, `grupo ${label} b`),
    ]);
  });
}

function seedAceite(): void {
  const aceite: Product = {
    id: "prod_aceite",
    name: "Aceite",
    categoryId: null,
    members: [member(UNO, "aceite 1l")],
  };
  act(() => {
    useSettingsStore.setState({ products: [aceite] });
  });
}

function searchBox(): HTMLInputElement {
  const box = screen.getByRole("searchbox", { name: "Buscar sugerencia" });
  if (!(box instanceof HTMLInputElement)) throw new Error("the search field is not an input");
  return box;
}

function typeSearch(value: string): void {
  fireEvent.change(searchBox(), { target: { value } });
}

function button(name: string): HTMLElement {
  return screen.getByRole("button", { name });
}

function selectCardBox(name: string): HTMLElement {
  return screen.getByRole("checkbox", { name: `Seleccionar la sugerencia «${name}»` });
}

function selectVisibleBox(): HTMLElement {
  return screen.getByRole("checkbox", { name: "Seleccionar visibles" });
}

function shownNames(): string[] {
  return nameInputs().map((input) => input.value);
}

function storedProducts(): Product[] {
  return useSettingsStore.getState().products;
}

function pendingIds(): string[] {
  return useSuggestionsStore.getState().products.map((entry) => entry.id);
}

function dialogOf(): HTMLElement {
  return screen.getByRole("alertdialog");
}

const undoToastSchema = z.object({
  duration: z.number(),
  action: z.object({
    label: z.string(),
    onClick: z.custom<() => void>((value) => typeof value === "function"),
  }),
});

/** The toast at `index` of the mock: its message and the «Deshacer» action it offers. */
function undoToast(index: number): { message: string; duration: number; label: string; undo: () => void } {
  const call = toastMock.mock.calls[index];
  if (call === undefined) throw new Error(`there is no toast number ${String(index)}`);
  const [message, options] = call;
  const parsed = undoToastSchema.parse(options);
  return { message, duration: parsed.duration, label: parsed.action.label, undo: parsed.action.onClick };
}

function toastMessage(index: number): string | undefined {
  return toastMock.mock.calls[index]?.[0];
}

beforeEach(() => {
  toastMock.mockReset();
  window.localStorage.clear();
  resetSettingsStore();
  resetSuggestionsStore();
  seedInvoices();
});

afterEach(() => {
  cleanup();
  act(() => {
    useSessionStore.getState().clearAll();
    useSuggestionsStore.setState({ products: [] });
  });
  window.localStorage.clear();
  resetSettingsStore();
  resetSuggestionsStore();
});

describe("the order of the queue and the cards that land during a run (UI-SPEC queue order)", () => {
  it("lists «Agregar a» first, then groups, then singletons by lines (most first) and name", () => {
    seedAceite();
    enqueue([
      card("sug_s", "Sal", [member(UNO, "Sal")]),
      card("sug_c", "Café molido", [CAFE]),
      card("sug_g", "Leche entera", [LECHE_UNO, LECHE_DOS]),
      card("sug_add", "Aceite", [ACEITE], "prod_aceite"),
    ]);
    render(<ProductsTab />);
    // The coffee has two loaded lines, «Sal» none: lines first, then the name.
    expect(shownNames()).toEqual(["Leche entera", "Café molido", "Sal"]);
    const boxes = screen.getAllByRole("checkbox", { name: /^Seleccionar la sugerencia/ });
    expect(boxes.map((box) => box.getAttribute("aria-label"))).toEqual([
      "Seleccionar la sugerencia «Aceite»",
      "Seleccionar la sugerencia «Leche entera»",
      "Seleccionar la sugerencia «Café molido»",
      "Seleccionar la sugerencia «Sal»",
    ]);
  });

  it("puts a card that lands below the last one and sorts again only on the next search", () => {
    enqueue([card("sug_z", "Zeta", [member(UNO, "zeta")]), card("sug_l", "Leche entera", [LECHE_UNO, LECHE_DOS])]);
    render(<ProductsTab />);
    expect(shownNames()).toEqual(["Leche entera", "Zeta"]);
    // A canned batch: a three-member group and a singleton that would both sort first.
    act(() => {
      useSuggestionsStore.getState().enqueueProducts([
        card("sug_a", "Alfa", [member(UNO, "alfa")]),
        card("sug_d", "Delta", [member(UNO, "d1"), member(UNO, "d2"), member(DOS, "d3")]),
      ]);
    });
    expect(shownNames()).toEqual(["Leche entera", "Zeta", "Delta", "Alfa"]);
    // Typing in the search sorts the whole queue again.
    typeSearch("a");
    typeSearch("");
    expect(shownNames()).toEqual(["Delta", "Leche entera", "Alfa", "Zeta"]);
  });

  it("does not move the card the user is working on when a rename changes its sort name", () => {
    enqueue([card("sug_a", "Alfa", [member(UNO, "alfa")]), card("sug_b", "Beta", [member(UNO, "beta")])]);
    render(<ProductsTab />);
    const input = nameInput("Alfa");
    fireEvent.change(input, { target: { value: "Zzz" } });
    fireEvent.blur(input);
    expect(shownNames()).toEqual(["Zzz", "Beta"]);
  });
});

describe("filters and search (D-20, E4)", () => {
  function mixedQueue(): ProductSuggestion[] {
    return [
      card("sug_g", "Leche entera", [LECHE_UNO, LECHE_DOS]),
      card("sug_c", "Café molido", [CAFE]),
      card("sug_a", "Azúcar", [AZUCAR]),
      card("sug_add", "Aceite", [ACEITE], "prod_aceite"),
    ];
  }

  it("names the toggle group and counts every pending card in each toggle", () => {
    seedAceite();
    enqueue(mixedQueue());
    render(<ProductsTab />);
    expect(screen.getByRole("group", { name: "Filtrar sugerencias" })).toBeInTheDocument();
    for (const label of ["Todas (4)", "Varios (1)", "De uno (2)", "Para agregar (1)"]) {
      expect(button(label)).toBeInTheDocument();
    }
    expect(button("Todas (4)")).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps each filter's cards, and the counts do not change with the filter or the search", () => {
    seedAceite();
    enqueue(mixedQueue());
    render(<ProductsTab />);
    fireEvent.click(button("Varios (1)"));
    expect(shownNames()).toEqual(["Leche entera"]);
    expect(button("Varios (1)")).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(button("De uno (2)"));
    expect(shownNames()).toEqual(["Café molido", "Azúcar"]);
    fireEvent.click(button("Para agregar (1)"));
    expect(shownNames()).toEqual([]);
    expect(screen.getByRole("heading", { name: "Agregar a «Aceite»" })).toBeInTheDocument();
    typeSearch("zzz");
    expect(button("Todas (4)")).toBeInTheDocument();
    expect(button("Para agregar (1)")).toBeInTheDocument();
  });

  it("pressing the pressed toggle keeps the filter (the group never ends with none)", () => {
    enqueue(mixedQueue());
    render(<ProductsTab />);
    fireEvent.click(button("De uno (2)"));
    fireEvent.click(button("De uno (2)"));
    expect(button("De uno (2)")).toHaveAttribute("aria-pressed", "true");
    expect(shownNames()).toEqual(["Café molido", "Azúcar"]);
  });

  it("searches by name, by member description and by supplier name, ignoring case and accents", () => {
    enqueue(mixedQueue());
    render(<ProductsTab />);
    typeSearch("CAFE");
    expect(shownNames()).toEqual(["Café molido"]);
    typeSearch("leche entera 1l");
    expect(shownNames()).toEqual(["Leche entera"]);
    typeSearch("tienda dos");
    expect(shownNames()).toEqual(["Leche entera"]);
    typeSearch("");
    expect(shownNames()).toHaveLength(3);
  });

  it("finds an «Agregar a» card by the name of its product, not by the name DeepSeek gave it", () => {
    seedAceite();
    enqueue([card("sug_add", "Nombre de DeepSeek", [ACEITE], "prod_aceite")]);
    render(<ProductsTab />);
    typeSearch("aceite");
    expect(screen.getByRole("heading", { name: "Agregar a «Aceite»" })).toBeInTheDocument();
    typeSearch("zzz");
    expect(screen.queryByRole("heading", { name: "Agregar a «Aceite»" })).toBeNull();
  });

  it("explains an empty result with the typed text, and without text when only the filter is empty", () => {
    enqueue(threeCards());
    render(<ProductsTab />);
    typeSearch("  zzz ");
    expect(
      screen.getByText("Ninguna sugerencia coincide con «zzz». Revisa la búsqueda o el filtro."),
    ).toBeInTheDocument();
    expect(nameInputs()).toHaveLength(0);
    typeSearch("");
    fireEvent.click(button("Para agregar (0)"));
    expect(screen.getByText("No hay sugerencias en este filtro.")).toBeInTheDocument();
  });

  it("does not render the section with no pending card, so there is no toolbar either", () => {
    render(<ProductsTab />);
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(screen.queryByRole("group", { name: "Filtrar sugerencias" })).toBeNull();
  });
});

describe("«Mostrar más» (E4 overflow)", () => {
  it("shows 50 cards, then adds 50 more and then the rest", () => {
    enqueue(manyCards(120));
    render(<ProductsTab />);
    expect(nameInputs()).toHaveLength(50);
    fireEvent.click(button("Mostrar 50 más"));
    expect(nameInputs()).toHaveLength(100);
    fireEvent.click(button("Mostrar 20 más"));
    expect(nameInputs()).toHaveLength(120);
    expect(screen.queryByRole("button", { name: /^Mostrar \d+ más$/ })).toBeNull();
  });

  it("shows no button with 50 cards or fewer", () => {
    enqueue(manyCards(50));
    render(<ProductsTab />);
    expect(nameInputs()).toHaveLength(50);
    expect(screen.queryByRole("button", { name: /^Mostrar \d+ más$/ })).toBeNull();
  });

  it("starts again from the first page when the search changes", () => {
    enqueue(manyCards(120));
    render(<ProductsTab />);
    fireEvent.click(button("Mostrar 50 más"));
    expect(nameInputs()).toHaveLength(100);
    typeSearch("Producto 0");
    // «Producto 001»…«Producto 099» match: 99 cards, 50 shown.
    expect(nameInputs()).toHaveLength(50);
    expect(button("Mostrar 49 más")).toBeInTheDocument();
  });

  it("keeps a card split off the 50th card on the page, with the focus on its name", () => {
    enqueue(manyGroups(55));
    render(<ProductsTab />);
    expect(nameInputs()).toHaveLength(50);
    const last = cardOf(nameInput("Grupo 050"));
    fireEvent.click(within(last).getByRole("checkbox", { name: "Elegir «grupo 050 a»" }));
    fireEvent.click(within(last).getByRole("button", { name: "Separar en producto nuevo desde «Grupo 050»" }));
    expect(nameInputs()).toHaveLength(51);
    const names = shownNames();
    expect(names[49]).toBe("Grupo 050");
    expect(names[50]).toBe("grupo 050 a");
    expect(nameInput("grupo 050 a")).toHaveFocus();
  });
});

describe("selection and the bulk bar (D-20)", () => {
  it("has «Seleccionar visibles» unchecked, mixed with some selected and checked with all", () => {
    enqueue(threeCards());
    render(<ProductsTab />);
    expect(selectVisibleBox()).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText("0 seleccionadas")).toBeInTheDocument();
    fireEvent.click(selectCardBox("Leche entera"));
    expect(selectVisibleBox()).toHaveAttribute("aria-checked", "mixed");
    expect(screen.getByText("1 seleccionada")).toBeInTheDocument();
    fireEvent.click(selectVisibleBox());
    expect(selectVisibleBox()).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("3 seleccionadas")).toBeInTheDocument();
    fireEvent.click(selectVisibleBox());
    expect(selectVisibleBox()).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText("0 seleccionadas")).toBeInTheDocument();
  });

  it("selects every card that matches, shown or not", () => {
    enqueue(manyCards(60));
    render(<ProductsTab />);
    fireEvent.click(selectVisibleBox());
    expect(screen.getByText("60 seleccionadas")).toBeInTheDocument();
  });

  it("keeps the selection only for the cards that still match the filter and the search", () => {
    enqueue(threeCards());
    render(<ProductsTab />);
    fireEvent.click(selectCardBox("Leche entera"));
    fireEvent.click(selectCardBox("Azúcar"));
    expect(screen.getByText("2 seleccionadas")).toBeInTheDocument();
    fireEvent.click(button("De uno (2)"));
    expect(screen.getByText("1 seleccionada")).toBeInTheDocument();
    expect(selectCardBox("Azúcar")).toBeChecked();
    // Back to all: the card that did not match meanwhile is no longer selected.
    fireEvent.click(button("Todas (3)"));
    expect(selectCardBox("Leche entera")).not.toBeChecked();
    expect(screen.getByText("1 seleccionada")).toBeInTheDocument();
  });

  it("makes «Aceptar seleccionadas» and «Rechazar seleccionadas» aria-disabled at 0, and does nothing", () => {
    enqueue(threeCards());
    render(<ProductsTab />);
    for (const name of ["Aceptar seleccionadas", "Rechazar seleccionadas"]) {
      const target = button(name);
      expect(target).toHaveAttribute("aria-disabled", "true");
      fireEvent.click(target);
    }
    expect(storedProducts()).toEqual([]);
    expect(pendingIds()).toHaveLength(3);
    expect(toastMock).not.toHaveBeenCalled();
    fireEvent.click(selectCardBox("Azúcar"));
    expect(button("Aceptar seleccionadas")).not.toHaveAttribute("aria-disabled");
  });

  it("applies nothing by selecting, searching or filtering", () => {
    enqueue(threeCards());
    render(<ProductsTab />);
    fireEvent.click(selectVisibleBox());
    typeSearch("leche");
    fireEvent.click(button("Varios (1)"));
    expect(storedProducts()).toEqual([]);
    expect(pendingIds()).toHaveLength(3);
    expect(toastMock).not.toHaveBeenCalled();
  });
});

describe("«Aceptar seleccionadas» (D-20, D-35, A-4)", () => {
  it("creates the selected products without a dialog and tells how many", () => {
    enqueue(threeCards());
    render(<ProductsTab />);
    fireEvent.click(selectCardBox("Leche entera"));
    fireEvent.click(selectCardBox("Azúcar"));
    fireEvent.click(button("Aceptar seleccionadas"));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(storedProducts().map((entry) => entry.name)).toEqual(["Leche entera", "Azúcar"]);
    expect(pendingIds()).toEqual(["sug_b"]);
    expect(toastMock).toHaveBeenCalledTimes(1);
    expect(toastMessage(0)).toBe("2 productos creados");
    expect(screen.getByText("0 seleccionadas")).toBeInTheDocument();
  });

  it("accepts the cards in the order of the list and refuses a repeated name, which stays with its error", () => {
    enqueue([
      card("sug_a", "Leche", [LECHE_UNO, LECHE_DOS]),
      card("sug_b", "leche", [CAFE]),
      card("sug_c", "Azúcar", [AZUCAR]),
    ]);
    render(<ProductsTab />);
    fireEvent.click(selectVisibleBox());
    fireEvent.click(button("Aceptar seleccionadas"));
    expect(storedProducts().map((entry) => entry.name)).toEqual(["Leche", "Azúcar"]);
    expect(pendingIds()).toEqual(["sug_b"]);
    expect(toastMessage(0)).toBe("2 productos creados; 1 quedó en la cola");
    expect(
      screen.getByText("Ya existe un producto con ese nombre. Cambia el nombre o usa «Unir con…»."),
    ).toBeInTheDocument();
    // The refused card stays selected.
    expect(screen.getByText("1 seleccionada")).toBeInTheDocument();
  });

  it("uses the name as typed in a field that was not stored yet", () => {
    enqueue([card("sug_a", "Leche", [LECHE_UNO, LECHE_DOS]), card("sug_c", "Azúcar", [AZUCAR])]);
    render(<ProductsTab />);
    fireEvent.change(nameInput("Leche"), { target: { value: "Leche deslactosada" } });
    fireEvent.click(selectVisibleBox());
    fireEvent.click(button("Aceptar seleccionadas"));
    expect(storedProducts().map((entry) => entry.name)).toEqual(["Leche deslactosada", "Azúcar"]);
  });

  it("moves the focus to the tab heading when everything was accepted", async () => {
    enqueue([card("sug_a", "Leche", [LECHE_UNO])]);
    render(<ProductsTab />);
    fireEvent.click(selectVisibleBox());
    fireEvent.click(button("Aceptar seleccionadas"));
    expect(screen.queryByRole("heading", { name: /Sugerencias de productos/ })).toBeNull();
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Productos", level: 2 })).toHaveFocus();
    });
  });

  it("adds only the checked members of an «Agregar a» card and keeps the unchecked ones in it", () => {
    seedAceite();
    const oliva = member(UNO, "Aceite de oliva");
    enqueue([card("sug_add", "Aceite", [ACEITE, oliva], "prod_aceite")]);
    render(<ProductsTab />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Elegir «Aceite de oliva»" }));
    fireEvent.click(selectCardBox("Aceite"));
    fireEvent.click(button("Aceptar seleccionadas"));
    const [aceite] = storedProducts();
    expect(aceite?.members.map((entry) => entry.description)).toEqual(["aceite 1l", "Aceite vegetal 1L"]);
    const left = useSuggestionsStore.getState().products;
    expect(left.map((entry) => entry.id)).toEqual(["sug_add"]);
    expect(left[0]?.members.map((entry) => entry.description)).toEqual(["Aceite de oliva"]);
    expect(toastMessage(0)).toBe("Descripciones sumadas a 1 producto");
  });

  it("refuses an «Agregar a» card whose product was deleted and says so under its buttons", () => {
    enqueue([card("sug_add", "Aceite", [ACEITE], "prod_borrado")]);
    render(<ProductsTab />);
    fireEvent.click(selectVisibleBox());
    fireEvent.click(button("Aceptar seleccionadas"));
    expect(
      screen.getByText("Ese producto ya no existe. Rechaza la sugerencia o únela con otro producto."),
    ).toBeInTheDocument();
    expect(toastMessage(0)).toBe("0 productos creados; 1 quedó en la cola");
    expect(pendingIds()).toEqual(["sug_add"]);
  });
});

describe("«Rechazar seleccionadas» (D-20, D-22)", () => {
  it("removes the selected cards with «{n} sugerencias rechazadas» and «Deshacer» for six seconds", () => {
    enqueue(threeCards());
    render(<ProductsTab />);
    fireEvent.click(selectCardBox("Leche entera"));
    fireEvent.click(selectCardBox("Azúcar"));
    fireEvent.click(button("Rechazar seleccionadas"));
    expect(shownNames()).toEqual(["Café molido"]);
    expect(storedProducts()).toEqual([]);
    const toast = undoToast(0);
    expect(toast.message).toBe("2 sugerencias rechazadas");
    expect(toast.label).toBe("Deshacer");
    expect(toast.duration).toBe(6000);
  });

  it("«Deshacer» brings every card back to the place it had", () => {
    enqueue(threeCards());
    const before = useSuggestionsStore.getState().products;
    render(<ProductsTab />);
    fireEvent.click(selectCardBox("Leche entera"));
    fireEvent.click(selectCardBox("Azúcar"));
    fireEvent.click(button("Rechazar seleccionadas"));
    act(() => {
      undoToast(0).undo();
    });
    expect(useSuggestionsStore.getState().products).toEqual(before);
    expect(shownNames()).toEqual(["Leche entera", "Café molido", "Azúcar"]);
  });

  it("says «1 sugerencia rechazada» for one card", () => {
    enqueue(threeCards());
    render(<ProductsTab />);
    fireEvent.click(selectCardBox("Azúcar"));
    fireEvent.click(button("Rechazar seleccionadas"));
    expect(undoToast(0).message).toBe("1 sugerencia rechazada");
    expect(pendingIds()).toEqual(["sug_a", "sug_b"]);
  });
});

describe("«Aceptar todas las visibles» (D-20, OQ6)", () => {
  it("opens a dialog that states the count and has «Volver a revisar» focused", async () => {
    enqueue(manyCards(3));
    render(<ProductsTab />);
    fireEvent.click(button("Aceptar todas las visibles"));
    const dialog = dialogOf();
    expect(within(dialog).getByText("¿Aceptar 3 sugerencias?")).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        "Se crearán 3 productos nuevos. Podrás editarlos o borrarlos en «Mis productos».",
      ),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(within(dialog).getByRole("button", { name: "Volver a revisar" })).toHaveFocus();
    });
    expect(within(dialog).getByRole("button", { name: "Aceptar 3 sugerencias" })).toBeInTheDocument();
    expect(storedProducts()).toEqual([]);
  });

  it("counts every card that matches, including those «Mostrar más» has not shown", () => {
    enqueue(manyCards(120));
    render(<ProductsTab />);
    expect(nameInputs()).toHaveLength(50);
    fireEvent.click(button("Aceptar todas las visibles"));
    expect(within(dialogOf()).getByText("¿Aceptar 120 sugerencias?")).toBeInTheDocument();
  });

  it("counts only the cards that match the active filter and search", () => {
    enqueue([...manyCards(10), ...manyGroups(4)]);
    render(<ProductsTab />);
    fireEvent.click(button("Varios (4)"));
    fireEvent.click(button("Aceptar todas las visibles"));
    expect(within(dialogOf()).getByText("¿Aceptar 4 sugerencias?")).toBeInTheDocument();
    fireEvent.click(within(dialogOf()).getByRole("button", { name: "Volver a revisar" }));
    fireEvent.click(button("Todas (14)"));
    typeSearch("Producto 00");
    fireEvent.click(button("Aceptar todas las visibles"));
    // «Producto 001»…«Producto 009» match; «Producto 010» does not.
    expect(within(dialogOf()).getByText("¿Aceptar 9 sugerencias?")).toBeInTheDocument();
  });

  it("splits the body into new products and products that get descriptions, leaving a zero part out", () => {
    seedAceite();
    enqueue([...manyCards(2), card("sug_add", "Aceite", [ACEITE], "prod_aceite")]);
    render(<ProductsTab />);
    fireEvent.click(button("Aceptar todas las visibles"));
    expect(
      within(dialogOf()).getByText(
        "Se crearán 2 productos nuevos y se sumarán descripciones a 1 producto que ya tienes. Podrás editarlos o borrarlos en «Mis productos».",
      ),
    ).toBeInTheDocument();
    expect(within(dialogOf()).getByText("¿Aceptar 3 sugerencias?")).toBeInTheDocument();
    fireEvent.click(within(dialogOf()).getByRole("button", { name: "Volver a revisar" }));
    fireEvent.click(button("Para agregar (1)"));
    fireEvent.click(button("Aceptar todas las visibles"));
    expect(
      within(dialogOf()).getByText(
        "Se sumarán descripciones a 1 producto que ya tienes. Podrás editarlos o borrarlos en «Mis productos».",
      ),
    ).toBeInTheDocument();
  });

  it("«Volver a revisar» closes it and changes nothing", () => {
    enqueue(manyCards(3));
    render(<ProductsTab />);
    fireEvent.click(button("Aceptar todas las visibles"));
    fireEvent.click(within(dialogOf()).getByRole("button", { name: "Volver a revisar" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(storedProducts()).toEqual([]);
    expect(pendingIds()).toHaveLength(3);
    expect(toastMock).not.toHaveBeenCalled();
  });

  it("the accent button accepts every visible card, shown or not, and tells how many", async () => {
    enqueue(manyCards(120));
    render(<ProductsTab />);
    fireEvent.click(button("Aceptar todas las visibles"));
    fireEvent.click(within(dialogOf()).getByRole("button", { name: "Aceptar 120 sugerencias" }));
    expect(storedProducts()).toHaveLength(120);
    expect(pendingIds()).toEqual([]);
    expect(toastMessage(0)).toBe("120 productos creados");
    expect(screen.queryByRole("alertdialog")).toBeNull();
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Productos", level: 2 })).toHaveFocus();
    });
  });

  it("only accepts the cards of the filter it was opened with, and leaves the rest pending", () => {
    enqueue([...manyCards(3), ...manyGroups(2)]);
    render(<ProductsTab />);
    fireEvent.click(button("Varios (2)"));
    fireEvent.click(button("Aceptar todas las visibles"));
    fireEvent.click(within(dialogOf()).getByRole("button", { name: "Aceptar 2 sugerencias" }));
    expect(storedProducts().map((entry) => entry.name)).toEqual(["Grupo 001", "Grupo 002"]);
    expect(pendingIds()).toHaveLength(3);
  });

  it("fixes the cards when it opens: a card that lands meanwhile is not accepted", () => {
    enqueue(manyCards(2));
    render(<ProductsTab />);
    fireEvent.click(button("Aceptar todas las visibles"));
    act(() => {
      useSuggestionsStore.getState().enqueueProducts([card("sug_late", "Tardía", [member(DOS, "tardia")])]);
    });
    expect(within(dialogOf()).getByText("¿Aceptar 2 sugerencias?")).toBeInTheDocument();
    fireEvent.click(within(dialogOf()).getByRole("button", { name: "Aceptar 2 sugerencias" }));
    expect(storedProducts()).toHaveLength(2);
    expect(pendingIds()).toEqual(["sug_late"]);
  });

  it("keeps a refused card with its error and counts it in the toast", () => {
    enqueue([
      card("sug_a", "Leche", [LECHE_UNO]),
      card("sug_b", "leche", [CAFE]),
      card("sug_c", "Azúcar", [AZUCAR]),
    ]);
    render(<ProductsTab />);
    fireEvent.click(button("Aceptar todas las visibles"));
    fireEvent.click(within(dialogOf()).getByRole("button", { name: "Aceptar 3 sugerencias" }));
    expect(toastMessage(0)).toBe("2 productos creados; 1 quedó en la cola");
    expect(pendingIds()).toHaveLength(1);
    expect(screen.getByText(/Ya existe un producto con ese nombre/)).toBeInTheDocument();
  });

  it("is aria-disabled when no card matches, and opens nothing", () => {
    enqueue(manyCards(2));
    render(<ProductsTab />);
    typeSearch("zzz");
    const target = button("Aceptar todas las visibles");
    expect(target).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(target);
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
});
