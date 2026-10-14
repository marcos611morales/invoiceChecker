"use client";

import { useRef, useState } from "react";
import { LogOut } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { es } from "@/lib/copy/es";
import { logout } from "@/lib/client/logout";
import { useSessionStore } from "@/stores/sessionStore";

/**
 * Sign-out (ACC-02). With invoices loaded it asks first (D-07a); either way it wipes the
 * in-memory store before leaving. clearAll also bumps the generation, so a batch still
 * parsing cannot write afterwards (Pitfall 12). logout() lands on /login even if the
 * request fails.
 */
export function LogoutButton() {
  const hasInvoices = useSessionStore((s) => s.invoices.length > 0);
  const clearAll = useSessionStore((s) => s.clearAll);
  const [dialogOpen, setDialogOpen] = useState(false);
  const dismissRef = useRef<HTMLButtonElement>(null);

  async function leave(): Promise<void> {
    clearAll();
    await logout();
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        aria-label={es.global.logout}
        onClick={() => {
          if (hasInvoices) {
            setDialogOpen(true);
          } else {
            void leave();
          }
        }}
        className="h-9 max-sm:size-11 max-sm:px-0"
      >
        <LogOut className="size-4" aria-hidden="true" />
        <span className="max-sm:sr-only">{es.global.logout}</span>
      </Button>
      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent initialFocus={dismissRef}>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl leading-[1.2] font-semibold">
              {es.dialogs.logout.title}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {es.dialogs.logout.body}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel ref={dismissRef}>
              {es.dialogs.logout.dismiss}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setDialogOpen(false);
                void leave();
              }}
            >
              {es.dialogs.logout.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
