"use client";

import { useEffect } from "react";

/**
 * Asks the browser to confirm reload or tab close while `active` (D-07b, CARGA-06).
 * Nothing is registered while inactive. The prompt text is controlled by the browser.
 */
export function useBeforeUnload(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const onBeforeUnload = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [active]);
}
