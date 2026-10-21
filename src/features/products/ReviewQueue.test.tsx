// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { Concepto, ParsedInvoice } from "@/domain/cfdi/types";
import { z } from "zod";
import { pendingQueueSchema, type ProductSuggestion } from "@/domain/llm/suggestions";
import { normalizeDescription } from "@/domain/settings/normalize";
import { LIMITS, defaultSettings, type Product, type ProductMember } from "@/domain/settings/types";
import { useSessionStore } from "@/stores/sessionStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useSuggestionsStore } from "@/stores/suggestionsStore";
import { makeInvoice } from "../../../tests/support/ledgerFactory";
import "../../../tests/support/domPolyfills";
import { nameInput, nameInputs } from "../../../tests/support/reviewQueue";
import { resetSettingsStore } from "../../../tests/support/settingsStorage";
import { readStoredQueue, resetSuggestionsStore } from "../../../tests/support/suggestionsStorage";
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

/** The first text of every row under the heading `heading` in the open send dialog. */
function sectionRows(dialog: HTMLElement, heading: string): string[] {
  const title = within(dialog).getByRole("heading", { name: heading });
  const section = title.closest("section");
  if (section === null) throw new Error(`the heading «${heading}» is not inside a section`);
  return within(section)
    .getAllByRole("listitem")
    .map((row) => row.querySelector("span")?.textContent ?? "");
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
    expect(nameInputs().map((input) => input.value)).toEqual(["Café molido", "Azúcar"]);
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
    expect(nameInput("Café molido")).toHaveFocus();
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
    const sent = sectionRows(dialog, "Descripciones y proveedores (3)").sort();
    expect(sent).toEqual(["Azúcar", "Café Molido 1kg", "Sal"]);
    // The accepted product travels by name only, as context (D-04, D-33).
    expect(sectionRows(dialog, "Productos existentes, solo como contexto (1)")).toEqual([
      "Leche entera",
    ]);
  });

  it("does not keep a product that was never accepted: without it all five are free", () => {
    render(<ProductsTab />);
    expect(caption()).toBe("5 descripciones sin agrupar");
  });
});

const NAME_LABEL = "Nombre del producto sugerido";
const QUEUE_KEY = "invoicechecker:suggestions";
const SAL = member(DOS, "Sal");
const MENSAJE_VACIO = "Escribe un nombre para el producto.";

const undoToastSchema = z.object({
  duration: z.number(),
  action: z.object({
    label: z.string(),
    onClick: z.custom<() => void>((value) => typeof value === "function"),
  }),
});

/** The toast at `index` of the mock: its message and the «Deshacer» action it offers. */
function undoToast(index: number): {
  message: string;
  duration: number;
  label: string;
  undo: () => void;
} {
  const call = toastMock.mock.calls[index];
  if (call === undefined) throw new Error(`there is no toast number ${String(index)}`);
  const [message, options] = call;
  const parsed = undoToastSchema.parse(options);
  return {
    message,
    duration: parsed.duration,
    label: parsed.action.label,
    undo: parsed.action.onClick,
  };
}

function freeCaption(): string {
  const button = screen.getByRole("button", { name: "Agrupar productos" });
  const id = button.getAttribute("aria-describedby");
  return (id === null ? null : document.getElementById(id)?.textContent) ?? "";
}

function queueNames(): string[] {
  return useSuggestionsStore.getState().products.map((entry) => entry.name);
}

function typeName(name: string, value: string): HTMLInputElement {
  const input = nameInput(name);
  fireEvent.change(input, { target: { value } });
  return input;
}

function cardOf(name: string): HTMLElement {
  const item = nameInput(name).closest("li");
  if (item === null) throw new Error(`the card «${name}» has no list item`);
  return item;
}

function banButtons(item: HTMLElement): HTMLElement[] {
  return within(item).getAllByRole("button", { name: "No agrupar esta descripción" });
}

function banButton(item: HTMLElement, index: number): HTMLElement {
  const button = banButtons(item)[index];
  if (button === undefined) throw new Error(`the card has no Ban button number ${String(index)}`);
  return button;
}

const storedEnvelopeSchema = z.object({ state: pendingQueueSchema });

async function storedNames(): Promise<string[]> {
  const envelope = storedEnvelopeSchema.parse(await readStoredQueue());
  return envelope.state.products.map((entry) => entry.name);
}

