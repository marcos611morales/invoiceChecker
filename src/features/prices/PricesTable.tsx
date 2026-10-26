"use client";

import { Fragment, useId, useMemo, useState } from "react";
import Big from "big.js";
import {
  constructSortFn,
  createColumnHelper,
  createPaginatedRowModel,
  createSortedRowModel,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import type { Header, PaginationState, SortingState } from "@tanstack/react-table";
import { ChevronDown, ChevronRight } from "lucide-react";
import { SortHeaderButton, ariaSort } from "@/components/SortHeaderButton";
import { TruncatedText } from "@/components/TruncatedText";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Comparability } from "@/domain/prices/comparable";
import type { ProductComparison } from "@/domain/prices/compare";
import type { SeriesSlot } from "@/domain/prices/history";
import { es } from "@/lib/copy/es";
import {
  expandPricesAria,
  notNormalizedBadge,
  onlyAtStore,
  paginationPageText,
  paginationRangeText,
  pricePerStoresCaption,
} from "@/lib/copy/messages";
import { formatMoney, unitPriceText } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ProductDetail } from "./ProductDetail";

/** Slots when the caller has none: every store of a product falls into «Otras tiendas». */
const NO_HISTORY_SLOTS: ReadonlyMap<string, ReadonlyMap<string, SeriesSlot>> = new Map();

/** Comparability when the caller has none: every row is compared. */
const NO_COMPARABILITY: ReadonlyMap<string, Comparability> = new Map();

/** A table row: the comparison plus what the sorts and the cells read. */
interface PriceRow {
  id: string;
  name: string;
  /** True when the compared purchases are pieces without a verified size (D-10). */
  perPiece: boolean;
  /** Purchases left out of the comparison (D-10, D-12, D-26). */
  notNormalizedCount: number;
  /** Name of the cheapest store; undefined below 2 stores so it sorts last. */
  cheapestName: string | undefined;
  /** Name of the only compared store, when there is exactly one (D-02). */
  onlyStoreName: string | undefined;
  /** Count of stores with a normalized purchase. */
  stores: number;
  /** Estimated saving; undefined without a cheapest store so it sorts last. */
  saving: Big | undefined;
  /** «{precio} / {unidad}» of the cheapest (or only) store's median; null without a normalized purchase. */
  priceText: string | null;
  /** Purchases behind that median. */
  priceCount: number;
  /** The comparison the expanded panel explains (D-07). */
  comparison: ProductComparison;
  /** True when the product is not compared: de-emphasised, no expander, dashes (D-18). */
  hidden: boolean;
  /** True when the user, and not the default, decided that it is not compared (D-18). */
  hiddenByUser: boolean;
  /** Whether the product is compared by default; the override is stored against it (D-19). */
  defaultComparable: boolean;
}

/** A product with no entry is compared, by default (the view gives every row an entry). */
const COMPARED_BY_DEFAULT: Comparability = { comparable: true, byUser: false, defaultComparable: true };

function toRow(comparison: ProductComparison, state: Comparability): PriceRow {
  if (!state.comparable) {
    // Nothing of a not-compared product is shown as a result: its cells read «—» (D-18, UI-SPEC).
    return {
      id: comparison.productId,
      name: comparison.name,
      perPiece: false,
      notNormalizedCount: 0,
      cheapestName: undefined,
      onlyStoreName: undefined,
      stores: comparison.stores.length,
      saving: undefined,
      priceText: null,
      priceCount: 0,
      comparison,
      hidden: true,
      hiddenByUser: state.byUser,
      defaultComparable: state.defaultComparable,
    };
  }
  // The price of a product with one store is that store's median, rounded only here.
  const store = comparison.cheapest ?? comparison.stores[0];
  const onlyStore = comparison.stores.length === 1 ? comparison.stores[0] : undefined;
  return {
    id: comparison.productId,
    name: comparison.name,
    perPiece: comparison.perPiece,
    notNormalizedCount: comparison.notNormalizedCount,
    cheapestName: comparison.cheapest?.name,
    onlyStoreName: onlyStore?.name,
    stores: comparison.stores.length,
    saving: comparison.saving ?? undefined,
    priceText:
      store === undefined || comparison.family === null
        ? null
        : unitPriceText(store.median, comparison.family),
    priceCount: store?.count ?? 0,
    comparison,
    hidden: false,
    hiddenByUser: false,
    defaultComparable: state.defaultComparable,
  };
}

