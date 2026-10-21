"use client";

import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { TruncatedText } from "@/components/TruncatedText";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { CategorySource } from "@/domain/settings/resolver";
import { SIN_CATEGORIA, type Category } from "@/domain/settings/types";
import { es } from "@/lib/copy/es";
import {
  appliesToLinesText,
  categoryChangedToast,
  conceptCategoryAria,
  conceptCategoryProductAria,
} from "@/lib/copy/messages";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/stores/settingsStore";

/**
 * Select values are encoded so that no category id can collide with an action
 * value: a category is "category:" plus its id, «Sin categoría» is "none" and
 * «Quitar ajuste» is "remove".
 */
const CATEGORY_PREFIX = "category:";
const NONE_VALUE = "none";
const REMOVE_VALUE = "remove";

/** The change toast stays six seconds, like the other toasts with «Deshacer» (D-29, UI-SPEC Q5). */
const UNDO_TOAST_MS = 6000;

/** Item text wraps even though the shared SelectItem keeps it on one line. */
const WRAPPING_TEXT = "whitespace-normal break-words";

export interface ConceptCategorySelectProps {
  /** RFC of the supplier of the invoice: half of the key of the rule (D-09). */
  rfc: string;
  /** Supplier name, shown after «Aplica a {n} líneas de» under an adjusted line (D-09). */
  supplierName: string;
  /** Original description of the line: stored readable next to the rule and used in the aria-label. */
  descripcion: string;
  /** Normalized description: the key to remove or restore the rule of this line. */
  ruleKey: string;
  /** Loaded lines of this supplier whose description normalizes to `ruleKey` (D-09). */
  lineCount: number;
  /** Category the line resolves to, or the reserved «Sin categoría» key. */
  category: string;
  /** Where that category came from: a rule of the line, its product, the supplier, or nothing. */
  source: CategorySource;
  /** Name of the product that gives the category; only read when `source` is "producto" (D-16). */
  productName: string | null;
  /** The user's categories in list order (`orderedCategories`). */
  categories: readonly Category[];
  /** Name of a category key for display. */
  nameOf: (key: string) => string;
}

function encodeCategory(category: string): string {
  return category === SIN_CATEGORIA ? NONE_VALUE : `${CATEGORY_PREFIX}${category}`;
}

/** Category id, null for «Sin categoría», or undefined for a value this component never offers. */
function decodeCategory(value: string): string | null | undefined {
  if (value === NONE_VALUE) return null;
  if (value.startsWith(CATEGORY_PREFIX)) return value.slice(CATEGORY_PREFIX.length);
  return undefined;
}

/**
 * Category selector of one concept line in the expanded invoice row (CAT-03, D-11).
 * Choosing an item stores a rule for the supplier RFC plus the normalized
 * description (D-09): it applies at once to every equal line of that supplier and
 * to invoices loaded later, and the other lines of the invoice keep their category.
 * «Sin categoría» is an explicit adjustment that beats the supplier's category
 * (UI-SPEC Q4), and choosing the supplier's own category still stores a rule.
 * Every change shows a toast with «Deshacer» that puts back exactly the previous
 * rule, or removes the one the change created (UI-SPEC Q5, T-03-36). An adjusted line
 * also shows how many loaded lines its rule reaches and ends the popup with
 * «Quitar ajuste» after a separator (D-09).
 *
 * A line whose category comes from its product (D-16) reads «{categoría} · del producto
 * {nombre}»: the product name is capped at 120px inside the trigger, and the full name is
 * in the accessible name, in a Tooltip (merged into the Select trigger through its render
 * prop, so no button nests inside the trigger) and as the first, non-selectable line of the
 * open popup, which is how a touch screen, where a tap opens the Select, reaches it. The
 * adjusted logic does not change: only a concept rule is an adjustment, so picking a
 * category stores a rule that beats the product and «Quitar ajuste» gives the line back to it.
 *
 * The Select value is null unless the line has a rule of its own, so picking any
 * item, including the one the supplier already gives, fires a change. The trigger
 * content is rendered directly rather than looked up from the items: muted for a
 * supplier-derived or implicit value, foreground for an adjusted one, with the
 * «· del proveedor» suffix kept visible when the name truncates. Descriptions and
 * names come from XML and settings and render as React text only (T-03-09).
 */
