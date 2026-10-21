"use client";

import { CircleAlert, Info, X } from "lucide-react";
import { Alert, AlertAction, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { es } from "@/lib/copy/es";
import {
  canceledText,
  failedBatchesText,
  failureText,
  stoppedText,
} from "@/lib/copy/messages";
import { useLlmRunStore, type RunKind } from "@/stores/llmRunStore";

/**
 * How a run ended when it did not end clean (UI-SPEC run result): canceled by the user, finished
 * with failed batches, or stopped by a refusal that a retry cannot fix. A clean end has no Alert,
 * only the toast. `onRetry` is the same handler as the entry button of that run kind, so
 * «Reintentar» re-runs only the still-free items and opens the send dialog first.
 */
export function RunResult({ onRetry }: { onRetry: (kind: RunKind) => void }) {
  const status = useLlmRunStore((s) => s.status);
  const dismissResult = useLlmRunStore((s) => s.dismissResult);
  const close = (
    <AlertAction>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={es.products.closeAlert}
        onClick={dismissResult}
        className="max-sm:size-11"
      >
        <X aria-hidden="true" />
      </Button>
    </AlertAction>
  );

  if (status.phase === "canceled") {
    return (
      <Alert role="status">
        <Info aria-hidden="true" className="text-muted-foreground" />
        <AlertDescription className="text-foreground break-words">
          {canceledText(status.received)}
        </AlertDescription>
        {close}
      </Alert>
    );
  }

  if (status.phase === "partial") {
    return (
      <Alert>
        <CircleAlert aria-hidden="true" className="text-destructive!" />
        <AlertDescription className="text-foreground break-words">
          <div className="flex flex-wrap items-center gap-2">
            <span>{failedBatchesText(status.failed)}</span>
            <span aria-hidden="true">·</span>
            <Button
              type="button"
              variant="outline"
              className="h-9 max-sm:h-11"
              onClick={() => {
                onRetry(status.kind);
              }}
            >
              {es.products.run.retry}
            </Button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{failureText(status.lastError)}</p>
        </AlertDescription>
        {close}
      </Alert>
    );
  }

  if (status.phase === "stopped") {
    return (
      <Alert>
        <CircleAlert aria-hidden="true" className="text-destructive!" />
        <AlertDescription className="text-foreground break-words">
          {stoppedText(status.batch, status.total, failureText(status.error))}
        </AlertDescription>
        {status.error === "unauthorized" ? (
          <div className="col-start-2 mt-2">
            <a href="/login" className={buttonVariants({ variant: "outline" })}>
              {es.products.signIn}
            </a>
          </div>
        ) : null}
        {close}
      </Alert>
    );
  }

  return null;
}
