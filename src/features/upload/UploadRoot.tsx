"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import { useDropzone } from "react-dropzone";
import { hasReport } from "@/domain/import/report";
import { es } from "@/lib/copy/es";
import { useSessionStore } from "@/stores/sessionStore";
import { useImport } from "./useImport";

interface UploadApi {
  openFiles: () => void;
  openFolder: () => void;
  /** True while a batch is being read or parsed; pickers and drops are inert. */
  processing: boolean;
  /** True while files are being dragged anywhere over the window. */
  isDragGlobal: boolean;
}

const UploadContext = createContext<UploadApi | null>(null);

/** Upload actions and state for the buttons rendered under {@link UploadRoot}. */
export function useUpload(): UploadApi {
  const api = useContext(UploadContext);
  if (api === null) {
    throw new Error("useUpload must be used inside <UploadRoot>");
  }
  return api;
}

// React's typings lack the non-standard webkitdirectory attribute (Pitfall 10).
const folderInputProps = { webkitdirectory: "" };

/**
 * Drop target over the whole app (CARGA-01, D-10). The dropzone root is the full-height
 * wrapper so files and folders can be dropped anywhere. Neither picker restricts the file
 * type, so PDFs and ZIPs still reach the ignored list.
 */
export function UploadRoot({ children }: { children: ReactNode }) {
  const { run } = useImport();
  const processing = useSessionStore((s) => s.progress.phase !== "idle");
  const loadedScreen = useSessionStore((s) => hasReport(s));
  // Element kept in state (callback ref) so the click handler never reads a ref during render.
  const [folderInput, setFolderInput] = useState<HTMLInputElement | null>(null);

  // A disabled dropzone still prevents the browser from opening a dropped XML in the tab.
  const { getRootProps, getInputProps, open, isDragGlobal } = useDropzone({
    onDrop: (files: File[]) => {
      void run(files);
    },
    noClick: true,
    noKeyboard: true,
    disabled: processing,
  });

  function onFolderPicked(event: ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const files = Array.from(input.files ?? []);
    input.value = ""; // allow picking the same folder again
    void run(files);
  }

  const api = useMemo<UploadApi>(
    () => ({
      openFiles: () => {
        if (!processing) open();
      },
      openFolder: () => {
        if (!processing) folderInput?.click();
      },
      processing,
      isDragGlobal: isDragGlobal && !processing,
    }),
    [open, processing, isDragGlobal, folderInput],
  );

  const showOverlay = api.isDragGlobal && loadedScreen;

  return (
    <UploadContext.Provider value={api}>
      <div {...getRootProps({ className: "flex min-h-dvh flex-col" })}>
        <input {...getInputProps()} />
        <input
          ref={setFolderInput}
          type="file"
          multiple
          hidden
          tabIndex={-1}
          aria-hidden="true"
          disabled={processing}
          {...folderInputProps}
          onChange={onFolderPicked}
        />
        {children}
        {showOverlay && (
          <div
            data-testid="drop-overlay"
            className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/90 duration-150 animate-in fade-in-0 motion-reduce:animate-none"
          >
            <div
              aria-hidden="true"
              className="absolute inset-4 rounded-xl border-2 border-dashed border-primary"
            />
            <p className="relative text-[28px] leading-[1.2] font-semibold">
              {es.empty.windowOverlay}
            </p>
          </div>
        )}
      </div>
    </UploadContext.Provider>
  );
}
