"use client";

import type { FilterOption } from "@/domain/accounting/filters";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

/** Skeleton for the RED commit: the real behavior arrives in the GREEN commit. */
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
  return (
    <Popover>
      <PopoverTrigger render={<Button variant="outline" size="lg" />}>
        {props.label}
      </PopoverTrigger>
      <PopoverContent className={props.widthClass}>{null}</PopoverContent>
    </Popover>
  );
}
