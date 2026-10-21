"use client";

import { useRef } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ruleMapKey } from "@/domain/settings/normalize";
import { es } from "@/lib/copy/es";
import { ungroupedTrigger, unmarkAria } from "@/lib/copy/messages";
import { useSettingsStore } from "@/stores/settingsStore";

/**
 * Descriptions marked «No agrupar» (D-22, UI-SPEC lines 322-327, 436-438): a Collapsible closed
 * by default under «Mis productos», rendered only while there is at least one mark. Each row
 * shows the description (it wraps in full) and its supplier, and «Quitar marca» takes the mark
 * away so the next «Agrupar productos» sends the description again. Removing a mark shows no
 * toast; `onAnnounce` receives the polite sentence instead. Descriptions come from XML text and
 * are only ever rendered as React text (RESEARCH Pitfall 7).
 *
 * The row that was pressed is about to leave the page, so focus moves first, to the button of
 * the row that takes its place (or the one before it); with the last mark gone this component
 * unmounts and `onEmptied` places the focus.
 */
export function UngroupedList({
  onAnnounce,
  onEmptied,
}: {
  onAnnounce: (message: string) => void;
  onEmptied: () => void;
}) {
  const marks = useSettingsStore((s) => s.ungroupedConcepts);
  const buttons = useRef(new Map<string, HTMLButtonElement>());

  if (marks.length === 0) return null;

  const remove = (key: string) => {
    const index = marks.findIndex((mark) => ruleMapKey(mark.rfc, mark.key) === key);
    const neighbour = marks[index + 1] ?? marks[index - 1];
    if (neighbour === undefined) onEmptied();
    else buttons.current.get(ruleMapKey(neighbour.rfc, neighbour.key))?.focus();
    if (useSettingsStore.getState().unmarkUngrouped(key) !== null) {
      onAnnounce(es.products.ungrouped.removedAnnouncement);
    }
  };

  return (
    <Collapsible>
      <CollapsibleTrigger
        render={<Button variant="outline" className="h-auto min-h-9 whitespace-normal max-sm:min-h-11" />}
      >
        {ungroupedTrigger(marks.length)}
        <ChevronDown className="size-4" aria-hidden="true" />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2">
        <p className="pb-2 text-xs text-muted-foreground">{es.products.ungrouped.intro}</p>
        <ScrollArea className="max-h-72 rounded-lg border [&_[data-slot=scroll-area-viewport]]:max-h-72">
          <ul className="flex flex-col">
            {marks.map((mark) => {
              const key = ruleMapKey(mark.rfc, mark.key);
              return (
                <li
                  key={key}
                  className="flex min-h-11 items-center gap-2 border-b px-3 py-2 last:border-b-0"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-sm break-words">{mark.description}</span>
                    <span className="text-xs break-words text-muted-foreground">
                      {mark.supplierName}
                    </span>
                  </div>
                  <Button
                    ref={(element) => {
                      if (element === null) buttons.current.delete(key);
                      else buttons.current.set(key, element);
                    }}
                    type="button"
                    variant="ghost"
                    aria-label={unmarkAria(mark.description)}
                    className="shrink-0 max-sm:h-11"
                    onClick={() => {
                      remove(key);
                    }}
                  >
                    {es.products.ungrouped.remove}
                  </Button>
                </li>
              );
            })}
          </ul>
        </ScrollArea>
      </CollapsibleContent>
    </Collapsible>
  );
}
