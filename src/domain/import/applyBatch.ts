import type {
  BatchEntry,
  BatchSummary,
  DuplicateFile,
  FileRef,
  IgnoredFile,
  ImportState,
  LoadedInvoice,
  RejectedFile,
} from "./types";

export function emptyImportState(): ImportState {
  return {
    invoices: [],
    firstFileByUuid: {},
    rejected: [],
    duplicates: [],
    ignored: [],
  };
}

/**
 * Accumulates a batch onto the session state without mutating it (D-08).
 * First-wins dedupe by UUID, in batch order, inside the batch and against what
 * was already loaded (D-18). Every entry lands in exactly one list.
 */
export function applyBatch(
  state: ImportState,
  batch: readonly BatchEntry[],
): { state: ImportState; summary: BatchSummary } {
  const invoices: LoadedInvoice[] = [...state.invoices];
  const rejected: RejectedFile[] = [...state.rejected];
  const duplicates: DuplicateFile[] = [...state.duplicates];
  const ignored: IgnoredFile[] = [...state.ignored];
  const firstFileByUuid: Record<string, FileRef> = { ...state.firstFileByUuid };
  const summary: BatchSummary = {
    added: 0,
    duplicates: 0,
    rejected: 0,
    ignored: 0,
  };

  for (const entry of batch) {
    if (entry.kind === "ignored") {
      ignored.push({ file: entry.file, kind: entry.ignoredKind });
      summary.ignored += 1;
    } else if (entry.kind === "unreadable") {
      rejected.push({ file: entry.file, reason: "unreadable" });
      summary.rejected += 1;
    } else if (!entry.result.ok) {
      const item: RejectedFile = {
        file: entry.file,
        reason: entry.result.reason,
      };
      if (entry.result.detail !== undefined) item.detail = entry.result.detail;
      rejected.push(item);
      summary.rejected += 1;
    } else {
      const invoice = entry.result.invoice;
      // hasOwn: a UUID like "constructor" must not match Object.prototype.
      const original = Object.hasOwn(firstFileByUuid, invoice.uuid)
        ? firstFileByUuid[invoice.uuid]
        : undefined;
      if (original !== undefined) {
        duplicates.push({
          file: entry.file,
          originalFile: original,
          uuid: invoice.uuid,
        });
        summary.duplicates += 1;
      } else {
        firstFileByUuid[invoice.uuid] = entry.file;
        invoices.push({ file: entry.file, invoice });
        summary.added += 1;
      }
    }
  }

  return {
    state: { invoices, firstFileByUuid, rejected, duplicates, ignored },
    summary,
  };
}
