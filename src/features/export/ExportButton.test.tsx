// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ParsedInvoice } from "@/domain/cfdi/types";
import { useSessionStore } from "@/stores/sessionStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { makeInvoice } from "../../../tests/support/ledgerFactory";
import "../../../tests/support/domPolyfills";
import { resetSettingsStore } from "../../../tests/support/settingsStorage";
import type { SheetModel } from "./cellModel";
import { ExportButton } from "./ExportButton";

const toastMock = vi.hoisted(() => vi.fn<(message: string) => void>());
vi.mock("sonner", () => ({ toast: toastMock }));

const writeMock = vi.hoisted(() => vi.fn<(sheets: SheetModel[]) => Promise<Blob>>());
vi.mock("./writeWorkbook", () => ({
  EXPORT_TIMEOUT_MS: 30000,
  writeWorkbook: writeMock,
}));

const downloadMock = vi.hoisted(() => vi.fn<(blob: Blob, fileName: string) => void>());
vi.mock("@/lib/client/download", () => ({ downloadBlob: downloadMock }));

const FILE_CON = "gastos-2025-01_2025-01-con-iva.xlsx";
const FILE_SIN = "gastos-2025-01_2025-01-sin-iva.xlsx";
const BLOB = new Blob(["PK"]);

function seed(invoices: readonly ParsedInvoice[]): void {
  act(() => {
    const store = useSessionStore.getState();
    store.applyBatch(
      invoices.map((invoice) => ({
        kind: "parsed" as const,
        file: { name: `${invoice.uuid}.xml`, path: `${invoice.uuid}.xml` },
        result: { ok: true as const, invoice },
      })),
      store.generation,
    );
  });
}

function exportButton(): HTMLElement {
  return screen.getByRole("button", { name: "Exportar a Excel" });
}

/** A promise settled by the test, to hold the export in its pending state. */
function deferred(): {
  promise: Promise<Blob>;
  resolve: (blob: Blob) => void;
  reject: (error: Error) => void;
} {
  let resolve: (blob: Blob) => void = () => undefined;
  let reject: (error: Error) => void = () => undefined;
  const promise = new Promise<Blob>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  toastMock.mockReset();
  writeMock.mockReset();
  downloadMock.mockReset();
  writeMock.mockResolvedValue(BLOB);
  seed([makeInvoice({ uuid: "OK-1", folio: "OK-1" })]);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  act(() => {
    useSessionStore.getState().clearAll();
  });
  resetSettingsStore();
});

describe("ExportButton: download (D-19, XLS-02)", () => {
  it("shows the label and keeps the accessible name", () => {
    render(<ExportButton />);
    expect(exportButton()).toHaveTextContent("Exportar a Excel");
  });

  it("writes the workbook once, downloads it with the D-19 name and announces it", async () => {
    render(<ExportButton />);
    fireEvent.click(exportButton());
    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(`Excel descargado: ${FILE_CON}`);
    });
    expect(writeMock).toHaveBeenCalledTimes(1);
    const sheets = writeMock.mock.calls[0]?.[0];
    expect(sheets?.map((sheet) => sheet.name)).toEqual(["Resumen por mes"]);
    expect(downloadMock).toHaveBeenCalledTimes(1);
    expect(downloadMock).toHaveBeenCalledWith(BLOB, FILE_CON);
  });

  it("names the file with the active IVA mode", async () => {
    act(() => {
      useSettingsStore.getState().setIvaMode("sin");
    });
    render(<ExportButton />);
    fireEvent.click(exportButton());
    await waitFor(() => {
      expect(downloadMock).toHaveBeenCalledWith(BLOB, FILE_SIN);
    });
    expect(writeMock.mock.calls[0]?.[0][0]?.columns[1]?.header).toBe("Monto (sin IVA)");
  });
});

