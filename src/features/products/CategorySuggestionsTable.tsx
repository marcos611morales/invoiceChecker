"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { TruncatedText } from "@/components/TruncatedText";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { pruneCategoryRows, type CategorySuggestion } from "@/domain/llm/suggestions";
import { addCategory, orderedCategories } from "@/domain/settings/categories";
import { setSupplierCategory } from "@/domain/settings/assignments";
import { comparableName } from "@/domain/settings/schema";
import type { Category, Product, SettingsData } from "@/domain/settings/types";
import { es } from "@/lib/copy/es";
import {
  categoryAcceptErrorText,
  categoryAcceptedAnnouncement,
  categoryAcceptedToast,
  categoryCreatedToast,
  categoryRowsHeading,
  categorySelectAria,
  acceptSuggestionAria,
  moreMembersLabel,
  newCategoryLabel,
  rejectSuggestionAria,
  rejectedAnnouncement,
  type CategoryAcceptError,
} from "@/lib/copy/messages";
import { useSettingsStore } from "@/stores/settingsStore";
import { useSuggestionsStore } from "@/stores/suggestionsStore";

/**
 * Select values are encoded so that no category id can collide with the «Nueva: …» item: a
 * category is "category:" plus its id and the proposed new category is "new".
 */
const CATEGORY_PREFIX = "category:";
const NEW_VALUE = "new";

/** The «Deshacer» toast of a rejection stays six seconds, like the other ones of the tab. */
const UNDO_TOAST_MS = 6000;

/** Item text wraps even though the shared SelectItem keeps it on one line. */
const WRAPPING_TEXT = "whitespace-normal break-words";

/** What «Aceptar» will do with a row: reuse a category, or create one and use it. */
type AcceptPlan =
  | { ok: true; categoryId: string; createName: null }
  | { ok: true; categoryId: null; createName: string }
  | { ok: false; reason: CategoryAcceptError | "choose" };

/**
 * Decides, without writing anything, what accepting `row` would do against the settings as they
 * are (D-17, D-18). An existing choice must still be a category. A new name equal to a category
 * (ignoring case and edge spaces) uses that category; any other name goes through the same checks
 * as «Mis categorías» (empty, reserved «Sin categoría», too long, the 200 limit). The assignment is
 * tried on a draft too, so a refusal (the 5,000 suppliers limit) never leaves a category created
 * for nothing. A product that is gone cannot get one.
 */
function planAccept(settings: SettingsData, row: CategorySuggestion): AcceptPlan {
  const choice = row.choice;
  if (choice === null) return { ok: false, reason: "choose" };
  let draft = settings;
  let categoryId: string;
  let createName: string | null = null;
  if (choice.kind === "existing") {
    if (!settings.categories.some((category) => category.id === choice.categoryId)) {
      return { ok: false, reason: "choose" };
    }
    categoryId = choice.categoryId;
  } else {
    const wanted = comparableName(choice.name);
    const same = settings.categories.find((category) => comparableName(category.name) === wanted);
    if (same !== undefined) {
      categoryId = same.id;
    } else {
      const added = addCategory(settings, choice.name, "draft");
      if (!added.ok) return { ok: false, reason: added.reason };
      draft = added.next;
      categoryId = added.category.id;
      createName = added.category.name;
    }
  }
  if (row.kind === "supplier") {
    const assigned = setSupplierCategory(draft, row.rfc, row.name, categoryId);
    if (!assigned.ok) {
      return { ok: false, reason: assigned.reason === "limit" ? "supplier-limit" : "choose" };
    }
  } else if (!settings.products.some((product) => product.id === row.productId)) {
    return { ok: false, reason: "choose" };
  }
  return createName === null
    ? { ok: true, categoryId, createName: null }
    : { ok: true, categoryId: null, createName };
}

/** Name of a category by id, or null when it is not one of the user's. */
function categoryName(categories: readonly Category[], id: string): string | null {
  return categories.find((category) => category.id === id)?.name ?? null;
}

/** The Select value of a row: the proposed new category, an existing one, or none (placeholder). */
function selectValue(row: CategorySuggestion, categories: readonly Category[]): string | null {
  const choice = row.choice;
  if (choice === null) return null;
  if (choice.kind === "new") return NEW_VALUE;
  return categoryName(categories, choice.categoryId) === null
    ? null
    : `${CATEGORY_PREFIX}${choice.categoryId}`;
}

