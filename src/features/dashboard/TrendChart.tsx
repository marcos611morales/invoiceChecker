"use client";

import type Big from "big.js";
import { Bar, BarChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { MonthPoint } from "@/domain/accounting/aggregate";
import { toMoneyString } from "@/domain/accounting/decimal";
import type { DateRange } from "@/domain/accounting/filters";
import { es } from "@/lib/copy/es";
import { averageLegend, trendAriaLabel } from "@/lib/copy/messages";
import { formatMoney, monthLongLabel, rangeText } from "@/lib/format";
import { isTrendDatum, toTrendData } from "./trendData";

/**
 * Static chart config. The shadcn chart writes this object into an inline style
 * block, so it must never be built from invoice data (T-02-19): keys and colors
 * are fixed here and nothing from the XML ever reaches it.
 */
const trendChartConfig = {
  gasto: { label: es.charts.trendTooltipRow, color: "var(--chart-1)" },
} satisfies ChartConfig;

/** Above this many months the X ticks thin out instead of showing every month. */
const FULL_TICKS_UP_TO = 12;

const COMPACT_NUMBER = new Intl.NumberFormat("es-MX", { notation: "compact" });

/**
 * Monthly spend bars with a dashed average line (DASH-02, DASH-06, D-21). The
 * series arrives zero-filled from the shared selector, so a month without spend
 * is a zero-height bar with its tick, and a credit-note-heavy month is a negative
 * bar below the zero baseline.
 */
export function TrendChart(props: {
  series: readonly MonthPoint[];
  promedio: Big;
  range: DateRange;
}) {
  const { series, promedio, range } = props;
  const data = toTrendData(series);
  const averageValue = Number(toMoneyString(promedio));
  const averageText = formatMoney(promedio);
  return (
    <section className="flex flex-col gap-4 rounded-lg border bg-background p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold">{es.charts.trendHeading}</h2>
        <p className="text-xs text-muted-foreground">{rangeText(range.from, range.to)}</p>
      </div>
      <div role="img" aria-label={trendAriaLabel(range.from, range.to)}>
        <ChartContainer config={trendChartConfig} className="aspect-auto h-72 w-full">
          <BarChart data={data} accessibilityLayer>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.5} />
            <XAxis
              dataKey="tick"
              axisLine={false}
              tickLine={false}
              interval={data.length > FULL_TICKS_UP_TO ? "preserveStartEnd" : 0}
              minTickGap={8}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tickCount={4}
              width={56}
              tickFormatter={(value: number) => COMPACT_NUMBER.format(value)}
            />
            <ReferenceLine y={0} stroke="var(--border)" />
            <ReferenceLine
              y={averageValue}
              stroke="var(--foreground)"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              ifOverflow="extendDomain"
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(_label, payload) => {
                    const datum = payload[0]?.payload;
                    return isTrendDatum(datum) ? monthLongLabel(datum.month) : "";
                  }}
                  formatter={(_value, _name, item) => {
                    const datum = item.payload;
                    if (!isTrendDatum(datum)) return null;
                    return (
                      <div className="flex w-full items-center justify-between gap-4">
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <span className="size-2.5 shrink-0 rounded-[2px] bg-(--color-gasto)" />
                          {es.charts.trendTooltipRow}
                        </span>
                        <span className="font-medium text-foreground tabular-nums">
                          {datum.amountText}
                        </span>
                      </div>
                    );
                  }}
                />
              }
            />
            <Bar
              dataKey="amount"
              name="gasto"
              fill="var(--color-gasto)"
              radius={[4, 4, 0, 0]}
              activeBar={{ fill: "var(--primary)" }}
              isAnimationActive={false}
            />
          </BarChart>
        </ChartContainer>
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className="size-2.5 rounded-[2px] bg-chart-1" />
          {es.charts.trendLegendBars}
        </span>
        <span className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="h-0 w-4 border-t-[1.5px] border-dashed border-foreground"
          />
          {averageLegend(averageText)}
        </span>
      </div>
      <table className="sr-only">
        <thead>
          <tr>
            <th scope="col">{es.charts.trendTableMonth}</th>
            <th scope="col">{es.charts.trendTooltipRow}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((datum) => (
            <tr key={datum.month}>
              <th scope="row">{monthLongLabel(datum.month)}</th>
              <td>{datum.amountText}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
