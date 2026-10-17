"use client";

import { useMemo, useState } from "react";
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
import { toast } from "sonner";
import { SortHeaderButton, ariaSort } from "@/components/SortHeaderButton";
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
import { supplierOptions } from "@/domain/accounting/filters";
import { supplierTableRows, type SupplierTableRow } from "@/domain/settings/assignments";
import { orderedCategories } from "@/domain/settings/categories";
import { SIN_CATEGORIA } from "@/domain/settings/types";
import { useLedger } from "@/features/dashboard/useLedger";
import { es } from "@/lib/copy/es";
import {
  paginationPageText,
  paginationRangeText,
  supplierCategoryAria,
} from "@/lib/copy/messages";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/stores/settingsStore";
import { useCategorySettings } from "./useCategorySettings";

/** A table row: the domain row plus the category name the sort and the Select read. */
interface SupplierRow extends SupplierTableRow {
  /** Name of the assigned category; undefined when unassigned so it sorts last. */
  categoryName: string | undefined;
}

// Module scope on purpose: stable references keep TanStack from re-running the
// row models on every render (Pitfall 9).
const COLLATOR = new Intl.Collator("es", { sensitivity: "base" });

/** Spanish-collated text order (accents and case ignored). */
const sortFn_es = constructSortFn({
  resolveDataValue: (value: unknown) => String(value ?? ""),
  sort: (a: unknown, b: unknown) => COLLATOR.compare(String(a), String(b)),
});

/** Numeric order of the Facturas count. */
const sortFn_count = constructSortFn({
  sort: (a: unknown, b: unknown) => Number(a) - Number(b),
});

/** Sorting and 50-row client-side pagination, like the Facturas table. */
const features = tableFeatures({
  rowSortingFeature,
  rowPaginationFeature,
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortFns: { es: sortFn_es, count: sortFn_count },
});

const helper = createColumnHelper<typeof features, SupplierRow>();

/** Data columns; the actions column is display-only and lives in the component. */
const columns = helper.columns([
  helper.accessor("name", {
    id: "proveedor",
    header: es.categories.columns.supplier,
    sortFn: "es",
  }),
  helper.accessor("rfc", {
    id: "rfc",
    header: es.categories.columns.rfc,
    enableSorting: false,
  }),
  helper.accessor("invoices", {
    id: "invoices",
    header: es.categories.columns.invoices,
    sortFn: "count",
  }),
  helper.accessor("categoryName", {
    id: "categoria",
    header: es.categories.columns.category,
    sortFn: "es",
    sortUndefined: "last",
  }),
]);

/** Facturas descending is the default order; the stable sort keeps names in order within a count. */
const DEFAULT_SORTING: SortingState = [{ id: "invoices", desc: true }];

/** First page, 50 rows per page (UI-SPEC E2 overflow). */
const PAGE_SIZE = 50;
const INITIAL_PAGINATION: PaginationState = { pageIndex: 0, pageSize: PAGE_SIZE };

/** The undo toast stays six seconds (UI-SPEC defaults). */
const TOAST_DURATION_MS = 6000;

/** Item text wraps even though the shared SelectItem keeps it on one line. */
const WRAPPING_TEXT = "whitespace-normal break-words";

type SupplierHeader = Header<typeof features, SupplierRow>;

/**
 * One row per loaded supplier, plus one per supplier that only exists in the saved settings,
 * with a Select for its default category (CAT-02, D-03). Changing it applies at once through
 * the settings store, which persists it; choosing «Sin categoría» removes the assignment. A
 * refused change (the 5,000-assignment limit) leaves the stored settings as they were and
 * shows a toast. A saved-only row offers «Quitar asignación» with an undo toast. Headers sort
 * and the table pages by 50 exactly like the Facturas table. Supplier names and RFCs come from
 * XML and are rendered as React text only (T-03-14, T-03-33).
 */
