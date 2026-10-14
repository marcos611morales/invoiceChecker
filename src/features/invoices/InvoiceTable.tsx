"use client";

import { useId, useMemo, useState } from "react";
import { useTable } from "@tanstack/react-table";
import type {
  Header,
  PaginationState,
  SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { hasReport } from "@/domain/import/report";
import { es } from "@/lib/copy/es";
import {
  facturasCargadasHeading,
  paginationPageText,
  paginationRangeText,
} from "@/lib/copy/messages";
import { formatFechaIso, formatFolio, formatTotal } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/stores/sessionStore";
import { columns, features, toInvoiceRows } from "./columns";
import type { InvoiceRow } from "./columns";

/** Columns whose values are numbers and therefore align to the right. */
const RIGHT_ALIGNED = new Set(["total", "conceptos"]);

/** Fecha descending is the default order (D-23, user-confirmed). */
const DEFAULT_SORTING: SortingState = [{ id: "fecha", desc: true }];

/** First page, 50 rows per page (D-23). */
const INITIAL_PAGINATION: PaginationState = { pageIndex: 0, pageSize: 50 };
const PAGE_SIZE = INITIAL_PAGINATION.pageSize;

type InvoiceHeader = Header<typeof features, InvoiceRow>;

function SortIcon({ sorted }: { sorted: false | "asc" | "desc" }) {
  if (sorted === "asc") {
    return <ArrowUp className="size-4 text-primary" aria-hidden="true" />;
  }
  if (sorted === "desc") {
    return <ArrowDown className="size-4 text-primary" aria-hidden="true" />;
  }
  return (
    <ArrowUpDown className="size-4 text-muted-foreground" aria-hidden="true" />
  );
}

function ariaSort(
  sorted: false | "asc" | "desc",
): "ascending" | "descending" | "none" {
  if (sorted === "asc") return "ascending";
  if (sorted === "desc") return "descending";
  return "none";
}

/** Cell value of one row/column, rendered as React text only (T-01-36). */
function cellContent(columnId: string, row: InvoiceRow) {
  switch (columnId) {
    case "fecha":
      return formatFechaIso(row.fecha);
    case "proveedor":
      return (
        <Tooltip>
          <TooltipTrigger className="block w-full min-w-0 cursor-default truncate text-left">
            {row.proveedor}
          </TooltipTrigger>
          <TooltipContent className="break-words">
            {row.proveedor}
          </TooltipContent>
        </Tooltip>
      );
    case "tipo":
      return <Badge variant="outline">{row.tipo}</Badge>;
    case "folio":
      return formatFolio(row.folio ?? null);
    case "total":
      return formatTotal(row.total, row.moneda);
    case "conceptos":
      return String(row.conceptos);
    default:
      return null;
  }
}

/**
 * "Facturas cargadas" (D-21, D-22, D-23): every loaded invoice with the values
 * exactly as its XML states them, sortable by any column. Display only: no
 * totals row and no sum or average of any kind.
 */
export function InvoiceTable() {
  const reportVisible = useSessionStore((s) => hasReport(s));
  const invoices = useSessionStore((s) => s.invoices);
  const rows = useMemo(() => toInvoiceRows(invoices), [invoices]);
  const [sorting, setSorting] = useState<SortingState>(DEFAULT_SORTING);
  const [pagination, setPagination] =
    useState<PaginationState>(INITIAL_PAGINATION);
  const headingId = useId();

  // autoResetPageIndex is off so sorting or a new batch keeps the page (D-23).
  // When the page no longer exists, fall back to the first one. The reset is a
  // conditional state update during render (React's derived-state pattern),
  // not an effect, and the clamped index is what the table receives.
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageIndex = pagination.pageIndex < pageCount ? pagination.pageIndex : 0;
  if (pageIndex !== pagination.pageIndex) {
    setPagination({ pageIndex, pageSize: PAGE_SIZE });
  }

  const table = useTable({
    features,
    columns,
    data: rows,
    getRowId: (row) => row.id,
    state: { sorting, pagination: { pageIndex, pageSize: PAGE_SIZE } },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    autoResetPageIndex: false,
    // Numeric columns would otherwise start descending; D-23 wants
    // ascending, descending, unsorted on every header.
    sortDescFirst: false,
    enableMultiSort: false,
  });

  if (!reportVisible) return null;

  // Files were processed but none produced a valid invoice.
  if (rows.length === 0) {
    return (
      <section aria-label={es.table.heading} className="min-w-0">
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle className="text-base">{es.table.emptyHeading}</EmptyTitle>
            <EmptyDescription>{es.table.emptyBody}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </section>
    );
  }

  const renderHeader = (header: InvoiceHeader) => {
    const sorted = header.column.getIsSorted();
    const right = RIGHT_ALIGNED.has(header.column.id);
    return (
      <TableHead
        key={header.id}
        aria-sort={ariaSort(sorted)}
        className={cn("font-semibold", right && "text-right")}
      >
        <button
          type="button"
          onClick={header.column.getToggleSortingHandler()}
          className={cn(
            "inline-flex items-center gap-1 rounded-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            right && "flex-row-reverse",
          )}
        >
          <table.FlexRender header={header} />
          <SortIcon sorted={sorted} />
        </button>
      </TableHead>
    );
  };

  return (
    <section
      aria-labelledby={headingId}
      className="flex min-w-0 flex-col gap-4"
    >
      <div className="flex flex-col gap-1">
        <h2 id={headingId} className="text-xl leading-[1.2] font-semibold">
          {facturasCargadasHeading(rows.length)}
        </h2>
        {/* role="note" overrides the default alert role: the note never
            changes, so it must not be announced on every load. */}
        <Alert role="note">
          <Info aria-hidden="true" />
          <AlertDescription>{es.table.note}</AlertDescription>
        </Alert>
      </div>
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((group) => (
            <TableRow
              key={group.id}
              className="bg-secondary hover:bg-secondary"
            >
              {group.headers.map(renderHeader)}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id} className="h-10 hover:bg-secondary">
              {row.getAllCells().map((cell) => {
                const id = cell.column.id;
                return (
                  <TableCell
                    key={cell.id}
                    className={cn(
                      id === "proveedor" && "max-w-[280px]",
                      id === "folio" && "font-mono",
                      RIGHT_ALIGNED.has(id) && "text-right tabular-nums",
                    )}
                  >
                    {cellContent(id, row.original)}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {pageCount > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <p className="text-muted-foreground">
            {paginationRangeText(
              pageIndex * PAGE_SIZE + 1,
              Math.min(rows.length, (pageIndex + 1) * PAGE_SIZE),
              rows.length,
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
