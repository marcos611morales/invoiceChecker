"use client";

import { useMemo, useRef, useState } from "react";
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
import { TruncatedText } from "@/components/TruncatedText";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { SupplierRow } from "@/domain/accounting/aggregate";
import { es } from "@/lib/copy/es";
import { formatCount, formatMoney, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * One table row. A missing share or ticket is `undefined` (not null) so that
 * `sortUndefined: "last"` keeps it at the end in both directions.
 */
interface SupplierTableRow {
  id: string;
  name: string;
  net: Big;
  pct: Big | undefined;
  facturas: number;
  ticket: Big | undefined;
}

function toTableRows(rows: readonly SupplierRow[]): SupplierTableRow[] {
  return rows.map((row) => ({
    id: row.rfc,
    name: row.name,
    net: row.net,
    pct: row.pct ?? undefined,
    facturas: row.facturas,
    ticket: row.ticket ?? undefined,
  }));
}

// Module scope on purpose: stable references keep TanStack from re-running the
// row models on every render.
const collator = new Intl.Collator("es", { sensitivity: "base" });

/** Spanish-collated text order (accents and case ignored). */
const sortFn_es = constructSortFn({
  resolveDataValue: (value: unknown) => String(value ?? ""),
  sort: (a: unknown, b: unknown) => collator.compare(String(a), String(b)),
});

/**
 * Exact decimal order. The built-in basic sort compares with `<` and `>` and
 * throws on Big values under strict mode (Pitfall 1), so Big values are only
 * ever compared with their `cmp` method.
 */
const sortFn_big = constructSortFn({
  sort: (a: unknown, b: unknown) => (a instanceof Big && b instanceof Big ? a.cmp(b) : 0),
});

/** Plain integer counts. */
const sortFn_count = constructSortFn({
  sort: (a: unknown, b: unknown) => (typeof a === "number" && typeof b === "number" ? a - b : 0),
});

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { es: sortFn_es, big: sortFn_big, count: sortFn_count },
});

const helper = createColumnHelper<typeof features, SupplierTableRow>();

const columns = helper.columns([
  helper.accessor("name", {
    id: "name",
    header: es.charts.columns.supplier,
    sortFn: "es",
  }),
  helper.accessor("net", {
    id: "net",
    header: es.charts.columns.net,
    sortFn: "big",
  }),
  helper.accessor("pct", {
    id: "pct",
    header: es.charts.columns.pct,
    sortFn: "big",
    sortUndefined: "last",
  }),
  helper.accessor("facturas", {
    id: "facturas",
    header: es.charts.columns.invoices,
    sortFn: "count",
  }),
  helper.accessor("ticket", {
    id: "ticket",
    header: es.charts.columns.ticket,
    sortFn: "big",
    sortUndefined: "last",
  }),
]);

/** Columns whose values are numbers and therefore align to the right. */
const RIGHT_ALIGNED = new Set(["net", "pct", "facturas", "ticket"]);

/** Gasto neto descending: a negative net lands last (D-23). */
const DEFAULT_SORTING: SortingState = [{ id: "net", desc: true }];

const MISSING = "—";

type SupplierHeader = Header<typeof features, SupplierTableRow>;

/** Cell text of one row/column, rendered as React text only (T-02-20). */
function cellContent(columnId: string, row: SupplierTableRow) {
  switch (columnId) {
    case "name":
      return <TruncatedText text={row.name} />;
    case "net":
      return formatMoney(row.net);
    case "pct":
      return row.pct === undefined ? MISSING : formatPercent(row.pct);
    case "facturas":
      return formatCount(row.facturas);
    case "ticket":
      return row.ticket === undefined ? MISSING : formatMoney(row.ticket);
    default:
      return null;
  }
}

/** Mounted only while the dialog is open, so the sort state resets on every open. */
function SupplierTable({ rows }: { rows: readonly SupplierRow[] }) {
  const data = useMemo(() => toTableRows(rows), [rows]);
  const [sorting, setSorting] = useState<SortingState>(DEFAULT_SORTING);
  const table = useTable({
    features,
    columns,
    data,
    getRowId: (row) => row.id,
    state: { sorting },
    onSortingChange: setSorting,
    // Numeric columns would otherwise start descending; the headers cycle
    // ascending, descending, none like the Facturas table.
    sortDescFirst: false,
    enableMultiSort: false,
  });

  const renderHeader = (header: SupplierHeader) => {
    const sorted = header.column.getIsSorted();
    const right = RIGHT_ALIGNED.has(header.column.id);
    return (
      <TableHead
        key={header.id}
        aria-sort={ariaSort(sorted)}
        className={cn("font-semibold", right && "text-right")}
      >
        <SortHeaderButton
          sorted={sorted}
          right={right}
          onClick={header.column.getToggleSortingHandler()}
        >
          <table.FlexRender header={header} />
        </SortHeaderButton>
      </TableHead>
    );
  };

  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((group) => (
          <TableRow key={group.id} className="bg-secondary hover:bg-secondary">
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
                    id === "name" && "max-w-[240px]",
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
  );
}

/**
 * Every supplier of the current filter, not just the top 10 (D-22). A centred
 * dialog, full screen under 640 px, with a sortable table inside a 480 px scroll
 * area. Focus moves to the title on open; closing returns it to the trigger.
 */
export function SupplierDialog({
  rows,
  open,
  onOpenChange,
}: {
  rows: readonly SupplierRow[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        initialFocus={titleRef}
        className="sm:max-w-[720px] max-sm:top-0 max-sm:left-0 max-sm:h-dvh max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:grid-rows-[auto_minmax(0,1fr)_auto]"
      >
        <DialogHeader>
          <DialogTitle ref={titleRef} tabIndex={-1} className="text-xl outline-none">
            {es.charts.rankingHeading}
          </DialogTitle>
          <DialogDescription>{es.charts.dialogDescription}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[480px] max-sm:max-h-full [&_[data-slot=scroll-area-viewport]]:max-h-[480px] max-sm:[&_[data-slot=scroll-area-viewport]]:max-h-full">
          <SupplierTable rows={rows} />
        </ScrollArea>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>{es.charts.close}</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
