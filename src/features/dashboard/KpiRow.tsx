import type Big from "big.js";
import { ArrowDown, ArrowUp } from "lucide-react";
import { ZERO } from "@/domain/accounting/decimal";
import type { IvaMode, KpiDeltas, KpiResult } from "@/domain/accounting/aggregate";
import { es } from "@/lib/copy/es";
import { deltaLine, monthsSubLabel, notasSubLabel } from "@/lib/copy/messages";
import { formatCount, formatDelta, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

interface CardSpec {
  testId: "kpi-gasto" | "kpi-facturas" | "kpi-ticket" | "kpi-promedio";
  label: string;
  value: string;
  muted: boolean;
  subLabel: string | null;
  delta: Big | null;
}

function buildCards(current: KpiResult, deltas: KpiDeltas): CardSpec[] {
  return [
    {
      testId: "kpi-gasto",
      label: es.dashboard.kpis.gasto,
      value: formatMoney(current.gasto),
      muted: current.gasto.eq(ZERO),
      subLabel: null,
      delta: deltas.gasto,
    },
    {
      testId: "kpi-facturas",
      label: es.dashboard.kpis.facturas,
      value: formatCount(current.facturas),
      muted: current.facturas === 0,
      subLabel: current.notas > 0 ? notasSubLabel(current.notas) : null,
      delta: deltas.facturas,
    },
    {
      testId: "kpi-ticket",
      label: es.dashboard.kpis.ticket,
      value: current.ticket === null ? "—" : formatMoney(current.ticket),
      muted: current.ticket === null || current.ticket.eq(ZERO),
      subLabel: null,
      delta: deltas.ticket,
    },
    {
      testId: "kpi-promedio",
      label: es.dashboard.kpis.promedio,
      value: formatMoney(current.promedio),
      muted: current.promedio.eq(ZERO),
      subLabel: monthsSubLabel(current.months),
      delta: deltas.promedio,
    },
  ];
}

/**
 * Change against the previous period (D-20). An increase is neutral foreground
 * with an up arrow, a decrease uses the positive token with a down arrow
 * (UI-SPEC decision 2); the destructive token is never used here. A missing
 * delta never shows a percentage.
 */
function DeltaLine({
  testId,
  delta,
  previousLabel,
}: {
  testId: string;
  delta: Big | null;
  previousLabel: string;
}) {
  if (delta === null) {
    return (
      <div
        data-testid={`${testId}-delta`}
        className="flex items-center gap-1 text-xs text-muted-foreground"
      >
        {es.dashboard.kpis.noPrevious}
      </div>
    );
  }
  const { text, direction } = formatDelta(delta);
  return (
    <div
      data-testid={`${testId}-delta`}
      className={cn(
        "flex items-center gap-1 text-xs",
        direction === "down" ? "text-positive" : "text-foreground",
      )}
    >
      {direction === "up" && <ArrowUp className="size-3 shrink-0" aria-hidden="true" />}
      {direction === "down" && <ArrowDown className="size-3 shrink-0" aria-hidden="true" />}
      {direction !== "flat" && (
        <span className="sr-only">
          {direction === "up" ? es.dashboard.kpis.increased : es.dashboard.kpis.decreased}{" "}
        </span>
      )}
      <span>{deltaLine(text, previousLabel)}</span>
    </div>
  );
}

/**
 * The four KPI cards of the Dashboard (DASH-01, D-03): Gasto total, Facturas,
 * Ticket promedio and Promedio mensual, all from the filtered visible set in the
 * active IVA mode. Informational only (no interaction). Values are never
 * clipped or abbreviated: 28/600, tabular figures, no wrapping; the grid is 1 column below
 * 640 px, 2 from 640 px and 4 from 1200 px so a 13-character amount fits.
 */
export function KpiRow({
  current,
  deltas,
  previousLabel,
  mode,
}: {
  current: KpiResult;
  deltas: KpiDeltas;
  previousLabel: string;
  mode: IvaMode;
}) {
  return (
    <div
      data-testid="kpi-row"
      data-iva-mode={mode}
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 min-[1200px]:grid-cols-4"
    >
      {buildCards(current, deltas).map((card) => (
        <div key={card.testId} className="flex flex-col gap-1 rounded-lg border bg-secondary p-4">
          <div className="text-sm font-semibold">{card.label}</div>
          <div
            data-testid={card.testId}
            className={cn(
              "text-[28px] leading-[1.2] font-semibold tabular-nums whitespace-nowrap",
              card.muted && "text-muted-foreground",
            )}
          >
            {card.value}
          </div>
          {card.subLabel !== null && (
            <div className="text-xs text-muted-foreground">{card.subLabel}</div>
          )}
          <DeltaLine testId={card.testId} delta={card.delta} previousLabel={previousLabel} />
        </div>
      ))}
    </div>
  );
}
