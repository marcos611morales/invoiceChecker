"use client";

import { useMemo, useState } from "react";
import { buildLedger, type LedgerEntry } from "@/domain/accounting/ledger";
import { useSessionStore } from "@/stores/sessionStore";

/** The browser's local calendar year: the one clock read of the ledger (D-48). */
function currentCalendarYear(): number {
  return new Date().getFullYear();
}

/**
 * The one place that builds the ledger (REGLA-08): the session invoices plus the
 * manual exclusions and restorations. The Dashboard, the Calidad de datos tab and the
 * shell's incident counter all read it, so they can never disagree. It selects the
 * three inputs with primitive selectors and memoizes on them, so the same array
 * instance comes back until one of them changes. The ledger also depends on the
 * browser's year, read once when the hook mounts (a lazy initializer, so React calls
 * it during the first render only) and handed to the pure domain, which reads no
 * clock; it bounds the plausible Fecha years (D-48).
 */
export function useLedger(): LedgerEntry[] {
  const invoices = useSessionStore((s) => s.invoices);
  const excluded = useSessionStore((s) => s.excluded);
  const restored = useSessionStore((s) => s.restored);
  const [currentYear] = useState(currentCalendarYear);
  return useMemo(
    () => buildLedger(invoices, { excluded, restored }, { currentYear }),
    [invoices, excluded, restored, currentYear],
  );
}
