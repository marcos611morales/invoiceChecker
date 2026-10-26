// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import Big from "big.js";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ComparedPurchase, ProductComparison } from "@/domain/prices/compare";
import type { NotNormalizedReason } from "@/domain/prices/content";
import type { Purchase } from "@/domain/prices/purchases";
import type { UnitFamily } from "@/domain/prices/units";
import { ProductDetail } from "./ProductDetail";
import { PurchasesList } from "./PurchasesList";

const RFC = "AAA010101AAA";
const UUID = "11111111-2222-3333-4444-555555555555";

function base(over: Partial<Purchase> = {}): Purchase {
  return {
    productId: "p1",
    productName: "Leche entera",
    storeRfc: RFC,
    storeName: "Tienda Alfa",
    memberKey: `${RFC}|LECHE`,
    descripcion: "Leche Entera 1 L",
    claveProdServ: "50131700",
    claveUnidad: "LTR",
    cantidad: "12",
    fecha: "2025-05-28T17:38:18",
    folio: "F-100",
    uuid: UUID,
    conceptIndex: 0,
    amount: new Big("240"),
    ...over,
  };
}

interface ComparedInput extends Partial<Purchase> {
  family?: UnitFamily;
  content?: string;
  price?: string;
}

function compared(input: ComparedInput = {}): ComparedPurchase {
  const { family, content, price, ...rest } = input;
  return {
    ...base(rest),
    status: "compared",
    family: family ?? "volume",
    content: new Big(content ?? "12"),
    price: new Big(price ?? "20"),
    sized: true,
    source: "xml",
  };
}

interface RejectedInput extends Partial<Purchase> {
  reason: NotNormalizedReason;
  family?: UnitFamily | null;
}

function rejected(input: RejectedInput): ComparedPurchase {
  const { reason, family, ...rest } = input;
  return {
    ...base(rest),
    status: "not-normalized",
    reason,
    family: family ?? null,
    content: null,
  };
}

/** Body rows of the purchases list, in the order shown. */
function bodyRows(): HTMLElement[] {
  const body = screen.getAllByRole("rowgroup")[1];
  if (body === undefined) throw new Error("no table body");
  return within(body).getAllByRole("row");
}

function cellsOf(row: HTMLElement): HTMLElement[] {
  return within(row).getAllByRole("cell");
}

function cellAt(row: HTMLElement | undefined, index: number): HTMLElement {
  if (row === undefined) throw new Error("no row");
  const cell = cellsOf(row)[index];
  if (cell === undefined) throw new Error(`no cell ${String(index)}`);
  return cell;
}

afterEach(() => {
  cleanup();
});

