"use client";

import type { ReactNode } from "react";
import { TopBar } from "./TopBar";

export function AppShell({
  children,
  topBarActions,
}: {
  children: ReactNode;
  topBarActions?: ReactNode;
}) {
  return (
    <>
      <TopBar actions={topBarActions} />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 pt-8 pb-16">
        {children}
      </main>
    </>
  );
}
