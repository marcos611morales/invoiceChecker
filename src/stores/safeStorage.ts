import type { PersistStorage } from "zustand/middleware";
import { z } from "zod";

/**
 * Only the envelope is checked here; the state stays `unknown` and is validated by each
 * store's own `migrate` and `merge`. Validating the state against the newest schema here
 * would turn an older stored version into "nothing stored" and lose its data (Pitfall 4).
 */
const envelopeSchema = z.object({
  state: z.unknown(),
  version: z.number().optional(),
});

/**
 * What the adapter tells the outside about a stored key. It is implemented by the plain,
 * non-persisted status stores, never by the persisted store the adapter serves.
 */
export interface StorageReporter {
  /** A stored value exists but is not usable (not JSON, or not an envelope). */
  markReadFailed(): void;
  /** `true` after a write that failed, `false` after one that worked. */
  setWriteFailed(failed: boolean): void;
}

/**
 * The browser-storage adapter of every persisted store. Every storage access is inside
 * try/catch: blocked storage, private mode, quota and the server (no window) all become
 * "nothing stored" or a no-op. The adapter never calls `set` on a persisted store (Pitfall 6):
 * persist calls `setItem` after every `set`, so setting state from here would loop. It only
 * reports to the `reporter` it is given: a stored value that exists but is not usable
 * (`getItem`) and a write that fails (`setItem`). A `getItem` that itself throws is not a
 * read failure: nothing is known to be stored. The reporter is asked at each call, so a store
 * can be created before the status store it reports to.
 */
export function createSafeStorage(reporter: () => StorageReporter): PersistStorage<unknown> {
  return {
    getItem: (name) => {
      let raw: string | null;
      try {
        raw = window.localStorage.getItem(name);
      } catch {
        return null;
      }
      if (raw === null) return null;
      try {
        const parsed = envelopeSchema.safeParse(JSON.parse(raw));
        if (parsed.success) return parsed.data;
      } catch {
        // Not JSON: reported below like a wrong envelope.
      }
      reporter().markReadFailed();
      return null;
    },
    setItem: (name, value) => {
      try {
        window.localStorage.setItem(name, JSON.stringify(value));
        reporter().setWriteFailed(false);
      } catch {
        // Quota or blocked storage: the data still works for this session.
        reporter().setWriteFailed(true);
      }
    },
    removeItem: (name) => {
      try {
        window.localStorage.removeItem(name);
      } catch {
        // Blocked storage: nothing to remove.
      }
    },
  };
}
