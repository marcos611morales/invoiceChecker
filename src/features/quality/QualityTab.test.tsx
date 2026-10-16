// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { INCIDENT_ORDER, type IncidentType } from "@/domain/accounting/quality";
import type { ParsedInvoice } from "@/domain/cfdi/types";
import type { BatchEntry } from "@/domain/import/types";
import { es } from "@/lib/copy/es";
import { useSessionStore } from "@/stores/sessionStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { makeInvoice } from "../../../tests/support/ledgerFactory";
import "../../../tests/support/domPolyfills";
import { QualityTab } from "./QualityTab";

/** An Ingreso whose folio is its uuid, so every reference in the UI is easy to find. */
function inv(uuid: string, overrides: Partial<ParsedInvoice> = {}): ParsedInvoice {
  return makeInvoice({ uuid, folio: uuid, ...overrides });
}

function parsedEntry(invoice: ParsedInvoice, name = `${invoice.uuid}.xml`): BatchEntry {
  return {
    kind: "parsed",
    file: { name, path: name },
    result: { ok: true, invoice },
  };
}

function seed(invoices: readonly ParsedInvoice[]): void {
  act(() => {
    const store = useSessionStore.getState();
    store.applyBatch(invoices.map((invoice) => parsedEntry(invoice)), store.generation);
  });
}

function seedEntries(entries: readonly BatchEntry[]): void {
  act(() => {
    const store = useSessionStore.getState();
    store.applyBatch(entries, store.generation);
  });
}

/** Every situation of the panel once; see `COUNTS` for what each yields. */
function richScenario(): ParsedInvoice[] {
  return [
    inv("OK-1"),
    inv("CERO-1", { total: "0.00", subTotal: "0.00", totalImpuestosTrasladados: null }),
    inv("USD-1", { moneda: "USD", tipoCambio: null }),
    inv("BAD-T", { total: "abc" }),
    inv("BAD-F", { fecha: "2025-13-45T00:00:00" }),
    inv("PPD-1", { metodoPago: "PPD", formaPago: "99" }),
    inv("RED-1", { total: "116.50" }),
    inv("NC-1", { tipo: "E" }),
    inv("REL-MAY", { fecha: "2025-05-20T10:00:00" }),
    inv("REL-JUL", { fecha: "2025-07-10T10:00:00" }),
    inv("NC-2", {
      tipo: "E",
      fecha: "2025-08-02T10:00:00",
      relacionados: [{ tipoRelacion: "01", uuids: ["REL-MAY", "REL-JUL"] }],
    }),
    inv("ORIG-1"),
    inv("NEW-1", { relacionados: [{ tipoRelacion: "04", uuids: ["ORIG-1"] }] }),
    inv("EXC-1"),
  ];
}

const COUNTS: ReadonlyMap<IncidentType, number> = new Map<IncidentType, number>([
  ["nc-sin-relacionada", 1],
  ["nc-varias-relacionadas", 1],
  ["sustituciones", 1],
  ["moneda-sin-tc", 1],
  ["datos-invalidos", 2],
  ["cero", 1],
  ["redondeo", 1],
  ["ppd-sin-complemento", 1],
  ["excluidas", 1],
  ["sustituidas", 1],
]);

function loadRich(): void {
  seed(richScenario());
  act(() => {
    useSessionStore.getState().excludeInvoice("EXC-1");
  });
}

function triggerOf(type: IncidentType): HTMLElement {
  return screen.getByTestId(`quality-trigger-${type}`);
}

function openTypes(): IncidentType[] {
  return INCIDENT_ORDER.filter(
    (type) => screen.queryByTestId(`quality-trigger-${type}`)?.getAttribute("aria-expanded") === "true",
  );
}

function ensureOpen(type: IncidentType): void {
  const trigger = triggerOf(type);
  if (trigger.getAttribute("aria-expanded") !== "true") fireEvent.click(trigger);
}

function rowOf(type: IncidentType, uuid: string, suffix = ""): HTMLElement {
  return screen.getByTestId(`quality-row-${type}:${uuid}${suffix}`);
}

