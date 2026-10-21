import { create } from "zustand";

/**
 * Whether the browser storage worked for one persisted store (UI-SPEC Q8, AJUS-01). It lives
 * in memory only, like sessionStore: there is no persist middleware, so it is never written
 * anywhere. A store's storage adapter and `migrate`/`merge` set these flags, and they never
 * touch the persisted store itself (Pitfall 6: persist calls `setItem` after every `set`, so
 * setting the persisted store from the adapter would loop).
 */
export interface StorageStatusState {
  /** The stored value existed but could not be used on load; the defaults were used. */
  readFailed: boolean;
  /** The last write failed (blocked storage or quota). */
  writeFailed: boolean;
  /** The read-failure toast was already shown during this page load. */
  readNoticeShown: boolean;
  markReadFailed: () => void;
  setWriteFailed: (failed: boolean) => void;
  markReadNoticeShown: () => void;
}

/** One status store per persisted store, so the two notices never mix. */
export function createStorageStatusStore() {
  return create<StorageStatusState>()((set) => ({
    readFailed: false,
    writeFailed: false,
    readNoticeShown: false,
    markReadFailed: () => {
      set({ readFailed: true });
    },
    setWriteFailed: (failed) => {
      set({ writeFailed: failed });
    },
    markReadNoticeShown: () => {
      set({ readNoticeShown: true });
    },
  }));
}

/** Status of the settings (`invoicechecker:settings`). */
export const useStorageStatusStore = createStorageStatusStore();

/** Status of the pending suggestions queue (`invoicechecker:suggestions`). */
export const useSuggestionsStatusStore = createStorageStatusStore();