/** The first two member descriptions of an accepted product and how many more it has. */
function memberPreview(products: readonly Product[], productId: string): { text: string; more: number } {
  const product = products.find((candidate) => candidate.id === productId);
  if (product === undefined) return { text: "", more: 0 };
  const shown = product.members.slice(0, 2).map((member) => member.description);
  return { text: shown.join(" · "), more: Math.max(0, product.members.length - shown.length) };
}

export interface CategorySuggestionsTableProps {
  /** The pending category rows, in queue order. The caller does not render the table without rows. */
  rows: readonly CategorySuggestion[];
  /** Receives the polite message after a row leaves. */
  onAnnounce: (text: string) => void;
  /** Called, before the last row leaves, to put the focus on the tab heading (the section unmounts). */
  onEmptied: () => void;
}

/**
 * «Sugerencias de categoría» (D-17, D-18, D-23, E5): one row per supplier or product with a type
 * Badge, the name, a Select already set on the suggested category («Nueva: {nombre}» first when
 * DeepSeek proposed a new one; «Sin categoría» is not an option) and per-row «Aceptar» and
 * «Rechazar». Nothing reaches the settings until «Aceptar» (LLM-04): it writes the supplier's
 * default category with its RFC and name, or the product's category; a new category is created by
 * the first accepted row that uses it and reused by the later ones. A row whose target got a
 * category by other means is dropped, never applied (D-34, A-3). «Rechazar» offers «Deshacer».
 * Names and descriptions come from XML and DeepSeek and render as React text only.
 */
