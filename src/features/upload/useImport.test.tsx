// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { BatchEntry } from "@/domain/import/types";
import { es } from "@/lib/copy/es";
import { useSessionStore } from "@/stores/sessionStore";

const toastMock = vi.hoisted(() => {
  const fn = vi.fn();
  return Object.assign(fn, { error: vi.fn() });
});
const ingestMock = vi.hoisted(() => vi.fn());

vi.mock("sonner", () => ({ toast: toastMock }));
vi.mock("@/lib/client/ingest", () => ({ ingest: ingestMock }));

import { useImport } from "./useImport";

const pdfFile = new File(["x"], "a.pdf", { type: "application/pdf" });

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