export function SupplierCategoryTable() {
  const ledger = useLedger();
  const { settings, nameOf } = useCategorySettings();
  const setSupplierCategory = useSettingsStore((s) => s.setSupplierCategory);
  const removeSupplierAssignment = useSettingsStore((s) => s.removeSupplierAssignment);
  const restoreSupplierAssignment = useSettingsStore((s) => s.restoreSupplierAssignment);
  const data = useMemo<SupplierRow[]>(
    () =>
      supplierTableRows(supplierOptions(ledger), settings)
        .map((row) => ({
          ...row,
          categoryName: row.categoryId === null ? undefined : nameOf(row.categoryId),
        }))
        // Pre-sorted by name so the stable sort by Facturas keeps names in order.
        .sort((a, b) => COLLATOR.compare(a.name, b.name)),
    [ledger, settings, nameOf],
  );
  const items = useMemo(
    () => [
      { value: SIN_CATEGORIA, label: es.categories.none },
      ...orderedCategories(settings.categories).map((category) => ({
        value: category.id,
        label: category.name,
      })),
    ],
    [settings.categories],
  );
  const [sorting, setSorting] = useState<SortingState>(DEFAULT_SORTING);
  const [pagination, setPagination] = useState<PaginationState>(INITIAL_PAGINATION);

  // autoResetPageIndex is off so sorting or a new batch keeps the page. When the page no
  // longer exists, fall back to the first one (React's derived-state pattern, no effect).
  const pageCount = Math.max(1, Math.ceil(data.length / PAGE_SIZE));
  const pageIndex = pagination.pageIndex < pageCount ? pagination.pageIndex : 0;
  if (pageIndex !== pagination.pageIndex) {
    setPagination({ pageIndex, pageSize: PAGE_SIZE });
  }

  const table = useTable({
    features,
    columns,
    data,
    getRowId: (row) => row.rfc,
    state: { sorting, pagination: { pageIndex, pageSize: PAGE_SIZE } },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    autoResetPageIndex: false,
    // Counts would otherwise start descending; every header cycles ascending, descending,
    // unsorted, like the Facturas table.
    sortDescFirst: false,
    enableMultiSort: false,
  });

  const changeCategory = (row: SupplierRow, next: string | null) => {
    if (next === null) return;
    const result = setSupplierCategory(row.rfc, row.name, next === SIN_CATEGORIA ? null : next);
    if (!result.ok && result.reason === "limit") toast(es.categories.supplierLimit);
  };

  const removeAssignment = (rfc: string) => {
    const removed = removeSupplierAssignment(rfc);
    if (removed === null) return;
    toast(es.categories.assignmentRemoved, {
      duration: TOAST_DURATION_MS,
      action: {
        label: es.categories.undo,
        onClick: () => {
          restoreSupplierAssignment(removed);
        },
      },
    });
  };

  const renderHeader = (header: SupplierHeader) => {
    const right = header.column.id === "invoices";
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

  const renderCell = (columnId: string, row: SupplierRow) => {
    switch (columnId) {
      case "proveedor":
        return <TruncatedText text={row.name} />;
      case "rfc":
        return row.rfc;
      case "invoices":
        return row.loaded ? (
          row.invoices
        ) : (
          <Badge variant="outline">{es.categories.savedOnly}</Badge>
        );
      case "categoria": {
        const unassigned = row.categoryId === null;
        return (
          <Select
            items={items}
            value={row.categoryId ?? SIN_CATEGORIA}
            onValueChange={(next) => {
              changeCategory(row, next);
            }}
          >
            <SelectTrigger
              aria-label={supplierCategoryAria(row.name)}
              className={cn(
                "w-[296px] data-[size=default]:max-sm:h-11 max-sm:w-full",
                unassigned && "text-muted-foreground",
              )}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              {items.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  <span
                    className={
                      item.value === SIN_CATEGORIA
                        ? `${WRAPPING_TEXT} text-muted-foreground`
                        : WRAPPING_TEXT
                    }
                  >
                    {item.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      }
      default:
        return null;
    }
  };

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Table className="min-w-[900px]">
        <TableHeader>
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id} className="bg-secondary hover:bg-secondary">
              {group.headers.map(renderHeader)}
              <TableHead className="w-40">
                <span className="sr-only">{es.categories.columns.actions}</span>
              </TableHead>
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
                        id === "proveedor" && "max-w-[280px]",
                        id === "rfc" && "font-mono text-xs",
                        id === "invoices" && "text-right tabular-nums",
                      )}
                    >
                      {renderCell(id, row)}
                    </TableCell>
                  );
                })}
                <TableCell className="w-40">
                  {row.loaded ? null : (
                    <Button
                      type="button"
                      variant="ghost"
                      className="max-sm:h-11"
                      onClick={() => {
                        removeAssignment(row.rfc);
                      }}
                    >
                      {es.categories.removeAssignment}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
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
    </div>
  );
}
