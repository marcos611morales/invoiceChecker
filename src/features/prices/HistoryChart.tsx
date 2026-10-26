"use client";

import { useMemo } from "react";
import { CartesianGrid, Scatter, ScatterChart, XAxis, YAxis } from "recharts";
import { type ChartConfig, ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { toMoneyString } from "@/domain/accounting/decimal";
import type { ProductComparison } from "@/domain/prices/compare";
import {
  historySeries,
  STORE_SLOTS,
  type History,
  type HistoryPoint,
  type SeriesSlot,
} from "@/domain/prices/history";
import { es } from "@/lib/copy/es";
import {
  historyAriaLabel,
  historyContentRow,
  historyExcludedNote,
  historyFolioRow,
  otherStoresLabel,
} from "@/lib/copy/messages";
import {
  formatContent,
  formatFolio,
  longDateLabel,
  monthTickLabel,
  unitPriceText,
} from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Static chart config. The shadcn chart writes this object into an inline style block, so it must
 * never be built from invoice data (T-02-19, T-05-17): the keys are the fixed slots and the colors
 * are fixed here. Store names are React text only and never become a key or a CSS value.
 */
export const historyChartConfig = {
  tienda1: { label: es.prices.detail.history.series.tienda1, color: "var(--series-1)" },
  tienda2: { label: es.prices.detail.history.series.tienda2, color: "var(--series-2)" },
  tienda3: { label: es.prices.detail.history.series.tienda3, color: "var(--series-3)" },
  tienda4: { label: es.prices.detail.history.series.tienda4, color: "var(--series-4)" },
  tienda5: { label: es.prices.detail.history.series.tienda5, color: "var(--series-5)" },
  tienda6: { label: es.prices.detail.history.series.tienda6, color: "var(--series-6)" },
  otras: { label: es.prices.detail.history.series.otras, color: "var(--chart-1)" },
} satisfies ChartConfig;

/** Tailwind classes (literal, so they are generated) that give a glyph the color of its slot. */
const SLOT_TEXT_CLASS: Record<SeriesSlot, string> = {
  tienda1: "text-series-1",
  tienda2: "text-series-2",
  tienda3: "text-series-3",
  tienda4: "text-series-4",
  tienda5: "text-series-5",
  tienda6: "text-series-6",
  otras: "text-chart-1",
};

/** Above this many ticks the X ticks thin out instead of showing every month. */
const FULL_TICKS_UP_TO = 12;

const MS_PER_DAY = 86_400_000;

const COMPACT_NUMBER = new Intl.NumberFormat("es-MX", { notation: "compact" });

/** A marker is 10 px with a 2 px background ring; the hit area is 24 px across (radius 12). */
const HIT_RADIUS = 12;

function isSlot(value: unknown): value is SeriesSlot {
  return value === "otras" || STORE_SLOTS.some((slot) => slot === value);
}

/** What the chart draws and the tooltip reads for one purchase. `y` is geometry only. */
export interface HistoryDatum {
  x: number;
  y: number;
  slot: SeriesSlot;
  storeName: string;
  dateText: string;
  priceText: string;
  contentText: string;
  folioText: string;
}

/** Point of the history to the datum of the chart; every text comes from the exact values. */
export function historyDatum(point: HistoryPoint): HistoryDatum {
  return {
    x: point.day,
    y: Number(toMoneyString(point.price)),
    slot: point.slot,
    storeName: point.storeName,
    dateText: longDateLabel(point.fecha),
    priceText: unitPriceText(point.price, point.family),
    contentText: historyContentRow(formatContent(point.content, point.family)),
    folioText: historyFolioRow(formatFolio(point.folio)),
  };
}

/** Narrows the untyped payload recharts hands to the tooltip; unexpected payloads are dropped. */
export function isHistoryDatum(value: unknown): value is HistoryDatum {
  if (typeof value !== "object" || value === null) return false;
  return (
    "x" in value &&
    typeof value.x === "number" &&
    "y" in value &&
    typeof value.y === "number" &&
    "slot" in value &&
    isSlot(value.slot) &&
    "storeName" in value &&
    typeof value.storeName === "string" &&
    "dateText" in value &&
    typeof value.dateText === "string" &&
    "priceText" in value &&
    typeof value.priceText === "string" &&
    "contentText" in value &&
    typeof value.contentText === "string" &&
    "folioText" in value &&
    typeof value.folioText === "string"
  );
}

type Offsets = readonly (readonly [number, number])[];

/** Vertices of the polygon markers around their center; each is about 10 px across. */
const POLYGONS: Record<Exclude<SeriesSlot, "tienda1" | "otras">, Offsets> = {
  tienda2: [
    [-5, -5],
    [5, -5],
    [5, 5],
    [-5, 5],
  ],
  tienda3: [
    [0, -7],
    [7, 0],
    [0, 7],
    [-7, 0],
  ],
  tienda4: [
    [0, -6.5],
    [6, 4.5],
    [-6, 4.5],
  ],
  tienda5: [
    [0, 6.5],
    [6, -4.5],
    [-6, -4.5],
  ],
  tienda6: Array.from({ length: 5 }, (_, index): readonly [number, number] => {
    const angle = ((-90 + index * 72) * Math.PI) / 180;
    return [6 * Math.cos(angle), 6 * Math.sin(angle)];
  }),
};

function polygonPath(offsets: Offsets, cx: number, cy: number): string {
  return (
    offsets
      .map(([dx, dy], index) => `${index === 0 ? "M" : "L"}${(cx + dx).toFixed(2)} ${(cy + dy).toFixed(2)}`)
      .join("") + "Z"
  );
}

/**
 * The shape of one slot: circle, square, diamond, triangle, inverted triangle, pentagon, or a plus
 * sign for the folded series. With `ring`, a 2 px band in the background color separates it from
 * what lies under it. Identity is told by this shape and the legend, never by hue alone.
 */
function ShapeMark(props: {
  slot: SeriesSlot;
  cx: number;
  cy: number;
  color: string;
  ring: boolean;
}) {
  const { slot, cx, cy, color, ring } = props;
  if (slot === "otras") {
    const d = `M${String(cx - 6)} ${String(cy)}H${String(cx + 6)}M${String(cx)} ${String(cy - 6)}V${String(cy + 6)}`;
    return (
      <>
        {ring ? <path d={d} fill="none" stroke="var(--background)" strokeWidth={6.5} /> : null}
        <path d={d} fill="none" stroke={color} strokeWidth={2.5} />
      </>
    );
  }
  // The stroke is painted under the fill, so a 4 px stroke leaves a 2 px ring outside the shape.
  const ringProps = ring
    ? { stroke: "var(--background)", strokeWidth: 4, paintOrder: "stroke", strokeLinejoin: "round" as const }
    : {};
  if (slot === "tienda1") return <circle cx={cx} cy={cy} r={5} fill={color} {...ringProps} />;
  return <path d={polygonPath(POLYGONS[slot], cx, cy)} fill={color} {...ringProps} />;
}

/**
 * Marker the chart draws for each purchase. recharts clones the element with the pixel center
 * (`cx`, `cy`); the transparent circle gives a 24 px hit area for the tooltip.
 */
function SeriesMarker(props: { slot: SeriesSlot; cx?: number; cy?: number }) {
  const { slot, cx, cy } = props;
  if (cx === undefined || cy === undefined) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={HIT_RADIUS} fill="transparent" />
      <ShapeMark slot={slot} cx={cx} cy={cy} color={`var(--color-${slot})`} ring />
    </g>
  );
}

