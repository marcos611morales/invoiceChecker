// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { BACKUP_APP, buildBackupText, parseBackupText } from "@/domain/settings/backup";
import { SIN_CATEGORIA, type SettingsData } from "@/domain/settings/types";
import type { SheetModel, XCell } from "@/features/export/cellModel";
import { AppShell } from "@/features/shell/AppShell";
import { useSessionStore } from "@/stores/sessionStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { makeInvoice } from "../../../tests/support/ledgerFactory";
import "../../../tests/support/domPolyfills";
import { resetSettingsStore } from "../../../tests/support/settingsStorage";
import { BackupControls, BackupErrorAlert, type BackupError } from "./BackupControls";

const toastMock = vi.hoisted(() => vi.fn<(message: string) => void>());
vi.mock("sonner", () => ({ toast: toastMock }));

const downloadMock = vi.hoisted(() => vi.fn<(blob: Blob, fileName: string) => void>());
vi.mock("@/lib/client/download", () => ({ downloadBlob: downloadMock }));

const writeMock = vi.hoisted(() => vi.fn<(sheets: SheetModel[]) => Promise<Blob>>());
vi.mock("@/features/export/writeWorkbook", () => ({
  EXPORT_TIMEOUT_MS: 30000,
  writeWorkbook: writeMock,
}));

function Harness() {
  const [error, setError] = useState<BackupError | null>(null);
  return (
    <div>
      <BackupControls onError={setError} />
      <BackupErrorAlert
        error={error}
        onClose={() => {
          setError(null);
        }}
      />
    </div>
  );
}

function incoming(overrides: Partial<SettingsData> = {}): SettingsData {
  return {
    ivaMode: "sin",
    categories: [
      { id: "seed:otros", name: "Otros" },
      { id: "cat_a", name: "Eventos" },
      { id: "cat_b", name: "Mantenimiento" },
    ],
    supplierCategories: [
      { rfc: "EKU9003173C9", name: "Proveedor uno", categoryId: "cat_a" },
      { rfc: "XAXX010101000", name: "Público", categoryId: "cat_b" },
    ],
    conceptRules: [{ rfc: "EKU9003173C9", key: "renta", description: "Renta", categoryId: null }],
    products: [],
    ungroupedConcepts: [],
    ...overrides,
  };
}

function snapshot(): SettingsData {
  const { ivaMode, categories, supplierCategories, conceptRules, products, ungroupedConcepts } =
    useSettingsStore.getState();
  return { ivaMode, categories, supplierCategories, conceptRules, products, ungroupedConcepts };
}

function fileInput(): HTMLInputElement {
  // The app shell also has its own XML pickers; the settings one accepts JSON.
  const input = document.querySelector('input[type="file"][accept=".json,application/json"]');
  if (!(input instanceof HTMLInputElement)) throw new Error("no file input");
  return input;
}

/** Chooses a file the way the browser does and waits for the async read to settle. */
async function choose(file: File): Promise<void> {
  await act(async () => {
    fireEvent.change(fileInput(), { target: { files: [file] } });
    await Promise.resolve();
  });
}

function jsonFile(text: string, name = "ajustes.json"): File {
  return new File([text], name, { type: "application/json" });
}

beforeEach(() => {
  resetSettingsStore();
  toastMock.mockReset();
  downloadMock.mockReset();
  writeMock.mockReset();
  writeMock.mockResolvedValue(new Blob(["PK"]));
});

afterEach(() => {
  cleanup();
  resetSettingsStore();
  vi.restoreAllMocks();
});

