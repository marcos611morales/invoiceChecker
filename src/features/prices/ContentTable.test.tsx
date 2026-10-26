// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMemo } from "react";
import Big from "big.js";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { compareProduct, type ProductComparison } from "@/domain/prices/compare";
import type { Purchase } from "@/domain/prices/purchases";
import { normalizeDescription, ruleMapKey } from "@/domain/settings/normalize";
import { defaultSettings, type ContentCorrection } from "@/domain/settings/types";
import { AppShell } from "@/features/shell/AppShell";
import { useSessionStore } from "@/stores/sessionStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { makeConcepto, makeProduct, purchaseInvoice } from "../../../tests/support/pricesFactory";
import "../../../tests/support/domPolyfills";
import { resetSettingsStore } from "../../../tests/support/settingsStorage";
import { CONTENT_SECTION_ID, ContentTable, contentSectionId } from "./ContentTable";
import { ProductDetail } from "./ProductDetail";

interface ToastOptions {
  duration?: number;
  action?: { label: string; onClick: () => void };
}

const toastMock = vi.hoisted(() => {
  const toast = vi.fn<(message: string, options?: ToastOptions) => void>();
  return Object.assign(toast, { error: vi.fn<(message: string) => void>() });
});
vi.mock("sonner", () => ({ toast: toastMock }));

const RFC_A = "AAA010101AAA";
const RFC_B = "BBB010101BBB";
const RFC_C = "CCC010101CCC";
const RFC_D = "DDD010101DDD";

const PRODUCT = makeProduct("Leche", [{ rfc: RFC_A, descripcion: "LECHE", supplierName: "Tienda Alfa" }]);

interface Buy {
  rfc: string;
  store: string;
  descripcion: string;
  unidad: string;
  cantidad?: string;
  amount?: string;
  fecha?: string;
}

let sequence = 0;

