/** Time the object URL stays alive after the click, so the browser can start the download. */
const REVOKE_DELAY_MS = 1000;

/**
 * Downloads a Blob through a temporary anchor (the settings file and, later, the Excel export).
 * Local only: the Blob never leaves the browser. The object URL is revoked after a delay, not in
 * the same tick, because revoking at once can cancel the download in some browsers.
 */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, REVOKE_DELAY_MS);
}
