/**
 * Writes the workbook models to an .xlsx Blob (XLS-01, XLS-02).
 *
 * The writer library is loaded with a dynamic import inside the call, from its universal
 * entry only (never the package root or its browser entry, which spawns Web Workers up
 * front), so it stays out of the first-load bundle until the user exports. Its compression
 * of large sheets runs in a blob: Worker, which the Content-Security-Policy allows through
 * `worker-src`; if a browser still blocks it the promise would never settle, so the write
 * is raced against a timeout and the caller always gets an answer (D-24, Pitfall 1).
 */
import type { Sheet } from "write-excel-file/universal";
import type { SheetModel } from "./cellModel";
import { toLibrarySheet } from "./toLibrarySheet";

/** Longest wait for the file before the export is reported as failed. */
export const EXPORT_TIMEOUT_MS = 30000;

/** The part of the writer module this file uses; also the seam tests use to inject a stub. */
export interface WriterModule {
  default: (sheets: Sheet<Blob>[]) => { toBlob: () => Promise<Blob> };
}

/** The real library, loaded on first use. */
const loadWriter: () => Promise<WriterModule> = async () =>
  await import("write-excel-file/universal");

export async function writeWorkbook(
  sheets: SheetModel[],
  timeoutMs: number = EXPORT_TIMEOUT_MS,
  loader: () => Promise<WriterModule> = loadWriter,
): Promise<Blob> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error("export timeout"));
    }, timeoutMs);
  });
  const write = (async () => {
    const writer = await loader();
    return await writer.default(sheets.map(toLibrarySheet)).toBlob();
  })();
  try {
    return await Promise.race([write, timeout]);
  } finally {
    clearTimeout(timer);
    // If the timeout won, the write may still reject later; that must not become an
    // unhandled rejection.
    void write.catch(() => undefined);
  }
}
