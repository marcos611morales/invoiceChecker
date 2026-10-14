import { AppShell } from "@/features/shell/AppShell";
import { ImportCountsPanel } from "@/features/upload/ImportCountsPanel";

export default function Home() {
  return (
    <AppShell>
      <ImportCountsPanel />
    </AppShell>
  );
}