describe("the proposed name is an editable Input (D-12, D-19)", () => {
  it("shows one Input per card with the proposed name, at most 60 characters", () => {
    enqueue(threeCards());
    render(<ProductsTab />);
    const inputs = nameInputs();
    expect(inputs.map((input) => input.value)).toEqual(["Leche entera", "Café molido", "Azúcar"]);
    for (const input of inputs) {
      expect(input.getAttribute("maxlength")).toBe("60");
      expect(input).toHaveAccessibleName(NAME_LABEL);
      expect(input.getAttribute("aria-invalid")).toBeNull();
    }
  });

  it("stores the typed name only on Enter, keeps the focus in the field, and writes it to storage", async () => {
    enqueue(threeCards());
    render(<ProductsTab />);
    const input = nameInput("Café molido");
    input.focus();
    fireEvent.change(input, { target: { value: "Café tostado" } });
    expect(input.value).toBe("Café tostado");
    // Typing alone changes nothing in the queue.
    expect(queueNames()).toEqual(["Leche entera", "Café molido", "Azúcar"]);
    fireEvent.keyDown(input, { key: "Enter" });
    expect(queueNames()).toEqual(["Leche entera", "Café tostado", "Azúcar"]);
    expect(input).toHaveFocus();
    expect(await storedNames()).toEqual(["Leche entera", "Café tostado", "Azúcar"]);
    // The card keeps its id, target and members.
    const stored = useSuggestionsStore.getState().products[1];
    expect(stored?.id).toBe("sug_b");
    expect(stored?.members).toEqual([CAFE]);
  });

  it("stores the typed name when the field loses the focus", async () => {
    enqueue(threeCards());
    render(<ProductsTab />);
    const input = typeName("Azúcar", "Azúcar refinada");
    fireEvent.blur(input);
    expect(queueNames()).toEqual(["Leche entera", "Café molido", "Azúcar refinada"]);
    expect(await storedNames()).toEqual(["Leche entera", "Café molido", "Azúcar refinada"]);
  });

  it("survives a reload of the queue", async () => {
    enqueue(threeCards());
    render(<ProductsTab />);
    fireEvent.keyDown(typeName("Café molido", "Café tostado"), { key: "Enter" });
    const raw = window.localStorage.getItem(QUEUE_KEY);
    expect(raw).not.toBeNull();
    cleanup();
    // The reload: the memory is emptied (that writes too), the stored value is put back and read.
    act(() => {
      useSuggestionsStore.setState({ products: [] });
    });
    window.localStorage.setItem(QUEUE_KEY, raw ?? "");
    await act(async () => {
      await useSuggestionsStore.persist.rehydrate();
    });
    render(<ProductsTab />);
    expect(nameInputs().map((input) => input.value)).toEqual([
      "Leche entera",
      "Café tostado",
      "Azúcar",
    ]);
  });

  it("accepts the product with the typed name even when the field never lost the focus", () => {
    enqueue(threeCards());
    render(<ProductsTab />);
    typeName("Café molido", "Café tostado");
    press("Café molido");
    expect(storedProducts().map((entry) => entry.name)).toEqual(["Café tostado"]);
    expect(queueNames()).toEqual(["Leche entera", "Azúcar"]);
  });

  it("shows an empty name under the Input and refuses «Aceptar» with the same text; typing clears it", () => {
    enqueue(threeCards());
    render(<ProductsTab />);
    const input = typeName("Café molido", "");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(input.getAttribute("aria-invalid")).toBe("true");
    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).not.toBeNull();
    expect(document.getElementById(describedBy ?? "")?.textContent).toBe(MENSAJE_VACIO);
    expect(describedText(input)).toBe(MENSAJE_VACIO);
    // «Aceptar» of that card points at the same text, and refuses.
    const item = cardOf("");
    const button = within(item).getByRole("button", { name: /^Aceptar la sugerencia/ });
    expect(describedText(button)).toBe(MENSAJE_VACIO);
    fireEvent.click(button);
    expect(storedProducts()).toEqual([]);
    expect(queueNames()).toEqual(["Leche entera", "", "Azúcar"]);
    expect(screen.getAllByText(MENSAJE_VACIO)).toHaveLength(1);
    // Typing clears the error.
    fireEvent.change(nameInput(""), { target: { value: "C" } });
    expect(screen.queryByText(MENSAJE_VACIO)).toBeNull();
    expect(nameInput("C").getAttribute("aria-invalid")).toBeNull();
    expect(nameInput("C").getAttribute("aria-describedby")).toBeNull();
  });

  it("refuses the name of an accepted product ignoring case and edge spaces", () => {
    useSettingsStore.setState({ products: [productWith("prod_x", "Leche ENTERA", [AZUCAR])] });
    enqueue([card("sug_a", "Otro", [LECHE_UNO])]);
    render(<ProductsTab />);
    const input = typeName("Otro", "  leche entera ");
    fireEvent.keyDown(input, { key: "Enter" });
    const text = "Ya existe un producto con ese nombre. Cambia el nombre o usa «Unir con…».";
    expect(describedText(input)).toBe(text);
    expect(input.getAttribute("aria-invalid")).toBe("true");
    fireEvent.click(firstAcceptButton());
    expect(storedProducts().map((entry) => entry.name)).toEqual(["Leche ENTERA"]);
  });

  it("refuses «Sin categoría» as a name", () => {
    enqueue([card("sug_a", "Otro", [LECHE_UNO])]);
    render(<ProductsTab />);
    const input = typeName("Otro", "sin categoría");
    fireEvent.blur(input);
    expect(describedText(input)).toBe("«Sin categoría» es un nombre reservado.");
    fireEvent.click(firstAcceptButton());
    expect(storedProducts()).toEqual([]);
  });

  it("never accepts a product with more than 60 characters", () => {
    enqueue([card("sug_a", "n".repeat(61), [LECHE_UNO])]);
    render(<ProductsTab />);
    fireEvent.click(firstAcceptButton());
    expect(storedProducts().map((entry) => entry.name)).toEqual(["n".repeat(60)]);
  });
});

describe("«Rechazar» (D-22)", () => {
  function rejectButton(name: string): HTMLElement {
    return screen.getByRole("button", { name: `Rechazar la sugerencia «${name}»` });
  }

  it("is a neutral ghost button that names the card", () => {
    enqueue(threeCards());
    render(<ProductsTab />);
    expect(screen.getAllByRole("button", { name: /^Rechazar la sugerencia/ })).toHaveLength(3);
    expect(rejectButton("Café molido")).toHaveTextContent("Rechazar");
  });

  it("removes the card, leaves its descriptions free, and offers «Deshacer» for 6 seconds", async () => {
    enqueue(threeCards());
    render(<ProductsTab />);
    expect(freeCaption()).toBe("1 descripción sin agrupar");
    fireEvent.click(rejectButton("Café molido"));
    expect(queueNames()).toEqual(["Leche entera", "Azúcar"]);
    expect(storedProducts()).toEqual([]);
    expect(await storedNames()).toEqual(["Leche entera", "Azúcar"]);
    // «Café Molido 1kg» is free again for the next «Agrupar productos».
    expect(freeCaption()).toBe("2 descripciones sin agrupar");
    expect(toastMock).toHaveBeenCalledTimes(1);
    const rejected = undoToast(0);
    expect(rejected.message).toBe("Sugerencia «Café molido» rechazada");
    expect(rejected.duration).toBe(6000);
    expect(rejected.label).toBe("Deshacer");
    expect(
      screen.getByText("Sugerencia rechazada. Quedan 2 sugerencias."),
    ).toBeInTheDocument();
  });

  it("puts the card back where it was when «Deshacer» is pressed", () => {
    enqueue(threeCards());
    render(<ProductsTab />);
    fireEvent.click(rejectButton("Café molido"));
    act(() => {
      undoToast(0).undo();
    });
    expect(queueNames()).toEqual(["Leche entera", "Café molido", "Azúcar"]);
    expect(useSuggestionsStore.getState().products[1]?.members).toEqual([CAFE]);
    expect(freeCaption()).toBe("1 descripción sin agrupar");
    expect(nameInput("Café molido")).toBeInTheDocument();
  });

  it("rejects the card with the name the user typed, and undo restores that name", () => {
    enqueue(threeCards());
    render(<ProductsTab />);
    typeName("Café molido", "Café tostado");
    fireEvent.click(rejectButton("Café molido"));
    expect(undoToast(0).message).toBe("Sugerencia «Café tostado» rechazada");
    act(() => {
      undoToast(0).undo();
    });
    expect(queueNames()).toEqual(["Leche entera", "Café tostado", "Azúcar"]);
  });

  it("moves the focus to the name of the next card", () => {
    enqueue(threeCards());
    render(<ProductsTab />);
    fireEvent.click(rejectButton("Leche entera"));
    expect(nameInput("Café molido")).toHaveFocus();
  });

  it("moves the focus to the queue heading when the last card of several was rejected", () => {
    enqueue(threeCards());
    render(<ProductsTab />);
    fireEvent.click(rejectButton("Azúcar"));
    expect(screen.getByRole("heading", { name: "Sugerencias de productos · 2" })).toHaveFocus();
  });

  it("moves the focus to the tab heading when the queue empties, and announces it", () => {
    enqueue([card("sug_a", "Leche entera", [LECHE_UNO])]);
    render(<ProductsTab />);
    fireEvent.click(rejectButton("Leche entera"));
    expect(screen.getByRole("heading", { name: "Productos", level: 2 })).toHaveFocus();
    expect(screen.getByText("Sugerencia rechazada. No quedan sugerencias.")).toBeInTheDocument();
  });

  it("announces the singular when one suggestion remains", () => {
    enqueue([card("sug_a", "Leche entera", [LECHE_UNO]), card("sug_b", "Café molido", [CAFE])]);
    render(<ProductsTab />);
    fireEvent.click(rejectButton("Leche entera"));
    expect(screen.getByText("Sugerencia rechazada. Queda 1 sugerencia.")).toBeInTheDocument();
  });

  it("cuts a long name at 40 characters in the toast and keeps the whole name in the button label", () => {
    const long = "x".repeat(50);
    enqueue([card("sug_a", long, [LECHE_UNO])]);
    render(<ProductsTab />);
    fireEvent.click(rejectButton(long));
    expect(undoToast(0).message).toBe(`Sugerencia «${"x".repeat(39)}…» rechazada`);
  });
});

