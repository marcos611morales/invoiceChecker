"use client";

import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { es } from "@/lib/copy/es";
import { IvaToggle } from "./IvaToggle";
import { LogoutButton } from "./LogoutButton";

/**
 * Top bar. With `showIva` (the loaded screen only) the IVA control sits in the centre
 * slot from 640 px; under 640 px it moves to a sticky 52 px strip right below the bar,
 * so the active mode is always visible (REGLA-03, D-05).
 */
export function TopBar({
  actions,
  showIva = false,
}: {
  actions?: ReactNode;
  showIva?: boolean;
}) {
  return (
    <>
      <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-4 border-b border-border bg-secondary px-4 sm:px-6">
        <span className="text-xl font-semibold whitespace-nowrap">{es.global.appName}</span>
        <div data-slot="topbar-center" className="flex flex-1 items-center justify-center">
          {showIva && <IvaToggle variant="bar" />}
        </div>
        <div className="flex items-center gap-2">
          {actions}
          <ThemeToggle />
          <LogoutButton />
        </div>
      </header>
      {showIva && (
        <div
          data-slot="iva-subbar"
          className="sticky top-14 z-30 flex h-13 shrink-0 items-center justify-center border-b border-border bg-secondary sm:hidden"
        >
          <IvaToggle variant="subbar" />
        </div>
      )}
    </>
  );
}
