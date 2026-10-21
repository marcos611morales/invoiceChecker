"use client";

import { useState, type ReactElement } from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { es } from "@/lib/copy/es";
import { noProductMatches } from "@/lib/copy/messages";

/** One choice of the picker: an opaque id, the text that is searched and shown, and a muted caption. */
export interface PickerOption {
  id: string;
  label: string;
  caption?: string;
}

/** A titled group of choices. Groups without options are not shown. */
export interface PickerGroup {
  heading: string;
  options: readonly PickerOption[];
}

/** Lower case without accents, so «cafe» finds «Café». */
function comparable(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/**
 * Searchable product picker (UI-SPEC "Mover a…" / "Unir con…" popover): a Popover with a
 * Command list. 320px wide (the width of its trigger under 640px), list at most 288px high,
 * items 36px (44px under 640px). `trigger` is the button that opens it (the picker never
 * renders vendor or product text as anything but React text); `tooltip`, when given, is the
 * Tooltip of an icon-only trigger. The search runs on the option label only, never on the id.
 */
export function ProductPicker({
  trigger,
  tooltip,
  groups,
  onPick,
}: {
  trigger: ReactElement;
  tooltip?: string;
  groups: readonly PickerGroup[];
  onPick: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const popoverTrigger = <PopoverTrigger render={trigger} />;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch("");
      }}
    >
      {tooltip === undefined ? (
        popoverTrigger
      ) : (
        <Tooltip>
          <TooltipTrigger render={popoverTrigger} />
          <TooltipContent className="break-words">{tooltip}</TooltipContent>
        </Tooltip>
      )}
      <PopoverContent align="end" className="w-80 p-0 max-sm:w-(--anchor-width)">
        <Command
          label={es.products.picker.search}
          filter={(_value, query, keywords) =>
            comparable(keywords?.[0] ?? "").includes(comparable(query.trim())) ? 1 : 0
          }
        >
          <CommandInput
            value={search}
            onValueChange={setSearch}
            placeholder={es.products.picker.search}
          />
          <CommandList className="max-h-72">
            <CommandEmpty>{noProductMatches(search)}</CommandEmpty>
            {groups
              .filter((group) => group.options.length > 0)
              .map((group) => (
                <CommandGroup key={group.heading} heading={group.heading}>
                  {group.options.map((option) => (
                    <CommandItem
                      key={option.id}
                      value={option.id}
                      keywords={[option.label]}
                      className="h-9 max-sm:h-11"
                      onSelect={() => {
                        setOpen(false);
                        setSearch("");
                        onPick(option.id);
                      }}
                    >
                      <span className="min-w-0 flex-1 truncate">{option.label}</span>
                      {option.caption === undefined ? null : (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {option.caption}
                        </span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
