"use client";

import { useRef, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { CategorizeRun, GroupRun } from "@/domain/llm/candidates";
import { es } from "@/lib/copy/es";
import {
  batchesLine,
  categoriesGroupHeading,
  categorizeSendSummary,
  contextGroupHeading,
  contextNamesLine,
  groupSendSummary,
  itemsGroupHeading,
  productsGroupHeading,
  suppliersGroupHeading,
} from "@/lib/copy/messages";
import { RUN_STOP_SELECTOR } from "./focusTargets";

/**
 * The names of the accepted products that travel as context, once each, in the order they are
 * sent. They are read from the same `body.existing` objects the client serializes (LLM-06).
 */
function contextNamesOf(run: GroupRun): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const batch of run.batches) {
    for (const product of batch.body.existing) {
      if (seen.has(product.name)) continue;
      seen.add(product.name);
      names.push(product.name);
    }
  }
  return names;
}

/**
 * The names of the user's categories, once each, in the order they are sent: every batch carries
 * the same list, read from the `body.categories` objects the client serializes (LLM-06).
 */
function categoryNamesOf(run: CategorizeRun): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const batch of run.batches) {
    for (const category of batch.body.categories) {
      if (seen.has(category.name)) continue;
      seen.add(category.name);
      names.push(category.name);
    }
  }
  return names;
}

interface ShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  /** The summary sentence under the title. */
  summary: string;
  /** Extra muted lines between the summary and the people line. */
  lines: ReactNode;
  /** The groups of the disclosure, each a `<section>`, rendered from the bodies that are sent. */
  groups: ReactNode;
}

/**
 * The frame both send dialogs share (D-08, LLM-06). «No enviar» has the initial focus, so Enter
 * never sends by accident. Descriptions, supplier names and product names are vendor or user text
 * and only ever rendered as React text.
 */