// Module scope on purpose: stable references keep TanStack from re-running the row models.
const COLLATOR = new Intl.Collator("es", { sensitivity: "base" });

/** Spanish-collated text order (accents and case ignored). */
const sortFn_es = constructSortFn({
  resolveDataValue: (value: unknown) => String(value ?? ""),
  sort: (a: unknown, b: unknown) => COLLATOR.compare(String(a), String(b)),
});

/** Numeric order of the store count. */
const sortFn_count = constructSortFn({
  sort: (a: unknown, b: unknown) => Number(a) - Number(b),
});

/** Exact order of the savings, compared as decimals and never as floats. */
const sortFn_money = constructSortFn({
  sort: (a: unknown, b: unknown) => (a instanceof Big && b instanceof Big ? a.cmp(b) : 0),
});

/** Sorting and 50-row client-side pagination, like the product list. */
const features = tableFeatures({
  rowSortingFeature,
  rowPaginationFeature,
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortFns: { es: sortFn_es, count: sortFn_count, money: sortFn_money },
});

const helper = createColumnHelper<typeof features, PriceRow>();

/**
 * Data columns. The expander column is rendered by hand before them; the actions column
 * (Plan 05-09) is display-only and will be added after them.
 */
const columns = helper.columns([
  helper.accessor("name", {
    id: "producto",
    header: es.prices.columns.product,
    sortFn: "es",
  }),
  helper.accessor("cheapestName", {
    id: "barata",
    header: es.prices.columns.cheapest,
    sortFn: "es",
    sortUndefined: "last",
  }),
  // Mixed units ($/kg, $/L, $/pieza) are not comparable with each other: not sortable.
  helper.accessor("priceText", {
    id: "precio",
    header: es.prices.columns.price,
    enableSorting: false,
  }),
  helper.accessor("stores", {
    id: "tiendas",
    header: es.prices.columns.stores,
    sortFn: "count",
  }),
  helper.accessor("saving", {
    id: "ahorro",
    header: es.prices.columns.saving,
    sortFn: "money",
    sortUndefined: "last",
  }),
]);

/** Largest saving first, rows without a saving last (D-07). */
const DEFAULT_SORTING: SortingState = [{ id: "ahorro", desc: true }];

/** First page, 50 rows per page (UI-SPEC E4 overflow). */
const PAGE_SIZE = 50;
const INITIAL_PAGINATION: PaginationState = { pageIndex: 0, pageSize: PAGE_SIZE };

const RIGHT_COLUMNS: ReadonlySet<string> = new Set(["tiendas", "ahorro"]);

type PriceHeader = Header<typeof features, PriceRow>;

/** A cell with nothing to show: a muted dash. */
function Dash() {
  return <span className="text-muted-foreground">{es.prices.none}</span>;
}

