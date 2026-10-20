"use client";

import { Badge } from "@/components/ui/badge";
import { memberKey, type ProductSuggestion } from "@/domain/llm/suggestions";
import { es } from "@/lib/copy/es";
import { memberCaption } from "@/lib/copy/messages";

/**
 * One card per proposed product (D-11, D-12, D-19). Names and descriptions are vendor
 * text: they are only ever rendered as React text (RESEARCH Pitfall 7). The name is a
 * focusable heading (`tabIndex` -1) so later plans can move focus to it. `lines(key)` is
 * the count of loaded lines of a member; 0 means none of its invoices is loaded.
 */
export function ReviewQueue({
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