/** The legend glyph of a slot: its shape in its color, decorative (the name is the text). */
function SlotGlyph({ slot }: { slot: SeriesSlot }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="-8 -8 16 16"
      className={cn("size-3 shrink-0", SLOT_TEXT_CLASS[slot])}
    >
      <ShapeMark slot={slot} cx={0} cy={0} color="currentColor" ring={false} />
    </svg>
  );
}

/**
 * Tooltip of one purchase (D-33): the long date, then the store in text, the unit price, the
 * content and the folio. It reads the datum through a type guard, so an unexpected payload shows
 * nothing instead of being cast. Vendor text is React text only (T-05-18).
 */
export function HistoryTooltip(props: { active?: boolean; payload?: readonly unknown[] }) {
  const { active, payload } = props;
  if (active !== true || payload === undefined) return null;
  const first: unknown = payload[0];
  const datum: unknown =
    typeof first === "object" && first !== null && "payload" in first ? first.payload : undefined;
  if (!isHistoryDatum(datum)) return null;
  return (
    <div className="grid max-w-64 min-w-32 gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <div className="font-medium">{datum.dateText}</div>
      <div className="flex items-start gap-2">
        <SlotGlyph slot={datum.slot} />
        <span className="min-w-0 wrap-break-word text-muted-foreground">{datum.storeName}</span>
      </div>
      <div className="font-medium tabular-nums">{datum.priceText}</div>
      <div className="text-muted-foreground">{datum.contentText}</div>
      <div className="text-muted-foreground wrap-break-word">{datum.folioText}</div>
    </div>
  );
}

/** First day of each month inside `[from, to]`, as day numbers. */
function monthStartTicks(from: number, to: number): number[] {
  // A non-finite bound (no data) would never end the walk below.
  if (!Number.isFinite(from) || !Number.isFinite(to)) return [];
  const start = new Date(from * MS_PER_DAY);
  let year = start.getUTCFullYear();
  let month = start.getUTCMonth();
  const ticks: number[] = [];
  for (;;) {
    const day = Date.UTC(year, month, 1) / MS_PER_DAY;
    if (day > to) break;
    if (day >= from) ticks.push(day);
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }
  return ticks;
}