/** Product name (14/600, two lines then truncated) with its badges on their own line. */
function ProductCell({ row }: { row: PriceRow }) {
  if (row.hidden) {
    // Muted text and not opacity, so the contrast stays at the approved muted ratio (UI-SPEC Color).
    return (
      <div className="flex min-w-0 flex-col items-start gap-1">
        <TruncatedText
          text={row.name}
          className="line-clamp-2 text-sm font-semibold whitespace-normal break-words text-muted-foreground"
        />
        <Badge variant="outline">{es.prices.noComparable.badge}</Badge>
        <p className="text-xs text-muted-foreground">
          {row.hiddenByUser ? es.prices.noComparable.byUser : es.prices.noComparable.byDefault}
        </p>
      </div>
    );
  }
  return (
    <div className="flex min-w-0 flex-col items-start gap-1">
      <TruncatedText
        text={row.name}
        className="line-clamp-2 text-sm font-semibold whitespace-normal break-words"
      />
      {row.perPiece ? <Badge variant="outline">{es.prices.perPieceBadge}</Badge> : null}
      {row.notNormalizedCount > 0 ? (
        <Badge variant="outline">{notNormalizedBadge(row.notNormalizedCount)}</Badge>
      ) : null}
    </div>
  );
}

/** Cheapest store, «Solo en {tienda}» for one compared store, or a dash with none (D-02). */
function CheapestCell({ row }: { row: PriceRow }) {
  if (row.cheapestName !== undefined) return <TruncatedText text={row.cheapestName} />;
  if (row.onlyStoreName !== undefined) {
    return <TruncatedText text={onlyAtStore(row.onlyStoreName)} className="text-muted-foreground" />;
  }
  return <Dash />;
}

/** Price per unit of the cheapest (or only) store with the purchases behind its median. */
function PriceCell({ row }: { row: PriceRow }) {
  if (row.hidden) return <Dash />;
  if (row.priceText === null) {
    return <span className="text-muted-foreground">{es.prices.notNormalized}</span>;
  }
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-sm font-semibold">{row.priceText}</span>
      <span className="text-xs text-muted-foreground">{pricePerStoresCaption(row.priceCount)}</span>
    </div>
  );
}

/**
 * Products of the Precios tab: one row per product with purchases (D-07). All vendor and user
 * text is rendered as React text, and only supplier names are shown, never RFCs. Rows arrive in
 * product order; they are ordered by name first so that rows tied on the active sort keep the
 * Producto order (TanStack breaks ties by input position).
 */
