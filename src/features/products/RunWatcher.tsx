"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { es } from "@/lib/copy/es";
import { runFinishedToast } from "@/lib/copy/messages";
import { useLlmRunStore, type RunStatus } from "@/stores/llmRunStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useSuggestionsStore } from "@/stores/suggestionsStore";
import { PRODUCTS_QUEUE_HEADING_ID, PRODUCTS_TITLE_ID } from "./focusTargets";

const TOAST_DURATION_MS = 6000;

/** How long to wait for the Productos panel to mount after switching tabs, in animation frames. */
const FOCUS_FRAMES = 10;

/**
 * Statuses whose end was already announced. Module scope, so a remount of the watcher (the
 * loaded screen leaves and comes back) never announces the same run twice.
 */
const announced = new WeakSet<RunStatus>();

/** Focuses the queue heading when cards wait for review, else the tab heading, once the panel is there. */
function focusProductsHeading(): void {
  const id =
    useSuggestionsStore.getState().products.length > 0
      ? PRODUCTS_QUEUE_HEADING_ID
      : PRODUCTS_TITLE_ID;
  let frames = FOCUS_FRAMES;
  const attempt = () => {
    const target = document.getElementById(id);
    if (target !== null) {
      target.focus();
      return;
    }
    frames -= 1;
    if (frames > 0) requestAnimationFrame(attempt);
  };
  requestAnimationFrame(attempt);
}

/**
 * Always mounted with the loaded tabs (renders nothing): when a run ends it toasts how many
 * suggestions wait for review, from whichever tab the user is on. Only when the Productos tab is
 * not the active one does the toast carry «Revisar», which goes there and focuses the heading.
 */
export function RunWatcher() {
  const status = useLlmRunStore((s) => s.status);
  useEffect(() => {
    if (status.phase !== "finished" && status.phase !== "partial") return;
    if (announced.has(status)) return;
    announced.add(status);
    const message = runFinishedToast(status.kind, status.received);
    if (useSessionStore.getState().activeTab === "productos") {
      toast(message);
      return;
    }
    toast(message, {
      duration: TOAST_DURATION_MS,
      action: {
        label: es.products.run.review,
        onClick: () => {
          useSessionStore.getState().setActiveTab("productos");
          focusProductsHeading();
        },
      },
    });
  }, [status]);
  return null;
}
