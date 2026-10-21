import { SUGGESTIONS_VERSION, type PendingQueue } from "@/domain/llm/suggestions";
import { useSuggestionsStatusStore } from "@/stores/storageStatusStore";
import { useSuggestionsStore } from "@/stores/suggestionsStore";

/**
 * Test access to the persisted pending queue through the store's own storage adapter, so
 * tests never touch the browser storage object directly. Reload simulation:
 * `storeQueue(data)`, then `await useSuggestionsStore.persist.rehydrate()`.
 */
function adapter() {
  const options = useSuggestionsStore.persist.getOptions();
  if (options.storage === undefined || options.name === undefined) {
    throw new Error("suggestionsStore has no storage adapter configured");
  }
  return { storage: options.storage, name: options.name };
}

/** Writes a current-version value (SUGGESTIONS_VERSION) as a browser that already used the queue holds it. */
export function storeQueue(data: PendingQueue): void {
  const { storage, name } = adapter();
  void storage.setItem(name, { state: data, version: SUGGESTIONS_VERSION });
}

export async function readStoredQueue(): Promise<unknown> {
  const { storage, name } = adapter();
  return await storage.getItem(name);
}

export function clearStoredQueue(): void {
  const { storage, name } = adapter();
  void storage.removeItem(name);
}

/**
 * Empties the queue in memory, clears the stored key and resets the queue's in-memory storage
 * flags (the status store is not persisted, so it needs this).
 */
export function resetSuggestionsStore(): void {
  useSuggestionsStore.setState({ products: [], categories: [] });
  clearStoredQueue();
  useSuggestionsStatusStore.setState({
    readFailed: false,
    writeFailed: false,
    readNoticeShown: false,
  });
}