export function PricesTable({
  rows,
  historySlots = NO_HISTORY_SLOTS,
  comparability = NO_COMPARABILITY,
}: {
  rows: readonly ProductComparison[];
  /** Product id to store RFC to series slot: the stable colors of the price history (PREC-06). */
  historySlots?: ReadonlyMap<string, ReadonlyMap<string, SeriesSlot>>;
  /** Product id to its effective comparability; a row with no entry is compared (D-18). */
  comparability?: ReadonlyMap<string, Comparability>;
}) {
  const [sorting, setSorting] = useState<SortingState>(DEFAULT_SORTING);
  const [pagination, setPagination] = useState<PaginationState>(INITIAL_PAGINATION);
  // Several rows can be open at once; the open rows are session state and are not persisted (D-07).
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const panelBaseId = useId();
  const data = useMemo(
    () =>
      rows
        .map((comparison) => toRow(comparison, comparability.get(comparison.productId) ?? COMPARED_BY_DEFAULT))
        .sort((a, b) => COLLATOR.compare(a.name, b.name)),
    [rows, comparability],
  );

  // autoResetPageIndex is off so sorting keeps the page. When the page no longer exists (the
  // search narrowed the rows), fall back to the last one that does.
  const pageCount = Math.max(1, Math.ceil(data.length / PAGE_SIZE));
  const pageIndex = Math.min(pagination.pageIndex, pageCount - 1);
  if (pageIndex !== pagination.pageIndex) {
    setPagination({ pageIndex, pageSize: PAGE_SIZE });
  }

  const table = useTable({
    features,
    columns,
    data,
    getRowId: (row) => row.id,
    state: { sorting, pagination: { pageIndex, pageSize: PAGE_SIZE } },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    autoResetPageIndex: false,
    // Counts and savings would otherwise start descending; every header starts ascending.
    sortDescFirst: false,
    // The default order is a sort (largest saving first), so there is no unsorted state to
    // return to: a header toggles ascending and descending, and the saving flips to ascending
    // on the first click.
    enableSortingRemoval: false,
    enableMultiSort: false,
  });

  const toggle = (id: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderHeader = (header: PriceHeader) => {
    const right = RIGHT_COLUMNS.has(header.column.id);
    if (!header.column.getCanSort()) {
      return (
        <TableHead key={header.id} className="font-semibold">
          <table.FlexRender header={header} />
        </TableHead>
      );
    }
    return (
      <TableHead
        key={header.id}
        aria-sort={ariaSort(header.column.getIsSorted())}
        className={cn("font-semibold", right && "text-right")}
      >
        <SortHeaderButton
          sorted={header.column.getIsSorted()}
          right={right}
          onClick={header.column.getToggleSortingHandler()}
        >
          <table.FlexRender header={header} />
        </SortHeaderButton>
      </TableHead>
    );
  };

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Table className="min-w-[880px]">
        <TableHeader>
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id} className="bg-secondary hover:bg-secondary">
              <TableHead className="w-12">
                <span className="sr-only">{es.prices.detail.expanderHeader}</span>
              </TableHead>
              {group.headers.map(renderHeader)}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((tableRow) => {
            const row = tableRow.original;
            const open = expanded.has(row.id) && !row.hidden;
            const panelId = `${panelBaseId}-${row.id}`;
            return (
              <Fragment key={tableRow.id}>
                <TableRow className="h-14 hover:bg-secondary">
                  <TableCell className="w-12">
                    {row.hidden ? null : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-expanded={open}
                        aria-controls={open ? panelId : undefined}
                        aria-label={expandPricesAria(row.name, open)}
                        className="size-9 max-sm:size-11"
                        onClick={() => {
                          toggle(row.id);
                        }}
                      >
                        {open ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}
                      </Button>
                    )}
                  </TableCell>
                  {tableRow.getAllCells().map((cell) => {
                    const id = cell.column.id;
                    return (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          id === "producto" && "max-w-[320px] whitespace-normal",
                          id === "barata" && "max-w-[280px]",
                          id === "precio" && "tabular-nums",
                          id === "tiendas" && "text-right tabular-nums",
                          id === "tiendas" && row.hidden && "text-muted-foreground",
                          id === "ahorro" && "text-right text-sm font-semibold tabular-nums",
                        )}
                      >
                        {id === "producto" ? <ProductCell row={row} /> : null}
                        {id === "barata" ? <CheapestCell row={row} /> : null}
                        {id === "precio" ? <PriceCell row={row} /> : null}
                        {id === "tiendas" ? (row.stores === 0 ? <Dash /> : String(row.stores)) : null}
                        {id === "ahorro" ? (
                          row.saving === undefined ? <Dash /> : formatMoney(row.saving)
                        ) : null}
                      </TableCell>
                    );
                  })}
                </TableRow>
                {open ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell
                      id={panelId}
                      colSpan={columns.length + 1}
                      className="bg-secondary p-4 whitespace-normal sm:p-6"
                    >
                      <ProductDetail row={row.comparison} slots={historySlots.get(row.id)} />
                    </TableCell>
                  </TableRow>
                ) : null}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
      {pageCount > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <p className="text-muted-foreground">
            {paginationRangeText(
              pageIndex * PAGE_SIZE + 1,
              Math.min(data.length, (pageIndex + 1) * PAGE_SIZE),
              data.length,
            )}
          </p>
          <div className="flex items-center gap-2">
            <span>{paginationPageText(pageIndex + 1, pageCount)}</span>
            <Button
              type="button"
              variant="outline"
              className="max-sm:h-11 max-sm:min-w-11"
              disabled={!table.getCanPreviousPage()}
              onClick={() => {
                table.previousPage();
              }}
            >
              {es.table.previous}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="max-sm:h-11 max-sm:min-w-11"
              disabled={!table.getCanNextPage()}
              onClick={() => {
                table.nextPage();
              }}
            >
              {es.table.next}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
