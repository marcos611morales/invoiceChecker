"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from "react";
import { Check, Lock, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  orderedCategories,
  usageByCategory,
  type NameError,
} from "@/domain/settings/categories";
import { es } from "@/lib/copy/es";
import {
  categoryAddedText,
  categoryCountLabel,
  categoryRenamedText,
  deleteCategoryAria,
  renameCategoryAria,
  renameInputAria,
  usageCaption,
} from "@/lib/copy/messages";
import { useSettingsStore } from "@/stores/settingsStore";
import { useCategorySettings } from "./useCategorySettings";

const ERROR_TEXT: Record<NameError, string> = {
  empty: es.categories.list.errors.empty,
  duplicate: es.categories.list.errors.duplicate,
  reserved: es.categories.list.errors.reserved,
  "too-long": es.categories.list.errors.tooLong,
  limit: es.categories.list.errors.limit,
};

/** Icon-only ghost button with the same text as its Tooltip and its accessible name. */
function IconAction({
  label,
  onClick,
  buttonRef,
  children,
}: {
  label: string;
  onClick: () => void;
  buttonRef?: Ref<HTMLButtonElement>;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            ref={buttonRef}
            type="button"
            variant="ghost"
            size="icon"
            aria-label={label}
            onClick={onClick}
            className="size-9 max-sm:size-11"
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Inline name editor of one row (UI-SPEC Q10): the current name selected, Enter saves,
 * Esc cancels, blur does nothing. Mounted only while its row is being edited, so every
 * opening starts from the current name with no error. `onSave` returns the refusal
 * reason, or null when the name was saved.
 */
function RenameEditor({
  name,
  onSave,
  onCancel,
}: {
  name: string;
  onSave: (value: string) => NameError | null;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(name);
  const [error, setError] = useState<NameError | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const errorId = useId();

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const save = () => {
    setError(onSave(value));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      save();
    } else if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
    }
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <div className="flex items-center gap-2">
        <Input
          ref={inputRef}
          value={value}
          maxLength={60}
          aria-label={renameInputAria(name)}
          aria-invalid={error !== null ? true : undefined}
          aria-describedby={error !== null ? errorId : undefined}
          onChange={(event) => {
            setValue(event.target.value);
            setError(null);
          }}
          onKeyDown={onKeyDown}
          className="h-9 max-sm:h-11"
        />
        <IconAction label={es.categories.list.saveName} onClick={save}>
          <Check aria-hidden="true" />
        </IconAction>
        <IconAction label={es.categories.list.cancelRename} onClick={onCancel}>
          <X aria-hidden="true" />
        </IconAction>
      </div>
      {error !== null ? (
        <p id={errorId} className="text-xs text-foreground">
          {ERROR_TEXT[error]}
        </p>
      ) : null}
    </div>
  );
}

/**
 * «Mis categorías» card (CAT-01, D-04): add form, the alphabetical list with usage and
 * inline rename, and the locked «Sin categoría» row. Category names are free text from
 * the user and are only ever rendered as React text (T-03-06).
 */
export function CategoryList() {
  const { settings } = useCategorySettings();
  const addCategory = useSettingsStore((s) => s.addCategory);
  const renameCategory = useSettingsStore((s) => s.renameCategory);

  const ordered = useMemo(() => orderedCategories(settings.categories), [settings.categories]);
  const usage = useMemo(() => usageByCategory(settings), [settings]);

  const [name, setName] = useState("");
  const [addError, setAddError] = useState<NameError | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [, setPendingDelete] = useState<string | null>(null);

  const headingId = useId();
  const inputId = useId();
  const addErrorId = useId();
  const addInputRef = useRef<HTMLInputElement>(null);
  const pencilRefs = useRef(new Map<string, HTMLButtonElement>());
  const pendingFocus = useRef<string | null>(null);

  // After a rename ends the pencil is rendered again, so focus moves to it here.
  useEffect(() => {
    const id = pendingFocus.current;
    if (id === null) return;
    pendingFocus.current = null;
    pencilRefs.current.get(id)?.focus();
  });

  const submitAdd = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = addCategory(name);
    if (!result.ok) {
      setAddError(result.reason);
      return;
    }
    setName("");
    setAddError(null);
    setAnnouncement(categoryAddedText(result.category.name));
    addInputRef.current?.focus();
  };

  const saveRename = (id: string, value: string): NameError | null => {
    const result = renameCategory(id, value);
    if (!result.ok) return result.reason;
    setEditingId(null);
    setAnnouncement(categoryRenamedText(value.trim()));
    pendingFocus.current = id;
    return null;
  };

  const cancelRename = (id: string) => {
    setEditingId(null);
    pendingFocus.current = id;
  };

  return (
    <section
      aria-labelledby={headingId}
      className="flex w-full max-w-[720px] flex-col gap-4 rounded-lg border bg-background p-6"
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id={headingId} tabIndex={-1} className="text-xl leading-[1.2] font-semibold outline-none">
          {es.categories.list.heading}
        </h2>
        <span className="text-xs text-muted-foreground">
          {categoryCountLabel(settings.categories.length)}
        </span>
      </div>

      <form onSubmit={submitAdd} noValidate className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Label htmlFor={inputId}>{es.categories.list.newLabel}</Label>
          <Input
            id={inputId}
            ref={addInputRef}
            value={name}
            maxLength={60}
            placeholder={es.categories.list.newHint}
            autoComplete="off"
            aria-invalid={addError !== null ? true : undefined}
            aria-describedby={addError !== null ? addErrorId : undefined}
            onChange={(event) => {
              setName(event.target.value);
              setAddError(null);
            }}
            className="h-9 max-sm:h-11"
          />
          {addError !== null ? (
            <p id={addErrorId} className="text-xs text-foreground">
              {ERROR_TEXT[addError]}
            </p>
          ) : null}
        </div>
        <Button type="submit" variant="outline" className="h-9 sm:mt-[22px] max-sm:h-11 max-sm:w-full">
          {es.categories.list.add}
        </Button>
      </form>

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {settings.categories.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle className="text-base">{es.categories.list.emptyHeading}</EmptyTitle>
            <EmptyDescription>{es.categories.list.emptyBody}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}

      <ul className="flex flex-col divide-y divide-border">
        {ordered.map((category) => {
          const used = usage.get(category.id) ?? { suppliers: 0, concepts: 0 };
          return (
            <li key={category.id} className="flex min-h-14 items-center gap-3 py-2">
              {editingId === category.id ? (
                <RenameEditor
                  name={category.name}
                  onSave={(value) => saveRename(category.id, value)}
                  onCancel={() => {
                    cancelRename(category.id);
                  }}
                />
              ) : (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold break-words">{category.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {usageCaption(used.suppliers, used.concepts)}
                    </p>
                  </div>
                  <IconAction
                    label={renameCategoryAria(category.name)}
                    onClick={() => {
                      setEditingId(category.id);
                    }}
                    buttonRef={(node) => {
                      if (node === null) pencilRefs.current.delete(category.id);
                      else pencilRefs.current.set(category.id, node);
                    }}
                  >
                    <Pencil aria-hidden="true" />
                  </IconAction>
                  <IconAction
                    label={deleteCategoryAria(category.name)}
                    onClick={() => {
                      setPendingDelete(category.id);
                    }}
                  >
                    <Trash2 aria-hidden="true" />
                  </IconAction>
                </>
              )}
            </li>
          );
        })}
        <li className="flex min-h-14 items-start gap-3 bg-secondary px-3 py-2">
          <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold break-words">{es.categories.none}</p>
            <p className="text-xs text-muted-foreground">{es.categories.list.lockedCaption}</p>
          </div>
        </li>
      </ul>
    </section>
  );
}
