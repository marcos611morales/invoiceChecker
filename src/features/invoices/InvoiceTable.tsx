"use client";

import { Fragment, useId, useMemo, useState } from "react";
import { useTable } from "@tanstack/react-table";
import type { Header, PaginationState, SortingState } from "@tanstack/react-table";
import { ChevronDown, ChevronRight, Ellipsis, Info } from "lucide-react";
import { toast } from "sonner";
import { SortHeaderButton, ariaSort } from "@/components/SortHeaderButton";
import { TruncatedText } from "@/components/TruncatedText";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { IvaMode } from "@/domain/accounting/aggregate";
import type { LedgerEntry } from "@/domain/accounting/ledger";
import { es } from "@/lib/copy/es";
import {
  appliesToText,
  conceptsPanelTitle,
  foreignAmountLine,
  invoicesHeading,
  originalCurrencyLine,
  paginationPageText,
  paginationRangeText,
  paidLine,
  roundingLine,
  rowMenuAria,
  substitutedLine,
} from "@/lib/copy/messages";
import {
  formaPagoLabel,
  formatFechaIso,
  formatFolio,
  formatMoney,
  formatUnitPrice,
  invoiceRef,
  monthYearLabel,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/stores/sessionStore";
import {
  buildPaymentIndex,
  columns,
  conceptRows,
  features,
  foreignInfo,
  roundingDifference,
  toInvoiceRows,
} from "./columns";
import type { InvoiceRow, RowState } from "./columns";

export interface InvoiceTableProps {
  /** The visible ledger entries: every one is a row, whether it sums or not (D-27). */
  rows: readonly LedgerEntry[];
  /** The whole ledger, to resolve payments and substituting invoices. */
  ledger: readonly LedgerEntry[];
  mode: IvaMode;
}

/** Chevron, six data columns and the actions column. */
const COLUMN_COUNT = 8;

/** Columns whose values are numbers and therefore align to the right. */
const RIGHT_ALIGNED = new Set(["amount"]);

/** Fecha descending is the default order (D-24). */
const DEFAULT_SORTING: SortingState = [{ id: "fecha", desc: true }];

/** First page, 50 rows per page (D-24). */
const INITIAL_PAGINATION: PaginationState = { pageIndex: 0, pageSize: 50 };
const PAGE_SIZE = INITIAL_PAGINATION.pageSize;

/** Both toasts stay six seconds (D-29). */
const TOAST_DURATION_MS = 6000;

type InvoiceHeader = Header<typeof features, InvoiceRow>;

function stateLabel(state: RowState): string | null {
  switch (state) {
    case "no-suma":
      return es.invoices.states.noSuma;
    case "excluida":
      return es.invoices.states.excluida;
    case "sustituida":
      return es.invoices.states.sustituida;
    case "normal":
      return null;
  }
}

/** Caption under a credit note's badge: the month it applies to, or that none is loaded (D-15). */
function creditNoteCaption(entry: LedgerEntry): string | null {
  if (entry.kind !== "nota-credito") return null;
  if (entry.relatedLoaded.length > 0 && entry.month !== null) {
    return appliesToText(monthYearLabel(entry.month));
  }
  return es.invoices.noRelated;
}

const MENU_BUTTON_CLASS = "max-sm:size-11";

/** The "⋯" menu of a row that counts or can be re-included (D-28). Rows that never count get none. */
function RowMenu({
  row,
  onExclude,
  onReinclude,
}: {
  row: InvoiceRow;
  onExclude: (uuid: string) => void;
  onReinclude: (uuid: string) => void;
}) {
  const { entry } = row;
  if (entry.noSuma !== null) return null;
  const reinclude = entry.exclusion !== null;
  const ref = invoiceRef(entry.invoice.folio, entry.uuid);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={rowMenuAria(ref)}
        render={<Button type="button" variant="ghost" size="icon-lg" className={MENU_BUTTON_CLASS} />}
      >
        <Ellipsis aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto min-w-44">
        <DropdownMenuItem
          onClick={() => {
            if (reinclude) onReinclude(entry.uuid);
            else onExclude(entry.uuid);
          }}
        >
          {reinclude ? es.invoices.reinclude : es.invoices.exclude}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Expanded content of one invoice: lines that explain the row and its concepts (D-25). */
function ConceptsPanel({
  row,
  mode,
  panelId,
  payments,
  substitutedByRef,
}: {
  row: InvoiceRow;
  mode: IvaMode;
  panelId: string;
  payments: ReadonlyArray<{ fechaPago: string; formaDePagoP: string }>;
  substitutedByRef: string | null;
}) {
  const { entry } = row;
  const titleId = `${panelId}-title`;
  const concepts = conceptRows(entry, mode);
  const difference = roundingDifference(entry, mode);
  const foreign = foreignInfo(entry, mode);
  return (
    <div id={panelId} role="region" aria-labelledby={titleId} className="flex flex-col gap-3">
      <h3 id={titleId} className="text-sm font-semibold">
        {conceptsPanelTitle(invoiceRef(entry.invoice.folio, entry.uuid))}
      </h3>
      {payments.map((payment) => (
        <p key={`${payment.fechaPago}-${payment.formaDePagoP}`} className="text-sm">
          {paidLine(formatFechaIso(payment.fechaPago), formaPagoLabel(payment.formaDePagoP))}
        </p>
      ))}
      {foreign !== null && foreign.tc !== null ? (
        <p className="text-sm">{originalCurrencyLine(foreign.moneda, foreign.tc)}</p>
      ) : null}
      {substitutedByRef !== null ? (
        <p className="text-sm">{substitutedLine(substitutedByRef)}</p>
      ) : null}
      <Table className="text-sm">
        <TableHeader>
          <TableRow className="hover:bg-secondary">
            <TableHead>{es.invoices.conceptColumns.description}</TableHead>
            <TableHead className="text-right">{es.invoices.conceptColumns.quantity}</TableHead>
            <TableHead>{es.invoices.conceptColumns.unit}</TableHead>
            <TableHead className="text-right">{es.invoices.conceptColumns.unitPrice}</TableHead>
            <TableHead className="text-right">{es.invoices.conceptColumns.amount}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {concepts.map((concept) => (
            <TableRow key={concept.key} className="hover:bg-secondary">
              <TableCell className="max-w-[420px] align-top whitespace-normal wrap-anywhere">
                {concept.descripcion}
              </TableCell>
              <TableCell className="text-right align-top tabular-nums">{concept.cantidad}</TableCell>
              <TableCell className={cn("align-top", concept.unidadIsClave && "font-mono")}>
                {concept.unidad === "" ? "—" : concept.unidad}
              </TableCell>
              <TableCell className="text-right align-top tabular-nums">
                {formatUnitPrice(concept.precioUnitario)}
              </TableCell>
              <TableCell className="text-right align-top tabular-nums">
                {concept.monto === null ? "—" : formatMoney(concept.monto)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {difference !== null ? (
        <p className="text-sm text-muted-foreground">{roundingLine(formatMoney(difference))}</p>
      ) : null}
    </div>
  );
}

/**
 * "Facturas ({n})" (DASH-09, D-24): every ledger entry behind the figures,
 * sortable and paged by 50, with an expandable concept panel and a row menu to
 * exclude or re-include an invoice for this session (REGLA-08). Rows that do not
 * sum stay visible, attenuated with the muted text color and labelled (D-27).
 * Everything from the invoices renders as React text only (T-02-22).
 */
export function InvoiceTable({ rows: entries, ledger, mode }: InvoiceTableProps) {
  const excludeInvoice = useSessionStore((s) => s.excludeInvoice);
  const reincludeInvoice = useSessionStore((s) => s.reincludeInvoice);
  const rows = useMemo(() => toInvoiceRows(entries, mode), [entries, mode]);
  const payments = useMemo(() => buildPaymentIndex(ledger), [ledger]);
  const byUuid = useMemo(() => new Map(ledger.map((entry) => [entry.uuid, entry])), [ledger]);
  const [sorting, setSorting] = useState<SortingState>(DEFAULT_SORTING);
  const [pagination, setPagination] = useState<PaginationState>(INITIAL_PAGINATION);
  // Open panels are kept by invoice id, so sorting, paging and filtering keep them.
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set<string>());
  const headingId = useId();
  const idPrefix = useId();

  // autoResetPageIndex is off so sorting or a new batch keeps the page. When the
  // page no longer exists, fall back to the first one. The reset is a conditional
  // state update during render (React's derived-state pattern), not an effect.
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
    // Money would otherwise start descending; every header cycles ascending,
    // descending, unsorted (D-24).
    sortDescFirst: false,
    enableMultiSort: false,
  });

  const toggle = (uuid: string) => {
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(uuid)) next.delete(uuid);
      else next.add(uuid);
      return next;
    });
  };

  const exclude = (uuid: string) => {
    excludeInvoice(uuid);
    toast(es.invoices.excludedToast, {
      duration: TOAST_DURATION_MS,
      action: {
        label: es.invoices.undo,
        onClick: () => {
          reincludeInvoice(uuid);
        },
      },
    });
  };

  const reinclude = (uuid: string) => {
    reincludeInvoice(uuid);
    toast(es.invoices.reincludedToast, { duration: TOAST_DURATION_MS });
  };

  const renderHeader = (header: InvoiceHeader) => {
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

  const renderCell = (columnId: string, row: InvoiceRow) => {
    switch (columnId) {
      case "fecha":
        return formatFechaIso(row.fecha);
      case "proveedor":
        return <TruncatedText text={row.proveedor} />;
      case "folio":
        return formatFolio(row.folio ?? null);
      case "formasText":
        return row.formasText === "" ? "—" : <TruncatedText text={row.formasText} />;
      case "tipoLabel": {
        const label = stateLabel(row.state);
        const caption = creditNoteCaption(row.entry);
        return (
          <div className="flex flex-col items-start gap-0.5 py-1">
            <div className="flex flex-wrap items-center gap-1">
              <Badge variant="outline">{row.tipoLabel}</Badge>
              {label === null ? null : <Badge variant="secondary">{label}</Badge>}
            </div>
            {caption === null ? null : (
              <span className="text-xs text-muted-foreground">{caption}</span>
            )}
          </div>
        );
      }
      case "amount": {
        const foreign = foreignInfo(row.entry, mode);
        return (
          <div className="flex flex-col items-end py-1">
            <span className={cn(row.state === "excluida" && "line-through")}>
              {row.amount === undefined ? "—" : formatMoney(row.amount)}
            </span>
            {foreign === null ? null : (
              <span className="text-xs text-muted-foreground">
                {foreignAmountLine(foreign.moneda, foreign.amountText, foreign.tc)}
              </span>
            )}
          </div>
        );
      }
      default:
        return null;
    }
  };

  return (
    <section aria-labelledby={headingId} className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id={headingId} className="text-xl leading-[1.2] font-semibold">
          {invoicesHeading(rows.length)}
        </h2>
        {/* role="note" overrides the default alert role: the note never changes,
            so it must not be announced on every load. */}
        <Alert role="note">
          <Info aria-hidden="true" />
          <AlertDescription>{es.invoices.note}</AlertDescription>
        </Alert>
      </div>
      <Table className="min-w-[960px]">
        <TableHeader>
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id} className="bg-secondary hover:bg-secondary">
              <TableHead className="w-12">
                <span className="sr-only">{es.invoices.columns.concepts}</span>
              </TableHead>
              {group.headers.map(renderHeader)}
              <TableHead className="w-12">
                <span className="sr-only">{es.invoices.columns.actions}</span>
              </TableHead>
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((tableRow) => {
            const row = tableRow.original;
            const { entry } = row;
            const isOpen = open.has(row.id);
            const panelId = `${idPrefix}-panel-${row.id}`;
            // The line shows while a substitution is in force: excluded by it, or by hand.
            const substitutedByRef =
              entry.substitutedBy !== null && entry.exclusion !== null
                ? invoiceRef(byUuid.get(entry.substitutedBy)?.invoice.folio ?? null, entry.substitutedBy)
                : null;
            const tall =
              entry.kind === "nota-credito" || foreignInfo(entry, mode) !== null;
            return (
              <Fragment key={tableRow.id}>
                <TableRow
                  data-row-id={row.id}
                  className={cn(
                    "hover:bg-secondary",
                    tall ? "h-14" : "h-12",
                    row.state !== "normal" && "text-muted-foreground",
                  )}
                >
                  <TableCell className="w-12">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-lg"
                      className={MENU_BUTTON_CLASS}
                      data-testid={`expand-${row.id}`}
                      aria-label={isOpen ? es.invoices.hide : es.invoices.show}
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                      onClick={() => {
                        toggle(row.id);
                      }}
                    >
                      {isOpen ? (
                        <ChevronDown aria-hidden="true" />
                      ) : (
                        <ChevronRight aria-hidden="true" />
                      )}
                    </Button>
                  </TableCell>
                  {tableRow.getAllCells().map((cell) => {
                    const id = cell.column.id;
                    return (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          id === "proveedor" && "max-w-[280px]",
                          id === "formasText" && "max-w-[200px]",
                          id === "folio" && "font-mono",
                          RIGHT_ALIGNED.has(id) && "text-right tabular-nums",
                        )}
                      >
                        {renderCell(id, row)}
                      </TableCell>
                    );
                  })}
                  <TableCell className="w-12 text-right">
                    <RowMenu row={row} onExclude={exclude} onReinclude={reinclude} />
                  </TableCell>
                </TableRow>
                {isOpen ? (
                  <TableRow className="hover:bg-secondary">
                    <TableCell colSpan={COLUMN_COUNT} className="bg-secondary p-4 whitespace-normal">
                      <ConceptsPanel
                        row={row}
                        mode={mode}
                        panelId={panelId}
                        payments={payments.get(entry.uuid) ?? []}
                        substitutedByRef={substitutedByRef}
                      />
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
