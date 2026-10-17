import { create } from "zustand";

/**
 * Whether the browser storage worked for the settings (UI-SPEC Q8, AJUS-01). It lives in
 * memory only, like sessionStore: there is no persist middleware, so it is never written
 * anywhere. The settings storage adapter and `migrate`/`merge` set these flags, and they
 * never touch the persisted settings store itself (Pitfall 6: persist calls `setItem`
 * after every `set`, so setting the settings store from the adapter would loop).
 */
interface StorageStatusState {
  /** Stored settings existed but could not be used on load; the defaults were used. */
  readFailed: boolean;
  /** The last write of the settings failed (blocked storage or quota). */
  writeFailed: boolean;
  /** The read-failure toast was already shown during this page load. */
  readNoticeShown: boolean;
  markReadFailed: () => void;
  setWriteFailed: (failed: boolean) => void;
  markReadNoticeShown: () => void;
}

export const useStorageStatusStore = create<StorageStatusState>()((set) => ({
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
