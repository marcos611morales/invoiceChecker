"use client";

import { useEffect, useMemo, type ComponentType } from "react";
import { ShieldCheck, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { qualitySummary } from "@/domain/accounting/quality";
import { hasReport } from "@/domain/import/report";
import { DashboardTab } from "@/features/dashboard/DashboardTab";
import { useLedger } from "@/features/dashboard/useLedger";
import { QualityTab } from "@/features/quality/QualityTab";
import { ImportReport } from "@/features/report/ImportReport";
import { EmptyDropzone } from "@/features/upload/EmptyDropzone";
import { ProcessingIndicator } from "@/features/upload/ProcessingIndicator";
import { UploadRoot, useUpload } from "@/features/upload/UploadRoot";
import { es } from "@/lib/copy/es";
import { qualityTabAria, qualityTabLabel } from "@/lib/copy/messages";
import { useSessionStore, type AppTab } from "@/stores/sessionStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { TopBar } from "./TopBar";
import { useBeforeUnload } from "./useBeforeUnload";

/** Top bar button shown on the loaded screen only (D-10); inert while a batch runs. */
function AddInvoicesButton() {
  const { openFiles, processing } = useUpload();
  return (
    <Button
      type="button"
      disabled={processing}
      onClick={openFiles}
      className="h-9 max-md:size-9 max-md:px-0 max-sm:size-11"
      aria-label={es.global.addInvoices}
    >
      <Upload className="size-4" aria-hidden="true" />
      <span className="max-md:sr-only">{es.global.addInvoices}</span>
    </Button>
  );
}

const TRIGGER_CLASS =
  "group-data-horizontal/tabs:h-10 max-sm:group-data-horizontal/tabs:h-11 flex-none px-4 text-sm font-semibold text-muted-foreground after:bg-primary hover:bg-secondary";

/** Accepts only the tab values the store knows; anything else is ignored (no cast). */
function isAppTab(value: unknown): value is AppTab {
  return value === "dashboard" || value === "calidad" || value === "importacion";
}

interface TabDefinition {
  value: AppTab;
  label: string;
  Panel: ComponentType;
}

/** Module scope: the list never changes while the app runs (D-01 order). */
const TABS: readonly TabDefinition[] = [
  { value: "dashboard", label: es.tabs.dashboard, Panel: DashboardTab },
  { value: "calidad", label: es.tabs.quality, Panel: QualityTab },
  { value: "importacion", label: es.tabs.import, Panel: ImportReport },
];

/**
 * Loaded screen (D-01): the tabs are controlled by the session store, so a finished
 * batch (D-44) and the "Ver factura" requests can switch them. The Phase 1 invoices
 * table is no longer rendered here (D-02).
 */
function LoadedTabs() {
  const activeTab = useSessionStore((s) => s.activeTab);
  const setActiveTab = useSessionStore((s) => s.setActiveTab);
  // Incident rows over the ten types of the unfiltered ledger, informational D-46 type
  // included (D-04). The Dashboard notice reads the same summary's `amountChanging`.
  const ledger = useLedger();
  const incidentCount = useMemo(() => qualitySummary(ledger).total, [ledger]);
  return (
    <Tabs
      value={activeTab}
      onValueChange={(value: unknown) => {
        if (isAppTab(value)) setActiveTab(value);
      }}
      className="gap-8"
    >
      <TabsList
        variant="line"
        aria-label={es.tabs.ariaLabel}
        className="group-data-horizontal/tabs:h-10 max-sm:group-data-horizontal/tabs:h-11 gap-2 p-0"
      >
        {TABS.map(({ value, label }) =>
          value === "calidad" ? (
            <TabsTrigger
              key={value}
              value={value}
              className={TRIGGER_CLASS}
              aria-label={qualityTabAria(incidentCount)}
            >
              {qualityTabLabel(incidentCount)}
            </TabsTrigger>
          ) : (
            <TabsTrigger key={value} value={value} className={TRIGGER_CLASS}>
              {label}
            </TabsTrigger>
          ),
        )}
      </TabsList>
      {TABS.map(({ value, Panel }) => (
        <TabsContent key={value} value={value}>
          <Panel />
        </TabsContent>
      ))}
    </Tabs>
  );
}

export function AppShell() {
  // The report shows as soon as any non-hidden file was processed (D-10).
  const reportVisible = useSessionStore((s) => hasReport(s));
  // The unload warning keys on loaded invoices, not on the report (D-07b).
  const hasInvoices = useSessionStore((s) => s.invoices.length > 0);
  useBeforeUnload(hasInvoices);
  // The settings store is created with skipHydration, so the stored IVA mode is read once
  // here (external-store sync, no React state). Before that the control shows Con IVA, the
  // same markup the server renders.
  useEffect(() => {
    void useSettingsStore.persist.rehydrate();
  }, []);
  return (
    <UploadRoot>
      <TopBar
        showIva={reportVisible}
        actions={reportVisible ? <AddInvoicesButton /> : null}
      />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 pt-8 pb-16">
        <ProcessingIndicator />
        {reportVisible ? <LoadedTabs /> : <EmptyDropzone />}
        {reportVisible && (
          <footer className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="size-3" aria-hidden="true" />
            <p>{es.global.privacyLine}</p>
          </footer>
        )}
      </main>
    </UploadRoot>
  );
}
