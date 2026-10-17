"use client";

import { useId } from "react";
import { es } from "@/lib/copy/es";
import { SupplierCategoryTable } from "./SupplierCategoryTable";

/**
 * Categorías tab (D-01). Plan 03-02 holds the heading and the «Categoría por proveedor»
 * section; the «Mis categorías» card and the backup buttons arrive in later plans of the
 * phase, above this section in the UI-SPEC order.
 */
export function CategoriesTab() {
  const supplierHeadingId = useId();
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl leading-[1.2] font-semibold">{es.categories.heading}</h2>
        <p className="text-xs text-muted-foreground">{es.categories.intro}</p>
      </div>
      <section aria-labelledby={supplierHeadingId} className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 id={supplierHeadingId} className="text-xl leading-[1.2] font-semibold">
            {es.categories.supplierHeading}
          </h2>
          <p className="text-xs text-muted-foreground">{es.categories.supplierIntro}</p>
        </div>
        <SupplierCategoryTable />
      </section>
    </div>
  );
}
