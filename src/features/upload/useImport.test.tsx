// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { parseCfdi } from "@/domain/cfdi/parseCfdi";
import type { BatchEntry } from "@/domain/import/types";
import { es } from "@/lib/copy/es";
import { useSessionStore } from "@/stores/sessionStore";
import { readFixture } from "../../../tests/support/cfdiVariants";

const toastMock = vi.hoisted(() => {
  const fn = vi.fn();
  return Object.assign(fn, { error: vi.fn() });
});
const ingestMock = vi.hoisted(() => vi.fn());

vi.mock("sonner", () => ({ toast: toastMock }));
vi.mock("@/lib/client/ingest", () => ({ ingest: ingestMock }));

import { useImport } from "./useImport";

const pdfFile = new File(["x"], "a.pdf", { type: "application/pdf" });

function parsedEntry(relPath: string, name: string): BatchEntry {
  const result = parseCfdi(readFixture(relPath));
  if (!result.ok) {
    throw new Error(`fixture ${relPath} did not parse: ${result.reason}`);
  }
  return {
    kind: "parsed",
    file: { name, path: name },
    result: { ok: true, invoice: result.invoice },
  };
}

const ingresoBatch: BatchEntry[] = [
  parsedEntry("anon/anon-ingreso-descuento.xml", "ingreso.xml"),
];

const ignoredBatch: BatchEntry[] = [
  {
    kind: "ignored",
    file: { name: "a.pdf", path: "a.pdf" },
    ignoredKind: "pdf",
  },
];

describe("useImport", () => {
  beforeEach(() => {
    useSessionStore.getState().clearAll();
    toastMock.mockReset();
    toastMock.error.mockReset();
    ingestMock.mockReset();
  });

  afterEach(() => {
    useSessionStore.getState().clearAll();
  });

  it("shows the batch toast and returns progress to idle", async () => {
    ingestMock.mockResolvedValue(ignoredBatch);
    const { result } = renderHook(() => useImport());

    await act(async () => {
      await result.current.run([pdfFile]);
    });

    expect(toastMock).toHaveBeenCalledWith(
      "No se agregó ninguna factura nueva, 1 ignorado",
    );
    expect(useSessionStore.getState().progress).toEqual({ phase: "idle" });
  });

  it("shows the error toast and returns to idle when ingest throws", async () => {
    ingestMock.mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useImport());

    await act(async () => {
      await result.current.run([pdfFile]);
    });

    expect(toastMock.error).toHaveBeenCalledWith(es.errors.importFailed);
    expect(toastMock).not.toHaveBeenCalled();
    expect(useSessionStore.getState().progress).toEqual({ phase: "idle" });
  });

  it("ignores a second selection while a batch is processing", async () => {
    useSessionStore.getState().setProgress({ phase: "listing" });
    const { result } = renderHook(() => useImport());

    await act(async () => {
      await result.current.run([pdfFile]);
    });

    expect(ingestMock).not.toHaveBeenCalled();
    expect(useSessionStore.getState().progress).toEqual({ phase: "listing" });
  });

  it("writes nothing when the session was cleared while the batch ran", async () => {
    ingestMock.mockImplementation(async () => {
      useSessionStore.getState().clearAll();
      return ignoredBatch;
    });
    const { result } = renderHook(() => useImport());

    await act(async () => {
      await result.current.run([pdfFile]);
    });

    expect(toastMock).not.toHaveBeenCalled();
    expect(useSessionStore.getState().ignored).toEqual([]);
  });
});

describe("useImport: tab after a finished batch (D-01, D-44)", () => {
  beforeEach(() => {
    useSessionStore.getState().clearAll();
    toastMock.mockReset();
    toastMock.error.mockReset();
    ingestMock.mockReset();
  });

  afterEach(() => {
    useSessionStore.getState().clearAll();
  });

  it("opens Dashboard when the batch added an invoice", async () => {
    ingestMock.mockResolvedValue(ingresoBatch);
    useSessionStore.getState().setActiveTab("importacion");
    const { result } = renderHook(() => useImport());

    await act(async () => {
      await result.current.run([pdfFile]);
    });

    expect(useSessionStore.getState().invoices).toHaveLength(1);
    expect(useSessionStore.getState().activeTab).toBe("dashboard");
  });

  it("opens Dashboard even when the batch added nothing but the session already has an invoice", async () => {
    ingestMock.mockResolvedValueOnce(ingresoBatch);
    const { result } = renderHook(() => useImport());
    await act(async () => {
      await result.current.run([pdfFile]);
    });
    useSessionStore.getState().setActiveTab("importacion");

    ingestMock.mockResolvedValueOnce(ignoredBatch);
    await act(async () => {
      await result.current.run([pdfFile]);
    });

    expect(useSessionStore.getState().invoices).toHaveLength(1);
    expect(useSessionStore.getState().lastSummary?.added).toBe(0);
    expect(useSessionStore.getState().activeTab).toBe("dashboard");
  });

  it("opens Importación when the session has no invoice at all", async () => {
    ingestMock.mockResolvedValue(ignoredBatch);
    useSessionStore.getState().setActiveTab("dashboard");
    const { result } = renderHook(() => useImport());

    await act(async () => {
      await result.current.run([pdfFile]);
    });

    expect(useSessionStore.getState().invoices).toHaveLength(0);
    expect(useSessionStore.getState().activeTab).toBe("importacion");
  });

  it("respects the tab the user picked while the batch is still parsing", async () => {
    let finish: (batch: BatchEntry[]) => void = () => {};
    ingestMock.mockImplementation(
      () =>
        new Promise<BatchEntry[]>((resolve) => {
          finish = resolve;
        }),
    );
    const { result } = renderHook(() => useImport());

    let running: Promise<void> = Promise.resolve();
    act(() => {
      running = result.current.run([pdfFile]);
    });
    expect(useSessionStore.getState().progress.phase).not.toBe("idle");

    act(() => {
      useSessionStore.getState().setActiveTab("importacion");
    });
    expect(useSessionStore.getState().activeTab).toBe("importacion");

    await act(async () => {
      finish(ingresoBatch);
      await running;
    });

    expect(useSessionStore.getState().activeTab).toBe("dashboard");
  });

  it("does not touch the tab when the batch failed", async () => {
    ingestMock.mockRejectedValue(new Error("boom"));
    useSessionStore.getState().setActiveTab("importacion");
    const { result } = renderHook(() => useImport());

    await act(async () => {
      await result.current.run([pdfFile]);
    });

    expect(useSessionStore.getState().activeTab).toBe("importacion");
  });

  it("does not touch the tab when the batch was cancelled", async () => {
    ingestMock.mockResolvedValue(null);
    useSessionStore.getState().setActiveTab("importacion");
    const { result } = renderHook(() => useImport());

    await act(async () => {
      await result.current.run([pdfFile]);
    });

    expect(useSessionStore.getState().activeTab).toBe("importacion");
  });

  it("does not touch the tab when the session was cleared while the batch ran", async () => {
    ingestMock.mockImplementation(async () => {
      useSessionStore.getState().clearAll();
      useSessionStore.getState().setActiveTab("importacion");
      return ingresoBatch;
    });
    const { result } = renderHook(() => useImport());

    await act(async () => {
      await result.current.run([pdfFile]);
    });

    expect(useSessionStore.getState().invoices).toHaveLength(0);
    expect(useSessionStore.getState().activeTab).toBe("importacion");
  });
});
