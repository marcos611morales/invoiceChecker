"use client";

import { Check } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { IvaMode } from "@/domain/accounting/aggregate";
import { es } from "@/lib/copy/es";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/stores/settingsStore";

type IvaToggleVariant = "bar" | "subbar";

const TEST_ID: Record<IvaToggleVariant, string> = {
  bar: "iva-toggle-bar",
  subbar: "iva-toggle-subbar",
};

interface ModeCopy {
  mode: IvaMode;
  full: string;
  short: string;
  tooltip: string;
}

const MODES: readonly ModeCopy[] = [
  { mode: "con", full: es.iva.con, short: es.iva.conShort, tooltip: es.iva.conTooltip },
  { mode: "sin", full: es.iva.sin, short: es.iva.sinShort, tooltip: es.iva.sinTooltip },
];

function isIvaMode(value: string): value is IvaMode {
  return value === "con" || value === "sin";
}

/**
 * Con IVA / Sin IVA segmented control (REGLA-03, D-05). Base UI hands the group an
 * array and pressing the pressed item yields an empty one (Pitfall 6): an array
 * without a valid mode is ignored, so the group can never end up with no selection.
 * The "bar" variant lives in the top bar from 640 px; the "subbar" variant (short
 * labels, 44 px items) lives in the sticky strip under 640 px. Each variant hides
 * itself with CSS so only one is in the accessibility tree at a time.
 */
export function IvaToggle({ variant }: { variant: IvaToggleVariant }) {
  const ivaMode = useSettingsStore((s) => s.ivaMode);
  const setIvaMode = useSettingsStore((s) => s.setIvaMode);
  const compact = variant === "subbar";

  return (
    <div
      data-testid={TEST_ID[variant]}
      className={compact ? "sm:hidden" : "max-sm:hidden"}
    >
      <ToggleGroup
        aria-label={es.iva.groupLabel}
        spacing={1}
        value={[ivaMode]}
        onValueChange={(groupValue) => {
          const next = groupValue.find(isIvaMode);
          if (next !== undefined) setIvaMode(next);
        }}
        className="rounded-lg border border-border bg-secondary p-0.5"
      >
        {MODES.map(({ mode, full, short, tooltip }) => {
          const active = mode === ivaMode;
          return (
            <Tooltip key={mode}>
              <TooltipTrigger
                render={
                  <ToggleGroupItem
                    value={mode}
                    aria-label={full}
                    className={cn(
                      "h-9 min-w-[72px] gap-1 border px-3 text-sm font-semibold max-sm:h-11",
                      active
                        ? "border-border bg-background text-foreground aria-pressed:bg-background"
                        : "border-transparent bg-transparent text-muted-foreground",
                    )}
                  />
                }
              >
                {active && <Check className="size-4" aria-hidden="true" />}
                <span>{compact ? short : full}</span>
              </TooltipTrigger>
              <TooltipContent>{tooltip}</TooltipContent>
            </Tooltip>
          );
        })}
      </ToggleGroup>
    </div>
  );
}
