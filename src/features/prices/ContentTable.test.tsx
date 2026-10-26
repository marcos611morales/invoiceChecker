// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import Big from "big.js";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { compareProduct, type ProductComparison } from "@/domain/prices/compare";
import type { Purchase } from "@/domain/prices/purchases";
import { normalizeDescription, ruleMapKey } from "@/domain/settings/normalize";
import { defaultSettings, type ContentCorrection } from "@/domain/settings/types";
import { useSettingsStore } from "@/stores/settingsStore";
import { makeProduct } from "../../../tests/support/pricesFactory";
import "../../../tests/support/domPolyfills";
import { resetSettingsStore } from "../../../tests/support/settingsStorage";
import { CONTENT_SECTION_ID, ContentTable, contentSectionId } from "./ContentTable";
import { ProductDetail } from "./ProductDetail";

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
  const table = screen.getByRole("table");
  const groups = within(table).getAllByRole("rowgroup");
  const body = groups[1];
  if (body === undefined) throw new Error("no table body");
  return within(body).getAllByRole("row");
}

function rowWith(text: string): HTMLElement {
  const row = bodyRows().find((candidate) => candidate.textContent?.includes(text));
  if (row === undefined) throw new Error(`no row with ${text}`);
  return row;
}

beforeEach(() => {
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
    const cells = within(rows[1] as HTMLElement).getAllByRole("cell");
    expect(cells[3]).toHaveTextContent("1");
  });
});

describe("Contenido de cada descripción: member states (D-13, D-14, E8)", () => {
  it("shows a detected content in muted text with the outline badge «detectado»", () => {
    render(<ContentTable row={rowFor(detectedAndMissing())} />);
    const cell = within(rowWith(ALPURA)).getAllByRole("cell")[2] as HTMLElement;
    expect(cell).toHaveTextContent("12 L");
    expect(cell).toHaveTextContent("detectado");
    expect(within(cell).getByText("12 L").className).toContain("text-muted-foreground");
    expect(cell).not.toHaveTextContent("Corregido");
  });

  it("shows a corrected content in foreground with «Corregido» and «12 × 1 L»", () => {
    const correction = correctionOf(RFC_A, ALPURA, { packs: 12, amount: "1", unit: "l" });
    seedCorrections(correction);
    render(<ContentTable row={rowFor(detectedAndMissing(), [correction])} />);
    const cell = within(rowWith(ALPURA)).getAllByRole("cell")[2] as HTMLElement;
    expect(cell).toHaveTextContent("12 × 1 L");
    expect(cell).toHaveTextContent("Corregido");
    expect(cell).not.toHaveTextContent("detectado");
    expect(within(cell).getByText("12 × 1 L").className).not.toContain("text-muted-foreground");
  });

  it("shows «No normalizado», its reason and an outline «Capturar contenido» that names the description", () => {
    render(<ContentTable row={rowFor(detectedAndMissing())} />);
    const row = rowWith(LACDEL);
    const cell = within(row).getAllByRole("cell")[2] as HTMLElement;
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
      const cell = within(row).getAllByRole("cell")[2] as HTMLElement;
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
    expect(within(row).queryByRole("button")).toBeNull();
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
    expect(within(row).queryByRole("button")).toBeNull();
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
    expect(alert).not.toBeNull();
    expect(alert).toHaveAttribute("role", "status");
    const link = within(alert as HTMLElement).getByRole("button", { name: "Capturar contenido" });
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
