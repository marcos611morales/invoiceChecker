import type Big from "big.js";
import { ArrowDown, ArrowUp } from "lucide-react";
import { es } from "@/lib/copy/es";
import { deltaLine } from "@/lib/copy/messages";
import { formatDelta } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Change against a comparison period or month (D-20, D-17). An increase is neutral
 * foreground with an up arrow, a decrease uses the positive token with a down arrow
 * (UI-SPEC decision 2); the destructive token is never used here, and the arrow, the sign
 * and the screen-reader prefix always accompany the color. A missing delta never shows a
 * percentage: it shows `missingText` in the muted color. Shared by the KPI cards and the
 * rows of «Gasto por categoría». It renders spans only, so it can sit inside a row button
 * (phrasing content).
 */
export function DeltaLine({
  testId,
  delta,
  comparisonLabel,
  missingText,
}: {
  testId: string;
  delta: Big | null;
  comparisonLabel: string;
  missingText: string;
}) {
  if (delta === null) {
    return (
      <span
        data-testid={`${testId}-delta`}
        className="flex items-center gap-1 text-xs text-muted-foreground"
      >
        {missingText}
      </span>
    );
  }
  const { text, direction } = formatDelta(delta);
  return (
    <span
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
      <span>{deltaLine(text, comparisonLabel)}</span>
    </span>
  );
}
