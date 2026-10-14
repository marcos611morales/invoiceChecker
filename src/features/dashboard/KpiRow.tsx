import type Big from "big.js";
import { ZERO } from "@/domain/accounting/decimal";
import { es } from "@/lib/copy/es";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

/** KPI cards of the Dashboard (DASH-01). Phase 2 grows this row plan by plan. */
export function KpiRow({ gasto }: { gasto: Big }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      <div className="flex flex-col gap-1 rounded-lg border bg-secondary p-4">
        <div className="text-sm font-semibold">{es.dashboard.kpis.gasto}</div>
        <div
          data-testid="kpi-gasto"
          className={cn(
            "text-[28px] leading-[1.2] font-semibold tabular-nums whitespace-nowrap",
            gasto.eq(ZERO) && "text-muted-foreground",
          )}
        >
          {formatMoney(gasto)}
        </div>
      </div>
    </div>
  );
}
