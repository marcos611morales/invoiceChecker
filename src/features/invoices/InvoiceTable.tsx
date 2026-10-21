"use client";

import { Fragment, useEffect, useId, useMemo, useRef, useState } from "react";
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
import { ruleLineCounts, type ScopedEntry } from "@/domain/accounting/categories";
import type { LedgerEntry } from "@/domain/accounting/ledger";
import { orderedCategories } from "@/domain/settings/categories";
import { ruleMapKey } from "@/domain/settings/normalize";
import type { Resolver } from "@/domain/settings/resolver";
import type { Category } from "@/domain/settings/types";
import { useCategorySettings } from "@/features/categories/useCategorySettings";
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
  partOfTotalText,
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
  withFullAmounts,
} from "./columns";
import type { ConceptRow, InvoiceRow, RowState } from "./columns";
import { ConceptCategorySelect } from "./ConceptCategorySelect";

export interface InvoiceTableProps {
  /**
   * The visible ledger entries scoped to the category selection: every one is a row, whether it
   * sums or not (D-27). Under a category filter their amounts are the part of the chosen categories.
   */
  rows: readonly ScopedEntry[];
  /** The whole ledger, to resolve payments and substituting invoices. */
  ledger: readonly LedgerEntry[];
  mode: IvaMode;
  /** The effective category selection of the Dashboard; empty means no category filter (D-14). */
  categoryFilter: ReadonlySet<string>;
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
  onReinclude: (entry: LedgerEntry) => void;
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
            if (reinclude) onReinclude(entry);
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
  resolver,
  lineCounts,
  categories,
  nameOf,
  categoryFilter,
}: {
  row: InvoiceRow;
  mode: IvaMode;
  panelId: string;
  payments: ReadonlyArray<{ fechaPago: string; formaDePagoP: string }>;
  substitutedByRef: string | null;
  resolver: Resolver;
  /** Loaded lines per rule key over the whole ledger, for the «Aplica a N líneas» caption (D-09). */
  lineCounts: ReadonlyMap<string, number>;
  /** The user's categories in list order. */
  categories: readonly Category[];
  nameOf: (key: string) => string;
  /** While not empty, the lines of other categories read as outside the filter (D-14). */
  categoryFilter: ReadonlySet<string>;
}) {
  const { entry } = row;
  const titleId = `${panelId}-title`;
  const concepts = conceptRows(entry, mode, resolver);
  // The invoice amount governs, so the gap never uses the partial amount of a category filter.
  const difference = roundingDifference(withFullAmounts(entry), mode);
  // A line of another category is outside the filter: muted color (never opacity) plus a label (D-14).
  const isDimmed = (concept: ConceptRow) =>
    categoryFilter.size > 0 && !categoryFilter.has(concept.category);
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
            <TableHead>{es.invoices.conceptColumns.category}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {concepts.map((concept) => (
            <TableRow
              key={concept.key}
              className={cn("hover:bg-secondary", isDimmed(concept) && "text-muted-foreground")}
            >
              <TableCell className="max-w-[420px] align-top whitespace-normal wrap-anywhere">
                {concept.descripcion}
                {isDimmed(concept) ? <span className="sr-only">{es.invoices.notInCategoryFilter}</span> : null}
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
              {/* The rule belongs to supplier plus description, so the selector works on
                  every row with concepts, summing or not (UI-SPEC Q6). */}
              <TableCell className="align-top">
                <ConceptCategorySelect
                  rfc={entry.supplierRfc}
                  supplierName={entry.supplierName}
                  descripcion={concept.descripcion}
                  ruleKey={concept.ruleKey}
                  lineCount={lineCounts.get(ruleMapKey(entry.supplierRfc, concept.ruleKey)) ?? 0}
                  category={concept.category}
                  source={concept.source}
                  productName={concept.productName}
                  categories={categories}
                  nameOf={nameOf}
                />
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
export function InvoiceTable({ rows: entries, ledger, mode, categoryFilter }: InvoiceTableProps) {
  const filterActive = categoryFilter.size > 0;
  const excludeInvoice = useSessionStore((s) => s.excludeInvoice);
  const undoExclusion = useSessionStore((s) => s.undoExclusion);
  const reincludeInvoice = useSessionStore((s) => s.reincludeInvoice);
  const { settings, resolver, nameOf } = useCategorySettings();
  const categories = useMemo(() => orderedCategories(settings.categories), [settings.categories]);
  const focusRequest = useSessionStore((s) => s.focusRequest);
  const clearFocusRequest = useSessionStore((s) => s.clearFocusRequest);
  const revealRequest = useSessionStore((s) => s.revealRequest);
  const rows = useMemo(() => toInvoiceRows(entries, mode), [entries, mode]);
  const payments = useMemo(() => buildPaymentIndex(ledger), [ledger]);
  const byUuid = useMemo(() => new Map(ledger.map((entry) => [entry.uuid, entry])), [ledger]);
  // Over the whole ledger, not the visible rows: the caption says how far a rule reaches (D-09).
  const lineCounts = useMemo(() => ruleLineCounts(ledger), [ledger]);
  const [sorting, setSorting] = useState<SortingState>(DEFAULT_SORTING);
  const [pagination, setPagination] = useState<PaginationState>(INITIAL_PAGINATION);
  // Open panels are kept by invoice id, so sorting, paging and filtering keep them.
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set<string>());
  // Nonce of the last "Ver factura" request whose page and panel were resolved (idempotent render).
  const [handledNonce, setHandledNonce] = useState(0);
  const sectionRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  // The request value already seen: the one present at mount counts as handled, so coming back to
  // this tab never replays an old reveal (D-18).
  const handledReveal = useRef(revealRequest);
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

  // "Ver factura" (D-33): resolve the page and the open panel with derived state during
  // render, not in an effect (Pitfall 17). The index is read from the sorted row model
  // before pagination, so it follows the current sort. A row the filters hide is left
  // alone: the Dashboard explains it and nothing moves silently.
  if (focusRequest !== null && focusRequest.nonce !== handledNonce) {
    const index = table
      .getPrePaginatedRowModel()
      .rows.findIndex((tableRow) => tableRow.id === focusRequest.uuid);
    if (index >= 0) {
      setHandledNonce(focusRequest.nonce);
      setPagination({ pageIndex: Math.floor(index / PAGE_SIZE), pageSize: PAGE_SIZE });
      setOpen((current) => new Set(current).add(focusRequest.uuid));
    }
  }

  // After the commit that shows the page: only the DOM is touched here. A missing node
  // never throws, and the request is always cleared once handled or when it names a
  // uuid that is not loaded (T-02-29).
  useEffect(() => {
    if (focusRequest === null) return;
    if (!byUuid.has(focusRequest.uuid)) {
      clearFocusRequest();
      return;
    }
    if (focusRequest.nonce !== handledNonce) return;
    const section = sectionRef.current;
    const rowElement =
      section === null
        ? undefined
        : Array.from(section.querySelectorAll<HTMLElement>("[data-row-id]")).find(
            (element) => element.getAttribute("data-row-id") === focusRequest.uuid,
          );
    if (rowElement !== undefined) {
      const reduceMotion =
        typeof window.matchMedia !== "function" ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      rowElement.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
      rowElement.querySelector<HTMLElement>("button[aria-expanded]")?.focus();
    }
    clearFocusRequest();
  }, [focusRequest, handledNonce, byUuid, clearFocusRequest]);

  // A category or supplier row asked to show its invoices (D-18, DASH-08): bring the section to
  // the top of the screen and put focus on its heading. Only the DOM is touched; no row opens.
  useEffect(() => {
    if (revealRequest === 0 || revealRequest === handledReveal.current) return;
    handledReveal.current = revealRequest;
    const reduceMotion =
      typeof window.matchMedia !== "function" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    sectionRef.current?.scrollIntoView({ block: "start", behavior: reduceMotion ? "auto" : "smooth" });
    headingRef.current?.focus({ preventScroll: true });
  }, [revealRequest]);

  const toggle = (uuid: string) => {
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(uuid)) next.delete(uuid);
      else next.add(uuid);
      return next;
    });
  };

  const exclude = (uuid: string) => {
    const undo = excludeInvoice(uuid);
    toast(es.invoices.excludedToast, {
      duration: TOAST_DURATION_MS,
      action: {
        label: es.invoices.undo,
        onClick: () => {
          undoExclusion(undo);
        },
      },
    });
  };

  const reinclude = (entry: LedgerEntry) => {
    // The override applies only when the row has a loaded substitute; a row that is both
    // excluded by hand and substituted overrides too (user decision, UAT G-02-10).
    reincludeInvoice(entry.uuid, { overrideSubstitution: entry.substitutedBy !== null });
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
        // Under a category filter `amount` is the part of the chosen categories; the whole
        // invoice goes right below it so the part is never read as the invoice total (D-14, T-03-37).
        const fullAmount = filterActive ? row.fullAmount : undefined;
        return (
          <div className="flex flex-col items-end py-1">
            <span className={cn(row.state === "excluida" && "line-through")}>
              {row.amount === undefined ? "—" : formatMoney(row.amount)}
            </span>
            {fullAmount === undefined ? null : (
              <span className="text-xs text-muted-foreground">
                {partOfTotalText(formatMoney(fullAmount))}
              </span>
            )}
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
    <section
      ref={sectionRef}
      aria-labelledby={headingId}
      className="flex min-w-0 scroll-mt-[72px] flex-col gap-4 max-sm:scroll-mt-[124px]"
    >
      <div className="flex flex-col gap-1">
        <h2
          ref={headingRef}
          id={headingId}
          tabIndex={-1}
          className="text-xl leading-[1.2] font-semibold"
        >
          {invoicesHeading(rows.length)}
        </h2>
        {/* role="note" overrides the default alert role: the note never changes,
            so it must not be announced on every load. */}
        <Alert role="note">
          <Info aria-hidden="true" />
          <AlertDescription>
            {es.invoices.note}
            {filterActive ? (
              <>
                {" "}
                <span>{es.invoices.categoryNote}</span>
              </>
            ) : null}
          </AlertDescription>
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
              entry.kind === "nota-credito" ||
              foreignInfo(entry, mode) !== null ||
              (filterActive && row.fullAmount !== undefined);
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
                        resolver={resolver}
                        lineCounts={lineCounts}
                        categories={categories}
                        nameOf={nameOf}
                        categoryFilter={categoryFilter}
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
