import { LogoutButton } from "@/features/shell/LogoutButton";
import { ImportCountsPanel } from "@/features/upload/ImportCountsPanel";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">InvoiceChecker</h1>
        <LogoutButton />
      </div>
      <ImportCountsPanel />
    </main>
  );
}
