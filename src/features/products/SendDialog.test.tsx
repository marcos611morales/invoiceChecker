// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import {
  buildCategorizeRun,
  buildGroupRun,
  type CategorizeTarget,
  type LlmItem,
} from "@/domain/llm/candidates";
import {
  categorizeRequestSchema,
  groupRequestSchema,
  type CategorizeRequest,
  type GroupRequest,
} from "@/domain/llm/contract";
import type { Category } from "@/domain/settings/types";
import "../../../tests/support/domPolyfills";
import { CategorizeSendDialog, SendDialog } from "./SendDialog";

// LLM-06, T-04-41: what the dialog lists is what the browser serializes. Each body is pushed
// through JSON the way the client does and parsed with the route's own schema, and the rows of the
// dialog are compared with it item for item, including the 200-character cut.

const HEADING_WITHHELD =
  /^No se enviarán \(\d+\): contienen algo que parece un RFC, un UUID, un correo o un número largo\.$/;

function item(description: string, supplierName: string, key = description.toLowerCase()): LlmItem {
  return { rfc: "AAA010101AAA", key, description, supplierName, lines: 1 };
}

/** The body as it travels: serialized to JSON and parsed again with the route's schema. */
function travelled(body: GroupRequest): GroupRequest {
  return groupRequestSchema.parse(JSON.parse(JSON.stringify(body)));
}

function travelledCategorize(body: CategorizeRequest): CategorizeRequest {
  return categorizeRequestSchema.parse(JSON.parse(JSON.stringify(body)));
}

function dialog(): HTMLElement {
  return screen.getByRole("alertdialog");
}

function openDisclosure(): void {
  fireEvent.click(within(dialog()).getByRole("button", { name: /Ver exactamente qué se envía/ }));
}

/** The `li` of the group with this heading, each as the texts of its spans. */
function rowsOf(heading: string | RegExp): string[][] {
  const title = within(dialog()).getByRole("heading", { name: heading });
  const section = title.closest("section");
  if (section === null) throw new Error("the group has no section");
  return within(section)
    .getAllByRole("listitem")
    .map((row) => Array.from(row.querySelectorAll("span")).map((span) => span.textContent));
}

function noop(): void {}

afterEach(cleanup);

describe("the grouping dialog lists what is sent (LLM-06)", () => {
  const LONG = `${"Leche entera deslactosada ".repeat(12)}FIN`;
  const FREE: LlmItem[] = [
    item("LECHE ENTERA 1L", "Tienda Uno"),
    item("MM LECHE ENT", "Tienda Uno"),
    item(LONG, "Tienda Dos"),
    item("AZUCAR ESTANDAR", "Tienda Dos"),
    item("PAGO RFC EKU9003173C9", "Tienda Dos"),
  ];
  const EXISTING = [
    { productId: "p1", name: "Leche" },
    { productId: "p2", name: "Azúcar" },
  ];

  function renderDialog(max = 2) {
    const run = buildGroupRun(FREE, EXISTING, max);
    render(<SendDialog run={run} open onOpenChange={noop} onConfirm={noop} />);
    openDisclosure();
    return run;
  }

  it("shows, item for item, the items of the serialized bodies of every batch", () => {
    const run = renderDialog(2);
    expect(run.batches.length).toBeGreaterThan(1);
    const sent = run.batches.flatMap((batch) =>
      travelled(batch.body).items.map((entry) => [entry.description, entry.supplier]),
    );
    expect(sent).toHaveLength(4);
    expect(rowsOf("Descripciones y proveedores (4)")).toEqual(sent);
  });

  it("shows the 200-character cut, ending in «…», exactly as it travels", () => {
    const run = renderDialog(2);
    const cut = run.batches
      .flatMap((batch) => travelled(batch.body).items)
      .find((entry) => entry.description.endsWith("…"));
    expect(cut?.description).toHaveLength(200);
    expect(within(dialog()).getByText(cut?.description ?? "never")).toBeInTheDocument();
    expect(within(dialog()).queryByText(LONG)).toBeNull();
  });

  it("lists the context names of the bodies once each", () => {
    const run = renderDialog(2);
    const names = [
      ...new Set(run.batches.flatMap((batch) => travelled(batch.body).existing.map((p) => p.name))),
    ];
    expect(rowsOf("Productos existentes, solo como contexto (2)")).toEqual(names.map((name) => [name]));
  });

  it("lists the withheld item under «No se enviarán» and keeps it out of every body", () => {
    const run = renderDialog(2);
    expect(rowsOf(HEADING_WITHHELD)).toEqual([["PAGO RFC EKU9003173C9", "Tienda Dos"]]);
    expect(
      within(dialog()).getByRole("heading", {
        name: "No se enviarán (1): contienen algo que parece un RFC, un UUID, un correo o un número largo.",
      }),
    ).toBeInTheDocument();
    const serialized = JSON.stringify(run.batches.map((batch) => batch.body));
    expect(serialized).not.toContain("EKU9003173C9");
    const listed = rowsOf("Descripciones y proveedores (4)").flat();
    expect(listed.join("|")).not.toContain("EKU9003173C9");
  });

  it("counts in the summary only what is sent", () => {
    renderDialog(2);
    expect(
      within(dialog()).getByText(
        "Se enviarán a DeepSeek 4 descripciones de conceptos y 2 nombres de proveedor. No se envían RFC, UUID, montos, fechas ni folios.",
      ),
    ).toBeInTheDocument();
  });

  it("has no «No se enviarán» group when nothing is withheld", () => {
    const run = buildGroupRun(FREE.slice(0, 2), [], 250);
    render(<SendDialog run={run} open onOpenChange={noop} onConfirm={noop} />);
    openDisclosure();
    expect(within(dialog()).queryByRole("heading", { name: /No se enviarán/ })).toBeNull();
  });
});

