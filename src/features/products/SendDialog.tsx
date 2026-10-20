"use client";

import { useRef } from "react";
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
import type { GroupRun } from "@/domain/llm/candidates";
import { es } from "@/lib/copy/es";
import { groupSendSummary, itemsGroupHeading } from "@/lib/copy/messages";

/**
 * Privacy dialog shown before every send (D-08, LLM-06). The rows are rendered from
 * `batch.body.items`, the very objects the browser client serializes, never from a
 * separately built list (RESEARCH Pattern 4): what the user reads is what travels.
 * Descriptions and supplier names are vendor text and only ever rendered as React
 * text. «No enviar» has the initial focus, so Enter never sends by accident.
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
  const dismissRef = useRef<HTMLButtonElement>(null);
  const sent = run.batches.reduce((sum, batch) => sum + batch.body.items.length, 0);
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        initialFocus={dismissRef}
        className="grid-rows-[auto_minmax(0,1fr)_auto] max-h-[calc(100vh-2rem)] data-[size=default]:sm:max-w-[560px]"
      >
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl leading-[1.2] font-semibold">
            {es.products.dialog.title}
          </AlertDialogTitle>
          <AlertDialogDescription>{groupSendSummary(sent, run.suppliers)}</AlertDialogDescription>
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
              </ScrollArea>
            </CollapsibleContent>
          </Collapsible>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel ref={dismissRef} className="max-sm:h-11">
            {es.products.dialog.dismiss}
          </AlertDialogCancel>
          <AlertDialogAction className="max-sm:h-11" onClick={onConfirm}>
            {es.products.dialog.confirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
