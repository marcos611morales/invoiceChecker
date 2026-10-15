"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { FilterOption } from "@/domain/accounting/filters";
import { normalizeSearch } from "@/lib/format";

/**
 * Display names of the selected keys, in the order of the options; a selected
 * key that is no longer among the options is shown as the key itself.
 */
export function selectedNames(
  options: readonly FilterOption[],
  selected: ReadonlySet<string>,
): string[] {
  const names: string[] = [];
  const known = new Set<string>();
  for (const option of options) {
    known.add(option.key);
    if (selected.has(option.key)) names.push(option.label);
  }
  for (const key of selected) {
    if (!known.has(key)) names.push(key);
  }
  return names;
}

/**
 * Popover with a searchable checkbox list (D-14). Nothing selected means no
 * filter. Every label is rendered as a React text node (T-02-15). cmdk's own
 * filtering and sorting are off: the data order (count, then Spanish name) must
 * not change while the user types (RESEARCH Pitfall 7).
 */
export function MultiSelectFilter(props: {
  label: string;
  options: readonly FilterOption[];
  selected: ReadonlySet<string>;
  onChange: (next: ReadonlySet<string>) => void;
  searchPlaceholder: string;
  clearLabel: string;
  noMatch: (text: string) => string;
  widthClass: string;
}) {
  const { label, options, selected, onChange, searchPlaceholder, clearLabel, noMatch, widthClass } =
    props;
  const [search, setSearch] = useState("");

  const query = normalizeSearch(search);
  const visible = useMemo(
    () =>
      query === ""
        ? options
        : options.filter((option) => normalizeSearch(option.label).includes(query)),
    [options, query],
  );
  const summary = useMemo(() => selectedNames(options, selected).join(", "), [options, selected]);

  // The handler closes over the option key: cmdk hands back a lowercased value.
  const toggle = (key: string): void => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange(next);
  };

  return (
    <Popover
      onOpenChange={(open) => {
        if (!open) setSearch("");
      }}
    >
      <PopoverTrigger
        render={<Button variant="outline" size="lg" className="max-sm:h-11 max-sm:w-full" />}
      >
        <span className="font-semibold">{selected.size > 0 ? `${label}:` : label}</span>
        {selected.size > 0 ? (
          <Tooltip>
            <TooltipTrigger
              render={<span className="max-w-[200px] truncate font-normal text-muted-foreground" />}
            >
              {summary}
            </TooltipTrigger>
            <TooltipContent>{summary}</TooltipContent>
          </Tooltip>
        ) : null}
        <ChevronDown className="size-3.5" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent align="start" className={`${widthClass} max-w-[calc(100vw-2rem)]`}>
        <Command shouldFilter={false} className="h-auto bg-transparent p-0">
          <CommandInput
            value={search}
            onValueChange={setSearch}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
          />
          <CommandList className="max-h-72" aria-multiselectable="true">
            {visible.map((option) => {
              const checked = selected.has(option.key);
              return (
                <CommandItem
                  key={option.key}
                  value={option.key}
                  aria-checked={checked}
                  onSelect={() => toggle(option.key)}
                  className="items-start py-2 max-sm:min-h-11"
                >
                  <Checkbox
                    checked={checked}
                    tabIndex={-1}
                    aria-hidden="true"
                    className="pointer-events-none mt-0.5"
                  />
                  <span className="min-w-0 flex-1 break-words">{option.label}</span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {` (${option.count})`}
                  </span>
                </CommandItem>
              );
            })}
          </CommandList>
          {visible.length === 0 && query !== "" ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              {noMatch(search.trim())}
            </p>
          ) : null}
        </Command>
        <div className="border-t pt-2">
          <Button
            variant="ghost"
            size="lg"
            className="w-full justify-start max-sm:h-11"
            onClick={() => onChange(new Set<string>())}
          >
            {clearLabel}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