export function ConceptCategorySelect({
  rfc,
  supplierName,
  descripcion,
  ruleKey,
  lineCount,
  category,
  source,
  productName,
  categories,
  nameOf,
}: ConceptCategorySelectProps) {
  const setConceptRule = useSettingsStore((s) => s.setConceptRule);
  const removeConceptRule = useSettingsStore((s) => s.removeConceptRule);
  const restoreConceptRule = useSettingsStore((s) => s.restoreConceptRule);
  const adjusted = source === "regla";
  const product = source === "producto" ? productName : null;

  const onChange = (value: string | null) => {
    if (value === null) return;
    if (value === REMOVE_VALUE) {
      if (removeConceptRule(rfc, ruleKey) !== null) toast(es.invoices.adjustmentRemoved);
      return;
    }
    const next = decodeCategory(value);
    if (next === undefined) return;
    const result = setConceptRule(rfc, descripcion, next);
    if (!result.ok) {
      if (result.reason === "limit") toast(es.invoices.conceptLimit);
      return;
    }
    const { previous } = result;
    toast(categoryChangedToast(descripcion, nameOf(next === null ? SIN_CATEGORIA : next)), {
      duration: UNDO_TOAST_MS,
      action: {
        label: es.categories.undo,
        onClick: () => {
          restoreConceptRule(rfc, ruleKey, previous);
        },
      },
    });
  };

  const triggerClass = "max-w-full min-w-[240px] data-[size=default]:max-sm:h-11";
  const value = (
    <SelectValue className="min-w-0">
      <span className={cn("min-w-0 truncate", adjusted ? "text-foreground" : "text-muted-foreground")}>
        {nameOf(category)}
      </span>
      {source === "proveedor" ? (
        <>
          {" "}
          <span className="shrink-0 text-xs text-muted-foreground">
            {es.invoices.fromSupplier}
          </span>
        </>
      ) : null}
      {product !== null ? (
        <>
          {" "}
          <span className="shrink-0 text-xs text-muted-foreground">{es.invoices.fromProduct}</span>{" "}
          <span className="max-w-[120px] min-w-0 truncate text-xs text-muted-foreground">
            {product}
          </span>
        </>
      ) : null}
    </SelectValue>
  );

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <Select value={adjusted ? encodeCategory(category) : null} onValueChange={onChange}>
        {product === null ? (
          <SelectTrigger aria-label={conceptCategoryAria(descripcion)} className={triggerClass}>
            {value}
          </SelectTrigger>
        ) : (
          <Tooltip>
            <TooltipTrigger
              render={
                <SelectTrigger
                  aria-label={conceptCategoryProductAria(descripcion, nameOf(category), product)}
                  className={triggerClass}
                />
              }
            >
              {value}
            </TooltipTrigger>
            <TooltipContent className="break-words">{product}</TooltipContent>
          </Tooltip>
        )}
        <SelectContent
          alignItemWithTrigger={false}
          className="max-h-[min(18rem,var(--available-height))]"
        >
          {product !== null ? (
            <p
              data-slot="concept-product-origin"
              className="px-2 py-1.5 text-xs break-words text-muted-foreground select-none"
            >
              {`${es.invoices.productOrigin} ${product}`}
            </p>
          ) : null}
          <SelectItem value={NONE_VALUE} className="min-h-9 max-sm:min-h-11">
            <span className={cn(WRAPPING_TEXT, "text-muted-foreground")}>{es.categories.none}</span>
          </SelectItem>
          {categories.map((item) => (
            <SelectItem
              key={item.id}
              value={`${CATEGORY_PREFIX}${item.id}`}
              className="min-h-9 max-sm:min-h-11"
            >
              <span className={WRAPPING_TEXT}>{item.name}</span>
            </SelectItem>
          ))}
          {adjusted ? (
            <>
              <SelectSeparator />
              <SelectItem value={REMOVE_VALUE} className="min-h-9 max-sm:min-h-11">
                <span className={cn(WRAPPING_TEXT, "flex items-center gap-2")}>
                  <RotateCcw aria-hidden="true" className="size-4 shrink-0" />
                  {es.invoices.removeAdjustment}
                </span>
              </SelectItem>
            </>
          ) : null}
        </SelectContent>
      </Select>
      {adjusted ? (
        /* w-0 min-w-full: the caption takes the width of the selector and never widens it,
           so a long supplier name truncates instead of stretching the cell. */
        <p
          data-slot="concept-reach"
          className="flex w-0 min-w-full gap-1 text-xs text-muted-foreground"
        >
          <span className="shrink-0">{appliesToLinesText(lineCount)}</span>{" "}
          <TruncatedText text={supplierName} />
        </p>
      ) : null}
    </div>
  );
}
