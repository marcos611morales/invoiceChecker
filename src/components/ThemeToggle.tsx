"use client";

import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { es } from "@/lib/copy/es";
import { toggleTheme, useActiveTheme, useMounted } from "@/lib/client/theme";

/** Two-state theme toggle: Moon in light (go dark), Sun in dark (go light). */
export function ThemeToggle() {
  const mounted = useMounted();
  const theme = useActiveTheme();

  const copy = es.global.themeToggle;
  const label = !mounted ? copy.fallback : theme === "dark" ? copy.toLight : copy.toDark;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            aria-label={label}
            onClick={toggleTheme}
            className="max-sm:size-11"
          />
        }
      >
        <Moon className="size-5 dark:hidden" aria-hidden="true" />
        <Sun className="hidden size-5 dark:block" aria-hidden="true" />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
