"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { QueueFilter } from "@/domain/llm/queueView";
import { es } from "@/lib/copy/es";
import { filterToggleLabel, selectedCount } from "@/lib/copy/messages";

/** The four filters in the order of the toggles (UI-SPEC line 245). */
const FILTERS: readonly QueueFilter[] = ["todas", "varios", "deUno", "paraAgregar"];

function isQueueFilter(value: string): value is QueueFilter {
  return FILTERS.some((filter) => filter === value);
}

/**
 * Search, filter toggles and bulk bar of the product queue (D-20, UI-SPEC lines 403-406). It only
 * shows what it is given and reports what the user did: it holds no state of its own and applies
 * nothing, so every change to the queue or to the settings happens in the parent, on an explicit
 * press.
 *
 * - The search `Input` has a visible-to-screen-readers label (sr-only) and a placeholder.
 * - The `ToggleGroup` is single-choice. Base UI hands the group an array and pressing the pressed
 *   item yields an empty one, so an array without a valid filter is ignored and the group can never
 *   end up with no selection (as in the IVA toggle).
 * - «Seleccionar visibles» is a checkbox that is checked when every visible card is selected, mixed
 *   when only some are and unchecked otherwise. Base UI renders the mixed state as
 *   `aria-checked="mixed"` on the checkbox, which is what assistive technology reads.
 * - «Aceptar seleccionadas» and «Rechazar seleccionadas» are `aria-disabled` (still focusable) with
 *   nothing selected, and «Aceptar todas las visibles» is `aria-disabled` with nothing visible;
 *   their handlers are not called then.
 */
export function QueueToolbar({
  search,
  onSearchChange,
  filter,
  onFilterChange,
  counts,
  visibleCount,
  selectedVisible,
  onSelectAll,
  onAcceptSelected,
  onRejectSelected,
  onAcceptAll,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  filter: QueueFilter;
  onFilterChange: (filter: QueueFilter) => void;
  counts: Record<QueueFilter, number>;
  /** Cards that match the filter and the search, shown or not. */
  visibleCount: number;
  /** How many of those are selected. */
  selectedVisible: number;
  onSelectAll: (checked: boolean) => void;
  onAcceptSelected: () => void;
  onRejectSelected: () => void;
  onAcceptAll: () => void;
}) {
  const allSelected = visibleCount > 0 && selectedVisible === visibleCount;
  const someSelected = selectedVisible > 0 && !allSelected;
  const nothingSelected = selectedVisible === 0;
  const nothingVisible = visibleCount === 0;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-80 max-sm:w-full">
          <Label htmlFor="queue-search" className="sr-only">
            {es.products.queue.searchLabel}
          </Label>
          <Input
            id="queue-search"
            type="search"
            value={search}
            placeholder={es.products.queue.searchPlaceholder}
            autoComplete="off"
            className="h-9 max-sm:h-11"
            onChange={(event) => {
              onSearchChange(event.target.value);
            }}
          />
        </div>
        <ToggleGroup
          aria-label={es.products.queue.filterGroupLabel}
          variant="outline"
          spacing={1}
          value={[filter]}
          className="max-sm:flex-wrap"
          onValueChange={(groupValue) => {
            const next = groupValue.find(isQueueFilter);
            if (next !== undefined) onFilterChange(next);
          }}
        >
          {FILTERS.map((option) => (
            <ToggleGroupItem
              key={option}
              value={option}
              size="lg"
              className="max-sm:h-11 aria-pressed:bg-secondary aria-pressed:font-semibold"
            >
              {filterToggleLabel(option, counts[option])}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg bg-secondary p-2">
        <label className="flex min-h-9 items-center gap-2 text-sm max-sm:min-h-11">
          <Checkbox
            checked={allSelected}
            indeterminate={someSelected}
            aria-label={es.products.queue.selectVisible}
            className="data-indeterminate:border-primary data-indeterminate:bg-primary data-indeterminate:text-primary-foreground"
            onCheckedChange={(checked) => {
              onSelectAll(checked);
            }}
          />
          <span>{es.products.queue.selectVisible}</span>
        </label>
        <span className="text-sm text-muted-foreground">{selectedCount(selectedVisible)}</span>
        <Button
          type="button"
          variant="outline"
          size="lg"
          aria-disabled={nothingSelected ? true : undefined}
          className="max-sm:h-11 aria-disabled:pointer-events-none aria-disabled:opacity-50"
          onClick={() => {
            if (!nothingSelected) onAcceptSelected();
          }}
        >
          {es.products.queue.acceptSelected}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="lg"
          aria-disabled={nothingSelected ? true : undefined}
          className="max-sm:h-11 aria-disabled:pointer-events-none aria-disabled:opacity-50"
          onClick={() => {
            if (!nothingSelected) onRejectSelected();
          }}
        >
          {es.products.queue.rejectSelected}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          aria-disabled={nothingVisible ? true : undefined}
          className="ml-auto max-sm:ml-0 max-sm:h-11 aria-disabled:pointer-events-none aria-disabled:opacity-50"
          onClick={() => {
            if (!nothingVisible) onAcceptAll();
          }}
        >
          {es.products.queue.acceptAllVisible}
        </Button>
      </div>
    </div>
  );
}
