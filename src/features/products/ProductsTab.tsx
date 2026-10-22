"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Info, Layers, Tags } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import {
  buildCategorizeRun,
  buildGroupRun,
  collectCategorizeTargets,
  collectItems,
  freeItems,
  withheldItems,
  withheldTargets,
  type CategorizeRun,
  type GroupRun,
} from "@/domain/llm/candidates";
import { pendingMemberKeys } from "@/domain/llm/suggestions";
import { ruleMapKey } from "@/domain/settings/normalize";
import { productMemberKeys, ungroupedKeys } from "@/domain/settings/products";
import { useLedger } from "@/features/dashboard/useLedger";
import { es } from "@/lib/copy/es";
import {
  categorizeCaption,
  freeDescriptionsCaption,
  productQueueHeading,
} from "@/lib/copy/messages";
import { useLlmRunStore } from "@/stores/llmRunStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useStorageStatusStore, useSuggestionsStatusStore } from "@/stores/storageStatusStore";
import { useSuggestionsStore } from "@/stores/suggestionsStore";
import { CategorySuggestionsTable } from "./CategorySuggestionsTable";
import { PRODUCTS_QUEUE_HEADING_ID, PRODUCTS_TITLE_ID } from "./focusTargets";
import { ProductList } from "./ProductList";
import { ReviewQueue } from "./ReviewQueue";
import { RunProgress } from "./RunProgress";
import { RunResult } from "./RunResult";
import { CategorizeSendDialog, SendDialog } from "./SendDialog";
import { UngroupedList } from "./UngroupedList";

/**
 * Productos tab (D-01, D-02). Each entry button builds its run from everything that is still
 * free (D-03, D-04) and opens its send dialog; only confirming it starts the run, and the run
 * lives in a store outside this panel. The two buttons share one run slot.
 */
