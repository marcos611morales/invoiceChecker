"use client";

import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { es } from "@/lib/copy/es";
import { logout } from "@/lib/client/logout";

export function LogoutButton() {
  return (
    <Button
      type="button"
      variant="ghost"
      aria-label={es.global.logout}
      onClick={() => {
        void logout();
      }}
      className="h-9 max-sm:size-11 max-sm:px-0"
    >
      <LogOut className="size-4" aria-hidden="true" />
      <span className="max-sm:sr-only">{es.global.logout}</span>
    </Button>
  );
}