describe("ExportButton: pending state (E8 loading, XLS-01 concurrency)", () => {
  it("reads «Exportando…», is aria-busy and ignores a second activation", async () => {
    const pending = deferred();
    writeMock.mockReturnValue(pending.promise);
    render(<ExportButton />);
    fireEvent.click(exportButton());
    await waitFor(() => {
      expect(exportButton()).toHaveAttribute("aria-busy", "true");
    });
    const label = screen.getByText("Exportando…");
    expect(label).not.toHaveClass("invisible");
    expect(screen.getByText("Exportar a Excel", { selector: "span" })).toHaveClass("invisible");
    expect(exportButton()).not.toBeDisabled();

    fireEvent.click(exportButton());
    fireEvent.click(exportButton());
    expect(writeMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      pending.resolve(BLOB);
      await pending.promise;
    });
    await waitFor(() => {
      expect(exportButton()).not.toHaveAttribute("aria-busy");
    });
    expect(downloadMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Exportar a Excel", { selector: "span" })).not.toHaveClass(
      "invisible",
    );
  });

  it("keeps the same slot for the icon: a Spinner replaces it, same size", async () => {
    const pending = deferred();
    writeMock.mockReturnValue(pending.promise);
    render(<ExportButton />);
    const before = exportButton().querySelector("svg");
    expect(before).toHaveClass("size-4");
    expect(before).not.toHaveAttribute("data-slot", "spinner");
    fireEvent.click(exportButton());
    await waitFor(() => {
      expect(exportButton().querySelector('[data-slot="spinner"]')).not.toBeNull();
    });
    expect(exportButton().querySelectorAll("svg")).toHaveLength(1);
    expect(exportButton().querySelector("svg")).toHaveClass("size-4");
    await act(async () => {
      pending.resolve(BLOB);
      await pending.promise;
    });
  });
});

describe("ExportButton: failure (E8 error, D-24)", () => {
  it("shows the failure toast, downloads nothing and frees the button", async () => {
    writeMock.mockRejectedValueOnce(new Error("export timeout"));
    render(<ExportButton />);
    fireEvent.click(exportButton());
    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        "No se pudo generar el Excel. Inténtalo de nuevo.",
      );
    });
    expect(downloadMock).not.toHaveBeenCalled();
    expect(exportButton()).not.toHaveAttribute("aria-busy");

    fireEvent.click(exportButton());
    await waitFor(() => {
      expect(downloadMock).toHaveBeenCalledWith(BLOB, FILE_CON);
    });
    expect(writeMock).toHaveBeenCalledTimes(2);
  });

  it("shows the failure toast when the download itself throws", async () => {
    downloadMock.mockImplementationOnce(() => {
      throw new Error("no anchor");
    });
    render(<ExportButton />);
    fireEvent.click(exportButton());
    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        "No se pudo generar el Excel. Inténtalo de nuevo.",
      );
    });
    expect(exportButton()).not.toHaveAttribute("aria-busy");
  });
});

describe("ExportButton: no invoice under the filters (D-24)", () => {
  beforeEach(() => {
    act(() => {
      useSessionStore.getState().setRange({ from: "2024-01", to: "2024-02" });
    });
  });

  it("is aria-disabled, not disabled, and ignores activation", () => {
    render(<ExportButton />);
    const button = exportButton();
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).not.toHaveAttribute("disabled");
    fireEvent.click(button);
    expect(writeMock).not.toHaveBeenCalled();
    expect(downloadMock).not.toHaveBeenCalled();
    expect(toastMock).not.toHaveBeenCalled();
  });

  it("explains why in its Tooltip", async () => {
    render(<ExportButton />);
    const button = exportButton();
    act(() => {
      button.focus();
    });
    fireEvent.focus(button);
    expect(
      await screen.findByText(
        "No hay facturas con los filtros actuales",
        {},
        { timeout: 2000 },
      ),
    ).toBeInTheDocument();
  });

  it("is enabled again when the filters are cleared", () => {
    render(<ExportButton />);
    act(() => {
      useSessionStore.getState().clearFilters();
    });
    expect(exportButton()).not.toHaveAttribute("aria-disabled");
  });
});

describe("ExportButton: nothing leaves the browser (T-03-26, XLS-01)", () => {
  it("calls no network function and writes no browser storage key", async () => {
    const requests = vi.spyOn(globalThis, "fetch");
    const writes = vi.spyOn(Storage.prototype, "setItem");
    render(<ExportButton />);
    fireEvent.click(exportButton());
    await waitFor(() => {
      expect(downloadMock).toHaveBeenCalledTimes(1);
    });
    expect(requests).not.toHaveBeenCalled();
    expect(writes).not.toHaveBeenCalled();
  });
});

describe("ExportButton: responsive markup (UI-SPEC Q9)", () => {
  it("is an outline button 36 px tall that collapses to an icon below 1024 px", () => {
    render(<ExportButton />);
    const button = exportButton();
    expect(button).toHaveClass("h-9", "max-lg:size-9", "max-lg:px-0", "max-sm:size-11");
    const label = button.querySelector("span.max-lg\\:sr-only");
    expect(label).not.toBeNull();
    expect(label).toHaveTextContent("Exportar a Excel");
    expect(button.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("shows the label as the Tooltip on focus", async () => {
    render(<ExportButton />);
    const button = exportButton();
    act(() => {
      button.focus();
    });
    fireEvent.focus(button);
    const tips = await screen.findAllByText("Exportar a Excel", {}, { timeout: 2000 });
    expect(tips.length).toBeGreaterThan(1);
  });
});
