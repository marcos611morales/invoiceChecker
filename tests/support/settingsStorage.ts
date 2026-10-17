import type { IvaMode } from "@/domain/accounting/aggregate";
import { defaultSettings, type SettingsData } from "@/domain/settings/types";
import { useSettingsStore } from "@/stores/settingsStore";
import { useStorageStatusStore } from "@/stores/storageStatusStore";

/**
 * Test access to the persisted settings through the store's own storage adapter,
 * so tests never touch the browser storage object directly. Reload simulation:
 * `storeIvaMode("sin")` (the Phase 2 contract, version 1, so it exercises the
 * migration) or `storeSettings(data)` (version 2), then rehydrate the store.
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

/** Writes a version-2 value as a browser that already used Phase 3 would hold it. */
export function storeSettings(data: SettingsData): void {
  const { storage, name } = adapter();
  void storage.setItem(name, { state: data, version: 2 });
}

/**
 * Puts the store back to the suggestions and Con IVA, clears the stored key and resets the
 * in-memory storage failure flags (the status store is not persisted, so it needs this).
 */
export function resetSettingsStore(): void {
  useSettingsStore.setState(defaultSettings());
  clearStoredSettings();
  useStorageStatusStore.setState({ readFailed: false, writeFailed: false, readNoticeShown: false });
}

export async function readStoredSettings(): Promise<unknown> {
  const { storage, name } = adapter();
  return await storage.getItem(name);
}

export function clearStoredSettings(): void {
  const { storage, name } = adapter();
  void storage.removeItem(name);
}
