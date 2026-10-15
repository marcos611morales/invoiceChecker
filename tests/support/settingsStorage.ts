import type { IvaMode } from "@/domain/accounting/aggregate";
import { useSettingsStore } from "@/stores/settingsStore";

/**
 * Test access to the persisted settings through the store's own storage adapter,
 * so tests never touch the browser storage object directly. Reload simulation:
 * `storeIvaMode("sin")`, render, expect the Sin IVA figure.
 */
function adapter() {
  const options = useSettingsStore.persist.getOptions();
  if (options.storage === undefined || options.name === undefined) {
    throw new Error("settingsStore has no storage adapter configured");
  }
  return { storage: options.storage, name: options.name };
}

export function storeIvaMode(ivaMode: IvaMode): void {
  const { storage, name } = adapter();
  void storage.setItem(name, { state: { ivaMode }, version: 1 });
}

export async function readStoredSettings(): Promise<unknown> {
  const { storage, name } = adapter();
  return await storage.getItem(name);
}

export function clearStoredSettings(): void {
  const { storage, name } = adapter();
  void storage.removeItem(name);
}
