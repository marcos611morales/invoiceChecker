// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { Concepto, ParsedInvoice } from "@/domain/cfdi/types";
import type { ProductSuggestion } from "@/domain/llm/suggestions";
import { normalizeDescription } from "@/domain/settings/normalize";
import { LIMITS, defaultSettings, type Product, type ProductMember } from "@/domain/settings/types";
import { useSessionStore } from "@/stores/sessionStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useSuggestionsStore } from "@/stores/suggestionsStore";
import { makeInvoice } from "../../../tests/support/ledgerFactory";
import "../../../tests/support/domPolyfills";
import { resetSettingsStore } from "../../../tests/support/settingsStorage";
import { ProductsTab } from "./ProductsTab";

const toastMock = vi.hoisted(() => vi.fn<(message: string, options?: unknown) => void>());
vi.mock("sonner", () => ({ toast: toastMock }));

const STORAGE_KEY = "invoicechecker:settings";
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

/** Five distinct pairs of supplier and description: three at Tienda Uno, two at Tienda Dos. */
function seedInvoices(): void {
  const invoices = [
    invoice(UNO, ["Leche entera 1L", "Café Molido 1kg", "Azúcar"]),
    invoice(DOS, ["LECHE ENTERA 1L", "Sal"]),
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

function card(id: string, name: string, members: ProductMember[]): ProductSuggestion {
  return { id, name, target: null, members };
}

function enqueue(cards: ProductSuggestion[]): void {
  act(() => {
    useSuggestionsStore.setState({ products: cards });
  });
}

/** Three cards: «Leche entera» (two members), «Café molido» and «Azúcar». */
function threeCards(): ProductSuggestion[] {
  return [
    card("sug_a", "Leche entera", [LECHE_UNO, LECHE_DOS]),
    card("sug_b", "Café molido", [CAFE]),
    card("sug_c", "Azúcar", [AZUCAR]),
  ];
}

function acceptButton(name: string): HTMLElement {
  return screen.getByRole("button", { name: `Aceptar la sugerencia «${name}»` });
}

/** The first «Aceptar» of the page, for a card whose name is blank and so has no usable accessible name to look up. */
function firstAcceptButton(): HTMLElement {
  const [first] = screen.getAllByRole("button", { name: /^Aceptar la sugerencia/ });
  if (first === undefined) throw new Error("no Aceptar button on the page");
  return first;
}

function press(name: string): void {
  fireEvent.click(acceptButton(name));
}

function storedProducts(): Product[] {
  return useSettingsStore.getState().products;
}

function productWith(id: string, name: string, members: ProductMember[]): Product {
  return { id, name, categoryId: null, members };
}

/** The text of the element the button points at with aria-describedby, or null. */
function describedText(button: HTMLElement): string | null {
  const id = button.getAttribute("aria-describedby");
  if (id === null) return null;
  return document.getElementById(id)?.textContent ?? null;
}

beforeEach(() => {
  toastMock.mockReset();
  window.localStorage.clear();
  resetSettingsStore();
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
});

describe("«Aceptar» creates the product (LLM-04, D-06, D-09)", () => {
  it("changes nothing in the settings until a card is accepted", () => {
    enqueue(threeCards());
    render(<ProductsTab />);
    expect(storedProducts()).toEqual([]);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(toastMock).not.toHaveBeenCalled();
  });

  it("stores a product with a prod_ id, the card name, no category and the four member fields, and removes the card", () => {
    enqueue(threeCards());
    render(<ProductsTab />);
    press("Leche entera");
    const [created, ...rest] = storedProducts();
    expect(rest).toEqual([]);
    expect(created).toBeDefined();
    if (created === undefined) return;
    expect(created.id).toMatch(/^prod_/);
    expect(created.name).toBe("Leche entera");
    expect(created.categoryId).toBeNull();
    expect(created.members).toEqual([
      { rfc: UNO.rfc, key: "leche entera 1l", description: "Leche entera 1L", supplierName: "Tienda Uno" },
      { rfc: DOS.rfc, key: "leche entera 1l", description: "LECHE ENTERA 1L", supplierName: "Tienda Dos" },
    ]);
    expect(useSuggestionsStore.getState().products.map((entry) => entry.id)).toEqual([
      "sug_b",
      "sug_c",
    ]);
    expect(screen.queryByRole("heading", { name: "Leche entera", level: 3 })).toBeNull();
    expect(screen.getByRole("heading", { name: "Sugerencias de productos · 2" })).toBeInTheDocument();
  });

  it("gives every accepted product its own id", () => {
    enqueue(threeCards());
    render(<ProductsTab />);
    press("Leche entera");
    press("Azúcar");
    const ids = storedProducts().map((entry) => entry.id);
    expect(new Set(ids).size).toBe(2);
  });

  it("shows the toast «Producto «{nombre}» creado» with the name cut at 40 characters", () => {
    const long = "x".repeat(50);
    enqueue([card("sug_a", "Leche entera", [LECHE_UNO]), card("sug_l", long, [CAFE])]);
    render(<ProductsTab />);
    press("Leche entera");
    expect(toastMock.mock.calls[0]?.[0]).toBe("Producto «Leche entera» creado");
    press(long);
    expect(toastMock.mock.calls[1]?.[0]).toBe(`Producto «${"x".repeat(39)}…» creado`);
    // The product itself keeps the whole name.
    expect(storedProducts().map((entry) => entry.name)).toEqual(["Leche entera", long]);
  });

  it("announces the creation and how many suggestions remain", () => {
    enqueue(threeCards());
    render(<ProductsTab />);
    press("Leche entera");
    expect(
      screen.getByText("Producto «Leche entera» creado. Quedan 2 sugerencias."),
    ).toBeInTheDocument();
    press("Café molido");
    expect(
      screen.getByText("Producto «Café molido» creado. Queda 1 sugerencia."),
    ).toBeInTheDocument();
    press("Azúcar");
    expect(
      screen.getByText("Producto «Azúcar» creado. No quedan sugerencias."),
    ).toBeInTheDocument();
  });
});

describe("focus after an accept (UI-SPEC accessibility)", () => {
  it("moves to the name of the next card", () => {
    enqueue(threeCards());
    render(<ProductsTab />);
    press("Leche entera");
    expect(screen.getByRole("heading", { name: "Café molido", level: 3 })).toHaveFocus();
  });

  it("moves to the queue heading when the accepted card was the last of the list", () => {
    enqueue(threeCards());
    render(<ProductsTab />);
    press("Azúcar");
    expect(screen.getByRole("heading", { name: "Sugerencias de productos · 2" })).toHaveFocus();
  });

  it("moves to the tab heading when the queue empties, because the queue section is gone", () => {
    enqueue([card("sug_a", "Leche entera", [LECHE_UNO])]);
    render(<ProductsTab />);
    press("Leche entera");
    expect(screen.queryByRole("heading", { name: /Sugerencias de productos/ })).toBeNull();
    expect(screen.getByRole("heading", { name: "Productos", level: 2 })).toHaveFocus();
  });
});

describe("E4: a refused accept keeps the card and says why", () => {
  const cases: {
    title: string;
    prepare: () => void;
    name: string;
    members: ProductMember[];
    text: string;
  }[] = [
    {
      title: "a name that another product already has",
      prepare: () => {
        useSettingsStore.setState({ products: [productWith("prod_x", "leche ENTERA", [CAFE])] });
      },
      name: " Leche entera ",
      members: [LECHE_UNO],
      text: "Ya existe un producto con ese nombre. Cambia el nombre o usa «Unir con…».",
    },
    {
      title: "the reserved name",
      prepare: () => undefined,
      name: "Sin categoría",
      members: [LECHE_UNO],
      text: "«Sin categoría» es un nombre reservado.",
    },
    {
      title: "an empty name",
      prepare: () => undefined,
      name: "   ",
      members: [LECHE_UNO],
      text: "Escribe un nombre para el producto.",
    },
    {
      title: "a name over 60 characters",
      prepare: () => undefined,
      name: "n".repeat(61),
      members: [LECHE_UNO],
      text: "El nombre puede tener hasta 60 caracteres.",
    },
    {
      title: "the product limit",
      prepare: () => {
        useSettingsStore.setState({
          products: Array.from({ length: LIMITS.products }, (_, index) =>
            productWith(`prod_${String(index)}`, `Producto ${String(index)}`, [
              { rfc: "ZZZ", key: `k${String(index)}`, description: "d", supplierName: "s" },
            ]),
          ),
        });
      },
      name: "Uno más",
      members: [LECHE_UNO],
      text: "Alcanzaste el límite de 2,000 productos. Borra alguno para aceptar más.",
    },
    {
      title: "a description that is already in another product",
      prepare: () => {
        useSettingsStore.setState({ products: [productWith("prod_x", "Otro", [LECHE_UNO])] });
      },
      name: "Leche",
      members: [LECHE_UNO],
      text: "Algunas descripciones de esta sugerencia ya están en otro producto. Revisa «Mis productos».",
    },
    {
      title: "a description marked «No agrupar»",
      prepare: () => {
        useSettingsStore.setState({ ungroupedConcepts: [{ ...LECHE_UNO }] });
      },
      name: "Leche",
      members: [LECHE_UNO],
      text: "Algunas descripciones de esta sugerencia ya están en otro producto. Revisa «Mis productos».",
    },
  ];

  it.each(cases)("$title", ({ prepare, name, members, text }) => {
    prepare();
    const before = storedProducts();
    enqueue([card("sug_a", name, members), card("sug_b", "Café molido", [CAFE])]);
    render(<ProductsTab />);
    const button = firstAcceptButton();
    expect(button.getAttribute("aria-describedby")).toBeNull();
    fireEvent.click(button);
    expect(screen.getByText(text)).toBeInTheDocument();
    expect(describedText(firstAcceptButton())).toBe(text);
    // Nothing changed: the settings, the queue, the toast and the announcement.
    expect(storedProducts()).toBe(before);
    expect(useSuggestionsStore.getState().products.map((entry) => entry.id)).toEqual([
      "sug_a",
      "sug_b",
    ]);
    expect(toastMock).not.toHaveBeenCalled();
    // The other card has no message.
    expect(acceptButton("Café molido").getAttribute("aria-describedby")).toBeNull();
  });

  it("clears the message once the cause is gone and the accept succeeds", () => {
    useSettingsStore.setState({ products: [productWith("prod_x", "Leche entera", [CAFE])] });
    enqueue([card("sug_a", "Leche entera", [LECHE_UNO]), card("sug_b", "Azúcar", [AZUCAR])]);
    render(<ProductsTab />);
    press("Leche entera");
    const message = "Ya existe un producto con ese nombre. Cambia el nombre o usa «Unir con…».";
    expect(screen.getByText(message)).toBeInTheDocument();
    act(() => {
      useSettingsStore.setState({ products: [] });
    });
    press("Leche entera");
    expect(screen.queryByText(message)).toBeNull();
    expect(storedProducts().map((entry) => entry.name)).toEqual(["Leche entera"]);
  });

  it("keeps the focus on the button of a refused card", () => {
    useSettingsStore.setState({ products: [productWith("prod_x", "Leche entera", [CAFE])] });
    enqueue([card("sug_a", "Leche entera", [LECHE_UNO]), card("sug_b", "Azúcar", [AZUCAR])]);
    render(<ProductsTab />);
    const button = acceptButton("Leche entera");
    button.focus();
    fireEvent.click(button);
    expect(button).toHaveFocus();
  });
});

describe("accepted descriptions are no longer free (D-04, D-13, ROADMAP criterion 2)", () => {
  function caption(): string {
    const button = screen.getByRole("button", { name: "Agrupar productos" });
    const id = button.getAttribute("aria-describedby");
    return (id === null ? null : document.getElementById(id)?.textContent) ?? "";
  }

  it("counts the pending and the accepted descriptions out of the free ones, before and after the accept", () => {
    enqueue(threeCards());
    render(<ProductsTab />);
    // Four of the five descriptions wait in cards: only «Sal» is free.
    expect(caption()).toBe("1 descripción sin agrupar");
    press("Leche entera");
    expect(caption()).toBe("1 descripción sin agrupar");
  });

  it("keeps the product after a reload, and its descriptions stay out of the caption and of what is sent", () => {
    enqueue(threeCards());
    render(<ProductsTab />);
    press("Leche entera");
    const stored = window.localStorage.getItem(STORAGE_KEY);
    expect(stored).not.toBeNull();
    if (stored === null) return;
    cleanup();

    // The reload: a new page has the same stored settings, an empty queue and a fresh store.
    act(() => {
      useSuggestionsStore.setState({ products: [] });
      useSettingsStore.setState(defaultSettings());
    });
    window.localStorage.setItem(STORAGE_KEY, stored);
    act(() => {
      void useSettingsStore.persist.rehydrate();
    });
    expect(storedProducts().map((entry) => entry.name)).toEqual(["Leche entera"]);
    expect(storedProducts()[0]?.members).toHaveLength(2);

    render(<ProductsTab />);
    // Five descriptions, two of them in the product.
    expect(caption()).toBe("3 descripciones sin agrupar");
    fireEvent.click(screen.getByRole("button", { name: "Agrupar productos" }));
    const dialog = screen.getByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /Ver exactamente qué se envía/ }));
    const sent = within(dialog)
      .getAllByRole("listitem")
      .map((row) => row.querySelector("span")?.textContent ?? "")
      .sort();
    expect(sent).toEqual(["Azúcar", "Café Molido 1kg", "Sal"]);
  });

  it("does not keep a product that was never accepted: without it all five are free", () => {
    render(<ProductsTab />);
    expect(caption()).toBe("5 descripciones sin agrupar");
  });
});
