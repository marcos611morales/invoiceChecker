"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import { Ban } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  memberKey,
  type ProductSuggestion,
  type SuggestionMember,
} from "@/domain/llm/suggestions";
import {
  validateProductName,
  type AcceptProductError,
  type AddMembersError,
  type ProductNameError,
} from "@/domain/settings/products";
import { es } from "@/lib/copy/es";
import {
  acceptErrorText,
  acceptSuggestionAria,
  addMembersErrorText,
  addToCategoryCaption,
  addToTitle,
  chooseMemberAria,
  memberCaption,
  membersAddedAnnouncement,
  membersAddedToast,
  productCreatedAnnouncement,
  productCreatedToast,
  rejectSuggestionAria,
  rejectedAnnouncement,
  rejectedToast,
  ungroupedToast,
} from "@/lib/copy/messages";
import { useSettingsStore } from "@/stores/settingsStore";
import { useSuggestionsStore } from "@/stores/suggestionsStore";
import { IconAction } from "./IconAction";

/** The undo toasts stay six seconds (UI-SPEC defaults). */
const TOAST_DURATION_MS = 6000;

/** An error about the typed name belongs under the Input; the others belong under the buttons. */
function isNameError(reason: AcceptProductError): reason is ProductNameError {
  return (
    reason === "empty" || reason === "duplicate" || reason === "reserved" || reason === "too-long"
  );
}

