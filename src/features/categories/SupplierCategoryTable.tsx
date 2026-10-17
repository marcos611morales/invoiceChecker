"use client";

import { useMemo } from "react";
import { TruncatedText } from "@/components/TruncatedText";
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
import { supplierOptions, type FilterOption } from "@/domain/accounting/filters";
import { orderedCategories } from "@/domain/settings/categories";
import { SIN_CATEGORIA } from "@/domain/settings/types";
import { useLedger } from "@/features/dashboard/useLedger";
import { es } from "@/lib/copy/es";
import { supplierCategoryAria } from "@/lib/copy/messages";
import { useSettingsStore } from "@/stores/settingsStore";
import { useCategorySettings } from "./useCategorySettings";

/** Spanish order, accents and case ignored (the same rule as the supplier ranking). */
const COLLATOR = new Intl.Collator("es", { sensitivity: "base" });

/** Facturas descending, then name (UI-SPEC default sort). */
function compareSuppliers(a: FilterOption, b: FilterOption): number {
  return b.count - a.count || COLLATOR.compare(a.label, b.label);
}

/** Item text wraps even though the shared SelectItem keeps it on one line. */
const WRAPPING_TEXT = "whitespace-normal break-words";

/**
 * One row per loaded supplier with a Select for its default category (CAT-02, D-03).
 * Changing it applies at once through the settings store, which persists it; choosing
 * «Sin categoría» removes the assignment. A refused change (the 5,000-assignment limit)
 * leaves the stored settings as they were and the controlled Select keeps showing the
 * stored value; its toast belongs to Plan 03-06. Supplier names and RFCs come from XML
 * and are rendered as React text only (T-03-33).
 */
export function SupplierCategoryTable() {
  const ledger = useLedger();
  const { settings, resolver } = useCategorySettings();
  const setSupplierCategory = useSettingsStore((s) => s.setSupplierCategory);
  const suppliers = useMemo(() => supplierOptions(ledger).sort(compareSuppliers), [ledger]);
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

  return (
    <Table className="min-w-[900px]">
      <TableHeader>
        <TableRow className="bg-secondary hover:bg-secondary">
          <TableHead>{es.categories.columns.supplier}</TableHead>
          <TableHead>{es.categories.columns.rfc}</TableHead>
          <TableHead className="text-right">{es.categories.columns.invoices}</TableHead>
          <TableHead>{es.categories.columns.category}</TableHead>
          <TableHead className="w-12">
            <span className="sr-only">{es.categories.columns.actions}</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {suppliers.map((supplier) => (
          <TableRow key={supplier.key} className="h-12 hover:bg-secondary">
            <TableCell className="max-w-[280px]">
              <TruncatedText text={supplier.label} />
            </TableCell>
            <TableCell className="font-mono text-xs">{supplier.key}</TableCell>
            <TableCell className="text-right tabular-nums">{supplier.count}</TableCell>
            <TableCell>
              <Select
                items={items}
                value={resolver.supplierCategory(supplier.key)}
                onValueChange={(next) => {
                  if (next === null) return;
                  setSupplierCategory(
                    supplier.key,
                    supplier.label,
                    next === SIN_CATEGORIA ? null : next,
                  );
                }}
              >
                <SelectTrigger
                  aria-label={supplierCategoryAria(supplier.label)}
                  className="w-[296px] data-[size=default]:max-sm:h-11 max-sm:w-full"
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
            </TableCell>
            <TableCell className="w-12" />
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