describe("PurchasesList columns (D-08)", () => {
  it("lists date, store, folio, description, XML quantity, content and unit price", () => {
    render(<PurchasesList purchases={[compared()]} />);
    expect(
      screen.getAllByRole("columnheader").map((header) => header.textContent),
    ).toEqual([
      "Fecha",
      "Tienda",
      "Folio",
      "Descripción",
      "Cantidad (XML)",
      "Contenido",
      "Precio unitario",
    ]);
    const [row] = bodyRows();
    expect(cellAt(row, 0)).toHaveTextContent("28 may 2025");
    expect(cellAt(row, 1)).toHaveTextContent("Tienda Alfa");
    expect(cellAt(row, 2)).toHaveTextContent("F-100");
    expect(cellAt(row, 3)).toHaveTextContent("Leche Entera 1 L");
    expect(cellAt(row, 4)).toHaveTextContent("12");
    expect(cellAt(row, 5)).toHaveTextContent("12 L");
    expect(cellAt(row, 6)).toHaveTextContent("$20.00 / L");
  });

  it("shows a mass purchase in kilograms with its price per kilogram", () => {
    render(
      <PurchasesList
        purchases={[
          compared({
            claveUnidad: "KGM",
            cantidad: "0.270000",
            family: "mass",
            content: "0.27",
            price: "35.2047",
          }),
        ]}
      />,
    );
    const [row] = bodyRows();
    expect(cellAt(row, 4)).toHaveTextContent("0.27");
    expect(cellAt(row, 5)).toHaveTextContent("0.27 kg");
    expect(cellAt(row, 6)).toHaveTextContent("$35.20 / kg");
  });

  it("pluralizes the pieces bought", () => {
    render(
      <PurchasesList
        purchases={[
          compared({ family: "piece", content: "6", price: "10", uuid: "u1" }),
          compared({ family: "piece", content: "1", price: "10", uuid: "u2" }),
        ]}
      />,
    );
    const rows = bodyRows();
    expect(cellAt(rows[0], 5)).toHaveTextContent("6 piezas");
    expect(cellAt(rows[1], 5)).toHaveTextContent("1 pieza");
    expect(cellAt(rows[1], 6)).toHaveTextContent("$10.00 / pieza");
  });

  it("reads a dash for a missing folio", () => {
    render(<PurchasesList purchases={[compared({ folio: null })]} />);
    expect(cellAt(bodyRows()[0], 2)).toHaveTextContent("—");
  });

  it("keeps the order it receives, newest first", () => {
    render(
      <PurchasesList
        purchases={[
          compared({ fecha: "2025-06-02T10:00:00", folio: "F-3", uuid: "u3" }),
          rejected({ reason: "bad-quantity", fecha: "2025-05-01T10:00:00", folio: "F-2", uuid: "u2" }),
          compared({ fecha: "2025-01-05T10:00:00", folio: "F-1", uuid: "u1" }),
        ]}
      />,
    );
    expect(bodyRows().map((row) => cellAt(row, 2).textContent)).toEqual(["F-3", "F-2", "F-1"]);
    expect(bodyRows().map((row) => cellAt(row, 0).textContent)).toEqual([
      "2 jun 2025",
      "1 may 2025",
      "5 ene 2025",
    ]);
  });

  it("keeps a minimum width of 880 px inside a scroll container", () => {
    render(<PurchasesList purchases={[compared()]} />);
    const table = screen.getByRole("table");
    expect(table.className).toContain("min-w-[880px]");
    expect(table.parentElement?.className).toContain("overflow-x-auto");
  });
});

describe("description (D-08)", () => {
  it("shows the XML text unchanged, with its original case, as an accessible full text", () => {
    render(<PurchasesList purchases={[compared({ descripcion: "LECHE ENTERA ALPURA 1LT x12" })]} />);
    const button = screen.getByRole("button", { name: "LECHE ENTERA ALPURA 1LT x12" });
    expect(button).toHaveTextContent("LECHE ENTERA ALPURA 1LT x12");
  });

  it("wraps to two lines and then truncates, and keeps markup as text (T-05-15)", () => {
    const long = `${"Descripción larguísima ".repeat(12)}<b>fin</b>`;
    render(<PurchasesList purchases={[compared({ descripcion: long })]} />);
    const button = screen.getByRole("button", { name: long });
    expect(button.className).toContain("line-clamp-2");
    expect(button).toHaveTextContent("<b>fin</b>");
    expect(button.querySelector("b")).toBeNull();
    expect(document.body.querySelector("b")).toBeNull();
  });
});

describe("not-normalized purchases (D-09, D-10, D-12, D-26, D-29)", () => {
  it.each([
    [
      "unit-unknown",
      { reason: "unit-unknown", claveUnidad: "MTR" },
      "La unidad «MTR» no tiene equivalencia.",
    ],
    ["bad-quantity", { reason: "bad-quantity" }, "La cantidad de la factura no es válida."],
    ["bad-amount", { reason: "bad-amount", family: "volume" }, "El monto de la línea no es válido."],
    [
      "zero-amount",
      { reason: "zero-amount", family: "volume" },
      "La línea no tiene importe (descuento total o monto cero).",
    ],
    [
      "unsized-with-sized-siblings",
      { reason: "unsized-with-sized-siblings", family: "piece" },
      "Sin tamaño en la descripción, y otras compras de este producto sí lo tienen.",
    ],
  ] as const)("explains %s under «No normalizado»", (_code, input, sentence) => {
    render(<PurchasesList purchases={[compared({ uuid: "ok" }), rejected({ ...input, uuid: "no" })]} />);
    const row = bodyRows()[1];
    const content = cellAt(row, 5);
    expect(content).toHaveTextContent("No normalizado");
    const caption = within(content).getByText(sentence);
    expect(caption.className).toContain("text-xs");
    expect(caption.className).toContain("text-muted-foreground");
    expect(cellAt(row, 6)).toHaveTextContent("—");
    expect(row?.className).toContain("text-muted-foreground");
    expect(row?.className).not.toContain("opacity");
  });

  it.each([
    ["volume", "mass", "Se compró en litros; este producto se compara en kilogramos."],
    ["mass", "volume", "Se compró en kilogramos; este producto se compara en litros."],
    ["piece", "mass", "Se compró en piezas; este producto se compara en kilogramos."],
    ["mass", "piece", "Se compró en kilogramos; este producto se compara en piezas."],
  ] as const)(
    "names a purchase bought in %s on a product compared in %s",
    (bought, comparedIn, sentence) => {
      render(
        <PurchasesList
          purchases={[
            compared({ family: comparedIn, uuid: "ok" }),
            rejected({ reason: "other-family", family: bought, uuid: "no" }),
          ]}
        />,
      );
      expect(within(cellAt(bodyRows()[1], 5)).getByText(sentence)).toBeInTheDocument();
    },
  );

  it("keeps a compared row in foreground color", () => {
    render(<PurchasesList purchases={[compared()]} />);
    expect(bodyRows()[0]?.className).not.toContain("text-muted-foreground");
  });
});

