"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { CircleAlert, Download, Upload, X } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertAction, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  backupFileName,
  buildBackupText,
  checkBackupSize,
  parseBackupText,
  type BackupFailure,
  type BackupSummary,
} from "@/domain/settings/backup";
import type { SettingsData } from "@/domain/settings/types";
import { downloadBlob } from "@/lib/client/download";
import { es } from "@/lib/copy/es";
import {
  backupReasonText,
  invalidFileText,
  replaceSettingsBody,
  replaceSummaryText,
  settingsDownloadedToast,
} from "@/lib/copy/messages";
import { useSessionStore } from "@/stores/sessionStore";
import { useSettingsStore } from "@/stores/settingsStore";

/** Why the last chosen file was refused, kept by the tab while its Alert is shown. */
export interface BackupError {
  fileName: string;
  reason: BackupFailure;
}

/** A valid file waiting for the user's decision. Nothing is applied until they confirm. */
interface PendingFile {
  fileName: string;
  settings: SettingsData;
  summary: BackupSummary;
}

/**
 * «Descargar ajustes» and «Subir ajustes» (AJUS-02, D-07, D-08). Both are local Blob and File
 * operations: nothing is sent anywhere. An invalid file is reported through `onError` and
 * touches nothing; a valid one opens the replace confirmation, and only confirming calls
 * `replaceAll`. The file input is reset right after the file is taken, so choosing the same
 * file again is handled again.
 */
export function BackupControls({ onError }: { onError: (error: BackupError | null) => void }) {
  const replaceAll = useSettingsStore((s) => s.replaceAll);
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLButtonElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  const [pending, setPending] = useState<PendingFile | null>(null);
  const [open, setOpen] = useState(false);

  function download(): void {
    const { ivaMode, categories, supplierCategories, conceptRules } = useSettingsStore.getState();
    // The only use of the browser's local date (UI-SPEC): the file name carries today's date.
    const today = new Date();
    const name = backupFileName({
      year: today.getFullYear(),
      month: today.getMonth() + 1,
      day: today.getDate(),
    });
    const text = buildBackupText({ ivaMode, categories, supplierCategories, conceptRules });
    downloadBlob(new Blob([text], { type: "application/json" }), name);
    toast(settingsDownloadedToast(name));
  }

  async function onFilePicked(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const input = event.target;
    const file = input.files?.[0];
    input.value = ""; // allow choosing the same file again
    if (file === undefined) return;
    const fileName = file.name;
    // Size first, on file.size, before the file is read into memory (T-03-16).
    const tooLarge = checkBackupSize(file.size);
    if (tooLarge !== null) {
      onError({ fileName, reason: tooLarge });
      return;
    }
    let text: string;
    try {
      text = await file.text();
    } catch {
      // A file that cannot be read is reported like a broken one.
      onError({ fileName, reason: "damaged" });
      return;
    }
    const result = parseBackupText(text);
    if (!result.ok) {
      onError({ fileName, reason: result.reason });
      return;
    }
    onError(null);
    setPending({ fileName, settings: result.settings, summary: result.summary });
    setOpen(true);
  }

  return (
    <>
      <div className="flex gap-2 max-sm:w-full max-sm:flex-col">
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={download}
          className="max-sm:h-11 max-sm:w-full"
        >
          <Download aria-hidden="true" />
          {es.categories.backup.download}
        </Button>
        <Button
          ref={uploadRef}
          type="button"
          variant="outline"
          size="lg"
          onClick={() => {
            inputRef.current?.click();
          }}
          className="max-sm:h-11 max-sm:w-full"
        >
          <Upload aria-hidden="true" />
          {es.categories.backup.upload}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".json,application/json"
          hidden
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => {
            void onFilePicked(event);
          }}
        />
      </div>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent initialFocus={keepRef} finalFocus={uploadRef}>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl leading-[1.2] font-semibold">
              {es.categories.backup.replaceTitle}
            </AlertDialogTitle>
            <AlertDialogDescription className="break-words">
              {pending === null
                ? ""
                : replaceSettingsBody(pending.fileName, replaceSummaryText(pending.summary))}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel ref={keepRef}>{es.categories.backup.keepMine}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (pending !== null) {
                  replaceAll(pending.settings);
                  // A restored file can drop categories that are selected in the Dashboard filter; they must not stay selected (WR-01, like T-03-38 on delete).
                  useSessionStore
                    .getState()
                    .pruneCategoryFilter(new Set(pending.settings.categories.map((category) => category.id)));
                  toast(es.categories.backup.replacedToast);
                }
                setOpen(false);
              }}
            >
              {es.categories.backup.replaceConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/**
 * Alert of a refused settings file (D-08, E4). Only the icon is destructive; the text keeps the
 * foreground color. The file name is user text: shown in full, wrapping, as React text.
 */
export function BackupErrorAlert({
  error,
  onClose,
}: {
  error: BackupError | null;
  onClose: () => void;
}) {
  if (error === null) return null;
  return (
    <Alert>
      <CircleAlert aria-hidden="true" className="text-destructive!" />
      <AlertDescription className="text-foreground break-words">
        {invalidFileText(error.fileName, backupReasonText(error.reason))}
      </AlertDescription>
      <AlertAction>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={es.categories.backup.closeAlert}
          onClick={onClose}
          className="max-sm:size-11"
        >
          <X aria-hidden="true" />
        </Button>
      </AlertAction>
    </Alert>
  );
}
