"use client";

import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { memberKey, type ProductSuggestion } from "@/domain/llm/suggestions";
import type { AcceptProductError } from "@/domain/settings/products";
import { es } from "@/lib/copy/es";
import {
  acceptErrorText,
  acceptSuggestionAria,
  memberCaption,
  productCreatedAnnouncement,
  productCreatedToast,
} from "@/lib/copy/messages";
import { useSettingsStore } from "@/stores/settingsStore";
import { useSuggestionsStore } from "@/stores/suggestionsStore";

/**
 * One card per proposed product (D-11, D-12, D-19). Names and descriptions are vendor
 * text: they are only ever rendered as React text (RESEARCH Pitfall 7). The name is a
 * focusable heading (`tabIndex` -1) that receives focus after an accept. `lines(key)` is
 * the count of loaded lines of a member; 0 means none of its invoices is loaded.
 *
 * «Aceptar» is the only place where a card reaches the settings (LLM-04): a refusal keeps
 * the card and explains itself under the buttons. The announcement and the final focus
 * target live in the parent, because this component is unmounted when the queue empties:
 * `onAnnounce` receives the polite message and `focusHeading(queueEmpty)` is called before
 * the card is removed, while every element that can receive focus still exists.
 */
export function ReviewQueue({
  cards,
  lines,
  onAnnounce,
  focusHeading,
}: {
  cards: readonly ProductSuggestion[];
  lines: (key: string) => number;
  onAnnounce: (message: string) => void;
  focusHeading: (queueEmpty: boolean) => void;
}) {
  const baseId = useId();
  const [errors, setErrors] = useState<ReadonlyMap<string, AcceptProductError>>(new Map());
  const nameHeadings = useRef(new Map<string, HTMLHeadingElement>());

  const accept = (card: ProductSuggestion) => {
    const result = useSettingsStore
      .getState()
      .acceptProduct({ name: card.name, members: card.members });
    if (!result.ok) {
      setErrors((current) => new Map(current).set(card.id, result.reason));
      return;
    }
    const index = cards.findIndex((candidate) => candidate.id === card.id);
    const next = cards[index + 1];
    // Focus moves first: the accepted card's button is about to leave the page.
    const nextHeading = next === undefined ? undefined : nameHeadings.current.get(next.id);
    if (nextHeading !== undefined) nextHeading.focus();
    else focusHeading(cards.length <= 1);
    useSuggestionsStore.getState().removeProduct(card.id);
    setErrors((current) => {
      if (!current.has(card.id)) return current;
      const rest = new Map(current);
      rest.delete(card.id);
      return rest;
    });
    // The stored name is the trimmed one the reducer kept.
    toast(productCreatedToast(result.product.name));
    onAnnounce(
      productCreatedAnnouncement(
        result.product.name,
        useSuggestionsStore.getState().products.length,
      ),
    );
  };

  return (
    <ul className="flex max-w-[880px] flex-col gap-4">
      {cards.map((card) => {
        const error = errors.get(card.id);
        const errorId = `${baseId}-error-${card.id}`;
        return (
          <li key={card.id} className="rounded-lg border bg-background p-4">
            <h3
              tabIndex={-1}
              ref={(element) => {
                if (element === null) nameHeadings.current.delete(card.id);
                else nameHeadings.current.set(card.id, element);
              }}
              className="text-sm font-semibold break-words"
            >
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
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="lg"
                aria-label={acceptSuggestionAria(card.name)}
                aria-describedby={error === undefined ? undefined : errorId}
                className="max-sm:h-11"
                onClick={() => {
                  accept(card);
                }}
              >
                {es.products.queue.accept}
              </Button>
            </div>
            {error === undefined ? null : (
              <p id={errorId} className="mt-2 text-xs break-words text-foreground">
                {acceptErrorText(error)}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
