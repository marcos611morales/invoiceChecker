"use client";

import { Toaster } from "@/components/ui/sonner";
import { useActiveTheme } from "@/lib/client/theme";

/** Sonner toaster bound to the app's own light/dark theme (D-20). */
export function AppToaster() {
  const theme = useActiveTheme();
  return (
    <Toaster
      theme={theme}
      position="bottom-right"
      duration={6000}
      closeButton
    />
  );
}
