"use client";

import { useCallback, useId, useMemo, useRef, useState } from "react";
import { CircleAlert, Info, Layers, X } from "lucide-react";
import { Alert, AlertAction, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import {
  buildGroupRun,
  collectItems,
  freeItems,
  type GroupRun,
} from "@/domain/llm/candidates";
import { pendingMemberKeys } from "@/domain/llm/suggestions";
import { ruleMapKey } from "@/domain/settings/normalize";
import { productMemberKeys } from "@/domain/settings/products";
import { useLedger } from "@/features/dashboard/useLedger";
import { es } from "@/lib/copy/es";
import {
  failureText,
  freeDescriptionsCaption,
  productQueueHeading,
  runLine,
  stoppedText,
} from "@/lib/copy/messages";
import { useLlmRunStore } from "@/stores/llmRunStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useStorageStatusStore, useSuggestionsStatusStore } from "@/stores/storageStatusStore";
import { useSuggestionsStore } from "@/stores/suggestionsStore";
import { ProductList } from "./ProductList";
import { ReviewQueue } from "./ReviewQueue";
import { SendDialog } from "./SendDialog";

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
  const products = useSettingsStore((s) => s.products);
  const marks = useSettingsStore((s) => s.ungroupedConcepts);
  // The two storage conditions that make this tab's data volatile (Q8): the settings and the
  // pending queue each have their own status.
  const settingsWriteFailed = useStorageStatusStore((s) => s.writeFailed);
  const queueWriteFailed = useSuggestionsStatusStore((s) => s.writeFailed);
  // A description is taken when it waits in a card or already belongs to an accepted product
  // (D-04, D-13): taken descriptions leave the caption count and are never sent again.
  const free = useMemo(
    () => freeItems(items, new Set([...pendingMemberKeys(queue), ...productMemberKeys({ products })])),
    [items, queue, products],
  );
  const [run, setRun] = useState<GroupRun | null>(null);
  const [open, setOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const titleHeading = useRef<HTMLHeadingElement>(null);
  const queueHeading = useRef<HTMLHeadingElement>(null);
  // After an accept: the queue heading while cards remain, else the tab heading (the queue
  // section is not rendered when empty, UI-SPEC layout order).
  const focusHeading = useCallback((queueEmpty: boolean) => {
    (queueEmpty ? titleHeading.current : queueHeading.current)?.focus();
  }, []);

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
          <h2 ref={titleHeading} tabIndex={-1} className="text-xl leading-[1.2] font-semibold">
            {es.products.heading}
          </h2>
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
      {/* Not dismissible: each stays until a later write succeeds (Q8). */}
      {settingsWriteFailed ? (
        <Alert>
          <Info aria-hidden="true" className="text-muted-foreground" />
          <AlertDescription className="text-foreground">
            {es.categories.writeFailedAlert}
          </AlertDescription>
        </Alert>
      ) : null}
      {queueWriteFailed ? (
        <Alert>
          <Info aria-hidden="true" className="text-muted-foreground" />
          <AlertDescription className="text-foreground">
            {es.products.queueWriteFailedAlert}
          </AlertDescription>
        </Alert>
      ) : null}
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
      {products.length === 0 && queue.length === 0 && marks.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle className="text-base">{es.products.list.emptyHeading}</EmptyTitle>
            <EmptyDescription>{es.products.list.emptyBody}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}
      {queue.length > 0 ? (
        <section className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2
              ref={queueHeading}
              tabIndex={-1}
              className="text-xl leading-[1.2] font-semibold"
            >
              {productQueueHeading(queue.length)}
            </h2>
            <p className="text-xs text-muted-foreground">{es.products.queueIntro}</p>
          </div>
          <ReviewQueue
            cards={queue}
            lines={(key) => linesByKey.get(key) ?? 0}
            onAnnounce={setAnnouncement}
            focusHeading={focusHeading}
          />
        </section>
      ) : null}
      {products.length > 0 ? (
        <ProductList
          onEmptied={() => {
            // The list unmounts with its last product: focus goes to the tab heading.
            titleHeading.current?.focus();
          }}
        />
      ) : null}
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
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
