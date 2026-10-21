"use client";

import {
  Fragment,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
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
import { Check, ChevronDown, ChevronRight, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { SortHeaderButton, ariaSort } from "@/components/SortHeaderButton";
import { TruncatedText } from "@/components/TruncatedText";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { orderedCategories } from "@/domain/settings/categories";
import type { ProductNameError } from "@/domain/settings/products";
import { SIN_CATEGORIA, type Category, type Product } from "@/domain/settings/types";
import { es } from "@/lib/copy/es";
import {
  acceptErrorText,
  deleteProductAria,
  expandMembersAria,
  membersCount,
  paginationPageText,
  paginationRangeText,
  productCategoryAria,
  productDeletedToast,
  productFreedText,
  productsHeading,
  renameProductAria,
  renameProductInputAria,
  suppliersCell,
} from "@/lib/copy/messages";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/stores/settingsStore";
import { IconAction } from "./IconAction";
import { ProductMembers } from "./ProductMembers";

/** The undo toast stays six seconds (UI-SPEC defaults). */
const TOAST_DURATION_MS = 6000;

/** A table row: the product plus what the sorts and the cells read. */
interface ProductRow {
  id: string;
  name: string;
  /** Id of the product's category when it exists; null reads «Sin categoría» (D-16). */
  categoryId: string | null;
  /** Name of that category; undefined when unset so it sorts last. */
  categoryName: string | undefined;
  memberCount: number;
  /** Distinct supplier names, in member order. */
  suppliers: string[];
  product: Product;
}

function toRow(product: Product, categoryNames: ReadonlyMap<string, string>): ProductRow {
  const categoryName =
    product.categoryId === null ? undefined : categoryNames.get(product.categoryId);
  const suppliers: string[] = [];
  for (const member of product.members) {
    if (!suppliers.includes(member.supplierName)) suppliers.push(member.supplierName);
  }
  return {
    id: product.id,
    name: product.name,
    // A category that no longer exists adds no level, so the row reads it as unset.
    categoryId: categoryName === undefined ? null : product.categoryId,
    categoryName,
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
  helper.accessor("categoryName", {
    id: "categoria",
    header: es.products.list.columns.category,
    sortFn: "es",
    sortUndefined: "last",
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

/** Item text wraps even though the shared SelectItem keeps it on one line. */
const WRAPPING_TEXT = "whitespace-normal break-words";

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
 * Inline name editor of one row (the Phase 3 pattern): the current name selected, Enter saves,
 * Esc cancels, blur does nothing. Mounted only while its row is being edited, so every opening
 * starts from the current name with no error. `onSave` returns the refusal reason, or null when
 * the name was saved. The error text is the one of the suggestion cards.
 */
function RenameEditor({
  name,
  onSave,
  onCancel,
}: {
  name: string;
  onSave: (value: string) => ProductNameError | null;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(name);
  const [error, setError] = useState<ProductNameError | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const errorId = useId();

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const save = () => {
    setError(onSave(value));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      save();
    } else if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
    }
  };

  return (
    <div className="flex min-w-[260px] flex-col gap-1">
      <div className="flex items-center gap-2">
        <Input
          ref={inputRef}
          value={value}
          maxLength={60}
          aria-label={renameProductInputAria(name)}
          aria-invalid={error !== null ? true : undefined}
          aria-describedby={error !== null ? errorId : undefined}
          onChange={(event) => {
            setValue(event.target.value);
            setError(null);
          }}
          onKeyDown={onKeyDown}
          className="h-9 max-sm:h-11"
        />
        <IconAction label={es.products.list.saveName} onClick={save}>
          <Check aria-hidden="true" />
        </IconAction>
        <IconAction label={es.products.list.cancelRename} onClick={onCancel}>
          <X aria-hidden="true" />
        </IconAction>
      </div>
      {error !== null ? (
        <p id={errorId} className="text-xs text-foreground">
          {acceptErrorText(error)}
        </p>
      ) : null}
    </div>
  );
}

/** «Sin categoría» first, then the categories in list order (UI-SPEC E6). */
function categoryItems(categories: readonly Category[]): { value: string; label: string }[] {
  return [
    { value: SIN_CATEGORIA, label: es.categories.none },
    ...orderedCategories(categories).map((category) => ({
      value: category.id,
      label: category.name,
    })),
  ];
}

/** Which button gets focus once the list has rendered again. */
type PendingFocus = { kind: "pencil" | "expander"; id: string };

/**
 * «Mis productos» (D-14): the accepted products in a sortable, paginated table. Each row opens
 * a members sub-table; several can be open at once. A row can be renamed in place and deleted,
 * both with «Deshacer» for six seconds where it deletes. Product names, descriptions and
 * supplier names are free or XML text and are only ever rendered as React text (T-04-19).
 * `onEmptied` is called, before the change, when the change leaves no product at all: this
 * list is then unmounted, so the parent places focus.
 */
export function ProductList({ onEmptied }: { onEmptied?: () => void }) {
  const products = useSettingsStore((s) => s.products);
  const categories = useSettingsStore((s) => s.categories);
  const setProductCategory = useSettingsStore((s) => s.setProductCategory);
  const renameProduct = useSettingsStore((s) => s.renameProduct);
  const deleteProduct = useSettingsStore((s) => s.deleteProduct);
  const restoreProduct = useSettingsStore((s) => s.restoreProduct);
  const data = useMemo(() => {
    const names = new Map<string, string>(categories.map((category) => [category.id, category.name]));
    return products.map((product) => toRow(product, names));
  }, [products, categories]);
  const items = useMemo(() => categoryItems(categories), [categories]);
  const headingId = useId();
  const panelBaseId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const pencilRefs = useRef(new Map<string, HTMLButtonElement>());
  const expanderRefs = useRef(new Map<string, HTMLButtonElement>());
  const pendingFocus = useRef<PendingFocus | null>(null);
  const [sorting, setSorting] = useState<SortingState>(DEFAULT_SORTING);
  const [pagination, setPagination] = useState<PaginationState>(INITIAL_PAGINATION);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);

  // After a rename ends the pencil is rendered again, and after a member change the expander
  // may have been re-rendered, so focus moves here once the new render is in place.
  useEffect(() => {
    const target = pendingFocus.current;
    if (target === null) return;
    pendingFocus.current = null;
    const refs = target.kind === "pencil" ? pencilRefs.current : expanderRefs.current;
    refs.get(target.id)?.focus();
  });

  const saveRename = (id: string, value: string): ProductNameError | null => {
    const result = renameProduct(id, value);
    if (!result.ok) return result.reason;
    setEditingId(null);
    pendingFocus.current = { kind: "pencil", id };
    return null;
  };

  const cancelRename = (id: string) => {
    setEditingId(null);
    pendingFocus.current = { kind: "pencil", id };
  };

  // Focus moves first: the trash button that was pressed is about to leave the page.
  const placeFocusBeforeLeaving = () => {
    if (products.length <= 1) onEmptied?.();
    else headingRef.current?.focus();
  };

  const remove = (row: ProductRow) => {
    placeFocusBeforeLeaving();
    const snapshot = deleteProduct(row.id);
    if (snapshot === null) return;
    toast(productDeletedToast(row.name), {
      description: productFreedText(row.memberCount),
      duration: TOAST_DURATION_MS,
      action: {
        label: es.products.list.undo,
        onClick: () => {
          restoreProduct(snapshot);
        },
      },
    });
  };

  // A member change: when the product went with its last member focus goes to the heading
  // (or to the parent when nothing is left), else back to the product's expander.
  const memberChanged = (id: string, deleted: boolean) => {
    if (deleted) placeFocusBeforeLeaving();
    else pendingFocus.current = { kind: "expander", id };
  };

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

  // The change applies at once and persists; «Sin categoría» removes the product's level (D-16).
  const changeCategory = (row: ProductRow, next: string | null) => {
    if (next === null) return;
    setProductCategory(row.id, next === SIN_CATEGORIA ? null : next);
  };

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
        <h2
          id={headingId}
          ref={headingRef}
          tabIndex={-1}
          className="text-xl leading-[1.2] font-semibold outline-none"
        >
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
                      ref={(node) => {
                        if (node === null) expanderRefs.current.delete(row.id);
                        else expanderRefs.current.set(row.id, node);
                      }}
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
                        {id === "producto" ? (
                          editingId === row.id ? (
                            <RenameEditor
                              name={row.name}
                              onSave={(value) => saveRename(row.id, value)}
                              onCancel={() => {
                                cancelRename(row.id);
                              }}
                            />
                          ) : (
                            <NameCell name={row.name} />
                          )
                        ) : null}
                        {id === "categoria" ? (
                          <Select
                            items={items}
                            value={row.categoryId ?? SIN_CATEGORIA}
                            onValueChange={(next) => {
                              changeCategory(row, next);
                            }}
                          >
                            <SelectTrigger
                              aria-label={productCategoryAria(row.name)}
                              className={cn(
                                "w-[240px] data-[size=default]:max-sm:h-11 max-sm:w-full",
                                row.categoryId === null && "text-muted-foreground",
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
                        ) : null}
                        {id === "miembros" ? membersCount(row.memberCount) : null}
                        {id === "proveedores" ? (
                          <TruncatedText text={suppliersCell(row.suppliers)} />
                        ) : null}
                      </TableCell>
                    );
                  })}
                  <TableCell className="w-24">
                    {editingId === row.id ? null : (
                      <div className="flex items-center justify-end">
                        <IconAction
                          label={renameProductAria(row.name)}
                          onClick={() => {
                            setEditingId(row.id);
                          }}
                          buttonRef={(node) => {
                            if (node === null) pencilRefs.current.delete(row.id);
                            else pencilRefs.current.set(row.id, node);
                          }}
                        >
                          <Pencil aria-hidden="true" />
                        </IconAction>
                        <IconAction
                          label={deleteProductAria(row.name)}
                          onClick={() => {
                            remove(row);
                          }}
                        >
                          <Trash2 aria-hidden="true" />
                        </IconAction>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
                {open ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell id={panelId} colSpan={6} className="bg-secondary p-4 whitespace-normal">
                      <ProductMembers
                        product={row.product}
                        onChanged={(deleted) => {
                          memberChanged(row.id, deleted);
                        }}
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