afterEach(() => {
  cleanup();
  act(() => {
    useSessionStore.getState().clearAll();
    useSettingsStore.setState({ ivaMode: "con" });
  });
});

describe("QualityTab header and empty state", () => {
  it("shows the heading, the intro, the mode caption and the empty state with no incident", () => {
    seed([inv("OK-1"), inv("OK-2")]);
    render(<QualityTab />);
    expect(screen.getByRole("heading", { name: "Calidad de datos" })).toBeInTheDocument();
    expect(
      screen.getByText("Revisa las facturas que pueden cambiar o limitar el análisis."),
    ).toBeInTheDocument();
    expect(screen.getByTestId("mode-caption")).toHaveTextContent(es.iva.captionCon);
    expect(screen.getByText("Sin incidencias")).toBeInTheDocument();
    expect(
      screen.getByText("No encontramos nada que revisar en las facturas cargadas."),
    ).toBeInTheDocument();
    expect(document.querySelector("[data-slot=accordion]")).toBeNull();
  });

  it("keeps all twelve cards with a muted 0 when there is nothing to review", () => {
    seed([inv("OK-1")]);
    render(<QualityTab />);
    for (const type of INCIDENT_ORDER) {
      const value = screen.getByTestId(`quality-${type}`);
      expect(value).toHaveTextContent("0");
      expect(value).toHaveClass("text-muted-foreground");
    }
    for (const id of ["quality-duplicados", "quality-rechazados"]) {
      expect(screen.getByTestId(id)).toHaveTextContent("0");
      expect(screen.getByTestId(id)).toHaveClass("text-muted-foreground");
    }
  });

  it("follows the Sin IVA caption of the settings", () => {
    seed([inv("OK-1")]);
    act(() => {
      useSettingsStore.setState({ ivaMode: "sin" });
    });
    render(<QualityTab />);
    expect(screen.getByTestId("mode-caption")).toHaveTextContent(es.iva.captionSin);
  });
});

