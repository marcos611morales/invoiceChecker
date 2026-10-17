"use client";

import { useId, useRef, useState, type RefObject } from "react";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { categoryUsage, orderedCategories } from "@/domain/settings/categories";
import { SIN_CATEGORIA, type Category } from "@/domain/settings/types";
import { es } from "@/lib/copy/es";
import { deleteCategoryBody, deleteCategoryTitle } from "@/lib/copy/messages";
import { useSettingsStore } from "@/stores/settingsStore";
import { useCategorySettings } from "./useCategorySettings";

/** The undo toast stays six seconds (P2 D-29). */
const TOAST_DURATION_MS = 6000;

/** Item text wraps even though the shared SelectItem keeps it on one line (E4 long-text). */
const WRAPPING_TEXT = "whitespace-normal break-words";

/**
 * Content of the dialog. It is mounted only while the dialog is open, so the target
 * Select starts on «Sin categoría» every time.
 */
function DeleteBody({
  category,
  dismissRef,
  onConfirm,
}: {
  category: Category;
  dismissRef: RefObject<HTMLButtonElement | null>;
  onConfirm: (target: string | null) => void;
}) {
  const { settings } = useCategorySettings();
  const [target, setTarget] = useState<string>(SIN_CATEGORIA);
  const labelId = useId();

  // Read once when the dialog opens: after a delete the category is gone from the settings,
  // and the dialog must keep its text while it fades out.
  const [view] = useState(() => {
    const usage = categoryUsage(settings, category.id);
    return {
      usage,
      used: usage.suppliers > 0 || usage.concepts > 0,
      items: [
        { value: SIN_CATEGORIA, label: es.categories.none },
        ...orderedCategories(settings.categories)
          .filter((other) => other.id !== category.id)
          .map((other) => ({ value: other.id, label: other.name })),
      ],
    };
  });
  const { usage, used, items } = view;

  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle className="text-xl leading-[1.2] font-semibold break-words">
          {deleteCategoryTitle(category.name)}
        </AlertDialogTitle>
        <AlertDialogDescription>
          {deleteCategoryBody(usage.suppliers, usage.concepts)}
        </AlertDialogDescription>
      </AlertDialogHeader>
      {used ? (
        <div className="flex flex-col gap-2">
          <Label id={labelId}>{es.dialogs.deleteCategory.moveLabel}</Label>
          <Select
            items={items}
            value={target}
            onValueChange={(next) => {
              if (next !== null) setTarget(next);
            }}
          >
            <SelectTrigger aria-labelledby={labelId} className="w-full max-sm:h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false} className="max-h-72">
              {items.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  <span
                    className={
                      item.value === SIN_CATEGORIA
                        ? `${WRAPPING_TEXT} text-muted-foreground`
                        : WRAPPING_TEXT
                    }
                  >
                    {item.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
      <AlertDialogFooter>
        <AlertDialogCancel ref={dismissRef}>{es.dialogs.deleteCategory.dismiss}</AlertDialogCancel>
        <AlertDialogAction
          variant="destructive"
          onClick={() => {
            onConfirm(target === SIN_CATEGORIA ? null : target);
          }}
        >
          {es.dialogs.deleteCategory.confirm}
        </AlertDialogAction>
      </AlertDialogFooter>
    </>
  );
}

/**
 * Delete confirmation of one category (CAT-05, D-05, UI-SPEC Q4 and Q10). Focus starts on
 * «Conservar categoría»; Esc and an overlay click dismiss with no change. Confirming moves
 * the category's supplier assignments and concept adjustments to the chosen category (or
 * to «Sin categoría»), shows «Categoría borrada» with «Deshacer» for six seconds, and
 * moves focus to `finalFocusRef` (the row is gone). A dismissal returns focus the usual way.
 * The category name is user text and is only rendered as React text (T-03-06).
 */
export function DeleteCategoryDialog({
  category,
  open,
  onOpenChange,
  finalFocusRef,
}: {
  category: Category;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Where focus goes after a delete: the «Mis categorías» heading. */
  finalFocusRef: RefObject<HTMLElement | null>;
}) {
  const deleteCategory = useSettingsStore((s) => s.deleteCategory);
  const restoreCategory = useSettingsStore((s) => s.restoreCategory);
  const dismissRef = useRef<HTMLButtonElement>(null);
  const deletedRef = useRef(false);

  const confirm = (target: string | null) => {
    const snapshot = deleteCategory(category.id, target);
    onOpenChange(false);
    if (snapshot === null) return;
    deletedRef.current = true;
    toast(es.categories.deletedToast, {
      duration: TOAST_DURATION_MS,
      action: {
        label: es.categories.undo,
        onClick: () => {
          restoreCategory(snapshot);
        },
      },
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        initialFocus={dismissRef}
        finalFocus={() => {
          const deleted = deletedRef.current;
          deletedRef.current = false;
          return deleted ? finalFocusRef.current : true;
        }}
      >
        <DeleteBody category={category} dismissRef={dismissRef} onConfirm={confirm} />
      </AlertDialogContent>
    </AlertDialog>
  );
}
