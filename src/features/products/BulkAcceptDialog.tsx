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
import { bulkAcceptBody, bulkAcceptConfirm, bulkAcceptTitle } from "@/lib/copy/messages";

/**
 * Confirmation of «Aceptar todas las visibles» (D-20, UI-SPEC lines 247-249). It states the exact
 * count: `created` cards will become new products and `addedTo` cards will add descriptions to
 * products the user already has, so the title counts both. «Volver a revisar» has the initial focus,
 * so Enter never accepts by accident; only the accent button applies anything.
 */
export function BulkAcceptDialog({
  open,
  onOpenChange,
  created,
  addedTo,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Visible cards without a target: each becomes a new product. */
  created: number;
  /** Visible cards with a target: each adds descriptions to a product that already exists. */
  addedTo: number;
  onConfirm: () => void;
}) {
  const dismissRef = useRef<HTMLButtonElement>(null);
  const total = created + addedTo;
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent initialFocus={dismissRef}>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl leading-[1.2] font-semibold">
            {bulkAcceptTitle(total)}
          </AlertDialogTitle>
          <AlertDialogDescription>{bulkAcceptBody(created, addedTo)}</AlertDialogDescription>
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
            {bulkAcceptConfirm(total)}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
