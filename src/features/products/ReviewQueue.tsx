"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Ban, Merge, Split } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  filterCounts,
  filterQueue,
  orderQueue,
  stableOrder,
  type QueueFilter,
} from "@/domain/llm/queueView";
import {
  memberKey,
  type ProductSuggestion,
  type QueueUndo,
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
  bulkAcceptedToast,
  bulkRejectedToast,
  chooseMemberAria,
  memberCaption,
  memberCountCaption,
  membersAddedAnnouncement,
  membersAddedToast,
  mergeAria,
  mergedToast,
  noMatchText,
  productCreatedAnnouncement,
  productCreatedToast,
  rejectSuggestionAria,
  rejectedAnnouncement,
  rejectedToast,
  selectSuggestionAria,
  showMoreLabel,
  splitAria,
  splitToast,
  ungroupedToast,
} from "@/lib/copy/messages";
import { useSettingsStore } from "@/stores/settingsStore";
import { useSuggestionsStore } from "@/stores/suggestionsStore";
import { BulkAcceptDialog } from "./BulkAcceptDialog";
import { IconAction } from "./IconAction";
import { ProductPicker, type PickerGroup } from "./ProductPicker";
import { QueueToolbar } from "./QueueToolbar";

/** The undo toasts stay six seconds (UI-SPEC defaults). */
const TOAST_DURATION_MS = 6000;

/** Cards shown at first and added by each «Mostrar más» (UI-SPEC E4 overflow). */
const PAGE_SIZE = 50;

/** Prefixes of the ids in the «Unir con…» picker, so a pending card and a product can never be confused. */
const PICK_CARD = "card:";
const PICK_PRODUCT = "product:";

/** Alphabetical order of the accepted products in the picker, as in «Mover a…». */
const collator = new Intl.Collator("es", { sensitivity: "base" });

/** An error about the typed name belongs under the Input; the others belong under the buttons. */
function isNameError(reason: AcceptProductError): reason is ProductNameError {
  return (
    reason === "empty" || reason === "duplicate" || reason === "reserved" || reason === "too-long"
  );
}

