import { parseCfdi } from "@/domain/cfdi/parseCfdi";
import { classifyFile } from "@/domain/import/classifyFile";
import type { BatchEntry, FileRef } from "@/domain/import/types";

/** XML files parsed per chunk before yielding to the event loop (D-11). */
export const CHUNK_SIZE = 25;

/** Minimum time between two progress reports; the final one is always sent. */
const PROGRESS_INTERVAL_MS = 100;

export interface IngestCallbacks {
  onProgress?: (done: number, total: number) => void;
  isCancelled?: () => boolean;
}

/**
 * Reference to a selected file: react-dropzone `path`, else `webkitRelativePath`,
 * else the bare name (Pitfall 10).
 */
export function toFileRef(file: File): FileRef {
  if ("path" in file && typeof file.path === "string" && file.path !== "") {
    return { name: file.name, path: file.path };
  }
  // Typed as string, but File-likes outside a real browser may omit it.
  if (typeof file.webkitRelativePath === "string" && file.webkitRelativePath !== "") {
    return { name: file.name, path: file.webkitRelativePath };
  }
  return { name: file.name, path: file.name };
}

async function parseOne(file: File, ref: FileRef): Promise<BatchEntry> {
  try {
    return { kind: "parsed", file: ref, result: parseCfdi(await file.text()) };
  } catch {
    return { kind: "unreadable", file: ref };
  }
}

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Classifies every file up front (hidden ones are dropped, PDF/ZIP/other become
 * ignored entries without being read), then parses the XML files in chunks of
 * CHUNK_SIZE with a macrotask yield between chunks. Entries come back in the
 * original selection order. Resolves null when cancelled between chunks.
 *
 * Runs entirely in the browser: no network request, no browser storage
 * (CARGA-02, CARGA-06).
 */
export async function ingest(
  files: readonly File[],
  callbacks: IngestCallbacks = {},
): Promise<BatchEntry[] | null> {
  const { onProgress, isCancelled } = callbacks;

  // One slot per kept file, in selection order; XML slots are filled by the chunk loop.
  const slots: Array<BatchEntry | null> = [];
  const pending: Array<{ slot: number; file: File; ref: FileRef }> = [];
  for (const file of files) {
    const kind = classifyFile(file.name);
    if (kind === "hidden") continue; // D-12: dropped, not listed
    const ref = toFileRef(file);
    if (kind === "xml") {
      pending.push({ slot: slots.length, file, ref });
      slots.push(null);
    } else {
      slots.push({ kind: "ignored", file: ref, ignoredKind: kind });
    }
  }

  const total = pending.length;
  let lastReport = performance.now();
  for (let start = 0; start < total; start += CHUNK_SIZE) {
    if (isCancelled?.() === true) return null;
    const chunk = pending.slice(start, start + CHUNK_SIZE);
    const entries = await Promise.all(chunk.map((item) => parseOne(item.file, item.ref)));
    chunk.forEach((item, index) => {
      slots[item.slot] = entries[index] ?? { kind: "unreadable", file: item.ref };
    });

    const done = start + chunk.length;
    const now = performance.now();
    if (done === total || now - lastReport >= PROGRESS_INTERVAL_MS) {
      lastReport = now;
      onProgress?.(done, total);
    }
    if (done < total) await yieldToEventLoop();
  }
  if (isCancelled?.() === true) return null;

  const result: BatchEntry[] = [];
  for (const slot of slots) {
    if (slot !== null) result.push(slot);
  }
  return result;
}
