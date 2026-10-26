# Phase 5 deferred items

Out-of-scope discoveries logged by plan executors. Nothing here was fixed by the plan that found it.

## From 05-12 (browser checks)

1. **E7 populated: an exactly overlapped marker is hidden, not merely stacked.**
   In the price history, when two stores bought on the same date at the same price, the marker of the
   later series (for example the square of series 2) is drawn on top of the marker of the earlier one
   (the circle of series 1) and covers it completely: the circle is 5 px of radius with a 2 px ring and
   the square is 10 px wide with a 2 px ring. Only one glyph is visible at that point. The two stores
   remain distinguishable by their lines (each line leaves the shared point in its own color), by the
   legend and by the tooltip of their other purchases, but the hover tooltip of the shared point names
   only the top store. Screenshot: `test-results/phase5-ui-states/e7-light-chart.png` and
   `e7-dark-chart.png` (the point at «abr 2025», 50 $/kg). The UI-SPEC E7 truth says overlapping markers
   stay distinguishable by shape and legend; this needs a decision at the end-of-phase review (for
   example a slightly larger or offset marker for the earlier series, or accept it). Source:
   `src/features/prices/HistoryChart.tsx` (`ShapeMark`, `SeriesMarker`).
2. **Unused eslint-disable directive** in `src/lib/client/navigation.ts` line 6 (a warning in
   `pnpm lint`, no error). Pre-existing, unrelated to Phase 5.
