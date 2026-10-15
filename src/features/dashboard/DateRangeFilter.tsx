"use client";

import { useId } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  normalizeRange,
  type DateRange,
} from "@/domain/accounting/filters";
import {
  compareMonths,
  monthsInRange,
  type MonthKey,
} from "@/domain/accounting/months";
import { es } from "@/lib/copy/es";
import { monthYearLabel, rangeText } from "@/lib/format";

/**
 * January of the last loaded month's year through the last loaded month,
 * clipped to the loaded span (UI-SPEC decision 1). Anchored on the span end,
 * never on today's date.
 */
export function thisYearRange(span: DateRange): DateRange {
  const januaryOfLastYear = `${span.to.slice(0, 4)}-01`;
  const from =
    compareMonths(januaryOfLastYear, span.from) < 0 ? span.from : januaryOfLastYear;
  return { from, to: span.to };
}

/** The last loaded month and the n - 1 before it, clipped to the loaded span. */
export function lastMonthsRange(span: DateRange, n: number): DateRange {
  const months = monthsInRange(span.from, span.to);
  const count = Math.max(1, n);
  const from = months[Math.max(0, months.length - count)] ?? span.from;
  return { from, to: span.to };
}

interface MonthSelectProps {
  label: string;
  value: MonthKey;
  months: readonly MonthKey[];
  onPick: (month: MonthKey) => void;
}

function MonthSelect({ label, value, months, onPick }: MonthSelectProps) {
  const id = useId();
  // The `items` prop lets Base UI render "ene 2025" in the trigger before the
  // popup has ever mounted (RESEARCH Pitfall 8).
  const items = months.map((month) => ({ value: month, label: monthYearLabel(month) }));
  return (
    <div className="flex flex-1 flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select
        items={items}
        value={value}
        onValueChange={(next) => {
          if (next !== null) onPick(next);
        }}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * "Fechas" filter: a popover with Desde/Hasta month selects and three
 * shortcuts (D-12, D-13). The range can never be invalid (choosing one end past
 * the other moves the other end), and a range equal to the loaded span is
 * reported as null so a later, wider batch widens the view.
 */
export function DateRangeFilter(props: {
  span: DateRange;
  value: DateRange | null;
  onChange: (range: DateRange | null) => void;
}) {
  const { span, value, onChange } = props;
  const current = value ?? span;
  const months = monthsInRange(span.from, span.to);

  const emit = (range: DateRange): void => {
    onChange(normalizeRange(range, span));
  };

  const pickFrom = (from: MonthKey): void => {
    emit({ from, to: compareMonths(from, current.to) > 0 ? from : current.to });
  };

  const pickTo = (to: MonthKey): void => {
    emit({ from: compareMonths(to, current.from) < 0 ? to : current.from, to });
  };

  return (
    <Popover>
      <PopoverTrigger
        render={<Button variant="outline" size="lg" className="max-sm:w-full" />}
      >
        <span className="font-semibold">{es.filters.dates}:</span>{" "}
        <span className="max-w-[200px] truncate font-normal text-muted-foreground">
          {rangeText(current.from, current.to)}
        </span>
        <ChevronDown className="size-3.5" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <div className="flex gap-2">
          <MonthSelect
            label={es.filters.from}
            value={current.from}
            months={months}
            onPick={pickFrom}
          />
          <MonthSelect
            label={es.filters.to}
            value={current.to}
            months={months}
            onPick={pickTo}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="lg" onClick={() => onChange(null)}>
            {es.filters.all}
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => emit(thisYearRange(span))}
          >
            {es.filters.thisYear}
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => emit(lastMonthsRange(span, 3))}
          >
            {es.filters.last3}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{es.filters.dateHelper}</p>
      </PopoverContent>
    </Popover>
  );
}
