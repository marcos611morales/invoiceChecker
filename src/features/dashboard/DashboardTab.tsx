"use client";

import { useMemo } from "react";
import { totalSpend } from "@/domain/accounting/aggregate";
import { buildLedger } from "@/domain/accounting/ledger";
import { useSessionStore } from "@/stores/sessionStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { KpiRow } from "./KpiRow";

/**
 * Dashboard panel. The ledger is built from the session invoices plus the manual
 * exclusions and restorations (REGLA-08), and the Gasto total is read in the IVA
 * mode of the settings store (REGLA-03). Switching the mode only picks the other
 * stored amount; it never rebuilds the ledger.
 */
export function DashboardTab() {
  const invoices = useSessionStore((s) => s.invoices);
  const excluded = useSessionStore((s) => s.excluded);
  const restored = useSessionStore((s) => s.restored);
  const ivaMode = useSettingsStore((s) => s.ivaMode);
  const ledger = useMemo(
    () => buildLedger(invoices, { excluded, restored }),
    [invoices, excluded, restored],
  );
  const gasto = useMemo(() => totalSpend(ledger, ivaMode), [ledger, ivaMode]);
  return <KpiRow gasto={gasto} />;
}
