"use client";

import { useId } from "react";
import { Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { es } from "@/lib/copy/es";
import { useStorageStatusStore } from "@/stores/storageStatusStore";
import { CategoryList } from "./CategoryList";
import { SupplierCategoryTable } from "./SupplierCategoryTable";

/**
 * Categorías tab (D-01), in the UI-SPEC order with 32 px between sections: title row,
 * the «Mis categorías» card and the «Categoría por proveedor» section. The backup buttons
 * and their alerts arrive in a later plan of the phase, in the title row and under it.
 */
export function CategoriesTab() {
  const supplierHeadingId = useId();
  const writeFailed = useStorageStatusStore((s) => s.writeFailed);
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl leading-[1.2] font-semibold">{es.categories.heading}</h2>
        <p className="text-xs text-muted-foreground">{es.categories.intro}</p>
      </div>
      {/* Not dismissible: it stays until a later write succeeds (Q8). */}
      {writeFailed ? (
        <Alert>
          <Info aria-hidden="true" className="text-muted-foreground" />
          <AlertDescription className="text-foreground">
            {es.categories.writeFailedAlert}
          </AlertDescription>
        </Alert>
      ) : null}
      <CategoryList />
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