export function ProductsTab() {
  const captionId = useId();
  const categorizeCaptionId = useId();
  const entries = useLedger();
  const items = useMemo(() => collectItems(entries), [entries]);
  const linesByKey = useMemo(
    () => new Map(items.map((item) => [ruleMapKey(item.rfc, item.key), item.lines])),
    [items],
  );
  const queue = useSuggestionsStore((s) => s.products);
  const status = useLlmRunStore((s) => s.status);
  const startGroupRun = useLlmRunStore((s) => s.startGroupRun);
  const startCategorizeRun = useLlmRunStore((s) => s.startCategorizeRun);
  const categoryRows = useSuggestionsStore((s) => s.categories);
  const pruneCategories = useSuggestionsStore((s) => s.pruneCategories);
  const products = useSettingsStore((s) => s.products);
  const categories = useSettingsStore((s) => s.categories);
  const supplierCategories = useSettingsStore((s) => s.supplierCategories);
  const marks = useSettingsStore((s) => s.ungroupedConcepts);
  // The two storage conditions that make this tab's data volatile (Q8): the settings and the
  // pending queue each have their own status.
  const settingsWriteFailed = useStorageStatusStore((s) => s.writeFailed);
  const queueWriteFailed = useSuggestionsStatusStore((s) => s.writeFailed);
  // A description is taken when it waits in a card, already belongs to an accepted product or is
  // marked «No agrupar» (D-04, D-13, D-22, D-25): taken descriptions leave the caption count and
  // are never sent again.
  const free = useMemo(
    () =>
      freeItems(
        items,
        new Set([
          ...pendingMemberKeys(queue),
          ...productMemberKeys({ products }),
          ...ungroupedKeys({ ungroupedConcepts: marks }),
        ]),
      ),
    [items, queue, products, marks],
  );
  // Suppliers without a default category and accepted products without category, minus the ones
  // that already wait in a category row (D-07, A-2): the caption counts them, the run sends them.
  const targets = useMemo(
    () =>
      collectCategorizeTargets(
        entries,
        { categories, supplierCategories, products },
        { products: queue, categories: categoryRows },
      ),
    [entries, categories, supplierCategories, products, queue, categoryRows],
  );
  // What the sensitive-pattern guard keeps in the browser is not counted as something to send
  // (UI-SPEC OQ7): the captions and the buttons count only what would travel.
  const sendableTargets = useMemo(() => {
    const kept = new Set(withheldTargets(targets));
    return targets.filter((target) => !kept.has(target));
  }, [targets]);
  const sendableFree = useMemo(
    () => free.length - withheldItems(free).length,
    [free],
  );
  const targetCount = useMemo(
    () => ({
      suppliers: sendableTargets.filter((target) => target.kind === "supplier").length,
      products: sendableTargets.filter((target) => target.kind === "product").length,
    }),
    [sendableTargets],
  );
  // A row whose supplier or product got a category by other means (in Categorías, in the product
  // list), or whose product was deleted, leaves the table without being applied (D-07, D-18, A-3).
  // Nothing to drop writes nothing, so this settles after one pass.
  useEffect(() => {
    pruneCategories({ categories, supplierCategories, products });
  }, [pruneCategories, categories, supplierCategories, products, categoryRows]);
  const [run, setRun] = useState<GroupRun | null>(null);
  const [open, setOpen] = useState(false);
  const [categorizeRun, setCategorizeRun] = useState<CategorizeRun | null>(null);
  const [categorizeOpen, setCategorizeOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const titleHeading = useRef<HTMLHeadingElement>(null);
  const queueHeading = useRef<HTMLHeadingElement>(null);
  // After an accept: the queue heading while cards remain, else the tab heading (the queue
  // section is not rendered when empty, UI-SPEC layout order).
  const focusHeading = useCallback((queueEmpty: boolean) => {
    (queueEmpty ? titleHeading.current : queueHeading.current)?.focus();
  }, []);

  // One run slot: the entry button is inert while a run is in flight or being stopped.
  const running = status.phase === "running" || status.phase === "cancelling";
  // aria-disabled, never `disabled`: the press is ignored when nothing can be sent or a run is active.
  const blocked = sendableFree === 0 || running;
  // The entry button and «Reintentar» do the same thing: build the run from what is still free
  // and open the send dialog first, so nothing is sent without the user's confirmation. The
  // names of the accepted products go as context on every request (D-04, D-33); the names of the
  // cards still pending from earlier runs never do, so `queue` is not passed.
  const openGroupDialog = () => {
    if (blocked) return;
    setRun(
      buildGroupRun(
        free,
        products.map((product) => ({ productId: product.id, name: product.name })),
      ),
    );
    setOpen(true);
  };
  const caption = running
    ? es.products.runActive
    : sendableFree === 0
      ? es.products.noneFree
      : freeDescriptionsCaption(sendableFree);
  const categorizeBlocked = sendableTargets.length === 0 || running;
  // Same as the grouping button: build the run from what is still without a category and open
  // the send dialog first. «Reintentar» after a categorize run calls this too.
  const openCategorizeDialog = () => {
    if (categorizeBlocked) return;
    setCategorizeRun(buildCategorizeRun(targets, categories));
    setCategorizeOpen(true);
  };
  const categorizeCaptionText = running
    ? es.products.runActive
    : categorizeCaption(targetCount.suppliers, targetCount.products);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h2
            ref={titleHeading}
            id={PRODUCTS_TITLE_ID}
            tabIndex={-1}
            className="text-xl leading-[1.2] font-semibold"
          >
            {es.products.heading}
          </h2>
          <p className="text-xs text-muted-foreground">{es.products.intro1}</p>
          <p className="text-xs text-muted-foreground">{es.products.intro2}</p>
        </div>
        <div className="flex flex-wrap items-start gap-4 max-md:w-full max-sm:flex-col">
          <div className="flex flex-col gap-1 max-sm:w-full">
            <Button
              type="button"
              variant="outline"
              size="lg"
              aria-disabled={blocked}
              aria-describedby={captionId}
              className="max-sm:h-11 max-sm:w-full aria-disabled:opacity-50"
              onClick={openGroupDialog}
            >
              <Layers aria-hidden="true" />
              {es.products.groupButton}
            </Button>
            <p id={captionId} className="text-xs text-muted-foreground">
              {caption}
            </p>
          </div>
          <div className="flex flex-col gap-1 max-sm:w-full">
            <Button
              type="button"
              variant="outline"
              size="lg"
              aria-disabled={categorizeBlocked}
              aria-describedby={categorizeCaptionId}
              className="max-sm:h-11 max-sm:w-full aria-disabled:opacity-50"
              onClick={openCategorizeDialog}
            >
              <Tags aria-hidden="true" />
              {es.products.categorizeButton}
            </Button>
            <p id={categorizeCaptionId} className="text-xs text-muted-foreground">
              {categorizeCaptionText}
            </p>
          </div>
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
      <RunResult
        onRetry={(kind) => {
          if (kind === "categorize") openCategorizeDialog();
          else openGroupDialog();
        }}
      />
      <RunProgress />
      {products.length === 0 &&
      queue.length === 0 &&
      categoryRows.length === 0 &&
      marks.length === 0 ? (
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
              id={PRODUCTS_QUEUE_HEADING_ID}
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
      {categoryRows.length > 0 ? (
        <CategorySuggestionsTable
          rows={categoryRows}
          onAnnounce={setAnnouncement}
          onEmptied={() => {
            // The section unmounts with its last row: focus goes to the tab heading.
            titleHeading.current?.focus();
          }}
        />
      ) : null}
      {products.length > 0 ? (
        <ProductList
          onEmptied={() => {
            // The list unmounts with its last product: focus goes to the tab heading.
            titleHeading.current?.focus();
          }}
        />
      ) : null}
      {marks.length > 0 ? (
        <UngroupedList
          onAnnounce={setAnnouncement}
          onEmptied={() => {
            // The section unmounts with its last mark: focus goes to the tab heading.
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
      {categorizeRun === null ? null : (
        <CategorizeSendDialog
          run={categorizeRun}
          open={categorizeOpen}
          onOpenChange={setCategorizeOpen}
          onConfirm={() => {
            setCategorizeOpen(false);
            void startCategorizeRun(categorizeRun);
          }}
        />
      )}
    </div>
  );
}
