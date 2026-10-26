"use client";

import { useMemo, useState } from "react";
import Big from "big.js";
import {
  constructSortFn,
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import type { Header, SortingState } from "@tanstack/react-table";
import { SortHeaderButton, ariaSort } from "@/components/SortHeaderButton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ProductComparison } from "@/domain/prices/compare";
import type { UnitFamily } from "@/domain/prices/units";
import { es } from "@/lib/copy/es";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

/** A table row: the comparison plus what the sorts and the cells read. */
interface PriceRow {
  id: string;
  name: string;
  /** Name of the cheapest store; undefined below 2 stores so it sorts last. */
  cheapestName: string | undefined;
  /** Count of stores with a normalized purchase. */
  stores: number;
  /** Estimated saving; undefined without a cheapest store so it sorts last. */
  saving: Big | undefined;
  /** «{precio} / {unidad}» of the cheapest (or only) store's median; null without a normalized purchase. */
  priceText: string | null;
}

function unitLabel(family: UnitFamily): string {
  return es.prices.units[family];
}

function toRow(comparison: ProductComparison): PriceRow {
  // The price of a product with one store is that store's median, rounded only here.
  const store = comparison.cheapest ?? comparison.stores[0];
  return {
    id: comparison.productId,
    name: comparison.name,
    cheapestName: comparison.cheapest?.name,
    stores: comparison.stores.length,
    saving: comparison.saving ?? undefined,
    priceText:
      store === undefined || comparison.family === null
        ? null
        : `${formatMoney(store.median)} / ${unitLabel(comparison.family)}`,
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

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { es: sortFn_es, count: sortFn_count, money: sortFn_money },
});

const helper = createColumnHelper<typeof features, PriceRow>();

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

const RIGHT_COLUMNS: ReadonlySet<string> = new Set(["tiendas", "ahorro"]);

type PriceHeader = Header<typeof features, PriceRow>;

/**
 * Products of the Precios tab: one row per product with purchases (D-07). All vendor and user
 * text is rendered as React text. Rows arrive in product order; they are ordered by name first
 * so that rows tied on the active sort keep the Producto order (TanStack breaks ties by input
 * position).
 */
export function PricesTable({ rows }: { rows: readonly ProductComparison[] }) {
  const [sorting, setSorting] = useState<SortingState>(DEFAULT_SORTING);
  const data = useMemo(
    () => rows.map(toRow).sort((a, b) => COLLATOR.compare(a.name, b.name)),
    [rows],
  );
  const table = useTable({
    features,
    columns,
    data,
    getRowId: (row) => row.id,
    state: { sorting },
    onSortingChange: setSorting,
    // Counts and savings would otherwise start descending; every header cycles ascending,
    // descending, unsorted, like the other tables.
    sortDescFirst: false,
    enableMultiSort: false,
  });

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
    <Table className="min-w-[880px]">
      <TableHeader>
        {table.getHeaderGroups().map((group) => (
          <TableRow key={group.id} className="bg-secondary hover:bg-secondary">
            {group.headers.map(renderHeader)}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.map((tableRow) => {
          const row = tableRow.original;
          return (
            <TableRow key={tableRow.id} className="h-14 hover:bg-secondary">
              {tableRow.getAllCells().map((cell) => {
                const id = cell.column.id;
                return (
                  <TableCell
                    key={cell.id}
                    className={cn(
                      id === "producto" && "max-w-[320px] font-semibold whitespace-normal break-words",
                      id === "barata" && "max-w-[280px] whitespace-normal break-words",
                      id === "precio" && "tabular-nums",
                      id === "tiendas" && "text-right tabular-nums",
                      id === "ahorro" && "text-right font-semibold tabular-nums",
                    )}
                  >
                    {id === "producto" ? row.name : null}
                    {id === "barata" ? (row.cheapestName ?? es.prices.none) : null}
                    {id === "precio" ? (
                      row.priceText === null ? (
                        <span className="text-muted-foreground">{es.prices.notNormalized}</span>
                      ) : (
                        row.priceText
                      )
                    ) : null}
                    {id === "tiendas" ? String(row.stores) : null}
                    {id === "ahorro" ? (
                      row.saving === undefined ? (
                        <span className="text-muted-foreground">{es.prices.none}</span>
                      ) : (
                        formatMoney(row.saving)
                      )
                    ) : null}
                  </TableCell>
                );
              })}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
