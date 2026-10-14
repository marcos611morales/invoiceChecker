"use client";

import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { es } from "@/lib/copy/es";
import { processingText } from "@/lib/copy/messages";
import { useSessionStore } from "@/stores/sessionStore";

/** Reading (spinner) and processing (N of M + 8 px bar) indicator for a running batch (D-11). */
export function ProcessingIndicator() {
  const progress = useSessionStore((s) => s.progress);

  if (progress.phase === "idle") return null;

  if (progress.phase === "listing") {
    return (
      <Card className="flex-row items-center gap-3 px-4">
        <Spinner aria-hidden="true" role="presentation" />
        <p aria-live="polite" aria-atomic="true" className="text-sm">
          {es.empty.readingFiles}
        </p>
      </Card>
    );
  }

  return (
    <Card className="gap-3 px-4">
      <p aria-live="polite" aria-atomic="true" className="text-sm tabular-nums">
        {processingText(progress.done, progress.total)}
      </p>
      <Progress
        aria-label={es.empty.progressLabel}
        value={progress.done}
        min={0}
        max={progress.total}
      />
    </Card>
  );
}
