"use client";

import { useMemo, useState } from "react";
import { Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { useLedger } from "@/features/dashboard/useLedger";
import { es } from "@/lib/copy/es";
import { useLlmRunStore } from "@/stores/llmRunStore";
import { useSuggestionsStore } from "@/stores/suggestionsStore";
import { SendDialog } from "./SendDialog";

/**
 * One card per proposed product (D-11, D-12, D-19). Names and descriptions are vendor
 * text: they are only ever rendered as React text (RESEARCH Pitfall 7). The name is a
 * focusable heading (`tabIndex` -1) so later plans can move focus to it.
 */
function SuggestionCards({ cards }: { cards: readonly ProductSuggestion[] }) {
  return (
    <ul className="flex max-w-[880px] flex-col gap-4">
      {cards.map((card) => (
        <li key={card.id} className="rounded-lg border bg-background p-4">
          <h3 tabIndex={-1} className="text-sm font-semibold break-words">
            {card.name}
          </h3>
          <ul className="mt-2 flex flex-col">
            {card.members.map((member) => (
              <li
                key={memberKey(member)}
                className="flex min-h-11 flex-col justify-center gap-0.5 py-1"
              >
                <span className="text-sm break-words">{member.description}</span>
                <span className="text-xs break-words text-muted-foreground">
                  {member.supplierName}
                </span>
              </li>
            ))}
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
  const entries = useLedger();
  const items = useMemo(() => collectItems(entries), [entries]);
  const queue = useSuggestionsStore((s) => s.products);
  const status = useLlmRunStore((s) => s.status);
  const startGroupRun = useLlmRunStore((s) => s.startGroupRun);
  const free = useMemo(
    () => freeItems(items, pendingMemberKeys(queue)),
    [items, queue],
  );
  const [run, setRun] = useState<GroupRun | null>(null);
  const [open, setOpen] = useState(false);

  // aria-disabled, never `disabled`: the press is ignored when nothing is free or a run is active.
  const blocked = free.length === 0 || status.phase === "running";

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
        </div>
      </div>
      {queue.length > 0 ? <SuggestionCards cards={queue} /> : null}
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