/** Plot area: a padded X range, month ticks, and a Y range padded 10 % and not forced to zero. */
function plotArea(data: readonly HistoryDatum[]): {
  xDomain: [number, number];
  ticks: number[];
  yDomain: [number, number];
} | null {
  if (data.length === 0) return null;
  const days = data.map((datum) => datum.x);
  const prices = data.map((datum) => datum.y);
  const minDay = Math.min(...days);
  const maxDay = Math.max(...days);
  const dayPad = Math.max(3, Math.ceil((maxDay - minDay) * 0.05));
  const xDomain: [number, number] = [minDay - dayPad, maxDay + dayPad];
  const monthStarts = monthStartTicks(xDomain[0], xDomain[1]);
  const ticks = monthStarts.length > 0 ? monthStarts : [Math.round((minDay + maxDay) / 2)];

  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const pricePad =
    maxPrice === minPrice ? Math.max(Math.abs(maxPrice) * 0.1, 1) : (maxPrice - minPrice) * 0.1;
  // The prices are positive: the pad never takes the axis below zero, but zero is not forced.
  const yDomain: [number, number] = [Math.max(minPrice - pricePad, 0), maxPrice + pricePad];
  return { xDomain, ticks, yDomain };
}

interface ChartSeries {
  slot: SeriesSlot;
  legend: string;
  data: HistoryDatum[];
}

function toChartSeries(history: History): ChartSeries[] {
  return history.series.map((series) => ({
    slot: series.slot,
    legend:
      series.slot === "otras"
        ? otherStoresLabel(series.stores.length)
        : (series.stores[0]?.name ?? ""),
    data: series.points.map(historyDatum),
  }));
}

/**
 * Price history of a product (PREC-06, D-24): the normalized price against the purchase date, one
 * line per store with a marker per purchase. Only compared purchases are plotted; the others are
 * counted in a caption. The purchases list under the chart is the table view of the same data.
 */
export function HistoryChart(props: {
  row: ProductComparison;
  slots: ReadonlyMap<string, SeriesSlot>;
}) {
  const { row, slots } = props;
  const history = useMemo(() => historySeries(row, slots), [row, slots]);
  const series = useMemo(() => toChartSeries(history), [history]);
  const plot = useMemo(() => plotArea(series.flatMap((item) => item.data)), [series]);
  const { firstFecha, lastFecha } = history;
  if (
    plot === null ||
    history.plotted === 0 ||
    row.family === null ||
    firstFecha === null ||
    lastFecha === null
  ) {
    return null;
  }
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <p className="text-xs text-muted-foreground">{es.prices.detail.history.axisUnit[row.family]}</p>
      <div
        role="img"
        aria-label={historyAriaLabel(row.name, longDateLabel(firstFecha), longDateLabel(lastFecha))}
      >
        <ChartContainer config={historyChartConfig} className="aspect-auto h-72 w-full">
          {/* D-33: a ScatterChart with a joined line per store, not the LineChart of the UI-SPEC,
              because recharts 3.8 gives LineChart only a tooltip per date (axis tooltips); the
              Scatter item tooltip is one per purchase. */}
          <ScatterChart accessibilityLayer>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.5} />
            <XAxis
              type="number"
              dataKey="x"
              domain={plot.xDomain}
              ticks={plot.ticks}
              axisLine={false}
              tickLine={false}
              interval={plot.ticks.length > FULL_TICKS_UP_TO ? "preserveStartEnd" : 0}
              minTickGap={8}
              tickFormatter={(value: number) => monthTickLabel(value)}
            />
            <YAxis
              type="number"
              dataKey="y"
              domain={plot.yDomain}
              axisLine={false}
              tickLine={false}
              tickCount={5}
              width={64}
              tickFormatter={(value: number) => COMPACT_NUMBER.format(value)}
            />
            <ChartTooltip cursor={false} content={<HistoryTooltip />} />
            {series.map((item) => (
              <Scatter
                key={item.slot}
                data={item.data}
                fill={`var(--color-${item.slot})`}
                shape={<SeriesMarker slot={item.slot} />}
                line={
                  item.slot === "otras"
                    ? false
                    : { stroke: `var(--color-${item.slot})`, strokeWidth: 2 }
                }
                lineType="joint"
                lineJointType="linear"
                isAnimationActive={false}
              />
            ))}
          </ScatterChart>
        </ChartContainer>
      </div>
      <ul className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
        {series.map((item) => (
          <li key={item.slot} className="flex min-w-0 items-start gap-2">
            <span className="mt-px">
              <SlotGlyph slot={item.slot} />
            </span>
            <span className="min-w-0 wrap-break-word">{item.legend}</span>
          </li>
        ))}
      </ul>
      {history.plotted === 1 ? (
        <p className="text-xs text-muted-foreground">{es.prices.detail.history.singlePurchase}</p>
      ) : null}
      {history.excluded > 0 ? (
        <p className="text-xs text-muted-foreground">{historyExcludedNote(history.excluded)}</p>
      ) : null}
    </div>
  );
}