/** A refusal of an «Agregar a» card is one of the four reasons of `addMembersToProduct`. */
function isAddReason(reason: AcceptProductError | "gone"): reason is AddMembersError {
  return (
    reason === "gone" || reason === "members-taken" || reason === "limit" || reason === "no-members"
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
 *
 * «Unir con…» (D-19) moves this card's members into another pending card (and removes this one)
 * or turns it into an «Agregar a» card for an accepted product; «Separar en producto nuevo»
 * moves the checked members of a card with several into a new card right below, with the focus
 * on its name. A card of a new product with several members has a checkbox per member that starts
 * unchecked; one with a single member has no checkbox, no count and no «Separar» (E4). Both
 * actions apply at once, change nothing in the settings and offer «Deshacer» for six seconds.
 *
 * Above the cards (D-20, UI-SPEC E4): a search, four filter toggles and a bulk bar. The list keeps
 * the order it had while a run adds cards (new ones go below the last one, `stableOrder`) and is
 * sorted again only when the filter, the search or the page changes. 50 cards show at first and
 * «Mostrar {n} más» adds 50. «Visibles» means every card that matches the filter and the search,
 * shown or not. Nothing is applied except by an explicit press: «Aceptar» and «Rechazar» on a card,
 * «Aceptar seleccionadas» and «Rechazar seleccionadas» on the cards the user ticked, or the
 * confirmation of «Aceptar todas las visibles», which states the exact count and whose cards are
 * the ones counted when it opened. A bulk accept follows the single-card rules card by card; a
 * refused card stays with its error, and an «Agregar a» card only adds the members still checked.
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
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<QueueFilter>("todas");
  // The order of the ids as the user has been seeing it; ids of cards that left stay in it so an
  // undo puts a card back where it was. Sorted again only by `resort`.
  const [frozen, setFrozen] = useState<readonly string[]>(() =>
    orderQueue(cards, lines).map((card) => card.id),
  );
  const [limit, setLimit] = useState(PAGE_SIZE);
  // Cards that must stay on the page beyond `limit` (the target of a join, a card split off).
  const [pinned, setPinned] = useState<ReadonlySet<string>>(new Set());
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  // The cards «Aceptar todas las visibles» will apply, fixed when the dialog opens (null: closed).
  const [bulkIds, setBulkIds] = useState<readonly string[] | null>(null);
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
  // Cards of a new product: the members the user checked to split them off (none to begin with,
  // so a member that arrives later is unchecked too).
  const [picked, setPicked] = useState<ReadonlyMap<string, ReadonlySet<string>>>(new Map());
  // The card whose name should take the focus once it is on the page (after a join or a split).
  const focusAfter = useRef<string | null>(null);
  const isChecked = (card: ProductSuggestion, key: string): boolean =>
    card.target !== null
      ? !(unchecked.get(card.id)?.has(key) ?? false)
      : (picked.get(card.id)?.has(key) ?? false);
  const toggleMember = (card: ProductSuggestion, key: string, checked: boolean) => {
    if (card.target !== null) {
      setUnchecked((current) => {
        const next = new Set(current.get(card.id) ?? []);
        if (checked) next.delete(key);
        else next.add(key);
        return new Map(current).set(card.id, next);
      });
      clearAddError(card.id);
      return;
    }
    setPicked((current) => {
      const next = new Set(current.get(card.id) ?? []);
      if (checked) next.add(key);
      else next.delete(key);
      return new Map(current).set(card.id, next);
    });
  };
  const checkedKeys = (card: ProductSuggestion): string[] =>
    card.members.map(memberKey).filter((key) => isChecked(card, key));
  // «Separar en producto nuevo» needs some members checked and some left (UI-SPEC line 414).
  const canSplit = (card: ProductSuggestion): boolean => {
    const checked = checkedKeys(card).length;
    return checked > 0 && checked < card.members.length;
  };

  // Focus goes to a card the user just joined or split off, after the render that shows it.
  useEffect(() => {
    const id = focusAfter.current;
    if (id === null) return;
    focusAfter.current = null;
    (nameInputs.current.get(id) ?? titles.current.get(id))?.focus();
  }, [cards]);
  // What the card is called to the user: the stored name of its target product, or its own name.
  const shownName = (card: ProductSuggestion): string => {
    if (card.target === null) return card.name;
    return products.find((product) => product.id === card.target)?.name ?? card.name;
  };

  // The list: the frozen order, the filter and the search. A card that landed since the order was
  // frozen goes below the last one (adjusting the state while rendering is how React keeps it in sync).
  const arranged = stableOrder(frozen, orderQueue(cards, lines));
  const knownIds = new Set(frozen);
  const landed = arranged.filter((card) => !knownIds.has(card.id));
  if (landed.length > 0) setFrozen([...frozen, ...landed.map((card) => card.id)]);
  const matching = filterQueue(arranged, filter, search, shownName);
  const onPage = matching.filter((card, index) => index < limit || pinned.has(card.id));
  const hiddenCount = matching.length - onPage.length;
  const selectedCards = matching.filter((card) => selected.has(card.id));

  // Sorts the whole queue again and starts from the first page; the selection keeps only the cards
  // that still match the new filter and search.
  const resort = (nextFilter: QueueFilter, nextSearch: string, nextLimit: number) => {
    setFrozen(orderQueue(cards, lines).map((card) => card.id));
    setLimit(nextLimit);
    setPinned(new Set());
    const keep = new Set(filterQueue(cards, nextFilter, nextSearch, shownName).map((card) => card.id));
    setSelected((current) => new Set([...current].filter((id) => keep.has(id))));
  };
  const changeFilter = (next: QueueFilter) => {
    setFilter(next);
    resort(next, search, PAGE_SIZE);
  };
  const changeSearch = (next: string) => {
    setSearch(next);
    resort(filter, next, PAGE_SIZE);
  };
  const showMore = () => {
    resort(filter, search, limit + PAGE_SIZE);
  };
  const toggleCard = (id: string, checked: boolean) => {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };
  const selectAll = (checked: boolean) => {
    setSelected(checked ? new Set(matching.map((card) => card.id)) : new Set());
  };
  const unselect = (ids: readonly string[]) => {
    const gone = new Set(ids);
    setSelected((current) => new Set([...current].filter((id) => !gone.has(id))));
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
    const index = onPage.findIndex((candidate) => candidate.id === id);
    const next = onPage[index + 1];
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
    const chosen = card.members.filter((member) => isChecked(card, memberKey(member)));
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

  // «Deshacer» of a join or a split (D-19): the cards come back exactly as they were.
  const showQueueUndo = (message: string, undo: QueueUndo) => {
    toast(message, {
      duration: TOAST_DURATION_MS,
      action: {
        label: es.products.queue.undo,
        onClick: () => {
          useSuggestionsStore.getState().undoQueueChange(undo);
        },
      },
    });
  };

  // «Unir con…» (D-19): the options of the picker are the other cards that propose a new product
  // and the accepted products. A card that has no name yet is listed by its first description.
  const mergeGroups = (card: ProductSuggestion): PickerGroup[] => [
    {
      heading: es.products.queue.otherSuggestions,
      options: cards
        .filter((other) => other.id !== card.id && other.target === null)
        .map((other) => ({
          id: `${PICK_CARD}${other.id}`,
          label: other.name.trim() === "" ? (other.members[0]?.description ?? "") : other.name,
          caption: memberCountCaption(other.members.length),
        })),
    },
    {
      heading: es.products.queue.ownProducts,
      options: [...products]
        .sort((a, b) => collator.compare(a.name, b.name))
        .map((product) => ({ id: `${PICK_PRODUCT}${product.id}`, label: product.name })),
    },
  ];

  // A pending pick moves this card's members into the other card and removes this one; a product
  // pick turns this card into an «Agregar a» card. Nothing reaches the settings until «Aceptar».
  const mergeWith = (card: ProductSuggestion, pick: string) => {
    // The typed name is stored first, so «Deshacer» brings the card back with it.
    commitName(card.id);
    const store = useSuggestionsStore.getState();
    if (pick.startsWith(PICK_CARD)) {
      const intoId = pick.slice(PICK_CARD.length);
      focusAfter.current = intoId;
      // The card that receives the members must be on the page for the focus to reach it.
      setPinned((current) => new Set(current).add(intoId));
      const undo = store.mergeSuggestions(card.id, intoId);
      if (undo === null) {
        focusAfter.current = null;
        return;
      }
      forget(card.id);
      showQueueUndo(mergedToast(), undo);
      return;
    }
    if (!pick.startsWith(PICK_PRODUCT)) return;
    const undo = store.turnIntoAddCard(card.id, pick.slice(PICK_PRODUCT.length));
    if (undo === null) return;
    forget(card.id);
    showQueueUndo(mergedToast(), undo);
  };

  // «Separar en producto nuevo» (D-19): the checked members leave for a new card right below.
  const splitOff = (card: ProductSuggestion) => {
    if (!canSplit(card)) return;
    commitName(card.id);
    const moved = new Set(checkedKeys(card));
    const undo = useSuggestionsStore.getState().splitSuggestion(card.id, [...moved]);
    if (undo === null || undo.createdId === null) return;
    const created = useSuggestionsStore
      .getState()
      .products.find((candidate) => candidate.id === undo.createdId);
    focusAfter.current = undo.createdId;
    // The new card goes right below its origin in the frozen order and stays on the page.
    const createdId = undo.createdId;
    setFrozen((current) => {
      const at = current.indexOf(card.id);
      if (at === -1) return current;
      const rest = current.filter((id) => id !== createdId);
      const origin = rest.indexOf(card.id);
      return [...rest.slice(0, origin + 1), createdId, ...rest.slice(origin + 1)];
    });
    setPinned((current) => new Set(current).add(createdId));
    // The members that left are no longer on this card: forget their ticks.
    setPicked((current) => {
      const ticks = current.get(card.id);
      if (ticks === undefined) return current;
      const rest = new Set([...ticks].filter((key) => !moved.has(key)));
      return new Map(current).set(card.id, rest);
    });
    clearAddError(card.id);
    showQueueUndo(splitToast(created?.name ?? ""), undo);
  };

  // Stores the names typed in the fields that are on the page, so a bulk action uses what is shown.
  const commitNames = (targets: readonly ProductSuggestion[]) => {
    for (const target of targets) {
      if (nameInputs.current.has(target.id)) commitName(target.id);
    }
  };

  // The queue section leaves the page with its last card: focus goes to the tab heading once the
  // pressed button (or the dialog that held it) is gone.
  const focusHeadingIfEmptied = () => {
    if (useSuggestionsStore.getState().products.length > 0) return;
    window.setTimeout(() => {
      focusHeading(true);
    }, 0);
  };

  // «Aceptar seleccionadas» and the confirmation of «Aceptar todas las visibles» (D-20, D-35). Each
  // card follows the rules of a single card, in the order given: a card of a new product takes all
  // its members, an «Agregar a» card only the members still checked. What was accepted leaves the
  // queue (an «Agregar a» card keeps the members left unchecked); a refused card stays with its error.
  const acceptCards = (targets: readonly ProductSuggestion[]) => {
    commitNames(targets);
    const queue = useSuggestionsStore.getState();
    const byId = new Map(queue.products.map((card) => [card.id, card]));
    const current = targets.flatMap((target) => {
      const card = byId.get(target.id);
      return card === undefined ? [] : [card];
    });
    const prepared = current.map((card) =>
      card.target === null
        ? card
        : { ...card, members: card.members.filter((member) => isChecked(card, memberKey(member))) },
    );
    const result = useSettingsStore.getState().acceptMany(prepared);
    const preparedById = new Map(prepared.map((card) => [card.id, card]));
    for (const refusal of result.refused) {
      const card = byId.get(refusal.id);
      if (card === undefined) continue;
      if (card.target === null) {
        if (refusal.reason !== "gone") setError(card.id, refusal.reason);
      } else if (isAddReason(refusal.reason)) {
        setAddError(card.id, refusal.reason);
      }
    }
    const whole: string[] = [];
    for (const id of result.acceptedIds) {
      const card = byId.get(id);
      const chosen = preparedById.get(id);
      if (card === undefined || chosen === undefined) continue;
      if (card.target === null || chosen.members.length === card.members.length) {
        whole.push(id);
        continue;
      }
      for (const member of chosen.members) {
        useSuggestionsStore.getState().dropMember(id, memberKey(member));
      }
      clearAddError(id);
    }
    useSuggestionsStore.getState().rejectMany(whole);
    for (const id of whole) forget(id);
    unselect(result.acceptedIds);
    focusHeadingIfEmptied();
    toast(bulkAcceptedToast(result.created, result.addedTo, result.refused.length));
  };

  // «Rechazar seleccionadas» (D-20, D-22): the cards leave at once and one «Deshacer» brings them all back.
  const rejectCards = (targets: readonly ProductSuggestion[]) => {
    commitNames(targets);
    const removed = useSuggestionsStore.getState().rejectMany(targets.map((card) => card.id));
    if (removed.length === 0) return;
    for (const entry of removed) forget(entry.card.id);
    unselect(removed.map((entry) => entry.card.id));
    focusHeadingIfEmptied();
    toast(bulkRejectedToast(removed.length), {
      duration: TOAST_DURATION_MS,
      action: {
        label: es.products.queue.undo,
        onClick: () => {
          useSuggestionsStore.getState().restoreMany(removed);
        },
      },
    });
  };

  // The cards the open dialog counted, in the order of the list, that are still pending.
  const bulkCards =
    bulkIds === null
      ? []
      : (() => {
          const wanted = new Set(bulkIds);
          return arranged.filter((card) => wanted.has(card.id));
        })();

  const onNameKeyDown = (id: string, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    commitName(id);
  };

  return (
    <div className="flex max-w-[880px] flex-col gap-4">
      <QueueToolbar
        search={search}
        onSearchChange={changeSearch}
        filter={filter}
        onFilterChange={changeFilter}
        counts={filterCounts(cards)}
        visibleCount={matching.length}
        selectedVisible={selectedCards.length}
        onSelectAll={selectAll}
        onAcceptSelected={() => {
          acceptCards(selectedCards);
        }}
        onRejectSelected={() => {
          rejectCards(selectedCards);
        }}
        onAcceptAll={() => {
          setBulkIds(matching.map((card) => card.id));
        }}
      />
      {matching.length === 0 ? (
        <p className="text-sm text-muted-foreground">{noMatchText(search)}</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {onPage.map((card) => {
            const addTo = card.target !== null;
            // E4 zero-one-many: a count and member checkboxes only where there is something to split.
            const several = card.members.length > 1;
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
                <div className="flex items-start gap-2">
                  <Checkbox
                    checked={selected.has(card.id)}
                    aria-label={selectSuggestionAria(shown)}
                    className="mt-2.5"
                    onCheckedChange={(checked) => {
                      toggleCard(card.id, checked);
                    }}
                  />
                  {addTo ? (
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
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
                      className="h-9 min-w-0 flex-1 text-sm font-semibold max-sm:h-11"
                    />
                  )}
                  {several ? (
                    <span className="shrink-0 pt-2 text-xs whitespace-nowrap text-muted-foreground">
                      {memberCountCaption(card.members.length)}
                    </span>
                  ) : null}
                </div>
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
                        {addTo || several ? (
                          <Checkbox
                            checked={isChecked(card, key)}
                            aria-label={chooseMemberAria(member.description)}
                            onCheckedChange={(checked) => {
                              toggleMember(card, key, checked);
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
                  {addTo ? null : (
                    <ProductPicker
                      groups={mergeGroups(card)}
                      onPick={(pick) => {
                        mergeWith(card, pick);
                      }}
                      trigger={
                        <Button
                          type="button"
                          variant="outline"
                          size="lg"
                          aria-label={mergeAria(shown)}
                          className="max-sm:h-11"
                        >
                          <Merge aria-hidden="true" />
                          {es.products.queue.merge}
                        </Button>
                      }
                    />
                  )}
                  {several ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      aria-label={splitAria(shown)}
                      aria-disabled={canSplit(card) ? undefined : true}
                      className="max-sm:h-11 aria-disabled:pointer-events-none aria-disabled:opacity-50"
                      onClick={() => {
                        splitOff(card);
                      }}
                    >
                      <Split aria-hidden="true" />
                      {es.products.queue.split}
                    </Button>
                  ) : null}
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
      )}
      {hiddenCount > 0 ? (
        <div>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="max-sm:h-11"
            onClick={showMore}
          >
            {showMoreLabel(Math.min(PAGE_SIZE, hiddenCount))}
          </Button>
        </div>
      ) : null}
      {bulkIds === null ? null : (
        <BulkAcceptDialog
          open
          onOpenChange={(next) => {
            if (!next) setBulkIds(null);
          }}
          created={bulkCards.filter((card) => card.target === null).length}
          addedTo={bulkCards.filter((card) => card.target !== null).length}
          onConfirm={() => {
            setBulkIds(null);
            acceptCards(bulkCards);
          }}
        />
      )}
    </div>
  );
}
