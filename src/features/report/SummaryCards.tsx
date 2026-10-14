import { CircleAlert } from "lucide-react";
import type { ReportCounts } from "@/domain/import/report";
import { es } from "@/lib/copy/es";
import {
  ignoradosSubLabel,
  trasladoNominaSubLabel,
} from "@/lib/copy/messages";
import { cn } from "@/lib/utils";

interface CardSpec {
  testId: string;
  label: string;
  value: number;
  subLabel?: string;
  destructive?: boolean;
}

function buildCards(counts: ReportCounts): CardSpec[] {
  const cards: CardSpec[] = [
    {
      testId: "summary-ingreso",
      label: es.report.cards.income,
      value: counts.ingreso,
    },
    {
      testId: "summary-egreso",
      label: es.report.cards.expense,
      value: counts.egreso,
    },
    {
      testId: "summary-pago",
      label: es.report.cards.payment,
      value: counts.pago,
    },
  ];
  // Not rendered at all when both are 0 (D-17).
  if (counts.traslado + counts.nomina > 0) {
    cards.push({
      testId: "summary-traslado-nomina",
      label: es.report.cards.transferAndPayroll,
      value: counts.traslado + counts.nomina,
      subLabel: trasladoNominaSubLabel(counts.traslado, counts.nomina),
    });
  }
  cards.push(
    {
      testId: "summary-duplicados",
      label: es.report.cards.duplicates,
      value: counts.duplicados,
    },
    {
      testId: "summary-rechazados",
      label: es.report.cards.rejected,
      value: counts.rechazados,
      destructive: counts.rechazados > 0,
    },
    {
      testId: "summary-ignorados",
      label: es.report.cards.ignored,
      value: counts.ignorados,
      subLabel: ignoradosSubLabel(counts.ignoradosPdf, counts.ignoradosOtros),
    },
  );
  return cards;
}

/** Informational cards of the import report (D-19, D-17); not interactive. */
export function SummaryCards({ counts }: { counts: ReportCounts }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {buildCards(counts).map((card) => (
        <div
          key={card.testId}
          className="flex flex-col gap-1 rounded-lg border bg-secondary p-4"
        >
          <div className="flex items-center gap-2 text-sm font-semibold">
            {card.label}
            {card.destructive === true && (
              <CircleAlert
                aria-hidden="true"
                className="size-4 text-destructive"
              />
            )}
          </div>
          <div
            data-testid={card.testId}
            className={cn(
              "text-[28px] leading-[1.2] font-semibold tabular-nums",
              card.value === 0 && "text-muted-foreground",
              card.destructive === true && "text-destructive",
            )}
          >
            {card.value}
          </div>
          {card.subLabel !== undefined && (
            <div className="text-xs text-muted-foreground">{card.subLabel}</div>
          )}
        </div>
      ))}
    </div>
  );
}
