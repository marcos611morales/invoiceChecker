"use client";

import type { BackupFailure } from "@/domain/settings/backup";

/** Why the last chosen file was refused, kept by the tab while its Alert is shown. */
export interface BackupError {
  fileName: string;
  reason: BackupFailure;
}

export function BackupControls({ onError }: { onError: (error: BackupError | null) => void }) {
  void onError;
  return null;
}

export function BackupErrorAlert({
  error,
  onClose,
}: {
  error: BackupError | null;
  onClose: () => void;
}) {
  void error;
  void onClose;
  return null;
}
