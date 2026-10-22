## Deferred Items

- Unused `eslint-disable` directive in `src/lib/client/navigation.ts` line 6 (`@next/next/no-location-assign-relative-destination`), reported by `pnpm eslint .` as a warning. Pre-existing, unrelated to Plan 04-01.
  status: open

- Tab list does not scroll between 640 and the width where the five tabs fit (found by Plan 04-21, UI-SPEC "Shell and tabs" check at 640 to 767 px). `TabsList` in `src/features/shell/AppShell.tsx` line 117 has `max-sm:overflow-x-auto`, which applies only below 640 px; at exactly 640 px with a «Productos · n» counter the tabs are 609 px wide inside a 592 px list and overflow it visibly (the page itself does not scroll sideways, and 700 and 767 px fit). The UI-SPEC asks the list to scroll at that width as well. Likely fix: `overflow-x-auto` and the scrollbar hiding classes without `max-sm:`. Outside the files of Plan 04-21, so not changed; `e2e/products.spec.ts` keeps the check as `test.fail` at 640 px, which turns into an unexpected pass once the shell is fixed.
  status: open
