"use client";

import { useId, useState } from "react";
import { Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { es } from "@/lib/copy/es";
import { useStorageStatusStore } from "@/stores/storageStatusStore";
import { BackupControls, BackupErrorAlert, type BackupError } from "./BackupControls";
import { CategoryList } from "./CategoryList";
import { SupplierCategoryTable } from "./SupplierCategoryTable";

/**
 * Categorías tab (D-01), in the UI-SPEC order with 32 px between sections: title row with the
 * backup buttons on the right, the invalid-file and storage Alerts when present, the
 * «Mis categorías» card and the «Categoría por proveedor» section.
 */
export function CategoriesTab() {
  const supplierHeadingId = useId();
  const writeFailed = useStorageStatusStore((s) => s.writeFailed);
  const [backupError, setBackupError] = useState<BackupError | null>(null);
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-xl leading-[1.2] font-semibold">{es.categories.heading}</h2>
          <p className="text-xs text-muted-foreground">{es.categories.intro}</p>
        </div>
        <BackupControls onError={setBackupError} />
      </div>
      <BackupErrorAlert
        error={backupError}
        onClose={() => {
          setBackupError(null);
        }}
      />
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
