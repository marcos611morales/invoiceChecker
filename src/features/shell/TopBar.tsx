"use client";

import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { es } from "@/lib/copy/es";
import { LogoutButton } from "./LogoutButton";

export function TopBar({
  actions,
}: {
  actions?: ReactNode;
  showIva?: boolean;
}) {
  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-4 border-b border-border bg-secondary px-4 sm:px-6">
      <span className="text-xl font-semibold whitespace-nowrap">{es.global.appName}</span>
      {/* Reserved for the Phase 2 IVA selector and the Phase 3 export button; renders nothing in Phase 1. */}
      <div data-slot="topbar-center" className="flex-1" />
      <div className="flex items-center gap-2">
        {actions}
        <ThemeToggle />
        <LogoutButton />
      </div>
    </header>
  );
}
