import type { SheetModel } from "./cellModel";

export const EXPORT_TIMEOUT_MS = 30000;

export interface WriterModule {
  default: (sheets: never[]) => { toBlob: () => Promise<Blob> };
}

export function writeWorkbook(
  sheets: SheetModel[],
  timeoutMs: number = EXPORT_TIMEOUT_MS,
  loader?: () => Promise<WriterModule>,
): Promise<Blob> {
  void sheets;
  void timeoutMs;
  void loader;
  return Promise.reject(new Error("not implemented"));
}
