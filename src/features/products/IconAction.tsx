"use client";

import type { ReactNode, Ref } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Icon-only ghost button whose Tooltip carries the same text as its accessible name, so a
 * screen-reader list of buttons names what each one acts on (UI-SPEC accessibility). 36px,
 * 44px under 640px.
 */
export function IconAction({
  label,
  onClick,
  buttonRef,
  describedBy,
  children,
}: {
  label: string;
  onClick: () => void;
  buttonRef?: Ref<HTMLButtonElement>;
  /** Id of the element whose text names what the button acts on, announced after the label. */
  describedBy?: string;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            ref={buttonRef}
            type="button"
            variant="ghost"
            size="icon"
            aria-label={label}
            aria-describedby={describedBy}
            onClick={onClick}
            className="size-9 max-sm:size-11"
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent className="break-words">{label}</TooltipContent>
    </Tooltip>
  );
}
