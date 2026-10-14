"use client";

import { useId, useMemo, useState } from "react";
import { useTable } from "@tanstack/react-table";
import type { Header, SortingState } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
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
import { facturasCargadasHeading } from "@/lib/copy/messages";
import { formatFechaIso, formatFolio, formatTotal } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/stores/sessionStore";
import { columns, features, toInvoiceRows } from "./columns";
import type { InvoiceRow } from "./columns";

/** Columns whose values are numbers and therefore align to the right. */
const RIGHT_ALIGNED = new Set(["total", "conceptos"]);

/** Fecha descending is the default order (D-23, user-confirmed). */
const DEFAULT_SORTING: SortingState = [{ id: "fecha", desc: true }];

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
      return row.tipo;
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
  const headingId = useId();

  const table = useTable({
    features,
    columns,
    data: rows,
    getRowId: (row) => row.id,
    state: { sorting },
    onSortingChange: setSorting,
    // Numeric columns would otherwise start descending; D-23 wants
    // ascending, descending, unsorted on every header.
    sortDescFirst: false,
    enableMultiSort: false,
  });

  if (!reportVisible || rows.length === 0) return null;

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
        <p className="text-sm text-muted-foreground">{es.table.note}</p>
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
    </section>
  );
}