describe("QualityTab cards", () => {
  it("shows a card per type with its count, and the grid breakpoints of Phase 1", () => {
    loadRich();
    render(<QualityTab />);
    for (const type of INCIDENT_ORDER) {
      const expected = COUNTS.get(type) ?? 0;
      expect(screen.getByTestId(`quality-${type}`)).toHaveTextContent(String(expected));
    }
    expect(screen.getByTestId("quality-cards")).toHaveClass(
      "grid-cols-2",
      "sm:grid-cols-3",
      "lg:grid-cols-4",
    );
    expect(screen.getByTestId("quality-cards").children).toHaveLength(12);
  });

  it("titles the cards in the fixed order, the link-only cards last", () => {
    loadRich();
    render(<QualityTab />);
    const labels = within(screen.getByTestId("quality-cards"))
      .getAllByTestId("quality-card-label")
      .map((node) => node.textContent);
    expect(labels).toEqual([
      "Notas de crédito sin factura relacionada",
      "Notas de crédito con varias relacionadas",
      "Sustituciones",
      "Moneda sin tipo de cambio",
      "Datos inválidos",
      "Facturas en $0",
      "Diferencias de redondeo",
      "PPD sin complemento de pago",
      "Excluidas",
      "Sustituidas",
      "Duplicados",
      "Archivos con error",
    ]);
  });

  it("does not use the destructive color anywhere in the tab", () => {
    loadRich();
    const { container } = render(<QualityTab />);
    for (const type of INCIDENT_ORDER) ensureOpen(type);
    // Only unprefixed color classes count: the Button base class carries aria-invalid: variants.
    expect(container.innerHTML).not.toMatch(/(?:^|[\s"])(?:text|bg|border)-destructive/);
  });

  it("shows the import-report counts on the link-only cards", () => {
    seedEntries([
      parsedEntry(inv("DUP-1"), "a.xml"),
      parsedEntry(inv("DUP-1"), "b.xml"),
      { kind: "parsed", file: { name: "mala.xml", path: "mala.xml" }, result: { ok: false, reason: "malformed" } },
      { kind: "parsed", file: { name: "otra.xml", path: "otra.xml" }, result: { ok: false, reason: "not-cfdi" } },
    ]);
    render(<QualityTab />);
    expect(screen.getByTestId("quality-duplicados")).toHaveTextContent("1");
    expect(screen.getByTestId("quality-rechazados")).toHaveTextContent("2");
    expect(screen.getByTestId("quality-duplicados")).not.toHaveClass("text-muted-foreground");
  });

  it("opens Importación at the matching section from the link-only cards", () => {
    seedEntries([
      parsedEntry(inv("DUP-1"), "a.xml"),
      parsedEntry(inv("DUP-1"), "b.xml"),
      { kind: "parsed", file: { name: "mala.xml", path: "mala.xml" }, result: { ok: false, reason: "malformed" } },
    ]);
    render(<QualityTab />);
    fireEvent.click(screen.getByTestId("quality-link-duplicados"));
    expect(useSessionStore.getState().importFocus).toBe("duplicados");
    expect(useSessionStore.getState().activeTab).toBe("importacion");
    act(() => {
      useSessionStore.getState().setActiveTab("calidad");
    });
    fireEvent.click(screen.getByTestId("quality-link-rechazados"));
    expect(useSessionStore.getState().importFocus).toBe("rechazados");
    expect(screen.getByTestId("quality-link-rechazados")).toHaveTextContent("Ver en Importación");
  });
});

describe("QualityTab accordions", () => {
  it("renders only the types with rows, in the fixed order, with their count", () => {
    loadRich();
    render(<QualityTab />);
    const triggers = INCIDENT_ORDER.map((type) => screen.getByTestId(`quality-trigger-${type}`));
    expect(triggers.map((node) => node.textContent)).toEqual([
      "Notas de crédito sin factura relacionada (1)",
      "Notas de crédito con varias relacionadas (1)",
      "Sustituciones (1)",
      "Moneda sin tipo de cambio (1)",
      "Datos inválidos (2)",
      "Facturas en $0 (1)",
      "Diferencias de redondeo (1)",
      "PPD sin complemento de pago (1)",
      "Excluidas (1)",
      "Sustituidas (1)",
    ]);
    expect(document.querySelectorAll("[data-slot=accordion-trigger]")).toHaveLength(10);
  });

  it("opens only the four amount-changing types by themselves", () => {
    loadRich();
    render(<QualityTab />);
    expect(openTypes()).toEqual([
      "nc-sin-relacionada",
      "sustituciones",
      "moneda-sin-tc",
      "datos-invalidos",
    ]);
    expect(triggerOf("nc-varias-relacionadas")).toHaveAttribute("aria-expanded", "false");
  });

  it("renders no accordion for a type with 0 rows", () => {
    seed([inv("CERO-1", { total: "0.00", subTotal: "0.00", totalImpuestosTrasladados: null })]);
    render(<QualityTab />);
    expect(screen.queryByTestId("quality-trigger-nc-sin-relacionada")).toBeNull();
    expect(screen.getByTestId("quality-trigger-cero")).toBeInTheDocument();
    expect(screen.getByTestId("quality-nc-sin-relacionada")).toHaveTextContent("0");
    expect(screen.queryByText("Sin incidencias")).toBeNull();
  });

  it("re-opens an amount-changing type that gains rows after the user closed it", () => {
    seed([inv("NC-1", { tipo: "E" })]);
    render(<QualityTab />);
    expect(triggerOf("nc-sin-relacionada")).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(triggerOf("nc-sin-relacionada"));
    expect(triggerOf("nc-sin-relacionada")).toHaveAttribute("aria-expanded", "false");
    // A re-render with the same rows keeps it closed.
    act(() => {
      useSessionStore.getState().setActiveTab("calidad");
    });
    expect(triggerOf("nc-sin-relacionada")).toHaveAttribute("aria-expanded", "false");
    seed([inv("NC-2", { tipo: "E" })]);
    expect(triggerOf("nc-sin-relacionada")).toHaveTextContent("(2)");
    expect(triggerOf("nc-sin-relacionada")).toHaveAttribute("aria-expanded", "true");
  });

  it("opens a closed type when it gains rows, and not before", () => {
    seed([inv("EXC-1"), inv("EXC-2")]);
    act(() => {
      useSessionStore.getState().excludeInvoice("EXC-1");
    });
    render(<QualityTab />);
    expect(triggerOf("excluidas")).toHaveTextContent("(1)");
    expect(triggerOf("excluidas")).toHaveAttribute("aria-expanded", "false");
    act(() => {
      useSessionStore.getState().excludeInvoice("EXC-2");
    });
    expect(triggerOf("excluidas")).toHaveTextContent("(2)");
    expect(triggerOf("excluidas")).toHaveAttribute("aria-expanded", "true");
  });

  it("keeps a type that the user opened by hand open", () => {
    loadRich();
    render(<QualityTab />);
    fireEvent.click(triggerOf("cero"));
    expect(triggerOf("cero")).toHaveAttribute("aria-expanded", "true");
    expect(rowOf("cero", "CERO-1")).toBeInTheDocument();
  });

  it("caps every panel at 320 px inside a scroll area", () => {
    loadRich();
    render(<QualityTab />);
    const panel = rowOf("nc-sin-relacionada", "NC-1").closest("[data-slot=scroll-area]");
    expect(panel).not.toBeNull();
    expect(panel?.className).toContain("max-h-80");
  });
});

describe("QualityTab rows", () => {
  it("shows the identity line and the sentence of a credit note without related invoice", () => {
    loadRich();
    render(<QualityTab />);
    const row = rowOf("nc-sin-relacionada", "NC-1");
    expect(within(row).getByText("15/01/2025")).toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "Proveedor de prueba" })).toBeInTheDocument();
    expect(within(row).getByText("NC-1")).toBeInTheDocument();
    expect(within(row).getByText("−$116.00")).toBeInTheDocument();
    expect(
      within(row).getByText(
        "Se resta en su propia fecha (ene 2025) porque la factura relacionada no está cargada.",
      ),
    ).toBeInTheDocument();
  });

  it("uses the amount of the active IVA mode", () => {
    seed([inv("OK-1", { total: "120.00" }), inv("RED-9", { total: "120.00" })]);
    act(() => {
      useSettingsStore.setState({ ivaMode: "sin" });
    });
    render(<QualityTab />);
    ensureOpen("redondeo");
    const row = rowOf("redondeo", "RED-9");
    expect(within(row).getByText("$100.00")).toBeInTheDocument();
  });

  it("writes the D-46 sentence for a credit note with several related invoices", () => {
    loadRich();
    render(<QualityTab />);
    ensureOpen("nc-varias-relacionadas");
    const row = rowOf("nc-varias-relacionadas", "NC-2");
    expect(
      within(row).getByText("Aplica a may 2025: la relacionada más antigua de 2"),
    ).toBeInTheDocument();
  });

  it("shows the substitution sentence for each state of the original", () => {
    loadRich();
    render(<QualityTab />);
    const row = rowOf("sustituciones", "NEW-1", ":ORIG-1");
    expect(
      within(row).getByText("Sustituye a la factura ORIG-1…. La original quedó excluida."),
    ).toBeInTheDocument();
    cleanup();
    act(() => {
      useSessionStore.getState().clearAll();
    });
    seed([inv("NEW-2", { relacionados: [{ tipoRelacion: "04", uuids: ["MISSING-ORIGINAL"] }] })]);
    render(<QualityTab />);
    expect(
      within(rowOf("sustituciones", "NEW-2", ":MISSING-ORIGINAL")).getByText(
        "Sustituye a la factura MISSING-…. La original no está cargada.",
      ),
    ).toBeInTheDocument();
  });

  it("shows the re-included wording once the original is back", () => {
    seed([inv("ORIG-1"), inv("NEW-1", { relacionados: [{ tipoRelacion: "04", uuids: ["ORIG-1"] }] })]);
    act(() => {
      useSessionStore.getState().reincludeInvoice("ORIG-1", { overrideSubstitution: true });
    });
    render(<QualityTab />);
    ensureOpen("sustituciones");
    expect(
      within(rowOf("sustituciones", "NEW-1", ":ORIG-1")).getByText(
        "Sustituye a la factura ORIG-1…. La original se volvió a incluir.",
      ),
    ).toBeInTheDocument();
  });

  it("writes the sentence of every other type", () => {
    loadRich();
    render(<QualityTab />);
    for (const type of INCIDENT_ORDER) ensureOpen(type);
    expect(
      within(rowOf("moneda-sin-tc", "USD-1")).getByText("USD sin tipo de cambio: no se suma"),
    ).toBeInTheDocument();
    expect(within(rowOf("moneda-sin-tc", "USD-1")).getByText("—", { selector: "span" })).toBeInTheDocument();
    expect(
      within(rowOf("cero", "CERO-1")).getByText(
        "Total en $0: no cuenta en el número de facturas ni en los promedios.",
      ),
    ).toBeInTheDocument();
    expect(
      within(rowOf("redondeo", "RED-1")).getByText(
        "El Total del XML difiere en $0.50 de Subtotal − Descuento + traslados − retenciones.",
      ),
    ).toBeInTheDocument();
    expect(
      within(rowOf("ppd-sin-complemento", "PPD-1")).getByText(
        'Pago en parcialidades o diferido sin complemento de pago cargado; en filtros aparece como "Por definir (sin complemento de pago)".',
      ),
    ).toBeInTheDocument();
    expect(
      within(rowOf("excluidas", "EXC-1")).getByText("Excluida por ti en esta sesión."),
    ).toBeInTheDocument();
    expect(
      within(rowOf("sustituidas", "ORIG-1")).getByText(
        "Sustituida por la factura NEW-1. No se suma.",
      ),
    ).toBeInTheDocument();
  });

  it("writes the concept-sum sentence when the concepts differ from the SubTotal", () => {
    seed([
      inv("CON-1", {
        conceptos: [
          {
            claveProdServ: "01010101",
            noIdentificacion: null,
            cantidad: "1",
            claveUnidad: "H87",
            unidad: null,
            descripcion: "Algo",
            valorUnitario: "99.00",
            importe: "99.00",
            descuento: null,
            objetoImp: null,
            traslados: [],
            retenciones: [],
          },
        ],
      }),
    ]);
    render(<QualityTab />);
    ensureOpen("redondeo");
    const row = rowOf("redondeo", "CON-1");
    expect(within(row).getByText("La suma de los conceptos difiere en $1.00 del Subtotal.")).toBeInTheDocument();
    expect(within(row).queryByText(/El Total del XML difiere/)).toBeNull();
  });

  it("agrees in gender with the damaged field (D-47)", () => {
    loadRich();
    render(<QualityTab />);
    expect(within(rowOf("datos-invalidos", "BAD-T")).getByText("Total inválido: no se suma")).toBeInTheDocument();
    expect(within(rowOf("datos-invalidos", "BAD-F")).getByText("Fecha inválida: no se suma")).toBeInTheDocument();
  });

  it("lists a damaged-data invoice instead of hiding it, with a dash for the amount", () => {
    loadRich();
    render(<QualityTab />);
    const row = rowOf("datos-invalidos", "BAD-T");
    expect(within(row).getByText("—", { selector: "span" })).toBeInTheDocument();
  });
});

