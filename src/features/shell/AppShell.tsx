"use client";

import type { ReactNode } from "react";
import { hasReport } from "@/domain/import/report";
import { ImportReport } from "@/features/report/ImportReport";
import { useSessionStore } from "@/stores/sessionStore";
import { TopBar } from "./TopBar";

export function AppShell({
  children,
  topBarActions,
}: {
  children: ReactNode;
  topBarActions?: ReactNode;
}) {
  // The report shows as soon as any non-hidden file was processed (D-10).
  const reportVisible = useSessionStore((s) => hasReport(s));
  return (
    <>
      <TopBar actions={topBarActions} />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 pt-8 pb-16">
        {children}
        {reportVisible && <ImportReport />}
      </main>
    </>
  );
}
