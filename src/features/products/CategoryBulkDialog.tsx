"use client";

import { useRef } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { es } from "@/lib/copy/es";
import { bulkAcceptConfirm, categoryBulkBody, categoryBulkTitle } from "@/lib/copy/messages";

/**
 * Confirmation of «Aceptar todas» for the category rows (D-23, UI-SPEC OQ6), the same pattern as
 * `BulkAcceptDialog`. It states the exact count: `applied` rows have a chosen category and will get
 * it, `skipped` rows have none and are left as they are. «Volver a revisar» has the initial focus,
 * so Enter never accepts by accident; only the accent button applies anything.
 */
export function CategoryBulkDialog({
  open,
  onOpenChange,
  applied,
  skipped,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Rows whose Select has a category: each one is applied with the single-row rules. */
  applied: number;
  /** Rows whose Select is empty: skipped and counted in the text. */
  skipped: number;
  onConfirm: () => void;
}) {
  const dismissRef = useRef<HTMLButtonElement>(null);
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent initialFocus={dismissRef}>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl leading-[1.2] font-semibold">
            {categoryBulkTitle(applied)}
          </AlertDialogTitle>
          <AlertDialogDescription>{categoryBulkBody(applied, skipped)}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel ref={dismissRef} className="max-sm:h-11">
            {es.products.queue.bulkDismiss}
          </AlertDialogCancel>
          <AlertDialogAction
            className="max-sm:h-11"
            onClick={() => {
              onConfirm();
            }}
          >
            {bulkAcceptConfirm(applied)}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