/**
 * One card per proposed product (D-11, D-12, D-19). Names and descriptions are vendor
 * text: they are only ever rendered as React text (RESEARCH Pitfall 7). The name is an
 * editable Input (60 characters at most): Enter or leaving the field stores it in the pending
 * queue, so it survives a reload (D-12, D-24). `lines(key)` is the count of loaded lines of a
 * member; 0 means none of its invoices is loaded.
 *
 * «Aceptar» is the only place where a card reaches the settings as a product (LLM-04): a
 * refusal keeps the card and explains itself, under the Input when it is about the name and
 * under the buttons otherwise. «Rechazar» and the Ban button of a member apply at once and
 * offer «Deshacer» for six seconds (D-22). The announcement and the final focus target live in
 * the parent, because this component is unmounted when the queue empties: `onAnnounce`
 * receives the polite message and `focusHeading(queueEmpty)` is called before the card is
 * removed, while every element that can receive focus still exists.
 *
 * A card with a `target` is an «Agregar a «X»» card (D-21): the title names the accepted product
 * instead of an editable name, only the new members are listed, each with a checkbox that
 * starts checked, and «Aceptar» adds the checked ones to that product without touching its
 * other members or its category. The unchecked ones stay in the card.
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
  // What the user is typing, until Enter or blur stores it in the queue.
  const [drafts, setDrafts] = useState<ReadonlyMap<string, string>>(new Map());
  const nameInputs = useRef(new Map<string, HTMLInputElement>());
  // The title of an «Agregar a» card is its focus target, as the name Input is for the others.
  const titles = useRef(new Map<string, HTMLElement>());
  // «Agregar a» cards: the members the user unchecked (all start checked, so a member that
  // arrives later is checked too) and the refusal shown under the buttons.
  const [unchecked, setUnchecked] = useState<ReadonlyMap<string, ReadonlySet<string>>>(new Map());
  const [addErrors, setAddErrors] = useState<ReadonlyMap<string, AddMembersError>>(new Map());
  const products = useSettingsStore((s) => s.products);
  const categories = useSettingsStore((s) => s.categories);

  const setAddError = (id: string, reason: AddMembersError) => {
    setAddErrors((current) =>
      current.get(id) === reason ? current : new Map(current).set(id, reason),
    );
  };
  // A product that is gone stays gone: toggling a checkbox cannot fix that, only «Rechazar» does.
  const clearAddError = (id: string) => {
    setAddErrors((current) => {
      const existing = current.get(id);
      if (existing === undefined || existing === "gone") return current;
      const rest = new Map(current);
      rest.delete(id);
      return rest;
    });
  };
  const isChecked = (cardId: string, key: string): boolean =>
    !(unchecked.get(cardId)?.has(key) ?? false);
  const toggleMember = (cardId: string, key: string, checked: boolean) => {
    setUnchecked((current) => {
      const next = new Set(current.get(cardId) ?? []);
      if (checked) next.delete(key);
      else next.add(key);
      return new Map(current).set(cardId, next);
    });
    clearAddError(cardId);
  };
  // What the card is called to the user: the stored name of its target product, or its own name.
  const shownName = (card: ProductSuggestion): string => {
    if (card.target === null) return card.name;
    return products.find((product) => product.id === card.target)?.name ?? card.name;
  };

  const setError = (id: string, reason: AcceptProductError) => {
    setErrors((current) => (current.get(id) === reason ? current : new Map(current).set(id, reason)));
  };
  const clearError = (id: string, onlyName: boolean) => {
    setErrors((current) => {
      const existing = current.get(id);
      if (existing === undefined || (onlyName && !isNameError(existing))) return current;
      const rest = new Map(current);
      rest.delete(id);
      return rest;
    });
  };
  const clearDraft = (id: string) => {
    setDrafts((current) => {
      if (!current.has(id)) return current;
      const rest = new Map(current);
      rest.delete(id);
      return rest;
    });
  };

  // Stores what is in the field (the DOM is what the user sees, so there is no stale draft) and
  // checks it against the accepted products. Returns nothing: the card in the store is the truth.
  const commitName = (id: string) => {
    const input = nameInputs.current.get(id);
    if (input === undefined) return;
    useSuggestionsStore.getState().renameSuggestion(id, input.value);
    clearDraft(id);
    const stored = useSuggestionsStore.getState().products.find((card) => card.id === id);
    if (stored === undefined) return;
    const checked = validateProductName(useSettingsStore.getState(), stored.name, null);
    if (checked.ok) clearError(id, true);
    else setError(id, checked.reason);
  };

  // Focus moves first: the button that was pressed is about to leave the page. It goes to the
  // name of the next card, or to the queue heading when this was the last one.
  const leave = (id: string) => {
    const index = cards.findIndex((candidate) => candidate.id === id);
    const next = cards[index + 1];
    const nextFocus =
      next === undefined
        ? undefined
        : (nameInputs.current.get(next.id) ?? titles.current.get(next.id));
    if (nextFocus !== undefined) nextFocus.focus();
    else focusHeading(cards.length <= 1);
  };

  const forget = (id: string) => {
    clearError(id, false);
    clearDraft(id);
    setAddErrors((current) => {
      if (!current.has(id)) return current;
      const rest = new Map(current);
      rest.delete(id);
      return rest;
    });
  };

  // «Aceptar» on an «Agregar a» card (D-21): the checked members join the product and leave the
  // card; the unchecked ones stay. A refusal keeps the card whole and explains itself.
  const acceptAddTo = (id: string) => {
    const card = useSuggestionsStore.getState().products.find((candidate) => candidate.id === id);
    if (card === undefined || card.target === null) return;
    const chosen = card.members.filter((member) => isChecked(card.id, memberKey(member)));
    const result = useSettingsStore.getState().addMembersToProduct(card.target, chosen);
    if (!result.ok) {
      setAddError(card.id, result.reason);
      return;
    }
    clearAddError(card.id);
    const whole = chosen.length === card.members.length;
    if (whole) leave(card.id);
    for (const member of chosen) {
      useSuggestionsStore.getState().dropMember(card.id, memberKey(member));
    }
    if (whole) forget(card.id);
    const name = shownName(card);
    toast(membersAddedToast(result.added, name));
    onAnnounce(
      membersAddedAnnouncement(
        result.added,
        name,
        useSuggestionsStore.getState().products.length,
      ),
    );
  };

  const accept = (id: string) => {
    commitName(id);
    const card = useSuggestionsStore.getState().products.find((candidate) => candidate.id === id);
    if (card === undefined) return;
    if (card.target !== null) {
      acceptAddTo(id);
      return;
    }
    const result = useSettingsStore
      .getState()
      .acceptProduct({ name: card.name, members: card.members });
    if (!result.ok) {
      setError(card.id, result.reason);
      return;
    }
    leave(card.id);
    useSuggestionsStore.getState().removeProduct(card.id);
    forget(card.id);
    // The stored name is the trimmed one the reducer kept.
    toast(productCreatedToast(result.product.name));
    onAnnounce(
      productCreatedAnnouncement(
        result.product.name,
        useSuggestionsStore.getState().products.length,
      ),
    );
  };

  const reject = (id: string) => {
    commitName(id);
    leave(id);
    const removed = useSuggestionsStore.getState().rejectSuggestion(id);
    if (removed === null) return;
    forget(id);
    toast(rejectedToast(shownName(removed.card)), {
      duration: TOAST_DURATION_MS,
      action: {
        label: es.products.queue.undo,
        onClick: () => {
          useSuggestionsStore.getState().restoreSuggestion(removed);
        },
      },
    });
    onAnnounce(rejectedAnnouncement(useSuggestionsStore.getState().products.length));
  };

  // «No agrupar esta descripción» (D-22): the mark is stored first, then the member leaves the
  // card (the card goes with its only member). Both halves are undone together.
  const ungroup = (card: ProductSuggestion, member: SuggestionMember) => {
    const key = memberKey(member);
    const marked = useSettingsStore.getState().markUngrouped({
      rfc: member.rfc,
      key: member.key,
      description: member.description,
      supplierName: member.supplierName,
    });
    if (!marked.ok) {
      if (marked.reason === "limit") toast(es.products.queue.ungroupLimit);
      // The description already belongs to an accepted product: it cannot be marked.
      else if (card.target === null) setError(card.id, "members-taken");
      else setAddError(card.id, "members-taken");
      return;
    }
    const only = card.members.length === 1;
    if (only) leave(card.id);
    else (nameInputs.current.get(card.id) ?? titles.current.get(card.id))?.focus();
    const dropped = useSuggestionsStore.getState().dropMember(card.id, key);
    if (dropped === null) {
      useSettingsStore.getState().unmarkUngrouped(key);
      return;
    }
    if (only) forget(card.id);
    toast(ungroupedToast(member.description), {
      duration: TOAST_DURATION_MS,
      action: {
        label: es.products.queue.undo,
        onClick: () => {
          useSettingsStore.getState().unmarkUngrouped(key);
          useSuggestionsStore.getState().restoreMember(dropped);
        },
      },
    });
  };

  const onNameKeyDown = (id: string, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    commitName(id);
  };

  return (
    <ul className="flex max-w-[880px] flex-col gap-4">
      {cards.map((card) => {
        const addTo = card.target !== null;
        const target = addTo ? products.find((product) => product.id === card.target) : undefined;
        const error = addTo ? undefined : errors.get(card.id);
        const nameError = error !== undefined && isNameError(error);
        const addError = addTo ? addErrors.get(card.id) : undefined;
        const errorId = `${baseId}-error-${card.id}`;
        const shown = shownName(card);
        // Under the buttons: the refusal of «Aceptar», for either kind of card. A name error
        // belongs under the Input instead.
        const footerError =
          addError !== undefined
            ? addMembersErrorText(addError)
            : error !== undefined && !nameError
              ? acceptErrorText(error)
              : undefined;
        const categoryName =
          target === undefined || target.categoryId === null
            ? null
            : (categories.find((category) => category.id === target.categoryId)?.name ?? null);
        return (
          <li key={card.id} className="rounded-lg border bg-background p-4">
            {addTo ? (
              <div className="flex flex-col gap-0.5">
                <h3
                  ref={(element) => {
                    if (element === null) titles.current.delete(card.id);
                    else titles.current.set(card.id, element);
                  }}
                  tabIndex={-1}
                  className="text-sm font-semibold break-words"
                >
                  {addToTitle(shown)}
                </h3>
                {target === undefined ? null : (
                  <p className="text-xs text-muted-foreground">
                    {addToCategoryCaption(categoryName)}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">{es.products.queue.addToNote}</p>
              </div>
            ) : (
              <Input
                ref={(element) => {
                  if (element === null) nameInputs.current.delete(card.id);
                  else nameInputs.current.set(card.id, element);
                }}
                value={drafts.get(card.id) ?? card.name}
                maxLength={60}
                aria-label={es.products.queue.nameAria}
                aria-invalid={nameError ? true : undefined}
                aria-describedby={nameError ? errorId : undefined}
                onChange={(event) => {
                  const value = event.target.value;
                  setDrafts((current) => new Map(current).set(card.id, value));
                  // Typing clears the error about the name; the others stay until they are fixed.
                  clearError(card.id, true);
                }}
                onKeyDown={(event) => {
                  onNameKeyDown(card.id, event);
                }}
                onBlur={() => {
                  commitName(card.id);
                }}
                className="h-9 text-sm font-semibold max-sm:h-11"
              />
            )}
            {nameError ? (
              <p id={errorId} className="mt-1 text-xs break-words text-foreground">
                {acceptErrorText(error)}
              </p>
            ) : null}
            <ul className="mt-2 flex flex-col">
              {card.members.map((member, memberIndex) => {
                const key = memberKey(member);
                const loadedLines = lines(key);
                const descriptionId = `${baseId}-member-${card.id}-${String(memberIndex)}`;
                return (
                  <li key={key} className="flex min-h-11 items-center gap-2 py-1">
                    {addTo ? (
                      <Checkbox
                        checked={isChecked(card.id, key)}
                        aria-label={chooseMemberAria(member.description)}
                        onCheckedChange={(checked) => {
                          toggleMember(card.id, key, checked);
                        }}
                      />
                    ) : null}
                    <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
                      <span id={descriptionId} className="text-sm break-words">
                        {member.description}
                      </span>
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
                    </div>
                    <IconAction
                      label={es.products.queue.ungroup}
                      describedBy={descriptionId}
                      onClick={() => {
                        ungroup(card, member);
                      }}
                    >
                      <Ban aria-hidden="true" />
                    </IconAction>
                  </li>
                );
              })}
            </ul>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="lg"
                aria-label={acceptSuggestionAria(shown)}
                aria-describedby={nameError || footerError !== undefined ? errorId : undefined}
                className="max-sm:h-11"
                onClick={() => {
                  accept(card.id);
                }}
              >
                {es.products.queue.accept}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="lg"
                aria-label={rejectSuggestionAria(shown)}
                className="max-sm:h-11"
                onClick={() => {
                  reject(card.id);
                }}
              >
                {es.products.queue.reject}
              </Button>
            </div>
            {footerError === undefined ? null : (
              <p id={errorId} className="mt-2 text-xs break-words text-foreground">
                {footerError}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
