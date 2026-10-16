"use client";

import { useMemo } from "react";
import { buildLedger, type LedgerEntry } from "@/domain/accounting/ledger";
import { useSessionStore } from "@/stores/sessionStore";

/**
 * The one place that builds the ledger (REGLA-08): the session invoices plus the
 * manual exclusions and restorations. The Dashboard, the Calidad de datos tab and the
 * shell's incident counter all read it, so they can never disagree. It selects the
 * three inputs with primitive selectors and memoizes on them, so the same array
 * instance comes back until one of them changes.
 */
export function useLedger(): LedgerEntry[] {
  const invoices = useSessionStore((s) => s.invoices);
  const excluded = useSessionStore((s) => s.excluded);
  const restored = useSessionStore((s) => s.restored);
  return useMemo(
    () => buildLedger(invoices, { excluded, restored }),
    [invoices, excluded, restored],
  );
}