function SendDialogShell({ open, onOpenChange, onConfirm, summary, lines, groups }: ShellProps) {
  const dismissRef = useRef<HTMLButtonElement>(null);
  // Set by the confirm button: once the run is started, closing the dialog hands focus to the
  // run card's stop button instead of the entry button (UI-SPEC send flow, step 3).
  const confirmed = useRef(false);
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        initialFocus={dismissRef}
        finalFocus={() => {
          if (!confirmed.current) return true;
          confirmed.current = false;
          // The default (the entry button) when the card is not there.
          return document.querySelector<HTMLElement>(RUN_STOP_SELECTOR) ?? true;
        }}
        className="grid-rows-[auto_minmax(0,1fr)_auto] max-h-[calc(100vh-2rem)] data-[size=default]:sm:max-w-[560px]"
      >
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl leading-[1.2] font-semibold">
            {es.products.dialog.title}
          </AlertDialogTitle>
          <AlertDialogDescription>{summary}</AlertDialogDescription>
          {lines}
          <p className="text-sm text-muted-foreground">{es.products.dialog.peopleLine}</p>
        </AlertDialogHeader>
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto">
          <Collapsible>
            <CollapsibleTrigger
              render={<Button variant="outline" className="h-9 max-sm:h-11" />}
            >
              {es.products.dialog.disclosure}
              <ChevronDown className="size-4" aria-hidden="true" />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <ScrollArea className="max-h-72 rounded-lg border [&_[data-slot=scroll-area-viewport]]:max-h-72">
                {groups}
              </ScrollArea>
            </CollapsibleContent>
          </Collapsible>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel ref={dismissRef} className="max-sm:h-11">
            {es.products.dialog.dismiss}
          </AlertDialogCancel>
          <AlertDialogAction
            className="max-sm:h-11"
            onClick={() => {
              confirmed.current = true;
              onConfirm();
            }}
          >
            {es.products.dialog.confirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Privacy dialog shown before every «Agrupar productos» send (D-08, LLM-06). The rows are
 * rendered from `batch.body.items` and `batch.body.existing`, the very objects the browser client
 * serializes, never from a separately built list (RESEARCH Pattern 4): what the user reads is
 * what travels.
 */
export function SendDialog({
  run,
  open,
  onOpenChange,
  onConfirm,
}: {
  run: GroupRun;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  const sent = run.batches.reduce((sum, batch) => sum + batch.body.items.length, 0);
  const context = contextNamesOf(run);
  return (
    <SendDialogShell
      open={open}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
      summary={groupSendSummary(sent, run.suppliers)}
      lines={
        <>
          {context.length > 0 ? (
            <p className="text-sm text-muted-foreground">{contextNamesLine(context.length)}</p>
          ) : null}
          {run.batches.length > 1 ? (
            <>
              <p className="text-sm text-muted-foreground">{batchesLine(run.batches.length)}</p>
              <p className="text-sm text-muted-foreground">{es.products.dialog.earlierNamesLine}</p>
            </>
          ) : null}
        </>
      }
      groups={
        <>
          {sent > 0 ? (
            <section className="flex flex-col">
              <h3 className="px-3 pt-2 text-sm font-semibold">{itemsGroupHeading(sent)}</h3>
              <ul className="flex flex-col">
                {run.batches.map((batch, batchIndex) =>
                  batch.body.items.map((item) => (
                    <li
                      key={`${String(batchIndex)}-${item.id}`}
                      className="flex flex-col gap-0.5 border-b px-3 py-2 last:border-b-0"
                    >
                      <span className="text-sm break-words">{item.description}</span>
                      <span className="text-xs break-words text-muted-foreground">
                        {item.supplier}
                      </span>
                    </li>
                  )),
                )}
              </ul>
            </section>
          ) : null}
          {context.length > 0 ? (
            <section className="flex flex-col">
              <h3 className="px-3 pt-2 text-sm font-semibold">
                {contextGroupHeading(context.length)}
              </h3>
              <ul className="flex flex-col">
                {context.map((name) => (
                  <li key={name} className="border-b px-3 py-2 last:border-b-0">
                    <span className="text-sm break-words">{name}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      }
    />
  );
}

/**
 * Privacy dialog of «Sugerir categorías» (D-07, D-08, LLM-06). Everything it counts and lists is
 * read from `batch.body.suppliers`, `batch.body.products` and `batch.body.categories`, the very
 * objects the client serializes: the supplier names, each product with the descriptions of its
 * members beneath it, and the user's category names (once; they travel on every batch).
 */
export function CategorizeSendDialog({
  run,
  open,
  onOpenChange,
  onConfirm,
}: {
  run: CategorizeRun;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  const suppliers = run.batches.flatMap((batch, index) =>
    batch.body.suppliers.map((supplier) => ({
      key: `${String(index)}-${supplier.id}`,
      name: supplier.name,
    })),
  );
  const products = run.batches.flatMap((batch, index) =>
    batch.body.products.map((product) => ({
      key: `${String(index)}-${product.id}`,
      name: product.name,
      members: product.members,
    })),
  );
  const members = products.reduce((sum, product) => sum + product.members.length, 0);
  const categories = categoryNamesOf(run);
  return (
    <SendDialogShell
      open={open}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
      summary={categorizeSendSummary(suppliers.length, products.length, members, categories.length)}
      lines={
        run.batches.length > 1 ? (
          <p className="text-sm text-muted-foreground">{batchesLine(run.batches.length)}</p>
        ) : null
      }
      groups={
        <>
          {suppliers.length > 0 ? (
            <section className="flex flex-col">
              <h3 className="px-3 pt-2 text-sm font-semibold">
                {suppliersGroupHeading(suppliers.length)}
              </h3>
              <ul className="flex flex-col">
                {suppliers.map((supplier) => (
                  <li key={supplier.key} className="border-b px-3 py-2 last:border-b-0">
                    <span className="text-sm break-words">{supplier.name}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {products.length > 0 ? (
            <section className="flex flex-col">
              <h3 className="px-3 pt-2 text-sm font-semibold">
                {productsGroupHeading(products.length)}
              </h3>
              <ul className="flex flex-col">
                {products.map((product) => (
                  <li
                    key={product.key}
                    className="flex flex-col gap-0.5 border-b px-3 py-2 last:border-b-0"
                  >
                    <span className="text-sm break-words">{product.name}</span>
                    {product.members.map((member, index) => (
                      <span
                        key={`${String(index)}-${member}`}
                        className="text-xs break-words text-muted-foreground"
                      >
                        {member}
                      </span>
                    ))}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {categories.length > 0 ? (
            <section className="flex flex-col">
              <h3 className="px-3 pt-2 text-sm font-semibold">
                {categoriesGroupHeading(categories.length)}
              </h3>
              <ul className="flex flex-col">
                {categories.map((name) => (
                  <li key={name} className="border-b px-3 py-2 last:border-b-0">
                    <span className="text-sm break-words">{name}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      }
    />
  );
}
