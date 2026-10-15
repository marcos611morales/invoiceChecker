"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  formaOptions,
  isDefaultFilters,
  supplierOptions,
  type DateRange,
  type FilterOption,
} from "@/domain/accounting/filters";
import type { LedgerEntry } from "@/domain/accounting/ledger";
import { es } from "@/lib/copy/es";
import {
  chipText,
  filtersButtonText,
  noFormaMatch,
  noSupplierMatch,
  removeChipAria,
} from "@/lib/copy/messages";
import { formaPagoLabel, rangeText } from "@/lib/format";
import { useSessionStore } from "@/stores/sessionStore";
import { DateRangeFilter } from "./DateRangeFilter";
import { MultiSelectFilter, selectedNames } from "./MultiSelectFilter";

/** Names shown in a chip before the "+N" (UI-SPEC "Chip patterns"). */
const SUPPLIER_CHIP_NAMES = 2;
const FORMA_CHIP_NAMES = 1;

/** The three filter triggers; rendered once in the desktop row and once in the mobile fold. */
function FilterTriggers(props: {
  span: DateRange | null;
  suppliers: readonly FilterOption[];
  formas: readonly FilterOption[];
}) {
  const { span, suppliers, formas } = props;
  const range = useSessionStore((s) => s.filters.range);
  const selectedSuppliers = useSessionStore((s) => s.filters.suppliers);
  const selectedFormas = useSessionStore((s) => s.filters.formas);
  const setRange = useSessionStore((s) => s.setRange);
  const setSuppliers = useSessionStore((s) => s.setSuppliers);
  const setFormas = useSessionStore((s) => s.setFormas);
  return (
    <>
      {span !== null ? <DateRangeFilter span={span} value={range} onChange={setRange} /> : null}
      <MultiSelectFilter
        label={es.filters.supplier}
        options={suppliers}
        selected={selectedSuppliers}
        onChange={setSuppliers}
        searchPlaceholder={es.filters.searchSupplier}
        clearLabel={es.filters.clearSuppliers}
        noMatch={noSupplierMatch}
        widthClass="w-[360px]"
      />
      <MultiSelectFilter
        label={es.filters.forma}
        options={formas}
        selected={selectedFormas}
        onChange={setFormas}
        searchPlaceholder={es.filters.searchForma}
        clearLabel={es.filters.clearFormas}
        noMatch={noFormaMatch}
        widthClass="w-[320px]"
      />
    </>
  );
}

function Chip(props: { text: string; removeLabel: string; onRemove: () => void }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-4xl border bg-secondary py-0.5 pr-0.5 pl-2.5 text-xs text-secondary-foreground">
      <span className="min-w-0 break-words">{props.text}</span>
      <button
        type="button"
        aria-label={props.removeLabel}
        onClick={props.onRemove}
        className="inline-flex size-5 shrink-0 items-center justify-center rounded-full outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 max-sm:-my-3 max-sm:size-11"
      >
        <X className="size-3" aria-hidden="true" />
      </button>
    </span>
  );
}

/**
 * Filter bar of the Dashboard (D-11, D-14): Fechas, Proveedor and Forma de pago,
 * one chip per active dimension, and a reset button. Below 640 px the triggers
 * fold into one "Filtros" button; the chips stay visible. Options count every
 * loaded invoice, whatever the other filters say (D-14).
 */
export function FilterBar(props: { ledger: readonly LedgerEntry[]; span: DateRange | null }) {
  const { ledger, span } = props;
  const filters = useSessionStore((s) => s.filters);
  const setRange = useSessionStore((s) => s.setRange);
  const setSuppliers = useSessionStore((s) => s.setSuppliers);
  const setFormas = useSessionStore((s) => s.setFormas);
  const clearFilters = useSessionStore((s) => s.clearFilters);
  const [foldOpen, setFoldOpen] = useState(false);

  const suppliers = useMemo(() => supplierOptions(ledger), [ledger]);
  const formas = useMemo(() => formaOptions(ledger, formaPagoLabel), [ledger]);

  const hasRange = filters.range !== null;
  const hasSuppliers = filters.suppliers.size > 0;
  const hasFormas = filters.formas.size > 0;
  const activeCount = Number(hasRange) + Number(hasSuppliers) + Number(hasFormas);
  const chipsPresent = activeCount > 0;

  return (
    <div data-testid="filter-bar" className="flex flex-col">
      <div className="flex flex-wrap items-center gap-2">
        <div
          data-testid="filter-triggers-desktop"
          className="flex flex-wrap items-center gap-2 max-sm:hidden"
        >
          <FilterTriggers span={span} suppliers={suppliers} formas={formas} />
        </div>
        <div data-testid="filter-fold" className="w-full sm:hidden">
          <Collapsible open={foldOpen} onOpenChange={setFoldOpen}>
            <CollapsibleTrigger
              render={<Button variant="outline" size="lg" className="h-11 w-full" />}
            >
              {filtersButtonText(activeCount)}
            </CollapsibleTrigger>
            <CollapsibleContent className="flex flex-col gap-2 pt-2">
              <FilterTriggers span={span} suppliers={suppliers} formas={formas} />
            </CollapsibleContent>
          </Collapsible>
        </div>
        {!isDefaultFilters(filters) ? (
          <Button
            variant="ghost"
            size="lg"
            className="ml-auto max-sm:h-11"
            onClick={clearFilters}
          >
            {es.filters.reset}
          </Button>
        ) : null}
      </div>
      <div
        data-testid="filter-chips"
        aria-live="polite"
        className={chipsPresent ? "mt-2 flex flex-wrap gap-2" : "flex flex-wrap gap-2"}
      >
        {filters.range !== null ? (
          <Chip
            text={`${es.filters.dates}: ${rangeText(filters.range.from, filters.range.to)}`}
            removeLabel={removeChipAria(es.filters.dates)}
            onRemove={() => setRange(null)}
          />
        ) : null}
        {hasSuppliers ? (
          <Chip
            text={chipText(
              es.filters.supplier,
              selectedNames(suppliers, filters.suppliers),
              SUPPLIER_CHIP_NAMES,
            )}
            removeLabel={removeChipAria(es.filters.supplier)}
            onRemove={() => setSuppliers(new Set<string>())}
          />
        ) : null}
        {hasFormas ? (
          <Chip
            text={chipText(
              es.filters.forma,
              selectedNames(formas, filters.formas),
              FORMA_CHIP_NAMES,
            )}
            removeLabel={removeChipAria(es.filters.forma)}
            onRemove={() => setFormas(new Set<string>())}
          />
        ) : null}
      </div>
    </div>
  );
}