describe("«No agrupar esta descripción» on a member (D-19, D-22, D-13)", () => {
  it("is an icon button per member that names the description it acts on", () => {
    enqueue(threeCards());
    render(<ProductsTab />);
    const item = cardOf("Leche entera");
    const buttons = banButtons(item);
    expect(buttons).toHaveLength(2);
    expect(buttons.map((button) => describedText(button))).toEqual([
      "Leche entera 1L",
      "LECHE ENTERA 1L",
    ]);
    // A card with one member has one too.
    expect(banButtons(cardOf("Azúcar"))).toHaveLength(1);
  });

  it("takes the member out of a two-member card, marks it in the settings, and offers «Deshacer»", () => {
    enqueue(threeCards());
    render(<ProductsTab />);
    fireEvent.click(banButton(cardOf("Leche entera"), 1));
    expect(useSuggestionsStore.getState().products[0]?.members).toEqual([LECHE_UNO]);
    expect(within(cardOf("Leche entera")).queryByText("LECHE ENTERA 1L")).toBeNull();
    expect(useSettingsStore.getState().ungroupedConcepts).toEqual([LECHE_DOS]);
    expect(toastMock).toHaveBeenCalledTimes(1);
    const marked = undoToast(0);
    expect(marked.message).toBe("«LECHE ENTERA 1L» no se volverá a enviar");
    expect(marked.duration).toBe(6000);
    expect(marked.label).toBe("Deshacer");
    // The card stays and the focus goes to its name.
    expect(nameInput("Leche entera")).toHaveFocus();
  });

  it("«Deshacer» removes the mark and puts the member back at its place", () => {
    enqueue(threeCards());
    render(<ProductsTab />);
    fireEvent.click(banButton(cardOf("Leche entera"), 0));
    expect(useSuggestionsStore.getState().products[0]?.members).toEqual([LECHE_DOS]);
    act(() => {
      undoToast(0).undo();
    });
    expect(useSettingsStore.getState().ungroupedConcepts).toEqual([]);
    expect(useSuggestionsStore.getState().products[0]?.members).toEqual([LECHE_UNO, LECHE_DOS]);
    expect(within(cardOf("Leche entera")).getByText("Leche entera 1L")).toBeInTheDocument();
  });

  it("makes the card disappear when the member was its only one, and «Deshacer» brings the card back", () => {
    enqueue(threeCards());
    render(<ProductsTab />);
    fireEvent.click(banButton(cardOf("Café molido"), 0));
    expect(queueNames()).toEqual(["Leche entera", "Azúcar"]);
    expect(useSettingsStore.getState().ungroupedConcepts).toEqual([CAFE]);
    // The focus goes to the next card.
    expect(nameInput("Azúcar")).toHaveFocus();
    act(() => {
      undoToast(0).undo();
    });
    expect(queueNames()).toEqual(["Leche entera", "Café molido", "Azúcar"]);
    expect(useSettingsStore.getState().ungroupedConcepts).toEqual([]);
  });

  it("moves the focus to the queue heading when the only member of the last card was marked", () => {
    enqueue(threeCards());
    render(<ProductsTab />);
    fireEvent.click(banButton(cardOf("Azúcar"), 0));
    expect(screen.getByRole("heading", { name: "Sugerencias de productos · 2" })).toHaveFocus();
  });

  it("keeps the marked description out of the free ones, and puts it back with «Quitar marca»", () => {
    enqueue([card("sug_a", "Leche entera", [LECHE_UNO, LECHE_DOS])]);
    render(<ProductsTab />);
    // Three free: Café, Azúcar and Sal.
    expect(freeCaption()).toBe("3 descripciones sin agrupar");
    fireEvent.click(banButton(cardOf("Leche entera"), 1));
    // The marked description is neither pending nor free.
    expect(freeCaption()).toBe("3 descripciones sin agrupar");
    // A rejected card would free its members; the mark keeps its own out.
    fireEvent.click(screen.getByRole("button", { name: "Rechazar la sugerencia «Leche entera»" }));
    expect(freeCaption()).toBe("4 descripciones sin agrupar");
  });

  it("refuses the mark beyond 5,000 with a toast and changes nothing", () => {
    const marks = Array.from({ length: LIMITS.ungroupedConcepts }, (_unused, index) =>
      member(UNO, `Marca ${String(index)}`),
    );
    useSettingsStore.setState({ ungroupedConcepts: marks });
    enqueue(threeCards());
    render(<ProductsTab />);
    const before = useSettingsStore.getState().ungroupedConcepts;
    fireEvent.click(banButton(cardOf("Leche entera"), 0));
    expect(toastMock).toHaveBeenCalledTimes(1);
    expect(toastMock.mock.calls[0]?.[0]).toBe("Llegaste al máximo de 5,000 descripciones marcadas.");
    expect(useSettingsStore.getState().ungroupedConcepts).toBe(before);
    expect(useSuggestionsStore.getState().products[0]?.members).toEqual([LECHE_UNO, LECHE_DOS]);
  });

  it("refuses to mark a description that is already in a product and says why", () => {
    useSettingsStore.setState({ products: [productWith("prod_x", "Otro", [LECHE_UNO])] });
    enqueue([card("sug_a", "Leche", [LECHE_UNO, LECHE_DOS])]);
    render(<ProductsTab />);
    fireEvent.click(banButton(cardOf("Leche"), 0));
    expect(useSettingsStore.getState().ungroupedConcepts).toEqual([]);
    expect(useSuggestionsStore.getState().products[0]?.members).toEqual([LECHE_UNO, LECHE_DOS]);
    expect(
      screen.getByText(
        "Algunas descripciones de esta sugerencia ya están en otro producto. Revisa «Mis productos».",
      ),
    ).toBeInTheDocument();
    expect(toastMock).not.toHaveBeenCalled();
  });
});

