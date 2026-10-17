/**
 * Settings file contract, version 1 (Phase 3, D-07, D-08, D-30). Skeleton: the behavior
 * arrives in the next commit of the plan.
 */
import type { SettingsData } from "./types";

export const BACKUP_APP = "invoicechecker-settings";
export const BACKUP_FILE_VERSION = 1;

export type BackupFailure = "not-invoicechecker" | "damaged" | "newer" | "too-large";

export interface BackupSummary {
  categories: number;
  suppliers: number;
  concepts: number;
}

export function checkBackupSize(bytes: number): BackupFailure | null {
  void bytes;
  return null;
}

export function buildBackupText(settings: SettingsData): string {
  void settings;
  return "";
}

export function backupFileName(date: { year: number; month: number; day: number }): string {
  void date;
  return "";
}

export function parseBackupText(
  text: string,
): { ok: true; settings: SettingsData; summary: BackupSummary } | { ok: false; reason: BackupFailure } {
  void text;
  return { ok: false, reason: "damaged" };
}
