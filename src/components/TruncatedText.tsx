"use client";

import { useSyncExternalStore } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** Touch devices: no hover, or a coarse pointer (UI-SPEC decision 9). */
const TOUCH_QUERY = "(hover: none), (pointer: coarse)";

/** matchMedia may not exist (jsdom, server render): treat that as a pointer device. */
function readMediaQuery(): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return null;
  }
  try {
    return window.matchMedia(TOUCH_QUERY);
  } catch {
    return null;
  }
}

function subscribeToTouch(onChange: () => void): () => void {
  const media = readMediaQuery();
  if (media === null) return () => {};
  media.addEventListener("change", onChange);
  return () => {
    media.removeEventListener("change", onChange);
  };
}

function isTouchDevice(): boolean {
  return readMediaQuery()?.matches ?? false;
}

function useIsTouchDevice(): boolean {
  return useSyncExternalStore(subscribeToTouch, isTouchDevice, () => false);
}

const BUTTON_CLASS =
  "block w-full min-w-0 cursor-default truncate rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Text that truncates inside its container and still gives access to the full
 * value (UI-SPEC decision 9). The truncated text is a button whose accessible
 * name is the full text; pointer devices get a Tooltip on hover or focus, touch
 * devices open the full text in a Popover on tap. The value is rendered as React
 * text only (T-02-20).
 */
export function TruncatedText({ text, className }: { text: string; className?: string }) {
  const touch = useIsTouchDevice();
  const triggerClass = cn(BUTTON_CLASS, className);
  if (touch) {
    return (
      <Popover>
        <PopoverTrigger aria-label={text} className={cn(triggerClass, "cursor-pointer")}>
          {text}
        </PopoverTrigger>
        <PopoverContent className="w-auto max-w-xs break-words">{text}</PopoverContent>
      </Popover>
    );
  }
  return (
    <Tooltip>
      <TooltipTrigger aria-label={text} className={triggerClass}>
        {text}
      </TooltipTrigger>
      <TooltipContent className="break-words">{text}</TooltipContent>
    </Tooltip>
  );
}
