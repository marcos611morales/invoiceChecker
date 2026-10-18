// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { BACKUP_APP, buildBackupText } from "@/domain/settings/backup";
import type { SettingsData } from "@/domain/settings/types";
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
    ...overrides,
  };
}

function snapshot(): SettingsData {
  const { ivaMode, categories, supplierCategories, conceptRules } = useSettingsStore.getState();
  return { ivaMode, categories, supplierCategories, conceptRules };
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
      within(dialog).getByText(/^El archivo «x\.json» contiene 3 categorías, 2 proveedores, 1 concepto ajustado\. /),
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
      await screen.findByText(/contiene 1 categoría, 0 proveedores, 1 concepto ajustado\./),
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

  it("refuses a version-2 file as coming from a newer app", async () => {
    await expectRefused(
      jsonFile(JSON.stringify({ app: BACKUP_APP, version: 2, settings: {} }), "futuro.json"),
      "es de una versión más nueva de la app",
    );
  });

  it("refuses a broken InvoiceChecker file as damaged", async () => {
    const text = buildBackupText(incoming());
    await expectRefused(jsonFile(text.slice(0, 60), "roto.json"), "está dañado o incompleto");
  });

  it("refuses a file above 1 MB without reading it", async () => {
    const file = jsonFile("{}", "grande.json");
    Object.defineProperty(file, "size", { value: 1048577 });
    const textSpy = vi.spyOn(file, "text");
    await expectRefused(file, "es demasiado grande (máx. 1 MB)");
    expect(textSpy).not.toHaveBeenCalled();
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
});
