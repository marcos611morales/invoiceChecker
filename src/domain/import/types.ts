import type {
  ParseResult,
  ParsedInvoice,
  RejectReason,
} from "@/domain/cfdi/types";

export type FileKind = "hidden" | "xml" | "pdf" | "zip" | "other";

/** Kinds of file that are counted and listed as ignored (hidden ones are dropped). */
export type IgnoredKind = "pdf" | "zip" | "other";

export interface FileRef {
  name: string;
  path: string;
}

/** One processed file of a selection, in selection order. */
export type BatchEntry =
  | { kind: "parsed"; file: FileRef; result: ParseResult }
  | { kind: "unreadable"; file: FileRef }
  | { kind: "ignored"; file: FileRef; ignoredKind: IgnoredKind };

export interface LoadedInvoice {
  file: FileRef;
  invoice: ParsedInvoice;
}

export interface RejectedFile {
  file: FileRef;
  reason: RejectReason | "unreadable";
  detail?: string;
}

export interface DuplicateFile {
  file: FileRef;
  originalFile: FileRef;
  uuid: string;
}

export interface IgnoredFile {
  file: FileRef;
  kind: IgnoredKind;
}

/** Everything the session has accumulated; every processed file is in exactly one list. */
export interface ImportState {
  invoices: LoadedInvoice[];
  firstFileByUuid: Record<string, FileRef>;
  rejected: RejectedFile[];
  duplicates: DuplicateFile[];
  ignored: IgnoredFile[];
}

/** Outcome of one batch only (not the accumulated session). */
export interface BatchSummary {
  added: number;
  duplicates: number;
  rejected: number;
  ignored: number;
}