describe("the categorize dialog lists what is sent (LLM-06)", () => {
  const CATEGORIES: Category[] = [
    { id: "cat_servicios", name: "Servicios" },
    { id: "seed:otros", name: "Otros" },
    { id: "cat_abarrotes", name: "Abarrotes" },
  ];
  const LONG_MEMBER = `${"Leche entera deslactosada ".repeat(12)}FIN`;
  const TARGETS: CategorizeTarget[] = [
    { kind: "supplier", rfc: "AAA010101AAA", name: "Tienda Uno" },
    { kind: "supplier", rfc: "BBB020202BBB", name: "Tienda Dos" },
    { kind: "supplier", rfc: "CCC030303CCC", name: "Cobros ventas@tienda.mx" },
    {
      kind: "product",
      productId: "prod_leche",
      name: "Leche entera",
      members: ["MM LECHE ENT", LONG_MEMBER, "PEDIDO 12345678"],
    },
    { kind: "product", productId: "prod_azucar", name: "Azúcar", members: ["AZUCAR ESTANDAR"] },
    { kind: "product", productId: "prod_folio", name: "Folios", members: ["FOLIO 20250312345"] },
  ];

  function renderDialog(max = 2) {
    const run = buildCategorizeRun(TARGETS, CATEGORIES, max);
    render(<CategorizeSendDialog run={run} open onOpenChange={noop} onConfirm={noop} />);
    openDisclosure();
    return run;
  }

  it("shows, item for item, the suppliers, the products with their members and the categories of the serialized bodies", () => {
    const run = renderDialog(2);
    expect(run.batches.length).toBeGreaterThan(1);
    const bodies = run.batches.map((batch) => travelledCategorize(batch.body));
    const suppliers = bodies.flatMap((body) => body.suppliers.map((supplier) => [supplier.name]));
    const products = bodies.flatMap((body) =>
      body.products.map((entry) => [entry.name, ...entry.members]),
    );
    expect(suppliers).toEqual([["Tienda Uno"], ["Tienda Dos"]]);
    expect(rowsOf("Proveedores sin categoría (2)")).toEqual(suppliers);
    expect(rowsOf("Productos sin categoría (2)")).toEqual(products);
    const categoryNames = [
      ...new Set(bodies.flatMap((body) => body.categories.map((category) => category.name))),
    ];
    expect(rowsOf(`Tus categorías (${String(categoryNames.length)})`)).toEqual(
      categoryNames.map((name) => [name]),
    );
  });

  it("shows the 200-character cut of a member exactly as it travels", () => {
    const run = renderDialog(2);
    const cut = run.batches
      .flatMap((batch) => travelledCategorize(batch.body).products)
      .flatMap((entry) => entry.members)
      .find((member) => member.endsWith("…"));
    expect(cut).toHaveLength(200);
    expect(within(dialog()).getByText(cut ?? "never")).toBeInTheDocument();
  });

  it("lists the withheld targets under «No se enviarán» and keeps them out of every body", () => {
    const run = renderDialog(2);
    expect(rowsOf(HEADING_WITHHELD)).toEqual([
      ["Cobros ventas@tienda.mx"],
      ["Folios", "FOLIO 20250312345"],
    ]);
    const serialized = JSON.stringify(run.batches.map((batch) => batch.body));
    for (const text of ["ventas@tienda.mx", "20250312345", "12345678"]) {
      expect(serialized).not.toContain(text);
    }
    expect(rowsOf("Productos sin categoría (2)").flat().join("|")).not.toContain("12345678");
  });

  it("counts in the summary only what is sent", () => {
    renderDialog(2);
    expect(
      within(dialog()).getByText(
        "Se enviarán a DeepSeek 2 nombres de proveedor, 2 nombres de producto con las descripciones de sus 3 miembros y los nombres de tus 3 categorías. No se envían RFC, UUID, montos, fechas ni folios.",
      ),
    ).toBeInTheDocument();
  });

  describe("a category name that looks sensitive (WR-04)", () => {
    const BLOCKING =
      "No se puede enviar: la categoría «Pagos EKU9003173C9» contiene algo que parece un RFC, un UUID, un correo o un número largo. Cámbiale el nombre en la pestaña Categorías y vuelve a intentarlo.";

    it("shows the blocking sentence and disables «Enviar a DeepSeek», which sends nothing", () => {
      const run = buildCategorizeRun(TARGETS, [
        ...CATEGORIES,
        { id: "cat_pagos", name: "Pagos EKU9003173C9" },
      ]);
      expect(run.sensitiveCategories).toEqual(["Pagos EKU9003173C9"]);
      const onConfirm = vi.fn<() => void>();
      render(<CategorizeSendDialog run={run} open onOpenChange={noop} onConfirm={onConfirm} />);
      const alert = within(dialog()).getByRole("alert");
      expect(alert).toHaveTextContent(BLOCKING);
      expect(alert).toHaveClass("text-destructive");
      const confirm = within(dialog()).getByRole("button", { name: "Enviar a DeepSeek" });
      expect(confirm).toBeDisabled();
      fireEvent.click(confirm);
      expect(onConfirm).not.toHaveBeenCalled();
      expect(within(dialog()).getByRole("button", { name: "No enviar" })).toBeEnabled();
    });

    it("shows no sentence and keeps the button enabled for a clean run", () => {
      const run = buildCategorizeRun(TARGETS, CATEGORIES);
      expect(run.sensitiveCategories).toEqual([]);
      const onConfirm = vi.fn<() => void>();
      render(<CategorizeSendDialog run={run} open onOpenChange={noop} onConfirm={onConfirm} />);
      expect(within(dialog()).queryByRole("alert")).toBeNull();
      expect(within(dialog()).queryByText(/No se puede enviar/)).toBeNull();
      const confirm = within(dialog()).getByRole("button", { name: "Enviar a DeepSeek" });
      expect(confirm).toBeEnabled();
      fireEvent.click(confirm);
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });
  });

  it("closing with «No enviar» calls onOpenChange and sends nothing", () => {
    const run = buildCategorizeRun(TARGETS, CATEGORIES);
    const onOpenChange = vi.fn<(open: boolean) => void>();
    const onConfirm = vi.fn<() => void>();
    render(
      <CategorizeSendDialog run={run} open onOpenChange={onOpenChange} onConfirm={onConfirm} />,
    );
    fireEvent.click(within(dialog()).getByRole("button", { name: "No enviar" }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onOpenChange.mock.calls[0]?.[0]).toBe(false);
  });
});
