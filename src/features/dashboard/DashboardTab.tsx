"use client";

import { useMemo } from "react";
import { totalSpend } from "@/domain/accounting/aggregate";
import { EMPTY_OVERRIDES, buildLedger } from "@/domain/accounting/ledger";
import { useSessionStore } from "@/stores/sessionStore";
import { KpiRow } from "./KpiRow";

/**
 * Dashboard panel. Tracer slice: the ledger is built from the session store and
 * the first KPI (Gasto total) is shown. The IVA mode comes from the settings
 * store in Plan 02-07; until then the spend is Con IVA.
 */
export function DashboardTab() {
  const invoices = useSessionStore((s) => s.invoices);
  const ledger = useMemo(
    () => buildLedger(invoices, EMPTY_OVERRIDES),
    [invoices],
  );
  const gasto = useMemo(() => totalSpend(ledger, "con"), [ledger]);
  return <KpiRow gasto={gasto} />;
}