export function CategorySuggestionsTable({ rows, onAnnounce, onEmptied }: CategorySuggestionsTableProps) {
  const categories = useSettingsStore((s) => s.categories);
  const products = useSettingsStore((s) => s.products);
  const heading = useRef<HTMLHeadingElement>(null);
  const triggers = useRef(new Map<string, HTMLElement>());
  const [errors, setErrors] = useState<ReadonlyMap<string, string>>(new Map());
  const ordered = orderedCategories(categories);

  const setError = (id: string, text: string) => {
    setErrors((current) => new Map(current).set(id, text));
  };
  const clearError = (id: string) => {
    setErrors((current) => {
      if (!current.has(id)) return current;
      const rest = new Map(current);
      rest.delete(id);
      return rest;
    });
  };

  // Focus moves first: the button that was pressed is about to leave the page. It goes to the
  // Select of the next row, or to the heading when this was the last (the tab heading when no
  // row remains, because the section is not rendered without rows).
  const leave = (id: string) => {
    const index = rows.findIndex((candidate) => candidate.id === id);
    const next = rows[index + 1];
    const target = next === undefined ? undefined : triggers.current.get(next.id);
    if (target !== undefined) target.focus();
    else if (rows.length <= 1) onEmptied();
    else heading.current?.focus();
  };

  const accept = (id: string) => {
    const queue = useSuggestionsStore.getState();
    const row = queue.categories.find((candidate) => candidate.id === id);
    if (row === undefined) return;
    const current = useSettingsStore.getState();
    // A target that got a category by other means, or a product that is gone, leaves the table
    // without being applied: what the user chose is never overwritten (D-34, A-3).
    const pending = pruneCategoryRows(
      { products: queue.products, categories: queue.categories },
      current,
    );
    if (!pending.categories.some((candidate) => candidate.id === id)) {
      leave(id);
      queue.pruneCategories(current);
      return;
    }
    const plan = planAccept(current, row);
    if (!plan.ok) {
      // A row with no usable choice keeps «Aceptar» aria-disabled; nothing to say here.
      if (plan.reason !== "choose") setError(id, categoryAcceptErrorText(plan.reason));
      return;
    }
    let categoryId: string;
    let name: string | null;
    let created = false;
    if (plan.createName !== null) {
      const added = current.addCategory(plan.createName);
      if (!added.ok) {
        setError(id, categoryAcceptErrorText(added.reason));
        return;
      }
      categoryId = added.category.id;
      name = added.category.name;
      created = true;
    } else {
      categoryId = plan.categoryId;
      name = categoryName(current.categories, categoryId);
    }
    if (name === null) return;
    if (row.kind === "supplier") {
      const result = useSettingsStore.getState().setSupplierCategory(row.rfc, row.name, categoryId);
      if (!result.ok) return;
    } else {
      const result = useSettingsStore.getState().setProductCategory(row.productId, categoryId);
      if (!result.ok) return;
    }
    leave(id);
    clearError(id);
    queue.removeCategoryRow(id);
    toast(created ? categoryCreatedToast(name, row.name) : categoryAcceptedToast(row.name, name));
    onAnnounce(
      categoryAcceptedAnnouncement(row.name, useSuggestionsStore.getState().categories.length),
    );
  };

  const reject = (id: string) => {
    leave(id);
    const removed = useSuggestionsStore.getState().removeCategoryRow(id);
    if (removed === null) return;
    clearError(id);
    toast(es.products.categoryRejected, {
      duration: UNDO_TOAST_MS,
      action: {
        label: es.products.queue.undo,
        onClick: () => {
          useSuggestionsStore.getState().restoreCategoryRow(removed);
        },
      },
    });
    onAnnounce(rejectedAnnouncement(useSuggestionsStore.getState().categories.length));
  };

  const choose = (row: CategorySuggestion, value: string | null) => {
    if (value === null || !value.startsWith(CATEGORY_PREFIX)) return;
    useSuggestionsStore
      .getState()
      .setCategoryChoice(row.id, { kind: "existing", categoryId: value.slice(CATEGORY_PREFIX.length) });
    clearError(row.id);
  };

  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-lg border p-6">
      <div className="flex flex-col gap-1">
        <h2
          ref={heading}
          tabIndex={-1}
          className="text-xl leading-[1.2] font-semibold"
        >
          {categoryRowsHeading(rows.length)}
        </h2>
        <p className="text-xs text-muted-foreground">{es.products.categoryRowsIntro}</p>
      </div>
      <Table className="min-w-[760px]">
        <TableHeader>
          <TableRow className="bg-secondary hover:bg-secondary">
            <TableHead className="font-semibold">{es.products.categoryColumns.type}</TableHead>
            <TableHead className="font-semibold">{es.products.categoryColumns.name}</TableHead>
            <TableHead className="font-semibold">{es.products.categoryColumns.category}</TableHead>
            <TableHead className="w-[220px]">
              <span className="sr-only">{es.products.categoryColumns.actions}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const value = selectValue(row, categories);
            const items = [
              ...(row.choice !== null && row.choice.kind === "new"
                ? [{ value: NEW_VALUE, label: newCategoryLabel(row.choice.name) }]
                : []),
              ...ordered.map((category) => ({
                value: `${CATEGORY_PREFIX}${category.id}`,
                label: category.name,
              })),
            ];
            const preview = row.kind === "product" ? memberPreview(products, row.productId) : null;
            const error = errors.get(row.id);
            const errorId = `category-row-error-${row.id}`;
            return (
              <TableRow key={row.id} className="h-14 hover:bg-secondary">
                <TableCell>
                  <Badge variant="outline">
                    {row.kind === "supplier"
                      ? es.products.categoryTypeSupplier
                      : es.products.categoryTypeProduct}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-[280px]">
                  <TruncatedText text={row.name} />
                  {preview !== null && preview.text !== "" ? (
                    <p className="flex w-0 min-w-full gap-1 text-xs text-muted-foreground">
                      <TruncatedText text={preview.text} />
                      {preview.more > 0 ? (
                        <span className="shrink-0">{moreMembersLabel(preview.more)}</span>
                      ) : null}
                    </p>
                  ) : null}
                </TableCell>
                <TableCell>
                  <div className="flex min-w-0 flex-col gap-1">
                    <Select
                      items={items}
                      value={value}
                      onValueChange={(next) => {
                        choose(row, next);
                      }}
                    >
                      <SelectTrigger
                        ref={(element) => {
                          if (element === null) triggers.current.delete(row.id);
                          else triggers.current.set(row.id, element);
                        }}
                        aria-label={categorySelectAria(row.name)}
                        className="w-[240px] data-[size=default]:max-sm:h-11 max-sm:w-full"
                      >
                        <SelectValue placeholder={es.products.categoryChoose} />
                      </SelectTrigger>
                      <SelectContent alignItemWithTrigger={false}>
                        {items.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            <span className={WRAPPING_TEXT}>{item.label}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {error === undefined ? null : (
                      <p id={errorId} className="text-xs text-destructive">
                        {error}
                      </p>
                    )}
                  </div>
                </TableCell>
                <TableCell className="w-[220px]">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      aria-label={acceptSuggestionAria(row.name)}
                      aria-disabled={value === null}
                      aria-describedby={error === undefined ? undefined : errorId}
                      className="max-sm:h-11 aria-disabled:opacity-50"
                      onClick={() => {
                        if (value === null) return;
                        accept(row.id);
                      }}
                    >
                      {es.products.queue.accept}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="lg"
                      aria-label={rejectSuggestionAria(row.name)}
                      className="max-sm:h-11"
                      onClick={() => {
                        reject(row.id);
                      }}
                    >
                      {es.products.queue.reject}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </section>
  );
}