function buy(options: Buy): Purchase {
  sequence += 1;
  return {
    productId: PRODUCT.id,
    productName: PRODUCT.name,
    storeRfc: options.rfc,
    storeName: options.store,
    memberKey: ruleMapKey(options.rfc, normalizeDescription(options.descripcion)),
    descripcion: options.descripcion,
    claveProdServ: "50131700",
    claveUnidad: options.unidad,
    cantidad: options.cantidad ?? "1",
    fecha: options.fecha ?? "2025-01-15T10:00:00",
    folio: null,
    uuid: `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
    conceptIndex: 0,
    amount: new Big(options.amount ?? "10.00"),
  };
}

function correctionOf(rfc: string, descripcion: string, over: Partial<ContentCorrection> = {}): ContentCorrection {
  return {
    rfc,
    key: normalizeDescription(descripcion),
    description: descripcion,
    supplierName: "Tienda",
    packs: 12,
    amount: "1",
    unit: "l",
    ...over,
  };
}

function seedCorrections(...corrections: ContentCorrection[]): void {
  act(() => {
    useSettingsStore.setState({ ...defaultSettings(), contentCorrections: corrections });
  });
}

function rowFor(purchases: Purchase[], corrections: ContentCorrection[] = []): ProductComparison {
  const map = new Map(corrections.map((c) => [ruleMapKey(c.rfc, c.key), c]));
  return compareProduct(PRODUCT, purchases, map);
}

const ALPURA = "LECHE ALPURA 12/1L";
const LACDEL = "Leche LacDel Desla";

/** A detected member (reads 12 L) next to an unsized one that therefore does not compare. */
function detectedAndMissing(): Purchase[] {
  return [
    buy({ rfc: RFC_A, store: "Tienda Alfa", descripcion: ALPURA, unidad: "H87", cantidad: "2", amount: "100" }),
    buy({ rfc: RFC_B, store: "Tienda Beta", descripcion: LACDEL, unidad: "H87", cantidad: "1", amount: "20" }),
  ];
}

/** Body rows of the content table, in the order shown. */
function bodyRows(): HTMLElement[] {
  // A product panel holds other tables too: the content table is the one in its own section.
  const section = screen.getByRole("region", { name: "Contenido de cada descripción" });
  const table = within(section).getByRole("table");
  const groups = within(table).getAllByRole("rowgroup");
  const body = groups[1];
  if (body === undefined) throw new Error("no table body");
  return within(body).getAllByRole("row");
}

/** A cell of a body row by position; fails loudly when it does not exist. */
function contentCell(row: HTMLElement, index: number): HTMLElement {
  const cell = within(row).getAllByRole("cell")[index];
  if (cell === undefined) throw new Error(`no cell ${String(index)}`);
  return cell;
}

function rowWith(text: string): HTMLElement {
  const row = bodyRows().find((candidate) => candidate.textContent?.includes(text));
  if (row === undefined) throw new Error(`no row with ${text}`);
  return row;
}

beforeEach(() => {
  toastMock.mockClear();
  toastMock.error.mockClear();
  resetSettingsStore();
  act(() => {
    useSettingsStore.setState(defaultSettings());
  });
});

afterEach(() => {
  cleanup();
  resetSettingsStore();
});

describe("Contenido de cada descripción: section and columns (D-13, E8)", () => {
  it("shows the heading with its id and the intro, and the five columns", () => {
    render(<ContentTable row={rowFor(detectedAndMissing())} />);
    const heading = screen.getByRole("heading", { name: "Contenido de cada descripción" });
    expect(heading.id).toBe(contentSectionId(PRODUCT.id));
    expect(heading.id.startsWith(CONTENT_SECTION_ID)).toBe(true);
    expect(heading).toHaveAttribute("tabindex", "-1");
    expect(
      screen.getByText(
        "Así se leyó el contenido de cada descripción. Corrígelo si no es correcto o si falta: se guarda en este navegador y va en tu archivo de ajustes.",
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader").map((header) => header.textContent)).toEqual([
      "Descripción",
      "Tienda",
      "Contenido por compra",
      "Compras",
      "Acciones",
    ]);
    expect(screen.getByText("Acciones").className).toContain("sr-only");
  });

  it("keeps a 760 px minimum width inside a horizontal scroll area, with 56 px rows", () => {
    render(<ContentTable row={rowFor(detectedAndMissing())} />);
    expect(screen.getByRole("table").className).toContain("min-w-[760px]");
    expect(bodyRows()[0]?.className).toContain("h-14");
  });

  it("renders nothing when the product has no purchase", () => {
    const { container } = render(<ContentTable row={rowFor([])} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("lists not-normalized members first, then the detected ones, with the store and the purchase count", () => {
    render(<ContentTable row={rowFor(detectedAndMissing())} />);
    const rows = bodyRows();
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent(LACDEL);
    expect(rows[0]).toHaveTextContent("Tienda Beta");
    expect(rows[1]).toHaveTextContent(ALPURA);
    expect(rows[1]).toHaveTextContent("Tienda Alfa");
    expect(contentCell(rowWith(ALPURA), 3)).toHaveTextContent("1");
  });
});

describe("Contenido de cada descripción: member states (D-13, D-14, E8)", () => {
  it("shows a detected content in muted text with the outline badge «detectado»", () => {
    render(<ContentTable row={rowFor(detectedAndMissing())} />);
    const cell = contentCell(rowWith(ALPURA), 2);
    expect(cell).toHaveTextContent("12 L");
    expect(cell).toHaveTextContent("detectado");
    expect(within(cell).getByText("12 L").className).toContain("text-muted-foreground");
    expect(cell).not.toHaveTextContent("Corregido");
  });

  it("shows a corrected content in foreground with «Corregido» and «12 × 1 L»", () => {
    const correction = correctionOf(RFC_A, ALPURA, { packs: 12, amount: "1", unit: "l" });
    seedCorrections(correction);
    render(<ContentTable row={rowFor(detectedAndMissing(), [correction])} />);
    const cell = contentCell(rowWith(ALPURA), 2);
    expect(cell).toHaveTextContent("12 × 1 L");
    expect(cell).toHaveTextContent("Corregido");
    expect(cell).not.toHaveTextContent("detectado");
    expect(within(cell).getByText("12 × 1 L").className).not.toContain("text-muted-foreground");
  });

  it("shows «No normalizado», its reason and an outline «Capturar contenido» that names the description", () => {
    render(<ContentTable row={rowFor(detectedAndMissing())} />);
    const row = rowWith(LACDEL);
    const cell = contentCell(row, 2);
    expect(cell).toHaveTextContent("No normalizado");
    expect(cell).toHaveTextContent("Sin tamaño en la descripción, y otras compras de este producto sí lo tienen.");
    const button = within(row).getByRole("button", {
      name: `Capturar contenido de «${LACDEL}» (Tienda Beta)`,
    });
    expect(button).toHaveTextContent("Capturar contenido");
    expect(within(row).queryByRole("button", { name: /Corregir el contenido/ })).toBeNull();
  });

  it("gives a detected member the pencil named with the description and the store", () => {
    render(<ContentTable row={rowFor(detectedAndMissing())} />);
    expect(
      within(rowWith(ALPURA)).getByRole("button", {
        name: `Corregir el contenido de «${ALPURA}» (Tienda Alfa)`,
      }),
    ).toBeInTheDocument();
  });

  it("cuts a long description at 60 characters in the pencil name only", () => {
    const long = `LECHE ${"X".repeat(100)} 12/1L`;
    const purchases = [buy({ rfc: RFC_A, store: "Tienda Alfa", descripcion: long, unidad: "H87" })];
    render(<ContentTable row={rowFor(purchases)} />);
    const name = `Corregir el contenido de «${Array.from(long).slice(0, 59).join("")}…» (Tienda Alfa)`;
    expect(screen.getByRole("button", { name })).toBeInTheDocument();
    expect(screen.getByText(long)).toBeInTheDocument();
  });

  it("says «Sin tamaño» in muted text for a piece without size in a per-piece product", () => {
    const purchases = [
      buy({ rfc: RFC_A, store: "Tienda Alfa", descripcion: "LECHE SOLA", unidad: "H87", amount: "20" }),
      buy({ rfc: RFC_B, store: "Tienda Beta", descripcion: "LECHE SOLA", unidad: "H87", amount: "25" }),
    ];
    render(<ContentTable row={rowFor(purchases)} />);
    for (const row of bodyRows()) {
      const cell = contentCell(row, 2);
      expect(within(cell).getByText("Sin tamaño").className).toContain("text-muted-foreground");
    }
  });

  it("reads «Usa la cantidad del XML (kilogramos)» for a weight member, with no edit button", () => {
    const purchases = [
      buy({ rfc: RFC_A, store: "Tienda Alfa", descripcion: "AZUCAR", unidad: "KGM", cantidad: "2", amount: "50" }),
    ];
    render(<ContentTable row={rowFor(purchases)} />);
    const row = rowWith("AZUCAR");
    expect(row).toHaveTextContent("Usa la cantidad del XML (kilogramos)");
    expect(within(row).queryByRole("button", { name: /Corregir|Capturar/ })).toBeNull();
  });

  it("reads «(litros)» for a volume member", () => {
    const purchases = [
      buy({ rfc: RFC_D, store: "Tienda Delta", descripcion: "LECHE DELTA", unidad: "LTR", cantidad: "4", amount: "70" }),
    ];
    render(<ContentTable row={rowFor(purchases)} />);
    expect(rowWith("LECHE DELTA")).toHaveTextContent("Usa la cantidad del XML (litros)");
  });

  it("shows only the reason, with no button, for a member whose unit is not recognized", () => {
    const purchases = [
      buy({ rfc: RFC_A, store: "Tienda Alfa", descripcion: "LECHE RARA", unidad: "ZZZ", amount: "20" }),
    ];
    render(<ContentTable row={rowFor(purchases)} />);
    const row = rowWith("LECHE RARA");
    expect(row).toHaveTextContent("No normalizado");
    expect(row).toHaveTextContent("La unidad «ZZZ» no tiene equivalencia.");
    expect(within(row).queryByRole("button", { name: /Corregir|Capturar/ })).toBeNull();
  });

  it("renders hostile vendor text as text", () => {
    const hostile = '<img src=x onerror="alert(1)"> 12/1L';
    const purchases = [buy({ rfc: RFC_A, store: "<b>Tienda</b>", descripcion: hostile, unidad: "H87" })];
    render(<ContentTable row={rowFor(purchases)} />);
    expect(document.querySelector("img")).toBeNull();
    expect(document.querySelector("b")).toBeNull();
    expect(screen.getByText(hostile)).toBeInTheDocument();
    expect(screen.getByText("<b>Tienda</b>")).toBeInTheDocument();
  });
});

describe("Contenido de cada descripción: overflow (E8)", () => {
  function twelveMembers(): Purchase[] {
    return Array.from({ length: 12 }, (_, index) =>
      buy({
        rfc: RFC_A,
        store: "Tienda Alfa",
        descripcion: `LECHE ${String.fromCharCode(65 + index)} 1L`,
        unidad: "H87",
      }),
    );
  }

  it("shows 10 members first and reveals the rest with «Mostrar 2 más»", () => {
    render(<ContentTable row={rowFor(twelveMembers())} />);
    expect(bodyRows()).toHaveLength(10);
    fireEvent.click(screen.getByRole("button", { name: "Mostrar 2 más" }));
    expect(bodyRows()).toHaveLength(12);
    expect(screen.queryByRole("button", { name: /Mostrar/ })).toBeNull();
  });

  it("offers no «Mostrar más» for 10 members", () => {
    render(<ContentTable row={rowFor(twelveMembers().slice(0, 10))} />);
    expect(bodyRows()).toHaveLength(10);
    expect(screen.queryByRole("button", { name: /Mostrar/ })).toBeNull();
  });
});

describe("Missing-content notice in the product panel (D-13)", () => {
  it("tells how many descriptions and purchases are left out, and the link focuses the section", () => {
    render(<ProductDetail row={rowFor(detectedAndMissing())} />);
    const notice = screen.getByText(
      "Falta el contenido de 1 descripción, por eso 1 compra no entra en la comparación.",
    );
    expect(notice).toBeInTheDocument();
    const alert = notice.closest('[data-slot="alert"]');
    if (!(alert instanceof HTMLElement)) throw new Error("no alert around the notice");
    expect(alert).toHaveAttribute("role", "status");
    const link = within(alert).getByRole("button", { name: "Capturar contenido" });
    fireEvent.click(link);
    expect(screen.getByRole("heading", { name: "Contenido de cada descripción" })).toHaveFocus();
  });

  it("uses the plural forms for several descriptions and purchases", () => {
    const purchases = [
      ...detectedAndMissing(),
      buy({ rfc: RFC_B, store: "Tienda Beta", descripcion: LACDEL, unidad: "H87", fecha: "2025-02-15T10:00:00" }),
      buy({ rfc: RFC_C, store: "Tienda Gama", descripcion: "Leche Gama", unidad: "H87" }),
    ];
    render(<ProductDetail row={rowFor(purchases)} />);
    expect(
      screen.getByText("Falta el contenido de 2 descripciones, por eso 3 compras no entran en la comparación."),
    ).toBeInTheDocument();
  });

  it("is absent when no description lacks its content", () => {
    const purchases = [
      buy({ rfc: RFC_A, store: "Tienda Alfa", descripcion: ALPURA, unidad: "H87", cantidad: "2", amount: "100" }),
    ];
    render(<ProductDetail row={rowFor(purchases)} />);
    expect(screen.queryByText(/Falta el contenido/)).toBeNull();
  });

  it("is absent once a correction gives the missing description its content", () => {
    const correction = correctionOf(RFC_B, LACDEL, { packs: 1, amount: "1", unit: "l" });
    render(<ProductDetail row={rowFor(detectedAndMissing(), [correction])} />);
    expect(screen.queryByText(/Falta el contenido/)).toBeNull();
  });

  it("places the content section between the chart and the purchases list", () => {
    render(<ProductDetail row={rowFor(detectedAndMissing())} />);
    const headings = screen.getAllByRole("heading").map((heading) => heading.textContent);
    const content = headings.indexOf("Contenido de cada descripción");
    const purchases = headings.indexOf("Compras");
    expect(content).toBeGreaterThanOrEqual(0);
    expect(purchases).toBeGreaterThan(content);
  });
});

// --- The inline editor (Task 2) ---

/** Recomputes the row from the stored corrections, the way the Precios tab does. */
function Harness({
  purchases,
  onAnnounce,
}: {
  purchases: Purchase[];
  onAnnounce?: (message: string) => void;
}) {
  const contentCorrections = useSettingsStore((state) => state.contentCorrections);
  const row = useMemo(() => rowFor(purchases, contentCorrections), [purchases, contentCorrections]);
  return <ProductDetail row={row} onAnnounce={onAnnounce} />;
}

/** Store B buys 6 unsized pieces for $432 next to a store A that reads 12 L per piece. */
function walmartStyle(): Purchase[] {
  return [
    buy({ rfc: RFC_A, store: "Tienda Alfa", descripcion: ALPURA, unidad: "H87", cantidad: "2", amount: "100" }),
    buy({ rfc: RFC_B, store: "Tienda Beta", descripcion: LACDEL, unidad: "H87", cantidad: "6", amount: "432" }),
  ];
}

const CAPTURE = `Capturar contenido de «${LACDEL}» (Tienda Beta)`;
const PENCIL_B = `Corregir el contenido de «${LACDEL}» (Tienda Beta)`;
const PENCIL_A = `Corregir el contenido de «${ALPURA}» (Tienda Alfa)`;

function packsField(): HTMLInputElement {
  const field = screen.getByRole("textbox", { name: "Piezas por paquete" });
  if (!(field instanceof HTMLInputElement)) throw new Error("not an input");
  return field;
}

function amountField(): HTMLInputElement {
  const field = screen.getByRole("textbox", { name: "Contenido de cada pieza" });
  if (!(field instanceof HTMLInputElement)) throw new Error("not an input");
  return field;
}

function unitSelect(): HTMLElement {
  return screen.getByRole("combobox", { name: "Unidad" });
}

function type(field: HTMLElement, value: string): void {
  fireEvent.change(field, { target: { value } });
}

function chooseUnit(label: string): void {
  fireEvent.click(unitSelect());
  const option = screen.getByRole("option", { name: label });
  // Base UI commits a mouse selection only when the pointer went down on the item.
  fireEvent.pointerDown(option);
  fireEvent.click(option);
}

function fillCorrection(packs: string, amount: string, unit: string): void {
  type(packsField(), packs);
  type(amountField(), amount);
  chooseUnit(unit);
}

function storedCorrections(): ContentCorrection[] {
  return useSettingsStore.getState().contentCorrections;
}

describe("Content editor: opening, fields and live preview (D-13, D-14)", () => {
  it("opens under the member, focuses «Piezas por paquete» and shows labels, helper and the unit options", () => {
    render(<Harness purchases={walmartStyle()} />);
    fireEvent.click(screen.getByRole("button", { name: CAPTURE }));

    expect(packsField()).toHaveFocus();
    expect(packsField().value).toBe("1");
    expect(amountField().value).toBe("");
    expect(
      screen.getByText("Para un paquete de 12 botellas de 1 L: piezas por paquete 12, contenido 1, unidad L."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar contenido" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Descartar cambios" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Volver a lo detectado" })).toBeNull();
    fireEvent.click(unitSelect());
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "g",
      "kg",
      "mL",
      "L",
      "piezas",
    ]);
  });

  it("previews the content per purchase and the total with the invoice quantity, politely", () => {
    render(<Harness purchases={walmartStyle()} />);
    fireEvent.click(screen.getByRole("button", { name: CAPTURE }));
    fillCorrection("12", "1", "L");

    const preview = screen.getByText(
      "Contenido por compra: 12 × 1 L. Con la cantidad de la factura (6), cada compra equivale a 72 L.",
    );
    expect(preview).toHaveAttribute("aria-live", "polite");
    expect(preview.className).toContain("text-xs");
  });

  it("keeps the live region mounted but empty while the typed values are not valid", () => {
    render(<Harness purchases={walmartStyle()} />);
    fireEvent.click(screen.getByRole("button", { name: CAPTURE }));
    const region = document.querySelector('[data-slot="content-preview"]');
    expect(region).not.toBeNull();
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region?.textContent).toBe("");
    type(amountField(), "abc");
    expect(region?.textContent).toBe("");
  });

  it("prefills the editor of a corrected member from its correction", () => {
    const correction = correctionOf(RFC_A, ALPURA, { packs: 6, amount: "0.5", unit: "kg" });
    seedCorrections(correction);
    render(<Harness purchases={walmartStyle()} />);
    fireEvent.click(screen.getByRole("button", { name: PENCIL_A }));
    expect(packsField().value).toBe("6");
    expect(amountField().value).toBe("0.5");
    expect(unitSelect()).toHaveTextContent("kg");
    expect(screen.getByRole("button", { name: "Volver a lo detectado" })).toBeInTheDocument();
  });

  it("prefills the editor of a detected member from the reading", () => {
    render(<Harness purchases={walmartStyle()} />);
    fireEvent.click(screen.getByRole("button", { name: PENCIL_A }));
    expect(packsField().value).toBe("1");
    expect(amountField().value).toBe("12");
    expect(unitSelect()).toHaveTextContent("L");
  });

  it("opens one editor at a time", () => {
    render(<Harness purchases={walmartStyle()} />);
    fireEvent.click(screen.getByRole("button", { name: CAPTURE }));
    fireEvent.click(screen.getByRole("button", { name: PENCIL_A }));
    expect(screen.getAllByRole("textbox", { name: "Piezas por paquete" })).toHaveLength(1);
  });
});

describe("Content editor: saving, discarding and focus (D-13, D-14, D-15, D-28)", () => {
  it("saves with Enter, stores the seven fields, shows «12 × 1 L» with «Corregido», recalculates and returns focus to the pencil", () => {
    const announce = vi.fn<(message: string) => void>();
    render(<Harness purchases={walmartStyle()} onAnnounce={announce} />);
    expect(screen.getByText(/Falta el contenido de 1 descripción/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: CAPTURE }));
    fillCorrection("12", "1", "L");
    fireEvent.keyDown(amountField(), { key: "Enter" });

    expect(storedCorrections()).toEqual([
      {
        rfc: RFC_B,
        key: normalizeDescription(LACDEL),
        description: LACDEL,
        supplierName: "Tienda Beta",
        packs: 12,
        amount: "1",
        unit: "l",
      },
    ]);
    expect(screen.queryByRole("textbox", { name: "Piezas por paquete" })).toBeNull();
    const row = rowWith(LACDEL);
    expect(row).toHaveTextContent("12 × 1 L");
    expect(row).toHaveTextContent("Corregido");
    expect(row).not.toHaveTextContent("No normalizado");
    expect(screen.queryByText(/Falta el contenido/)).toBeNull();
    // The comparison now has two stores: the summary uses the new content.
    expect(screen.getByText(/Ahorro estimado: \$132\.00\./)).toBeInTheDocument();
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith("Contenido guardado. El ahorro estimado de «Leche» es $132.00.");
    expect(screen.getByRole("button", { name: PENCIL_B })).toHaveFocus();
  });

  it("saves with the button and announces just «Contenido guardado.» when the product has no saving", () => {
    const announce = vi.fn<(message: string) => void>();
    const only = [
      buy({ rfc: RFC_B, store: "Tienda Beta", descripcion: LACDEL, unidad: "H87", cantidad: "6", amount: "432" }),
    ];
    render(<Harness purchases={only} onAnnounce={announce} />);
    // The only description of a per-piece product is not «No normalizado»: it has the pencil.
    fireEvent.click(screen.getByRole("button", { name: PENCIL_B }));
    fillCorrection("1", "375", "g");
    fireEvent.click(screen.getByRole("button", { name: "Guardar contenido" }));

    expect(storedCorrections()).toHaveLength(1);
    expect(rowWith(LACDEL)).toHaveTextContent("375 g");
    expect(announce).toHaveBeenCalledWith("Contenido guardado.");
    expect(screen.getByRole("button", { name: PENCIL_B })).toHaveFocus();
  });

  it("discards with Escape: nothing is stored and focus returns to the button that opened it", () => {
    render(<Harness purchases={walmartStyle()} />);
    fireEvent.click(screen.getByRole("button", { name: CAPTURE }));
    fillCorrection("12", "1", "L");
    fireEvent.keyDown(amountField(), { key: "Escape" });

    expect(storedCorrections()).toEqual([]);
    expect(screen.queryByRole("textbox", { name: "Piezas por paquete" })).toBeNull();
    expect(screen.getByRole("button", { name: CAPTURE })).toHaveFocus();
  });

  it("discards with «Descartar cambios» and returns focus", () => {
    render(<Harness purchases={walmartStyle()} />);
    fireEvent.click(screen.getByRole("button", { name: PENCIL_A }));
    type(amountField(), "99");
    fireEvent.click(screen.getByRole("button", { name: "Descartar cambios" }));
    expect(storedCorrections()).toEqual([]);
    expect(screen.getByRole("button", { name: PENCIL_A })).toHaveFocus();
  });

  it("does not discard when Escape closes the open unit list", async () => {
    render(<Harness purchases={walmartStyle()} />);
    fireEvent.click(screen.getByRole("button", { name: CAPTURE }));
    fireEvent.click(unitSelect());
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByRole("option")).toBeNull();
    });
    expect(packsField()).toBeInTheDocument();
  });

  it("replaces the correction of a member that already has one", () => {
    const correction = correctionOf(RFC_A, ALPURA, { packs: 12, amount: "1", unit: "l" });
    seedCorrections(correction);
    render(<Harness purchases={walmartStyle()} />);
    fireEvent.click(screen.getByRole("button", { name: PENCIL_A }));
    type(packsField(), "6");
    fireEvent.keyDown(packsField(), { key: "Enter" });
    expect(storedCorrections()).toHaveLength(1);
    expect(storedCorrections()[0]?.packs).toBe(6);
    expect(rowWith(ALPURA)).toHaveTextContent("6 × 1 L");
  });

  it("trims the typed values before storing them", () => {
    render(<Harness purchases={walmartStyle()} />);
    fireEvent.click(screen.getByRole("button", { name: CAPTURE }));
    fillCorrection(" 12 ", " 1.5 ", "kg");
    fireEvent.keyDown(packsField(), { key: "Enter" });
    expect(storedCorrections()[0]).toMatchObject({ packs: 12, amount: "1.5", unit: "kg" });
  });
});

describe("Content editor: validation and the cap (D-15, T-05-22)", () => {
  function open(): void {
    render(<Harness purchases={walmartStyle()} />);
    fireEvent.click(screen.getByRole("button", { name: CAPTURE }));
  }

  it.each(["0", "", "abc", "-1", "1e3", "1,000", "1,5,5", "0,0000001", "0.0000001", "1000001"])(
    "refuses the content «%s» with the field message and writes nothing",
    (value) => {
      open();
      type(packsField(), "1");
      type(amountField(), value);
      fireEvent.keyDown(amountField(), { key: "Enter" });

      const message = screen.getByText("Escribe un contenido mayor que 0.");
      expect(amountField()).toHaveAttribute("aria-invalid", "true");
      expect(amountField().getAttribute("aria-describedby")).toBe(message.id);
      expect(packsField()).not.toHaveAttribute("aria-invalid", "true");
      expect(storedCorrections()).toEqual([]);
      expect(screen.getByRole("textbox", { name: "Piezas por paquete" })).toBeInTheDocument();
      expect(toastMock).not.toHaveBeenCalled();
    },
  );

  it.each(["0", "", "2.5", "-3", "abc", "1000", "1e2"])(
    "refuses the pieces «%s» with the field message and writes nothing",
    (value) => {
      open();
      type(packsField(), value);
      type(amountField(), "1");
      fireEvent.click(screen.getByRole("button", { name: "Guardar contenido" }));

      const message = screen.getByText("Escribe un número entero de piezas, 1 o más.");
      expect(packsField()).toHaveAttribute("aria-invalid", "true");
      expect(packsField().getAttribute("aria-describedby")).toBe(message.id);
      expect(amountField()).not.toHaveAttribute("aria-invalid", "true");
      expect(storedCorrections()).toEqual([]);
    },
  );

  it("shows both messages together and clears each one when its field changes", () => {
    open();
    type(packsField(), "0");
    type(amountField(), "0");
    fireEvent.click(screen.getByRole("button", { name: "Guardar contenido" }));
    expect(screen.getByText("Escribe un contenido mayor que 0.")).toBeInTheDocument();
    expect(screen.getByText("Escribe un número entero de piezas, 1 o más.")).toBeInTheDocument();

    type(amountField(), "1");
    expect(screen.queryByText("Escribe un contenido mayor que 0.")).toBeNull();
    expect(amountField()).not.toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Escribe un número entero de piezas, 1 o más.")).toBeInTheDocument();

    type(packsField(), "12");
    expect(screen.queryByText("Escribe un número entero de piezas, 1 o más.")).toBeNull();
    expect(packsField()).not.toHaveAttribute("aria-invalid", "true");
  });

  it("puts focus on the first invalid field after a refused save", () => {
    open();
    type(packsField(), "1");
    type(amountField(), "0");
    fireEvent.click(screen.getByRole("button", { name: "Guardar contenido" }));
    expect(amountField()).toHaveFocus();
  });

  it.each([
    ["1,5", "1.5"],
    ["0,25", "0.25"],
    ["0,125", "0.125"],
  ])("reads the decimal comma in «%s» and stores «%s»", (typed, stored) => {
    open();
    fillCorrection("1", typed, "kg");
    fireEvent.keyDown(packsField(), { key: "Enter" });
    expect(storedCorrections()[0]).toMatchObject({ amount: stored });
  });

  it("accepts the edges: 999 pieces, 6 decimals and 1000000", () => {
    open();
    fillCorrection("999", "0.000001", "g");
    fireEvent.keyDown(packsField(), { key: "Enter" });
    expect(storedCorrections()[0]).toMatchObject({ packs: 999, amount: "0.000001", unit: "g" });
    cleanup();
    seedCorrections();
    open();
    fillCorrection("1", "1000000", "g");
    fireEvent.keyDown(packsField(), { key: "Enter" });
    expect(storedCorrections()[0]).toMatchObject({ amount: "1000000" });
  });

  function fullList(): ContentCorrection[] {
    return Array.from({ length: 2000 }, (_, index) =>
      correctionOf(`FULL${String(index).padStart(8, "0")}`, `OTRA ${String(index)}`, { packs: 1 }),
    );
  }

  it("shows the limit sentence at the cap, saves nothing and says so with a toast and an announcement", () => {
    seedCorrections(...fullList());
    const announce = vi.fn<(message: string) => void>();
    render(<Harness purchases={walmartStyle()} onAnnounce={announce} />);
    fireEvent.click(screen.getByRole("button", { name: CAPTURE }));
    fillCorrection("12", "1", "L");
    fireEvent.click(screen.getByRole("button", { name: "Guardar contenido" }));

    const sentence = "Alcanzaste el límite de 2,000 correcciones de contenido. Quita alguna para guardar más.";
    expect(screen.getByText(sentence)).toBeInTheDocument();
    expect(storedCorrections()).toHaveLength(2000);
    expect(storedCorrections().some((entry) => entry.rfc === RFC_B)).toBe(false);
    expect(toastMock.error).toHaveBeenCalledWith(sentence);
    expect(announce).toHaveBeenCalledWith(sentence);
    expect(screen.getByRole("textbox", { name: "Piezas por paquete" })).toBeInTheDocument();

    // Typing again clears the sentence; the limit is told again if the user tries again.
    type(packsField(), "6");
    expect(screen.queryByText(sentence)).toBeNull();
  });

  it("still lets a member that already has a correction be replaced at the cap", () => {
    const own = correctionOf(RFC_A, ALPURA, { packs: 12, amount: "1", unit: "l" });
    seedCorrections(...fullList().slice(0, 1999), own);
    render(<Harness purchases={walmartStyle()} />);
    fireEvent.click(screen.getByRole("button", { name: PENCIL_A }));
    type(packsField(), "3");
    fireEvent.keyDown(packsField(), { key: "Enter" });
    expect(storedCorrections()).toHaveLength(2000);
    expect(rowWith(ALPURA)).toHaveTextContent("3 × 1 L");
    expect(toastMock.error).not.toHaveBeenCalled();
  });
});

describe("Content editor: «Volver a lo detectado» (D-13, D-15)", () => {
  it("removes the correction, toasts for 6 s with «Deshacer», and the undo puts it back", () => {
    const correction = correctionOf(RFC_A, ALPURA, { packs: 6, amount: "2", unit: "l" });
    seedCorrections(correction);
    render(<Harness purchases={walmartStyle()} />);
    expect(rowWith(ALPURA)).toHaveTextContent("6 × 2 L");
    fireEvent.click(screen.getByRole("button", { name: PENCIL_A }));
    fireEvent.click(screen.getByRole("button", { name: "Volver a lo detectado" }));

    expect(storedCorrections()).toEqual([]);
    expect(rowWith(ALPURA)).toHaveTextContent("12 L");
    expect(rowWith(ALPURA)).toHaveTextContent("detectado");
    expect(screen.queryByRole("textbox", { name: "Piezas por paquete" })).toBeNull();
    expect(screen.getByRole("button", { name: PENCIL_A })).toHaveFocus();
    const [message, options] = toastMock.mock.calls.at(-1) ?? [];
    expect(message).toBe(`Se quitó la corrección de «${ALPURA}»`);
    expect(options?.duration).toBe(6000);
    expect(options?.action?.label).toBe("Deshacer");

    act(() => {
      options?.action?.onClick();
    });
    expect(storedCorrections()).toEqual([correction]);
    expect(rowWith(ALPURA)).toHaveTextContent("6 × 2 L");
  });

  it("cuts the description at 40 characters, «…» included, in the toast", () => {
    const long = `LECHE ${"Y".repeat(80)} 12/1L`;
    seedCorrections(correctionOf(RFC_A, long, { packs: 2, amount: "1", unit: "l" }));
    const purchases = [buy({ rfc: RFC_A, store: "Tienda Alfa", descripcion: long, unidad: "H87" })];
    render(<Harness purchases={purchases} />);
    fireEvent.click(screen.getByRole("button", { name: /^Corregir el contenido de/ }));
    fireEvent.click(screen.getByRole("button", { name: "Volver a lo detectado" }));
    expect(toastMock.mock.calls.at(-1)?.[0]).toBe(
      `Se quitó la corrección de «${Array.from(long).slice(0, 39).join("")}…»`,
    );
  });
});

describe("Content editor in the Precios tab (D-13, D-15, D-28)", () => {
  const WALMART = makeProduct("Leche", [
    { rfc: RFC_A, descripcion: ALPURA, supplierName: "Tienda Alfa" },
    { rfc: RFC_B, descripcion: LACDEL, supplierName: "Tienda Beta" },
  ]);

  function invoice(rfc: string, nombre: string, descripcion: string, cantidad: string, importe: string) {
    return purchaseInvoice({
      rfc,
      nombre,
      conceptos: [makeConcepto({ descripcion, claveUnidad: "H87", cantidad, valorUnitario: importe, importe })],
    });
  }

  function load(): void {
    act(() => {
      const store = useSessionStore.getState();
      const invoices = [
        invoice(RFC_A, "Tienda Alfa", ALPURA, "2", "100.00"),
        invoice(RFC_B, "Tienda Beta", LACDEL, "6", "432.00"),
      ];
      store.applyBatch(
        invoices.map((item) => ({
          kind: "parsed" as const,
          file: { name: `${item.uuid}.xml`, path: `${item.uuid}.xml` },
          result: { ok: true as const, invoice: item },
        })),
        store.generation,
      );
    });
  }

  afterEach(() => {
    act(() => {
      useSessionStore.getState().clearAll();
    });
  });

  it("turns an unsized description into a real comparison: the card, the row, the notice and the announcement follow at once", () => {
    act(() => {
      useSettingsStore.setState({ ...defaultSettings(), products: [WALMART] });
    });
    load();
    render(<AppShell />);
    fireEvent.click(screen.getByRole("tab", { name: "Precios" }));
    const panel = within(screen.getByRole("tabpanel", { name: "Precios" }));
    expect(screen.getByTestId("prices-savings-total")).toHaveTextContent("$0.00");
    fireEvent.click(panel.getByRole("button", { name: "Ver precios de Leche" }));
    expect(panel.getByText(/Falta el contenido de 1 descripción/)).toBeInTheDocument();

    fireEvent.click(panel.getByRole("button", { name: CAPTURE }));
    fillCorrection("12", "1", "L");
    fireEvent.click(panel.getByRole("button", { name: "Guardar contenido" }));

    expect(screen.getByTestId("prices-savings-total")).toHaveTextContent("$132.00");
    expect(panel.queryByText(/Falta el contenido/)).toBeNull();
    expect(screen.getByTestId("prices-announcement")).toHaveTextContent(
      "Contenido guardado. El ahorro estimado de «Leche» es $132.00.",
    );
    expect(panel.getByRole("button", { name: PENCIL_B })).toHaveFocus();
    expect(useSettingsStore.getState().contentCorrections).toHaveLength(1);
  });
});