describe("QualityTab row actions", () => {
  it("offers Ver factura on every row and Volver a incluir only in Excluidas and Sustituidas", () => {
    loadRich();
    render(<QualityTab />);
    for (const type of INCIDENT_ORDER) ensureOpen(type);
    const rows = document.querySelectorAll<HTMLElement>("[data-testid^='quality-row-']");
    expect(rows).toHaveLength(11);
    for (const node of rows) {
      const row = within(node);
      expect(row.getAllByRole("button", { name: "Ver factura" })).toHaveLength(1);
      const reinclude = row.queryAllByRole("button", { name: "Volver a incluir" });
      const testId = node.getAttribute("data-testid") ?? "";
      const isReincludable =
        testId.startsWith("quality-row-excluidas:") || testId.startsWith("quality-row-sustituidas:");
      expect(reinclude).toHaveLength(isReincludable ? 1 : 0);
    }
  });

  it("Ver factura asks the Dashboard to focus that invoice", () => {
    loadRich();
    act(() => {
      useSessionStore.getState().setActiveTab("calidad");
    });
    render(<QualityTab />);
    fireEvent.click(within(rowOf("moneda-sin-tc", "USD-1")).getByRole("button", { name: "Ver factura" }));
    const state = useSessionStore.getState();
    expect(state.focusRequest?.uuid).toBe("USD-1");
    expect(state.activeTab).toBe("dashboard");
  });

  it("Volver a incluir on Excluidas brings the invoice back and removes the row", () => {
    loadRich();
    render(<QualityTab />);
    ensureOpen("excluidas");
    fireEvent.click(within(rowOf("excluidas", "EXC-1")).getByRole("button", { name: "Volver a incluir" }));
    expect(useSessionStore.getState().excluded.has("EXC-1")).toBe(false);
    expect(useSessionStore.getState().restored.has("EXC-1")).toBe(false);
    expect(screen.queryByTestId("quality-trigger-excluidas")).toBeNull();
    expect(screen.getByTestId("quality-excluidas")).toHaveTextContent("0");
  });

  it("Volver a incluir on Sustituidas removes the row and updates the substitution", () => {
    loadRich();
    render(<QualityTab />);
    ensureOpen("sustituidas");
    fireEvent.click(within(rowOf("sustituidas", "ORIG-1")).getByRole("button", { name: "Volver a incluir" }));
    expect(screen.queryByTestId("quality-trigger-sustituidas")).toBeNull();
    expect(useSessionStore.getState().restored.has("ORIG-1")).toBe(true);
    expect(
      within(rowOf("sustituciones", "NEW-1", ":ORIG-1")).getByText(
        "Sustituye a la factura ORIG-1…. La original se volvió a incluir.",
      ),
    ).toBeInTheDocument();
  });

  it("WR-01: a plain Volver a incluir on Excluidas does not shield a substitute loaded later", () => {
    seed([inv("EXC-9")]);
    act(() => {
      useSessionStore.getState().excludeInvoice("EXC-9");
    });
    render(<QualityTab />);
    ensureOpen("excluidas");
    fireEvent.click(within(rowOf("excluidas", "EXC-9")).getByRole("button", { name: "Volver a incluir" }));
    expect(useSessionStore.getState().restored.has("EXC-9")).toBe(false);
    seed([inv("NEW-9", { relacionados: [{ tipoRelacion: "04", uuids: ["EXC-9"] }] })]);
    expect(screen.getByTestId("quality-sustituidas")).toHaveTextContent("1");
    ensureOpen("sustituidas");
    expect(rowOf("sustituidas", "EXC-9")).toBeInTheDocument();
    ensureOpen("sustituciones");
    expect(
      within(rowOf("sustituciones", "NEW-9", ":EXC-9")).getByText(
        "Sustituye a la factura EXC-9…. La original quedó excluida.",
      ),
    ).toBeInTheDocument();
  });

  it("WR-01: Volver a incluir on an Excluidas row that is also substituted overrides the substitution too (user decision)", () => {
    seed([inv("EXC-9")]);
    act(() => {
      useSessionStore.getState().excludeInvoice("EXC-9");
    });
    seed([inv("NEW-9", { relacionados: [{ tipoRelacion: "04", uuids: ["EXC-9"] }] })]);
    render(<QualityTab />);
    ensureOpen("excluidas");
    expect(rowOf("excluidas", "EXC-9")).toBeInTheDocument();
    expect(screen.queryByTestId("quality-trigger-sustituidas")).toBeNull();
    fireEvent.click(within(rowOf("excluidas", "EXC-9")).getByRole("button", { name: "Volver a incluir" }));
    expect(useSessionStore.getState().restored.has("EXC-9")).toBe(true);
    expect(screen.getByTestId("quality-excluidas")).toHaveTextContent("0");
    ensureOpen("sustituciones");
    expect(
      within(rowOf("sustituciones", "NEW-9", ":EXC-9")).getByText(
        "Sustituye a la factura EXC-9…. La original se volvió a incluir.",
      ),
    ).toBeInTheDocument();
  });

  it("goes to the empty state once the last incident is resolved", () => {
    seed([inv("EXC-1")]);
    act(() => {
      useSessionStore.getState().excludeInvoice("EXC-1");
    });
    render(<QualityTab />);
    ensureOpen("excluidas");
    fireEvent.click(within(rowOf("excluidas", "EXC-1")).getByRole("button", { name: "Volver a incluir" }));
    expect(screen.getByText("Sin incidencias")).toBeInTheDocument();
  });
});

