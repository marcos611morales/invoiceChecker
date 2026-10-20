"use client";

import { useId, useMemo, useState } from "react";
import { CircleAlert, Layers, X } from "lucide-react";
import { Alert, AlertAction, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  buildGroupRun,
  collectItems,
  freeItems,
  type GroupRun,
} from "@/domain/llm/candidates";
import {
  memberKey,
  pendingMemberKeys,
  type ProductSuggestion,
} from "@/domain/llm/suggestions";
import { ruleMapKey } from "@/domain/settings/normalize";
import { useLedger } from "@/features/dashboard/useLedger";
import { es } from "@/lib/copy/es";
import {
  failureText,
  freeDescriptionsCaption,
  memberCaption,
  productQueueHeading,
  runLine,
  stoppedText,
} from "@/lib/copy/messages";
import { useLlmRunStore } from "@/stores/llmRunStore";
import { useSuggestionsStore } from "@/stores/suggestionsStore";
import { SendDialog } from "./SendDialog";

/**
 * One card per proposed product (D-11, D-12, D-19). Names and descriptions are vendor
 * text: they are only ever rendered as React text (RESEARCH Pitfall 7). The name is a
 * focusable heading (`tabIndex` -1) so later plans can move focus to it. `lines(key)` is
 * the count of loaded lines of a member; 0 means none of its invoices is loaded.
 */
function SuggestionCards({
  cards,
  lines,
}: {
  cards: readonly ProductSuggestion[];
  lines: (key: string) => number;
}) {
  return (
    <ul className="flex max-w-[880px] flex-col gap-4">
      {cards.map((card) => (
        <li key={card.id} className="rounded-lg border bg-background p-4">
          <h3 tabIndex={-1} className="text-sm font-semibold break-words">
            {card.name}
          </h3>
          <ul className="mt-2 flex flex-col">
            {card.members.map((member) => {
              const key = memberKey(member);
              const loadedLines = lines(key);
              return (
                <li
                  key={key}
                  className="flex min-h-11 flex-col justify-center gap-0.5 py-1"
                >
                  <span className="text-sm break-words">{member.description}</span>
                  {loadedLines === 0 ? (
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-xs break-words text-muted-foreground">
                        {member.supplierName}
                      </span>
                      <Badge variant="outline">{es.products.noLines}</Badge>
                    </span>
                  ) : (
                    <span className="text-xs break-words text-muted-foreground">
                      {memberCaption(member.supplierName, loadedLines)}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ul>
  );
}

/**
 * Productos tab (D-01, D-02). The entry button builds the run from the free
 * descriptions of ALL loaded invoices (D-03, D-04) and opens the send dialog; only
 * confirming it starts the run, and the run lives in a store outside this panel.
 */
export function ProductsTab() {
  const captionId = useId();
  const entries = useLedger();
  const items = useMemo(() => collectItems(entries), [entries]);
  const linesByKey = useMemo(
    () => new Map(items.map((item) => [ruleMapKey(item.rfc, item.key), item.lines])),
    [items],
  );
  const queue = useSuggestionsStore((s) => s.products);
  const status = useLlmRunStore((s) => s.status);
  const startGroupRun = useLlmRunStore((s) => s.startGroupRun);
  const dismissResult = useLlmRunStore((s) => s.dismissResult);
  const free = useMemo(
    () => freeItems(items, pendingMemberKeys(queue)),
    [items, queue],
  );
  const [run, setRun] = useState<GroupRun | null>(null);
  const [open, setOpen] = useState(false);

  const running = status.phase === "running";
  // aria-disabled, never `disabled`: the press is ignored when nothing is free or a run is active.
  const blocked = free.length === 0 || running;
  const caption = running
    ? es.products.runActive
    : free.length === 0
      ? es.products.noneFree
      : freeDescriptionsCaption(free.length);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-xl leading-[1.2] font-semibold">{es.products.heading}</h2>
          <p className="text-xs text-muted-foreground">{es.products.intro1}</p>
          <p className="text-xs text-muted-foreground">{es.products.intro2}</p>
        </div>
        <div className="flex flex-col gap-1 max-md:w-full">
          <Button
            type="button"
            variant="outline"
            size="lg"
            aria-disabled={blocked}
            aria-describedby={captionId}
            className="max-sm:h-11 max-sm:w-full aria-disabled:opacity-50"
            onClick={() => {
              if (blocked) return;
              setRun(buildGroupRun(free, []));
              setOpen(true);
            }}
          >
            <Layers aria-hidden="true" />
            {es.products.groupButton}
          </Button>
          <p id={captionId} className="text-xs text-muted-foreground">
            {caption}
          </p>
        </div>
      </div>
      <div aria-live="polite" aria-atomic="true" className="empty:hidden">
        {status.phase === "running" ? (
          <p className="flex items-center gap-2 text-sm tabular-nums">
            <Spinner aria-hidden="true" role="presentation" />
            {runLine(status.kind, status.batch, status.total)}
          </p>
        ) : null}
      </div>
      {status.phase === "stopped" ? (
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
        </Alert>
      ) : null}
      {queue.length > 0 ? (
        <section className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-xl leading-[1.2] font-semibold">
              {productQueueHeading(queue.length)}
            </h2>
            <p className="text-xs text-muted-foreground">{es.products.queueIntro}</p>
          </div>
          <SuggestionCards cards={queue} lines={(key) => linesByKey.get(key) ?? 0} />
        </section>
      ) : null}
      {run === null ? null : (
        <SendDialog
          run={run}
          open={open}
          onOpenChange={setOpen}
          onConfirm={() => {
            setOpen(false);
            void startGroupRun(run);
          }}
        />
      )}
    </div>
  );
}
