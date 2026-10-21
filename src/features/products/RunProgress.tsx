"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { es } from "@/lib/copy/es";
import { runCaptionReceived, runCaptionWaiting, runLine } from "@/lib/copy/messages";
import { useLlmRunStore } from "@/stores/llmRunStore";

/**
 * Run card (UI-SPEC Run card, D-26): which batch is in flight, how many are done, what already
 * reached the queue and «Detener lotes», enabled the whole time. A request is not streamed, so
 * the bar moves only when a batch ends; with one batch it stays at 0 until the answer lands.
 * Shows only while a run is active; the ended states are `RunResult` and the toast.
 */
export function RunProgress() {
  const status = useLlmRunStore((s) => s.status);
  const cancel = useLlmRunStore((s) => s.cancel);
  if (status.phase !== "running" && status.phase !== "cancelling") return null;
  const stopping = status.phase === "cancelling";
  return (
    <Card className="gap-3 px-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div aria-live="polite" aria-atomic="true" className="flex min-w-0 flex-col gap-1">
          <p className="flex items-center gap-2 text-sm font-semibold tabular-nums">
            <Spinner aria-hidden="true" role="presentation" />
            {runLine(status.kind, status.batch, status.total)}
          </p>
          <p className="text-xs text-muted-foreground">
            {status.received > 0 ? runCaptionReceived(status.received) : runCaptionWaiting()}
          </p>
        </div>
        {/* aria-disabled, never `disabled`: the stopping button keeps its place and its focus. */}
        <Button
          type="button"
          variant="outline"
          data-run-stop=""
          aria-disabled={stopping}
          aria-busy={stopping}
          className="h-9 max-sm:h-11 aria-disabled:opacity-50"
          onClick={() => {
            if (!stopping) cancel();
          }}
        >
          {stopping ? es.products.run.stopping : es.products.run.stop}
        </Button>
      </div>
      <Progress
        aria-label={es.products.run.progressLabel}
        value={status.batch - 1}
        min={0}
        max={status.total}
      />
    </Card>
  );
}