describe("BackupControls: download (D-07)", () => {
  it("downloads a JSON Blob that parses back into the current settings and shows the toast", async () => {
    useSettingsStore.getState().replaceAll(incoming());
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Descargar ajustes" }));
    expect(downloadMock).toHaveBeenCalledTimes(1);
    const [blob, name] = downloadMock.mock.calls[0] ?? [];
    expect(blob).toBeInstanceOf(Blob);
    expect(name).toMatch(/^invoicechecker-ajustes-\d{4}-\d{2}-\d{2}\.json$/);
    if (!(blob instanceof Blob)) return;
    expect(blob.type).toBe("application/json");
    expect(await blob.text()).toBe(buildBackupText(incoming()));
    expect(toastMock).toHaveBeenCalledWith(`Ajustes descargados: ${String(name)}`);
  });

  it("writes file version 2 with the six fields, products and marks included, when the store holds products (D-13)", async () => {
    useSettingsStore.getState().replaceAll(
      incoming({
        categories: [{ id: "cat_a", name: "Eventos" }],
        supplierCategories: [],
        conceptRules: [],
        products: [
          {
            id: "prod_1",
            name: "Leche entera",
            categoryId: "cat_a",
            members: [{ rfc: "EKU9003173C9", key: "leche", description: "Leche", supplierName: "Uno" }],
          },
        ],
        ungroupedConcepts: [
          { rfc: "EKU9003173C9", key: "flete", description: "Flete", supplierName: "Uno" },
        ],
      }),
    );
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Descargar ajustes" }));
    const blob = downloadMock.mock.calls[0]?.[0];
    if (!(blob instanceof Blob)) throw new Error("the download must carry a Blob");
    const text = await blob.text();
    expect(text).toContain("prod_1");
    expect(text).toContain("flete");
    const parsed: unknown = JSON.parse(text);
    expect(parsed).toMatchObject({ app: BACKUP_APP, version: 2 });
    expect(Object.keys(typeof parsed === "object" && parsed !== null ? parsed : {}).sort()).toEqual([
      "app",
      "settings",
      "version",
    ]);
    const result = parseBackupText(text);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.settings).toEqual(snapshot());
  });

  it("uses the local date of today in the file name", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 6, 23, 30));
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Descargar ajustes" }));
    vi.useRealTimers();
    expect(downloadMock.mock.calls[0]?.[1]).toBe("invoicechecker-ajustes-2026-10-06.json");
  });

  it("makes no network request", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Descargar ajustes" }));
    vi.unstubAllGlobals();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("BackupControls: upload of a valid file (D-08)", () => {
  it("opens the replace dialog with the summary and focus on «Conservar los míos»", async () => {
    render(<Harness />);
    await choose(jsonFile(buildBackupText(incoming()), "x.json"));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("¿Reemplazar tus ajustes?")).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        /^El archivo «x\.json» contiene 3 categorías, 2 proveedores, 1 concepto ajustado, 0 productos \(0 descripciones\)\. Se reemplazarán tus categorías, las categorías de proveedores, los conceptos ajustados, los productos agrupados y el modo de IVA actuales\./,
      ),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(within(dialog).getByRole("button", { name: "Conservar los míos" })).toHaveFocus();
    });
    expect(within(dialog).getByRole("button", { name: "Reemplazar mis ajustes" })).toBeInTheDocument();
  });

  it("changes nothing until the user confirms", async () => {
    const before = snapshot();
    render(<Harness />);
    await choose(jsonFile(buildBackupText(incoming())));
    await screen.findByRole("alertdialog");
    expect(snapshot()).toEqual(before);
  });

  it("replaces everything in one write on «Reemplazar mis ajustes» and shows the toast", async () => {
    render(<Harness />);
    await choose(jsonFile(buildBackupText(incoming())));
    const dialog = await screen.findByRole("alertdialog");
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    fireEvent.click(within(dialog).getByRole("button", { name: "Reemplazar mis ajustes" }));
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(snapshot()).toEqual(incoming());
    expect(toastMock).toHaveBeenCalledWith("Ajustes reemplazados");
    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).toBeNull();
    });
  });

  it("loads a version-1 file with no products and no marks (D-13)", async () => {
    useSettingsStore.getState().replaceAll(
      incoming({
        products: [
          {
            id: "prod_1",
            name: "Leche entera",
            categoryId: "cat_a",
            members: [{ rfc: "EKU9003173C9", key: "leche", description: "Leche", supplierName: "Uno" }],
          },
        ],
        ungroupedConcepts: [
          { rfc: "EKU9003173C9", key: "flete", description: "Flete", supplierName: "Uno" },
        ],
      }),
    );
    render(<Harness />);
    const { ivaMode, categories, supplierCategories, conceptRules } = incoming();
    const versionOne = JSON.stringify({
      app: BACKUP_APP,
      version: 1,
      settings: { ivaMode, categories, supplierCategories, conceptRules },
    });
    await choose(jsonFile(versionOne, "viejo.json"));
    const dialog = await screen.findByRole("alertdialog");
    expect(
      within(dialog).getByText(/contiene 3 categorías, 2 proveedores, 1 concepto ajustado, 0 productos \(0 descripciones\)\./),
    ).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Reemplazar mis ajustes" }));
    expect(snapshot()).toEqual(incoming());
    expect(useSettingsStore.getState().products).toEqual([]);
    expect(useSettingsStore.getState().ungroupedConcepts).toEqual([]);
  });

  it("loads a version-2 file with its products and marks and counts them in the dialog (D-13)", async () => {
    const withProducts = incoming({
      products: [
        {
          id: "prod_1",
          name: "Leche entera",
          categoryId: "cat_a",
          members: [
            { rfc: "EKU9003173C9", key: "leche entera 1 l", description: "Leche entera 1 L", supplierName: "Proveedor uno" },
            { rfc: "XAXX010101000", key: "leche ent 12 pz", description: "Leche ENT 12 pz", supplierName: "Público" },
          ],
        },
        {
          id: "prod_2",
          name: "Vasos",
          categoryId: null,
          members: [
            { rfc: "EKU9003173C9", key: "vaso 12 oz", description: "Vaso 12 oz", supplierName: "Proveedor uno" },
          ],
        },
      ],
      ungroupedConcepts: [
        { rfc: "XAXX010101000", key: "renta de salon", description: "Renta de salón", supplierName: "Público" },
      ],
    });
    render(<Harness />);
    await choose(jsonFile(buildBackupText(withProducts), "nuevo.json"));
    const dialog = await screen.findByRole("alertdialog");
    expect(
      within(dialog).getByText(/contiene 3 categorías, 2 proveedores, 1 concepto ajustado, 2 productos \(3 descripciones\)\./),
    ).toBeInTheDocument();
    expect(snapshot().products).toEqual([]);
    fireEvent.click(within(dialog).getByRole("button", { name: "Reemplazar mis ajustes" }));
    expect(snapshot()).toEqual(withProducts);
    expect(useSettingsStore.getState().products).toHaveLength(2);
    expect(useSettingsStore.getState().ungroupedConcepts).toHaveLength(1);
  });

  it("changes nothing on «Conservar los míos» and Esc", async () => {
    const before = snapshot();
    render(<Harness />);
    await choose(jsonFile(buildBackupText(incoming())));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Conservar los míos" }));
    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).toBeNull();
    });
    expect(snapshot()).toEqual(before);

    await choose(jsonFile(buildBackupText(incoming())));
    const second = await screen.findByRole("alertdialog");
    fireEvent.keyDown(second, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).toBeNull();
    });
    expect(snapshot()).toEqual(before);
    expect(toastMock).not.toHaveBeenCalled();
  });

  it("returns focus to «Subir ajustes» after the dialog closes", async () => {
    render(<Harness />);
    await choose(jsonFile(buildBackupText(incoming())));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Conservar los míos" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Subir ajustes" })).toHaveFocus();
    });
  });

  it("handles the same file twice in a row because the input is reset", async () => {
    render(<Harness />);
    const file = jsonFile(buildBackupText(incoming()));
    await choose(file);
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Conservar los míos" }));
    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).toBeNull();
    });
    expect(fileInput().value).toBe("");
    await choose(file);
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
  });

  it("reads the summary in singular and with zero parts", async () => {
    render(<Harness />);
    const one = incoming({
      categories: [{ id: "cat_a", name: "Eventos" }],
      supplierCategories: [],
      conceptRules: [{ rfc: "EKU9003173C9", key: "renta", description: "Renta", categoryId: null }],
    });
    await choose(jsonFile(buildBackupText(one)));
    expect(
      await screen.findByText(
        /contiene 1 categoría, 0 proveedores, 1 concepto ajustado, 0 productos \(0 descripciones\)\./,
      ),
    ).toBeInTheDocument();
  });

  it("shows long file names in full and wraps them", async () => {
    render(<Harness />);
    const longName = `${"a".repeat(120)}.json`;
    await choose(jsonFile(buildBackupText(incoming()), longName));
    const body = await screen.findByText(new RegExp(`«${longName}»`));
    expect(body.textContent).toContain(longName);
    expect(body.className).toContain("break-words");
  });

  it("makes no network request", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    render(<Harness />);
    await choose(jsonFile(buildBackupText(incoming())));
    await screen.findByRole("alertdialog");
    vi.unstubAllGlobals();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("BackupControls: invalid files (D-08, D-30)", () => {
  async function expectRefused(file: File, reason: string): Promise<void> {
    const before = snapshot();
    render(<Harness />);
    await choose(file);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      `No se pudo usar el archivo «${file.name}»: ${reason}. Tus ajustes actuales no cambiaron.`,
    );
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(snapshot()).toEqual(before);
  }

  it("refuses plain text as not an InvoiceChecker file", async () => {
    await expectRefused(jsonFile("hola", "nota.json"), "no es un archivo de ajustes de InvoiceChecker");
  });

  it("refuses a version-3 file as coming from a newer app", async () => {
    await expectRefused(
      jsonFile(JSON.stringify({ app: BACKUP_APP, version: 3, settings: {} }), "futuro.json"),
      "es de una versión más nueva de la app",
    );
  });

  it("refuses a broken InvoiceChecker file as damaged", async () => {
    const text = buildBackupText(incoming());
    await expectRefused(jsonFile(text.slice(0, 60), "roto.json"), "está dañado o incompleto");
  });

  it("refuses a file above 4 MB (4,194,305 bytes) without reading it (D-31)", async () => {
    const file = jsonFile("{}", "grande.json");
    Object.defineProperty(file, "size", { value: 4194305 });
    const textSpy = vi.spyOn(file, "text");
    await expectRefused(file, "es demasiado grande (máx. 4 MB)");
    expect(textSpy).not.toHaveBeenCalled();
  });

  it("reads a file of exactly 4 MB and a file above 1 MB (D-31)", async () => {
    for (const size of [1048577, 4194304]) {
      const file = jsonFile(buildBackupText(incoming()), "limite.json");
      Object.defineProperty(file, "size", { value: size });
      const textSpy = vi.spyOn(file, "text");
      render(<Harness />);
      await choose(file);
      expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
      expect(textSpy).toHaveBeenCalledTimes(1);
      cleanup();
    }
  });

  it("closes the Alert with «Cerrar aviso» and clears it on a later valid upload", async () => {
    render(<Harness />);
    await choose(jsonFile("hola", "nota.json"));
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Cerrar aviso" }));
    expect(screen.queryByRole("alert")).toBeNull();

    await choose(jsonFile("hola", "nota.json"));
    await screen.findByRole("alert");
    await choose(jsonFile(buildBackupText(incoming())));
    await screen.findByRole("alertdialog");
    expect(screen.queryByText(/No se pudo usar el archivo/)).toBeNull();
  });

  it("shows a long file name in full, wrapping", async () => {
    render(<Harness />);
    const longName = `${"b".repeat(150)}.json`;
    await choose(jsonFile("hola", longName));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(`«${longName}»`);
    expect(within(alert).getByText(new RegExp(longName)).className).toContain("break-words");
  });

  it("handles the same refused file twice", async () => {
    render(<Harness />);
    const file = jsonFile("hola", "nota.json");
    await choose(file);
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Cerrar aviso" }));
    await choose(file);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  it("makes no network request", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    render(<Harness />);
    await choose(jsonFile("hola"));
    await screen.findByRole("alert");
    vi.unstubAllGlobals();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("Categorías tab with the backup controls (AJUS-02)", () => {
  async function renderShellOnCategories(): Promise<void> {
    act(() => {
      const store = useSessionStore.getState();
      store.applyBatch(
        [
          {
            kind: "parsed" as const,
            file: { name: "f0.xml", path: "f0.xml" },
            result: { ok: true as const, invoice: makeInvoice({}) },
          },
        ],
        store.generation,
      );
    });
    await act(async () => {
      render(<AppShell />);
      await useSettingsStore.persist.rehydrate();
    });
    fireEvent.click(screen.getByRole("tab", { name: "Categorías" }));
  }

  afterEach(() => {
    act(() => {
      useSessionStore.getState().clearAll();
    });
  });

  it("has both buttons in the title row and the Alert right below it", async () => {
    await renderShellOnCategories();
    expect(screen.getByRole("button", { name: "Descargar ajustes" })).toBeInTheDocument();
    await choose(jsonFile("hola", "nota.json"));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("no es un archivo de ajustes de InvoiceChecker");
  });

  it("applies a confirmed file: categories, IVA mode and the Dashboard classification", async () => {
    await renderShellOnCategories();
    expect(
      within(screen.getByTestId("iva-toggle-bar")).getByRole("button", { name: "Con IVA" }),
    ).toHaveAttribute("aria-pressed", "true");
    await choose(jsonFile(buildBackupText(incoming()), "otro-navegador.json"));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Reemplazar mis ajustes" }));
    await waitFor(() => {
      expect(snapshot()).toEqual(incoming());
    });
    expect(
      within(screen.getByTestId("iva-toggle-bar")).getByRole("button", { name: "Sin IVA" }),
    ).toHaveAttribute("aria-pressed", "true");
    // The category list now shows the file's categories (and the nine suggestions are gone).
    expect(screen.getAllByText("Eventos").length).toBeGreaterThan(0);
    expect(screen.queryByText("Limpieza e higiene")).toBeNull();
  });

  /** The Valor cell of the Parámetros row named `label` in the first workbook handed to the writer. */
  function parameter(label: string): XCell | undefined {
    const sheets = writeMock.mock.calls[0]?.[0];
    const sheet = sheets?.find((candidate) => candidate.name === "Parámetros");
    return sheet?.rows.find((row) => {
      const first = row[0];
      return first !== undefined && first.kind === "text" && first.value === label;
    })?.[1];
  }

  function selectCategories(...ids: string[]): void {
    act(() => {
      useSessionStore.getState().setCategories(new Set(ids));
    });
  }

  async function uploadAndConfirm(): Promise<void> {
    await choose(jsonFile(buildBackupText(incoming()), "otro-navegador.json"));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Reemplazar mis ajustes" }));
    await waitFor(() => {
      expect(snapshot()).toEqual(incoming());
    });
  }

  async function exportFromTopBar(): Promise<void> {
    fireEvent.click(screen.getByRole("button", { name: "Exportar a Excel" }));
    await waitFor(() => {
      expect(writeMock).toHaveBeenCalledTimes(1);
    });
  }

  it("WR-01: confirming the replace keeps only existing categories in the chip and in Parámetros", async () => {
    await renderShellOnCategories();
    selectCategories("seed:limpieza-higiene", "seed:otros", SIN_CATEGORIA);
    await uploadAndConfirm();
    expect([...useSessionStore.getState().filters.categories].sort()).toEqual([
      "seed:otros",
      "sin-categoria",
    ]);
    fireEvent.click(screen.getByRole("tab", { name: "Dashboard" }));
    expect(within(screen.getByTestId("filter-chips")).getByText("Categoría: Sin categoría, Otros")).toBeInTheDocument();
    expect(screen.queryByText(/seed:limpieza-higiene/)).toBeNull();
    await exportFromTopBar();
    expect(parameter("Categorías")).toEqual({ kind: "text", value: "Sin categoría, Otros" });
  });

  it("WR-01: when only dropped ids were selected there is no Categoría chip and the file says Todas", async () => {
    await renderShellOnCategories();
    selectCategories("seed:limpieza-higiene");
    await uploadAndConfirm();
    expect(useSessionStore.getState().filters.categories.size).toBe(0);
    fireEvent.click(screen.getByRole("tab", { name: "Dashboard" }));
    expect(within(screen.getByTestId("filter-chips")).queryByText(/^Categoría/)).toBeNull();
    await exportFromTopBar();
    expect(parameter("Categorías")).toEqual({ kind: "text", value: "Todas" });
  });

  it("WR-01: «Conservar los míos» leaves the category filter untouched (D-08)", async () => {
    await renderShellOnCategories();
    selectCategories("seed:limpieza-higiene");
    await choose(jsonFile(buildBackupText(incoming()), "otro-navegador.json"));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Conservar los míos" }));
    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).toBeNull();
    });
    expect([...useSessionStore.getState().filters.categories]).toEqual(["seed:limpieza-higiene"]);
  });
});