describe("Descripciones marcadas «No agrupar» (E7, D-22)", () => {
  function triggerButton(): HTMLElement {
    return screen.getByRole("button", { name: /^Descripciones marcadas «No agrupar»/ });
  }

  function open(): void {
    fireEvent.click(triggerButton());
  }

  it("is not rendered when there is no mark", () => {
    enqueue(threeCards());
    render(<ProductsTab />);
    expect(screen.queryByRole("button", { name: /Descripciones marcadas/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Quitar marca" })).toBeNull();
  });

  it("shows the count in a trigger that starts closed, and keeps the tab out of the empty state", () => {
    useSettingsStore.setState({ ungroupedConcepts: [SAL] });
    render(<ProductsTab />);
    expect(triggerButton()).toHaveTextContent("Descripciones marcadas «No agrupar» (1)");
    expect(triggerButton().getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("Todavía no hay productos agrupados")).toBeNull();
    expect(screen.queryByText("Sal")).toBeNull();
  });

  it("lists each mark with its supplier and «Quitar marca» once opened", () => {
    useSettingsStore.setState({ ungroupedConcepts: [SAL, CAFE] });
    render(<ProductsTab />);
    expect(triggerButton()).toHaveTextContent("(2)");
    open();
    expect(triggerButton().getAttribute("aria-expanded")).toBe("true");
    expect(
      screen.getByText(
        "DeepSeek no vuelve a recibir estas descripciones. Quita la marca si quieres que se consideren de nuevo.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Sal")).toBeInTheDocument();
    expect(screen.getByText("Tienda Dos")).toBeInTheDocument();
    expect(screen.getByText("Café Molido 1kg")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Quitar la marca «No agrupar» de «Sal»" }),
    ).toHaveTextContent("Quitar marca");
  });

  it("is placed after «Mis productos»", () => {
    useSettingsStore.setState({
      products: [productWith("prod_x", "Leche", [LECHE_UNO])],
      ungroupedConcepts: [SAL],
    });
    render(<ProductsTab />);
    const list = screen.getByRole("heading", { name: /^Mis productos/ });
    expect(
      list.compareDocumentPosition(triggerButton()) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("counts the marks out of the free descriptions", () => {
    useSettingsStore.setState({ ungroupedConcepts: [SAL] });
    render(<ProductsTab />);
    expect(freeCaption()).toBe("4 descripciones sin agrupar");
  });

  it("«Quitar marca» removes the row, the mark and the count, announces it and shows no toast", () => {
    useSettingsStore.setState({ ungroupedConcepts: [SAL, CAFE] });
    render(<ProductsTab />);
    expect(freeCaption()).toBe("3 descripciones sin agrupar");
    open();
    fireEvent.click(screen.getByRole("button", { name: "Quitar la marca «No agrupar» de «Sal»" }));
    expect(useSettingsStore.getState().ungroupedConcepts).toEqual([CAFE]);
    expect(screen.queryByText("Sal")).toBeNull();
    expect(triggerButton()).toHaveTextContent("(1)");
    expect(freeCaption()).toBe("4 descripciones sin agrupar");
    expect(
      screen.getByText("Marca quitada. La descripción se enviará en el próximo «Agrupar productos»."),
    ).toBeInTheDocument();
    expect(toastMock).not.toHaveBeenCalled();
    // The focus goes to the button of the row that is left.
    expect(
      screen.getByRole("button", { name: "Quitar la marca «No agrupar» de «Café Molido 1kg»" }),
    ).toHaveFocus();
  });

  it("goes away with its last mark and hands the focus to the tab heading", () => {
    useSettingsStore.setState({ ungroupedConcepts: [SAL] });
    render(<ProductsTab />);
    open();
    fireEvent.click(screen.getByRole("button", { name: "Quitar la marca «No agrupar» de «Sal»" }));
    expect(screen.queryByRole("button", { name: /Descripciones marcadas/ })).toBeNull();
    expect(screen.getByRole("heading", { name: "Productos", level: 2 })).toHaveFocus();
    expect(screen.getByText("Todavía no hay productos agrupados")).toBeInTheDocument();
  });

  it("keeps a long description whole in the list and cuts it at 60 characters in the label", () => {
    const long = "d".repeat(70);
    useSettingsStore.setState({ ungroupedConcepts: [member(UNO, long)] });
    render(<ProductsTab />);
    open();
    expect(screen.getByText(long)).toBeInTheDocument();
    const button = screen.getByRole("button", { name: /^Quitar la marca/ });
    expect(button.getAttribute("aria-label")).toBe(
      `Quitar la marca «No agrupar» de «${"d".repeat(59)}…»`,
    );
  });

  it("scrolls inside a ScrollArea of at most 288px with 100 or more marks", () => {
    const marks = Array.from({ length: 120 }, (_unused, index) =>
      member(UNO, `Marca ${String(index)}`),
    );
    useSettingsStore.setState({ ungroupedConcepts: marks });
    const view = render(<ProductsTab />);
    open();
    expect(triggerButton()).toHaveTextContent("(120)");
    expect(screen.getAllByRole("button", { name: /^Quitar la marca/ })).toHaveLength(120);
    const area = view.container.querySelector("[data-slot='scroll-area']");
    expect(area).not.toBeNull();
    expect(area?.className).toContain("max-h-72");
  });
});

describe("the send dialog lists the accepted product names as context (D-04, D-33, LLM-06)", () => {
  const CONTEXT_HEADING = /^Productos existentes, solo como contexto/;

  function openDialog(): HTMLElement {
    fireEvent.click(screen.getByRole("button", { name: "Agrupar productos" }));
    const dialog = screen.getByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /Ver exactamente qué se envía/ }));
    return dialog;
  }

  it("adds the line and the group when products are accepted, sorted by name", () => {
    useSettingsStore.setState({
      products: [
        productWith("prod_c", "Café molido", [CAFE]),
        productWith("prod_a", "Azúcar", [AZUCAR]),
      ],
    });
    render(<ProductsTab />);
    const dialog = openDialog();
    expect(
      within(dialog).getByText(
        "Como contexto también se enviarán 2 nombres de productos que ya aceptaste.",
      ),
    ).toBeInTheDocument();
    expect(sectionRows(dialog, "Productos existentes, solo como contexto (2)")).toEqual([
      "Azúcar",
      "Café molido",
    ]);
  });

  it("uses the singular for one accepted product", () => {
    useSettingsStore.setState({ products: [productWith("prod_l", "Leche entera", [LECHE_UNO])] });
    render(<ProductsTab />);
    const dialog = openDialog();
    expect(
      within(dialog).getByText(
        "Como contexto también se enviarán 1 nombre de producto que ya aceptaste.",
      ),
    ).toBeInTheDocument();
  });

  it("shows neither the line nor the group with no accepted product", () => {
    render(<ProductsTab />);
    const dialog = openDialog();
    expect(within(dialog).queryByText(/Como contexto también se enviarán/)).toBeNull();
    expect(within(dialog).queryByRole("heading", { name: CONTEXT_HEADING })).toBeNull();
  });

  it("never lists the name of a card that is still pending", () => {
    enqueue([card("sug_a", "Leche entera", [LECHE_UNO]), card("sug_c", "Azúcar", [AZUCAR])]);
    render(<ProductsTab />);
    const dialog = openDialog();
    expect(within(dialog).queryByText(/Como contexto también se enviarán/)).toBeNull();
    expect(within(dialog).queryByRole("heading", { name: CONTEXT_HEADING })).toBeNull();
    expect(within(dialog).queryByText("Leche entera")).toBeNull();
  });
});

describe("«Agregar a «X»» card (D-21)", () => {
  const LACTEOS = "cat_lacteos";

  /** «Leche entera» already holds LECHE_UNO and has a category; DeepSeek proposes more. */
  function seedProductWithCategory(categoryId: string | null = LACTEOS): void {
    useSettingsStore.setState({
      categories: [{ id: LACTEOS, name: "Lácteos" }],
      products: [{ id: "prod_leche", name: "Leche entera", categoryId, members: [LECHE_UNO] }],
    });
  }

  function addToCard(members: ProductMember[]): ProductSuggestion {
    return { id: "sug_add", name: "Leche", target: "prod_leche", members };
  }

  function memberBox(description: string): HTMLElement {
    return screen.getByRole("checkbox", { name: `Elegir «${description}»` });
  }

  it("is titled with the product, captions its category and the note, and has no name Input", () => {
    seedProductWithCategory();
    enqueue([addToCard([LECHE_DOS, CAFE])]);
    render(<ProductsTab />);
    expect(
      screen.getByRole("heading", { name: "Agregar a «Leche entera»", level: 3 }),
    ).toBeInTheDocument();
    expect(screen.getByText("Categoría: Lácteos")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Solo se suman estas descripciones nuevas; el producto conserva sus miembros y su categoría.",
      ),
    ).toBeInTheDocument();
    expect(nameInputs()).toHaveLength(0);
    // Only the new members are listed; the product's own member is not.
    expect(screen.queryByText("Leche entera 1L")).toBeNull();
    expect(screen.getByText("LECHE ENTERA 1L")).toBeInTheDocument();
  });

  it("says «Sin categoría» for a product with no category", () => {
    seedProductWithCategory(null);
    enqueue([addToCard([LECHE_DOS])]);
    render(<ProductsTab />);
    // The accepted-products list below also says «Sin categoría»: look inside the card.
    const title = screen.getByRole("heading", { name: "Agregar a «Leche entera»" });
    const cardElement = title.closest("li");
    if (cardElement === null) throw new Error("the title is not inside a card");
    expect(within(cardElement).getByText("Sin categoría")).toBeInTheDocument();
  });

  it("lists each new member with a checkbox that starts checked", () => {
    seedProductWithCategory();
    enqueue([addToCard([LECHE_DOS, CAFE, AZUCAR])]);
    render(<ProductsTab />);
    expect(screen.getAllByRole("checkbox")).toHaveLength(3);
    for (const description of ["LECHE ENTERA 1L", "Café Molido 1kg", "Azúcar"]) {
      expect(memberBox(description)).toBeChecked();
    }
  });

  it("adds the checked members, keeps the other members and the category, and keeps the unchecked one in the card", () => {
    seedProductWithCategory();
    enqueue([addToCard([LECHE_DOS, CAFE, AZUCAR])]);
    render(<ProductsTab />);
    fireEvent.click(memberBox("Azúcar"));
    expect(memberBox("Azúcar")).not.toBeChecked();
    press("Leche entera");

    const [product] = storedProducts();
    expect(product?.members).toEqual([LECHE_UNO, LECHE_DOS, CAFE]);
    expect(product?.categoryId).toBe(LACTEOS);
    expect(product?.name).toBe("Leche entera");
    // The third member waits in the same card, still unchecked.
    expect(useSuggestionsStore.getState().products).toEqual([
      { id: "sug_add", name: "Leche", target: "prod_leche", members: [AZUCAR] },
    ]);
    expect(screen.queryByText("LECHE ENTERA 1L")).toBeNull();
    expect(memberBox("Azúcar")).not.toBeChecked();
    expect(toastMock).toHaveBeenCalledTimes(1);
    expect(toastMock.mock.calls[0]?.[0]).toBe("Se agregaron 2 descripciones a «Leche entera»");
  });

  it("removes the card when every member was added, and moves focus on", () => {
    seedProductWithCategory();
    enqueue([addToCard([LECHE_DOS, CAFE]), card("sug_b", "Azúcar", [AZUCAR])]);
    render(<ProductsTab />);
    press("Leche entera");
    expect(storedProducts()[0]?.members).toEqual([LECHE_UNO, LECHE_DOS, CAFE]);
    expect(useSuggestionsStore.getState().products.map((entry) => entry.id)).toEqual(["sug_b"]);
    expect(nameInput("Azúcar")).toHaveFocus();
    expect(toastMock.mock.calls[0]?.[0]).toBe("Se agregaron 2 descripciones a «Leche entera»");
  });

  it("explains that the product is gone, changes nothing, and still lets the card be rejected", () => {
    seedProductWithCategory();
    enqueue([addToCard([LECHE_DOS])]);
    render(<ProductsTab />);
    act(() => {
      useSettingsStore.setState({ products: [] });
    });
    // The title falls back to the name DeepSeek proposed.
    expect(screen.getByRole("heading", { name: "Agregar a «Leche»" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Aceptar la sugerencia «Leche»" }));
    expect(
      screen.getByText("Ese producto ya no existe. Rechaza la sugerencia o únela con otro producto."),
    ).toBeInTheDocument();
    expect(storedProducts()).toEqual([]);
    expect(useSuggestionsStore.getState().products).toHaveLength(1);
    expect(toastMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Rechazar la sugerencia «Leche»" }));
    expect(useSuggestionsStore.getState().products).toEqual([]);
  });

  it("refuses members that are already in another product and keeps the card whole", () => {
    useSettingsStore.setState({
      categories: [{ id: LACTEOS, name: "Lácteos" }],
      products: [
        { id: "prod_leche", name: "Leche entera", categoryId: LACTEOS, members: [LECHE_UNO] },
        { id: "prod_cafe", name: "Café", categoryId: null, members: [CAFE] },
      ],
    });
    enqueue([addToCard([LECHE_DOS, CAFE])]);
    render(<ProductsTab />);
    const button = acceptButton("Leche entera");
    fireEvent.click(button);
    const message =
      "Algunas descripciones de esta sugerencia ya están en otro producto. Revisa «Mis productos».";
    expect(screen.getByText(message)).toBeInTheDocument();
    expect(describedText(button)).toBe(message);
    expect(storedProducts().find((entry) => entry.id === "prod_leche")?.members).toEqual([
      LECHE_UNO,
    ]);
    expect(useSuggestionsStore.getState().products[0]?.members).toEqual([LECHE_DOS, CAFE]);
    // Unchecking the member that is taken lets the other one in.
    fireEvent.click(memberBox("Café Molido 1kg"));
    expect(screen.queryByText(message)).toBeNull();
    fireEvent.click(button);
    expect(storedProducts().find((entry) => entry.id === "prod_leche")?.members).toEqual([
      LECHE_UNO,
      LECHE_DOS,
    ]);
  });

  it("asks for at least one description when none is checked", () => {
    seedProductWithCategory();
    enqueue([addToCard([LECHE_DOS])]);
    render(<ProductsTab />);
    fireEvent.click(memberBox("LECHE ENTERA 1L"));
    press("Leche entera");
    expect(screen.getByText("Elige al menos una descripción para agregar.")).toBeInTheDocument();
    expect(storedProducts()[0]?.members).toEqual([LECHE_UNO]);
    expect(useSuggestionsStore.getState().products).toHaveLength(1);
  });

  it("«Rechazar» removes the card, leaving the product alone", () => {
    seedProductWithCategory();
    enqueue([addToCard([LECHE_DOS])]);
    render(<ProductsTab />);
    fireEvent.click(screen.getByRole("button", { name: "Rechazar la sugerencia «Leche entera»" }));
    expect(useSuggestionsStore.getState().products).toEqual([]);
    expect(storedProducts()[0]?.members).toEqual([LECHE_UNO]);
    expect(toastMock.mock.calls[0]?.[0]).toBe("Sugerencia «Leche entera» rechazada");
  });
});

describe("«Unir con…» (D-19, D-21)", () => {
  const LACTEOS_PRODUCT: Product = {
    id: "prod_lacteos",
    name: "Lácteos",
    categoryId: null,
    members: [SAL],
  };

  function mergeButton(name: string): HTMLElement {
    return screen.getByRole("button", { name: `Unir la sugerencia «${name}» con…` });
  }

  async function openMerge(name: string): Promise<void> {
    fireEvent.click(mergeButton(name));
    await screen.findByRole("combobox", { name: "Buscar producto" });
  }

  function optionTexts(): string[] {
    return screen.getAllByRole("option").map((option) => option.textContent);
  }

  it("is an outline button that names the card, on every card of a new product and on no «Agregar a» card", () => {
    useSettingsStore.setState({ products: [LACTEOS_PRODUCT] });
    enqueue([
      ...threeCards(),
      { id: "sug_add", name: "Lácteos", target: "prod_lacteos", members: [SAL] },
    ]);
    render(<ProductsTab />);
    expect(screen.getAllByRole("button", { name: /^Unir la sugerencia/ })).toHaveLength(3);
    expect(mergeButton("Café molido")).toHaveTextContent("Unir con…");
    expect(screen.queryByRole("button", { name: "Unir la sugerencia «Lácteos» con…" })).toBeNull();
  });

  it("lists the other suggestions with their count and the products the user already has", async () => {
    useSettingsStore.setState({ products: [LACTEOS_PRODUCT] });
    enqueue(threeCards());
    render(<ProductsTab />);
    await openMerge("Café molido");
    expect(screen.getByText("Otras sugerencias")).toBeInTheDocument();
    expect(screen.getByText("Productos que ya tienes")).toBeInTheDocument();
    // Not the card itself; a card with several members shows its count, a single one too.
    expect(optionTexts()).toEqual(["Leche entera2 descripciones", "Azúcar1 descripción", "Lácteos"]);
  });

  it("does not list «Agregar a» cards among the other suggestions", async () => {
    useSettingsStore.setState({ products: [LACTEOS_PRODUCT] });
    enqueue([
      ...threeCards(),
      { id: "sug_add", name: "Lácteos", target: "prod_lacteos", members: [SAL] },
    ]);
    render(<ProductsTab />);
    await openMerge("Café molido");
    expect(optionTexts()).toEqual(["Leche entera2 descripciones", "Azúcar1 descripción", "Lácteos"]);
  });

  it("filters while typing and says when nothing matches", async () => {
    enqueue(threeCards());
    render(<ProductsTab />);
    await openMerge("Café molido");
    const search = screen.getByRole("combobox", { name: "Buscar producto" });
    fireEvent.change(search, { target: { value: "AZUCAR" } });
    expect(optionTexts()).toEqual(["Azúcar1 descripción"]);
    fireEvent.change(search, { target: { value: "queso" } });
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByText("Ningún producto coincide con «queso».")).toBeInTheDocument();
  });

  it("lists a card with no name by its first description", async () => {
    enqueue([card("sug_a", "", [LECHE_UNO]), card("sug_b", "Café molido", [CAFE])]);
    render(<ProductsTab />);
    await openMerge("Café molido");
    expect(optionTexts()).toEqual(["Leche entera 1L1 descripción"]);
  });

  it("moves the members of this card into the chosen suggestion, removes this card, and changes no settings", async () => {
    enqueue(threeCards());
    render(<ProductsTab />);
    await openMerge("Leche entera");
    fireEvent.click(screen.getByRole("option", { name: /^Azúcar/ }));
    const queue = useSuggestionsStore.getState().products;
    expect(queue.map((entry) => entry.id)).toEqual(["sug_b", "sug_c"]);
    expect(queue[1]).toEqual({
      id: "sug_c",
      name: "Azúcar",
      target: null,
      members: [AZUCAR, LECHE_UNO, LECHE_DOS],
    });
    expect(storedProducts()).toEqual([]);
    expect(screen.getByText("3 descripciones")).toBeInTheDocument();
    expect(nameInput("Azúcar")).toHaveFocus();
    expect(await storedNames()).toEqual(["Café molido", "Azúcar"]);
  });

  it("shows «Sugerencias unidas» for 6 seconds, and «Deshacer» puts both cards back exactly", async () => {
    const original = threeCards();
    enqueue(original);
    render(<ProductsTab />);
    await openMerge("Leche entera");
    fireEvent.click(screen.getByRole("option", { name: /^Azúcar/ }));
    const joined = undoToast(0);
    expect(joined.message).toBe("Sugerencias unidas");
    expect(joined.duration).toBe(6000);
    expect(joined.label).toBe("Deshacer");
    act(() => {
      joined.undo();
    });
    expect(useSuggestionsStore.getState().products).toEqual(original);
    expect(screen.queryByText("3 descripciones")).toBeNull();
  });

  it("turns the card into an «Agregar a» card when an accepted product is chosen, and applies nothing yet", async () => {
    useSettingsStore.setState({ products: [LACTEOS_PRODUCT] });
    enqueue(threeCards());
    render(<ProductsTab />);
    await openMerge("Café molido");
    fireEvent.click(screen.getByRole("option", { name: "Lácteos" }));
    expect(useSuggestionsStore.getState().products[1]).toEqual({
      id: "sug_b",
      name: "Café molido",
      target: "prod_lacteos",
      members: [CAFE],
    });
    expect(screen.getByRole("heading", { name: "Agregar a «Lácteos»", level: 3 })).toBeInTheDocument();
    expect(nameInputs()).toHaveLength(2);
    // The product keeps its members until «Aceptar».
    expect(storedProducts()).toEqual([LACTEOS_PRODUCT]);
    expect(undoToast(0).message).toBe("Sugerencias unidas");
    // The new card has no «Unir con…» (its actions are Aceptar, Rechazar, Separar).
    expect(screen.queryByRole("button", { name: /^Unir la sugerencia «Lácteos»/ })).toBeNull();
  });

  it("«Deshacer» turns the «Agregar a» card back into a card of a new product", async () => {
    useSettingsStore.setState({ products: [LACTEOS_PRODUCT] });
    const original = threeCards();
    enqueue(original);
    render(<ProductsTab />);
    await openMerge("Café molido");
    fireEvent.click(screen.getByRole("option", { name: "Lácteos" }));
    act(() => {
      undoToast(0).undo();
    });
    expect(useSuggestionsStore.getState().products).toEqual(original);
    expect(nameInput("Café molido")).toBeInTheDocument();
  });

  it("stores the name the user typed before joining, so «Deshacer» brings the card back with it", async () => {
    enqueue(threeCards());
    render(<ProductsTab />);
    // The button still names the stored card; the typed text is stored by the pick itself.
    typeName("Leche entera", "Leche deslactosada");
    await openMerge("Leche entera");
    fireEvent.click(screen.getByRole("option", { name: /^Azúcar/ }));
    act(() => {
      undoToast(0).undo();
    });
    expect(queueNames()).toEqual(["Leche deslactosada", "Café molido", "Azúcar"]);
  });

  it("leaves the accepted products untouched when a suggestion is joined", async () => {
    useSettingsStore.setState({ products: [LACTEOS_PRODUCT] });
    enqueue(threeCards());
    render(<ProductsTab />);
    await openMerge("Leche entera");
    fireEvent.click(screen.getByRole("option", { name: /^Café molido/ }));
    expect(storedProducts()).toEqual([LACTEOS_PRODUCT]);
  });
});

describe("«Separar en producto nuevo» and the member checkboxes (D-19, E4)", () => {
  function splitButton(name: string): HTMLElement {
    return screen.getByRole("button", { name: `Separar en producto nuevo desde «${name}»` });
  }

  function box(description: string): HTMLElement {
    return screen.getByRole("checkbox", { name: `Elegir «${description}»` });
  }

  function isDisabled(button: HTMLElement): boolean {
    return button.getAttribute("aria-disabled") === "true";
  }

  /** «Leche entera» holds three descriptions here, so one can stay while two leave. */
  function milkCards(): ProductSuggestion[] {
    return [
      card("sug_a", "Leche entera", [LECHE_UNO, LECHE_DOS, SAL]),
      card("sug_b", "Café molido", [CAFE]),
    ];
  }

  it("gives a card with one member neither a checkbox, a «Separar» nor a count", () => {
    enqueue([card("sug_b", "Café molido", [CAFE])]);
    render(<ProductsTab />);
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /^Separar en producto nuevo/ })).toBeNull();
    expect(screen.queryByText(/^\d+ descripciones$/)).toBeNull();
  });

  it("gives a card with several members a checkbox per row that starts unchecked, and a count", () => {
    enqueue(milkCards());
    render(<ProductsTab />);
    expect(screen.getAllByRole("checkbox")).toHaveLength(3);
    for (const description of ["Leche entera 1L", "LECHE ENTERA 1L", "Sal"]) {
      expect(box(description)).not.toBeChecked();
    }
    expect(screen.getByText("3 descripciones")).toBeInTheDocument();
  });

  it("cuts the description at 60 characters in the label of its checkbox", () => {
    const long = member(UNO, "d".repeat(70));
    enqueue([card("sug_a", "Varios", [long, CAFE])]);
    render(<ProductsTab />);
    expect(screen.getByRole("checkbox", { name: `Elegir «${"d".repeat(59)}…»` })).toBeInTheDocument();
  });

  it("names the card in the button and is enabled only while some but not all members are checked", () => {
    enqueue(milkCards());
    render(<ProductsTab />);
    const button = splitButton("Leche entera");
    expect(button).toHaveTextContent("Separar en producto nuevo");
    expect(isDisabled(button)).toBe(true);
    fireEvent.click(box("LECHE ENTERA 1L"));
    expect(isDisabled(button)).toBe(false);
    fireEvent.click(box("Leche entera 1L"));
    expect(isDisabled(button)).toBe(false);
    fireEvent.click(box("Sal"));
    expect(isDisabled(button)).toBe(true);
    fireEvent.click(box("Sal"));
    expect(isDisabled(button)).toBe(false);
  });

  it("does nothing while it is disabled", () => {
    enqueue(milkCards());
    render(<ProductsTab />);
    fireEvent.click(splitButton("Leche entera"));
    expect(useSuggestionsStore.getState().products).toEqual(milkCards());
    expect(toastMock).not.toHaveBeenCalled();
    fireEvent.click(box("Leche entera 1L"));
    fireEvent.click(box("LECHE ENTERA 1L"));
    fireEvent.click(box("Sal"));
    fireEvent.click(splitButton("Leche entera"));
    expect(useSuggestionsStore.getState().products).toEqual(milkCards());
  });

  it("moves the checked members to a new card right below, named after the first one, and focuses its name", async () => {
    enqueue(milkCards());
    render(<ProductsTab />);
    fireEvent.click(box("LECHE ENTERA 1L"));
    fireEvent.click(box("Sal"));
    fireEvent.click(splitButton("Leche entera"));
    const queue = useSuggestionsStore.getState().products;
    expect(queue.map((entry) => entry.name)).toEqual(["Leche entera", "LECHE ENTERA 1L", "Café molido"]);
    expect(queue[0]?.members).toEqual([LECHE_UNO]);
    expect(queue[1]?.members).toEqual([LECHE_DOS, SAL]);
    expect(queue[1]?.target).toBeNull();
    expect(queue[1]?.id).toMatch(/^sug_.+/);
    expect(nameInput("LECHE ENTERA 1L")).toHaveFocus();
    expect(storedProducts()).toEqual([]);
    expect(await storedNames()).toEqual(["Leche entera", "LECHE ENTERA 1L", "Café molido"]);
    // The new card's own members start unchecked, and the old card lost its ticks.
    expect(box("Sal")).not.toBeChecked();
    expect(screen.getByText("2 descripciones")).toBeInTheDocument();
  });

  it("shows «Se separó «{nombre}» en un producto nuevo» for 6 seconds, and «Deshacer» puts the card back exactly", () => {
    const original = milkCards();
    enqueue(original);
    render(<ProductsTab />);
    fireEvent.click(box("Sal"));
    fireEvent.click(splitButton("Leche entera"));
    const split = undoToast(0);
    expect(split.message).toBe("Se separó «Sal» en un producto nuevo");
    expect(split.duration).toBe(6000);
    expect(split.label).toBe("Deshacer");
    act(() => {
      split.undo();
    });
    expect(useSuggestionsStore.getState().products).toEqual(original);
    expect(screen.getAllByRole("checkbox")).toHaveLength(3);
  });

  it("splits with the name the user typed kept on the original card", () => {
    enqueue(milkCards());
    render(<ProductsTab />);
    typeName("Leche entera", "Lácteos varios");
    fireEvent.click(box("Sal"));
    fireEvent.click(splitButton("Leche entera"));
    expect(queueNames()).toEqual(["Lácteos varios", "Sal", "Café molido"]);
  });

  it("splits an «Agregar a» card: its checked members become a new product and it keeps the rest and its target", () => {
    useSettingsStore.setState({
      products: [{ id: "prod_leche", name: "Leche entera", categoryId: null, members: [LECHE_UNO] }],
    });
    enqueue([{ id: "sug_add", name: "Leche", target: "prod_leche", members: [LECHE_DOS, CAFE, AZUCAR] }]);
    render(<ProductsTab />);
    const button = splitButton("Leche entera");
    // All three start checked: nothing is left, so it is disabled until one is unchecked.
    expect(isDisabled(button)).toBe(true);
    expect(screen.getByText("3 descripciones")).toBeInTheDocument();
    fireEvent.click(box("Azúcar"));
    expect(isDisabled(button)).toBe(false);
    fireEvent.click(button);
    const queue = useSuggestionsStore.getState().products;
    expect(queue[0]).toEqual({ id: "sug_add", name: "Leche", target: "prod_leche", members: [AZUCAR] });
    expect(queue[1]?.target).toBeNull();
    expect(queue[1]?.members).toEqual([LECHE_DOS, CAFE]);
    expect(queue[1]?.name).toBe("LECHE ENTERA 1L");
    expect(nameInput("LECHE ENTERA 1L")).toHaveFocus();
  });

  it("gives an «Agregar a» card with one member no «Separar»", () => {
    useSettingsStore.setState({
      products: [{ id: "prod_leche", name: "Leche entera", categoryId: null, members: [LECHE_UNO] }],
    });
    enqueue([{ id: "sug_add", name: "Leche", target: "prod_leche", members: [LECHE_DOS] }]);
    render(<ProductsTab />);
    expect(screen.queryByRole("button", { name: /^Separar en producto nuevo/ })).toBeNull();
    expect(screen.queryByText(/descripciones$/)).toBeNull();
  });

  it("keeps the bare «Aceptar» and «Rechazar» named after the card", () => {
    enqueue(milkCards());
    render(<ProductsTab />);
    expect(acceptButton("Leche entera")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rechazar la sugerencia «Leche entera»" })).toBeInTheDocument();
  });
});
