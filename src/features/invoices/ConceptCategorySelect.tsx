"use client";

import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CategorySource } from "@/domain/settings/resolver";
import { SIN_CATEGORIA, type Category } from "@/domain/settings/types";
import { es } from "@/lib/copy/es";
import { conceptCategoryAria } from "@/lib/copy/messages";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/stores/settingsStore";

/**
 * Select values are encoded so that no category id can collide with the action
 * value: a category is "category:" plus its id, «Sin categoría» is "none".
 */
const CATEGORY_PREFIX = "category:";
const NONE_VALUE = "none";

/** Item text wraps even though the shared SelectItem keeps it on one line. */
const WRAPPING_TEXT = "whitespace-normal break-words";

export interface ConceptCategorySelectProps {
  /** RFC of the supplier of the invoice: half of the key of the rule (D-09). */
  rfc: string;
  /** Supplier name; Plan 03-05 shows it in the «Aplica a {n} líneas de {proveedor}» caption. */
  supplierName: string;
  /** Original description of the line: stored readable next to the rule and used in the aria-label. */
  descripcion: string;
  /** Normalized description; Plan 03-05 uses it to count the equal lines and to remove the rule. */
  ruleKey: string;
  /** Category the line resolves to, or the reserved «Sin categoría» key. */
  category: string;
  /** Where that category came from: a rule of the line, the supplier, or nothing. */
  source: CategorySource;
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
  descripcion,
  category,
  source,
  categories,
  nameOf,
}: ConceptCategorySelectProps) {
  const setConceptRule = useSettingsStore((s) => s.setConceptRule);
  const adjusted = source === "regla";

  const onChange = (value: string | null) => {
    if (value === null) return;
    const next = decodeCategory(value);
    if (next === undefined) return;
    const result = setConceptRule(rfc, descripcion, next);
    if (!result.ok && result.reason === "limit") toast(es.invoices.conceptLimit);
  };

  return (
    <Select value={adjusted ? encodeCategory(category) : null} onValueChange={onChange}>
      <SelectTrigger
        aria-label={conceptCategoryAria(descripcion)}
        className="max-w-full min-w-[240px] data-[size=default]:max-sm:h-11"
      >
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
        </SelectValue>
      </SelectTrigger>
      <SelectContent
        alignItemWithTrigger={false}
        className="max-h-[min(18rem,var(--available-height))]"
      >
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
      </SelectContent>
    </Select>
  );
}