describe("overflow (E9)", () => {
  function many(n: number): ComparedPurchase[] {
    return Array.from({ length: n }, (_, index) =>
      compared({
        uuid: `u${String(index)}`,
        folio: `F-${String(index)}`,
        fecha: `2025-05-${String(28 - (index % 28)).padStart(2, "0")}T10:00:00`,
      }),
    );
  }

  it("shows 20 purchases first and reveals the rest with «Mostrar 5 más»", () => {
    render(<PurchasesList purchases={many(25)} />);
    expect(bodyRows()).toHaveLength(20);
    fireEvent.click(screen.getByRole("button", { name: "Mostrar 5 más" }));
    expect(bodyRows()).toHaveLength(25);
    expect(screen.queryByRole("button", { name: /Mostrar/ })).toBeNull();
  });

  it("offers no button with 20 purchases or fewer", () => {
    render(<PurchasesList purchases={many(20)} />);
    expect(bodyRows()).toHaveLength(20);
    expect(screen.queryByRole("button", { name: /Mostrar/ })).toBeNull();
  });
});

describe("privacy (T-05-16)", () => {
  it("never shows the RFC or the UUID of a purchase", () => {
    render(
      <PurchasesList
        purchases={[compared(), rejected({ reason: "bad-quantity", uuid: "22222222-3333-4444-5555-666666666666" })]}
      />,
    );
    const text = document.body.textContent;
    expect(text).not.toContain(RFC);
    expect(text).not.toContain(UUID);
    expect(text).not.toContain("22222222-3333");
  });
});

describe("inside the product panel", () => {
  function product(purchases: ComparedPurchase[], stores: ProductComparison["stores"]): ProductComparison {
    return {
      productId: "p1",
      name: "Leche entera",
      family: stores.length === 0 ? null : "volume",
      perPiece: false,
      stores,
      cheapest: null,
      decidedByCount: false,
      saving: null,
      purchases,
      notNormalizedCount: purchases.filter((purchase) => purchase.status === "not-normalized").length,
      otherFamilies: [],
    };
  }

  it("shows the purchases section after the per-store table", () => {
    const store = {
      rfc: RFC,
      name: "Tienda Alfa",
      count: 1,
      min: new Big("20"),
      median: new Big("20"),
      last: new Big("20"),
      lastFecha: "2025-05-28T17:38:18",
    };
    render(<ProductDetail row={product([compared()], [store])} />);
    const regions = screen.getAllByRole("region");
    expect(regions.map((region) => region.querySelector("h3")?.textContent)).toEqual([
      "Precios por tienda",
      "Historial de precios",
      "Contenido de cada descripción",
      "Compras",
    ]);
  });

  it("keeps the purchases list when nothing could be compared (E6 + E7)", () => {
    render(
      <ProductDetail
        row={product([rejected({ reason: "unit-unknown", claveUnidad: "MTR" })], [])}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Ninguna compra de este producto tiene un contenido que se pueda comparar. Captura el contenido abajo para compararlo.",
    );
    const section = screen.getByRole("region", { name: "Compras" });
    expect(within(section).getByText("La unidad «MTR» no tiene equivalencia.")).toBeInTheDocument();
  });
});
