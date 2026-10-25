"use client";

import { CircleAlert, Info, X } from "lucide-react";
import { Alert, AlertAction, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { es } from "@/lib/copy/es";
import {
  canceledText,
  failedBatchesText,
  failureText,
  leftOutText,
  stoppedText,
} from "@/lib/copy/messages";
import { useLlmRunStore, type RunKind } from "@/stores/llmRunStore";

/**
 * How a run ended when it did not end clean (UI-SPEC run result): canceled by the user, finished
 * with failed batches, or stopped by a refusal that a retry cannot fix. A clean end has no Alert,
 * only the toast, unless valid suggestions did not fit in the queue (then an Info Alert says so, and
 * so does a line under the other results). `onRetry` is the same handler as the entry button of that run kind, so
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

  // Valid suggestions that did not fit in the queue: one line under every ended state (IN-03).
  const leftOut =
    status.phase === "finished" ||
    status.phase === "partial" ||
    status.phase === "stopped" ||
    status.phase === "canceled"
      ? status.leftOut
      : 0;
  const leftOutLine =
    leftOut > 0 ? (
      <p className="mt-1 text-xs text-muted-foreground">{leftOutText(leftOut)}</p>
    ) : null;

  if (status.phase === "finished") {
    // A clean end has only the toast, unless suggestions were left out: then the user is told.
    if (leftOut === 0) return null;
    return (
      <Alert role="status">
        <Info aria-hidden="true" className="text-muted-foreground" />
        <AlertDescription className="text-foreground break-words">
          {leftOutText(leftOut)}
        </AlertDescription>
        {close}
      </Alert>
    );
  }

  if (status.phase === "canceled") {
    return (
      <Alert role="status">
        <Info aria-hidden="true" className="text-muted-foreground" />
        <AlertDescription className="text-foreground break-words">
          {canceledText(status.received)}
          {leftOutLine}
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
          {leftOutLine}
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
          {leftOutLine}
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
