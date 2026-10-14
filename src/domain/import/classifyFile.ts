import type { FileKind } from "./types";

/**
 * Classifies a selected file by name only. Dot-prefixed names (.DS_Store and
 * AppleDouble "._" files) and Thumbs.db are system files (D-12); the rest is
 * decided by its lowercased extension.
 */
export function classifyFile(name: string): FileKind {
  const lower = name.toLowerCase();
  if (lower.startsWith(".") || lower === "thumbs.db") return "hidden";
  if (lower.endsWith(".xml")) return "xml";
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".zip")) return "zip";
  return "other";
}
