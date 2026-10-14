"use client";

import { logout } from "@/lib/client/logout";

export function LogoutButton() {
  return (
    <button
      type="button"
      onClick={() => {
        void logout();
      }}
      className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
    >
      Cerrar sesión
    </button>
  );
}