describe("QualityTab long and hostile text", () => {
  const longName = "Abarrotes".repeat(10);

  it("truncates a 90-character supplier and lets the sentence wrap", () => {
    expect(longName).toHaveLength(90);
    seed([inv("NC-9", { tipo: "E", emisor: { rfc: "LAR010101AAA", nombre: longName } })]);
    render(<QualityTab />);
    const row = rowOf("nc-sin-relacionada", "NC-9");
    const supplier = within(row).getByRole("button", { name: longName });
    expect(supplier).toHaveClass("truncate");
    const sentence = within(row).getByText(/^Se resta en su propia fecha/);
    expect(sentence).not.toHaveClass("truncate");
    expect(sentence.className).toContain("[overflow-wrap:anywhere]");
  });

  it("renders markup in a supplier name as plain text", () => {
    const hostile = "<img src=x onerror=alert(1)>";
    seed([inv("NC-8", { tipo: "E", emisor: { rfc: "HOS010101AAA", nombre: hostile } })]);
    const { container } = render(<QualityTab />);
    expect(container.querySelector("img")).toBeNull();
    expect(within(rowOf("nc-sin-relacionada", "NC-8")).getByRole("button", { name: hostile })).toBeInTheDocument();
  });
});

describe("QualityTab: Fecha year window (WR-03, D-48)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("WR-03: lists Fecha years outside 2000..current year + 1 under Datos inválidos, and only those", () => {
    // Mid-June 2026 local time: the window is 2000..2027 and the year is read at mount.
    vi.setSystemTime(new Date(2026, 5, 15, 12, 0, 0));
    seed([
      inv("OK-1", { fecha: "2025-01-15T10:00:00" }),
      inv("OLD-1", { fecha: "0001-03-01T10:00:00" }),
      inv("LOW-1", { fecha: "1999-12-31T23:59:59" }),
      inv("FAR-1", { fecha: "2205-01-01T10:00:00" }),
      inv("EDGE-1", { fecha: "2027-12-31T23:59:59" }),
      inv("PAGO-FAR", { tipo: "P", fecha: "2205-01-01T10:00:00" }),
    ]);
    render(<QualityTab />);
    expect(screen.getByTestId("quality-datos-invalidos").textContent.replace(/\D/g, "")).toBe("3");
    ensureOpen("datos-invalidos");
    for (const uuid of ["OLD-1", "LOW-1", "FAR-1"]) {
      expect(within(rowOf("datos-invalidos", uuid)).getByText("Fecha inválida: no se suma")).toBeInTheDocument();
    }
    expect(screen.queryByTestId("quality-row-datos-invalidos:EDGE-1")).toBeNull();
    expect(screen.queryByTestId("quality-row-datos-invalidos:PAGO-FAR")).toBeNull();
  });
});
