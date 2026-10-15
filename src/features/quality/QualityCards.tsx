"use client";

import { Button } from "@/components/ui/button";
import {
  INCIDENT_ORDER,
  type QualitySummary,
} from "@/domain/accounting/quality";
import { es } from "@/lib/copy/es";
import { incidentTitle } from "@/lib/copy/messages";
import { cn } from "@/lib/utils";
import { useSessionStore, type ImportFocus } from "@/stores/sessionStore";

interface CardSpec {
  testId: string;
  label: string;
  value: number;
  /** Link-only cards (D-32) point at a section of the Importación tab. */
  link?: ImportFocus;
}

function buildCards(
  summary: QualitySummary,
  duplicados: number,
  rechazados: number,
): CardSpec[] {
  const cards: CardSpec[] = INCIDENT_ORDER.map((type) => ({
    testId: `quality-${type}`,
    label: incidentTitle(type),
    value: summary.byType.get(type)?.length ?? 0,
  }));
  cards.push(
    {
      testId: "quality-duplicados",
      label: es.quality.titles.duplicados,
      value: duplicados,
      link: "duplicados",
    },
    {
      testId: "quality-rechazados",
      label: es.quality.titles.rechazados,
      value: rechazados,
      link: "rechazados",
    },
  );
  return cards;
}

/**
 * Summary cards of the Calidad de datos tab: one per incident type, then the two
 * link-only cards whose rows are not repeated here (D-31, D-32). The grid uses the
 * Phase 1 breakpoints (2, 3 and 4 columns). A zero renders muted and no card uses
 * the destructive color.
 */
export function QualityCards({
  summary,
  duplicados,
  rechazados,
}: {
  summary: QualitySummary;
  duplicados: number;
  rechazados: number;
}) {
  const requestImportFocus = useSessionStore((s) => s.requestImportFocus);
  return (
    <div
      data-testid="quality-cards"
      className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
    >
      {buildCards(summary, duplicados, rechazados).map((card) => {
        const labelId = `${card.testId}-label`;
        const link = card.link;
        return (
          <div
            key={card.testId}
            role={link === undefined ? undefined : "group"}
            aria-labelledby={link === undefined ? undefined : labelId}
            className="flex flex-col gap-1 rounded-lg border bg-secondary p-4"
          >
            <div
              id={labelId}
              data-testid="quality-card-label"
              className="text-sm font-semibold"
            >
              {card.label}
            </div>
            <div
              data-testid={card.testId}
              className={cn(
                "text-[28px] leading-[1.2] font-semibold tabular-nums",
                card.value === 0 && "text-muted-foreground",
              )}
            >
              {card.value}
            </div>
            {link !== undefined && (
              <Button
                type="button"
                variant="link"
                data-testid={`quality-link-${link}`}
                className="h-auto self-start px-0 py-0"
                onClick={() => {
                  requestImportFocus(link);
                }}
              >
                {es.quality.seeInImport}
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
