"use client";

import { Fragment, useId, useMemo, useState } from "react";
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
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Product } from "@/domain/settings/types";
import { es } from "@/lib/copy/es";
import {
  expandMembersAria,
  membersCount,
  paginationPageText,
  paginationRangeText,
  productsHeading,
  suppliersCell,
} from "@/lib/copy/messages";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/stores/settingsStore";
import { ProductMembers } from "./ProductMembers";

/** A table row: the product plus what the sorts and the cells read. */
interface ProductRow {
  id: string;
  name: string;
  memberCount: number;
  /** Distinct supplier names, in member order. */
  suppliers: string[];
  product: Product;
}

function toRow(product: Product): ProductRow {
  const suppliers: string[] = [];
  for (const member of product.members) {
    if (!suppliers.includes(member.supplierName)) suppliers.push(member.supplierName);
  }
  return {
    id: product.id,
    name: product.name,
    memberCount: product.members.length,
    suppliers,
    product,
  };
}

// Module scope on purpose: stable references keep TanStack from re-running the
// row models on every render (Pitfall 9).
const COLLATOR = new Intl.Collator("es", { sensitivity: "base" });

/** Spanish-collated text order (accents and case ignored). */
const sortFn_es = constructSortFn({
  resolveDataValue: (value: unknown) => String(value ?? ""),
  sort: (a: unknown, b: unknown) => COLLATOR.compare(String(a), String(b)),
});

/** Numeric order of the member count. */
const sortFn_count = constructSortFn({
  sort: (a: unknown, b: unknown) => Number(a) - Number(b),
});

/** Sorting and 50-row client-side pagination, like the supplier table. */
const features = tableFeatures({
  rowSortingFeature,
  rowPaginationFeature,
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortFns: { es: sortFn_es, count: sortFn_count },
});

const helper = createColumnHelper<typeof features, ProductRow>();

/** Data columns; the expander and the actions columns are display-only and live in the component. */
const columns = helper.columns([
  helper.accessor("name", {
    id: "producto",
    header: es.products.list.columns.product,
    sortFn: "es",
  }),
  helper.accessor("memberCount", {
    id: "miembros",
    header: es.products.list.columns.members,
    sortFn: "count",
  }),
  helper.accessor("suppliers", {
    id: "proveedores",
    header: es.products.list.columns.suppliers,
    enableSorting: false,
  }),
]);

/** Name ascending is the default order (UI-SPEC, es collator). */
const DEFAULT_SORTING: SortingState = [{ id: "producto", desc: false }];

/** First page, 50 rows per page (UI-SPEC E6 overflow). */
const PAGE_SIZE = 50;
const INITIAL_PAGINATION: PaginationState = { pageIndex: 0, pageSize: PAGE_SIZE };

type ProductHeader = Header<typeof features, ProductRow>;

/** Product name: wraps to two lines, then truncates, with the full name in a Tooltip. */
function NameCell({ name }: { name: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        className="line-clamp-2 w-full min-w-0 cursor-default rounded-sm text-left text-sm font-semibold break-words outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {name}
      </TooltipTrigger>
      <TooltipContent className="break-words">{name}</TooltipContent>
    </Tooltip>
  );
}

/**
 * «Mis productos» (D-14): the accepted products in a sortable, paginated table. Each row opens
 * a members sub-table; several can be open at once. Product names, descriptions and supplier
 * names are free or XML text and are only ever rendered as React text (T-04-19).
 */
export function ProductList() {
  const products = useSettingsStore((s) => s.products);
  const data = useMemo(() => products.map(toRow), [products]);
  const headingId = useId();
  const panelBaseId = useId();
  const [sorting, setSorting] = useState<SortingState>(DEFAULT_SORTING);
  const [pagination, setPagination] = useState<PaginationState>(INITIAL_PAGINATION);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());

  // autoResetPageIndex is off so sorting or a change keeps the page. When the page no
  // longer exists, fall back to the last one that does (React's derived-state pattern).
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
    // Counts would otherwise start descending; every header cycles ascending, descending,
    // unsorted, like the other tables.
    sortDescFirst: false,
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

  const renderHeader = (header: ProductHeader) => {
    const right = header.column.id === "miembros";
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
    <section
      aria-labelledby={headingId}
      className="flex min-w-0 flex-col gap-4 rounded-lg border bg-background p-6"
    >
      <div className="flex flex-col gap-1">
        <h2 id={headingId} tabIndex={-1} className="text-xl leading-[1.2] font-semibold outline-none">
          {productsHeading(products.length)}
        </h2>
        <p className="text-xs text-muted-foreground">{es.products.list.intro}</p>
      </div>
      <Table className="min-w-[880px]">
        <TableHeader>
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id} className="bg-secondary hover:bg-secondary">
              <TableHead className="w-12">
                <span className="sr-only">{es.products.list.columns.expander}</span>
              </TableHead>
              {group.headers.map(renderHeader)}
              <TableHead className="w-24">
                <span className="sr-only">{es.products.list.columns.actions}</span>
              </TableHead>
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((tableRow) => {
            const row = tableRow.original;
            const open = expanded.has(row.id);
            const panelId = `${panelBaseId}-${row.id}`;
            return (
              <Fragment key={tableRow.id}>
                <TableRow className="h-14 hover:bg-secondary">
                  <TableCell className="w-12">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-expanded={open}
                      aria-controls={open ? panelId : undefined}
                      aria-label={expandMembersAria(row.name, open)}
                      className="size-9 max-sm:size-11"
                      onClick={() => {
                        toggle(row.id);
                      }}
                    >
                      {open ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}
                    </Button>
                  </TableCell>
                  {tableRow.getAllCells().map((cell) => {
                    const id = cell.column.id;
                    return (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          id === "producto" && "max-w-[320px] whitespace-normal",
                          id === "miembros" && "text-right tabular-nums",
                          id === "proveedores" && "max-w-[280px]",
                        )}
                      >
                        {id === "producto" ? <NameCell name={row.name} /> : null}
                        {id === "miembros" ? membersCount(row.memberCount) : null}
                        {id === "proveedores" ? (
                          <TruncatedText text={suppliersCell(row.suppliers)} />
                        ) : null}
                      </TableCell>
                    );
                  })}
                  <TableCell className="w-24" />
                </TableRow>
                {open ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell id={panelId} colSpan={5} className="bg-secondary p-4 whitespace-normal">
                      <ProductMembers product={row.product} />
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
              onClick={() => table.previousPage()}
            >
              {es.table.previous}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="max-sm:h-11 max-sm:min-w-11"
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
            >
              {es.table.next}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
