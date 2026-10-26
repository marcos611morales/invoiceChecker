"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { resolveContent } from "@/domain/prices/content";
import type { MemberContent } from "@/domain/prices/members";
import type { UnitFamily } from "@/domain/prices/units";
import { contentAmountIssue } from "@/domain/settings/schema";
import { LIMITS, type ContentCorrection, type ContentUnit } from "@/domain/settings/types";
import { es } from "@/lib/copy/es";
import { contentLimitText, contentPreview, contentRemovedToast } from "@/lib/copy/messages";
import { formatContent, formatCorrection, formatQuantity } from "@/lib/format";
import { useSettingsStore } from "@/stores/settingsStore";

/** The removal toast stays six seconds, like the other toasts with «Deshacer» (UI-SPEC defaults). */
const TOAST_DURATION_MS = 6000;

const copy = es.prices.detail.content;

/** The units of the Select, in the order of the UI-SPEC: g · kg · mL · L · piezas. */
const UNIT_OPTIONS: readonly { value: ContentUnit; label: string }[] = [
  { value: "g", label: copy.units.g },
  { value: "kg", label: copy.units.kg },
  { value: "ml", label: copy.units.ml },
  { value: "l", label: copy.units.l },
  { value: "piezas", label: copy.units.piezas },
];

function unitLabel(unit: ContentUnit): string {
  return UNIT_OPTIONS.find((option) => option.value === unit)?.label ?? unit;
}

/** The unit that reads a size of a family: kilograms, litres or counted pieces. */
function unitOfFamily(family: UnitFamily): ContentUnit {
  if (family === "mass") return "kg";
  if (family === "volume") return "l";
  return "piezas";
}

interface Draft {
  packs: string;
  amount: string;
  unit: ContentUnit;
}

/**
 * What the fields start with: the member's correction, else the size read from its description as
 * one piece of that size, else one piece and an empty content. Without a reading the unit starts
 * at «piezas», the one that assumes nothing about weight or volume.
 */
function initialDraft(member: MemberContent): Draft {
  if (member.correction !== null) {
    return { packs: String(member.correction.packs), amount: member.correction.amount, unit: member.correction.unit };
  }
  if (member.detected !== null) {
    return { packs: "1", amount: member.detected.amount.toFixed(), unit: unitOfFamily(member.detected.family) };
  }
  return { packs: "1", amount: "", unit: "piezas" };
}

const PACKS_TEXT = /^\d{1,3}$/;

/** The pieces per pack when the text is a whole number from 1 to the stored maximum, else null. */
function packsOf(text: string): number | null {
  const trimmed = text.trim();
  if (!PACKS_TEXT.test(trimmed)) return null;
  const packs = Number(trimmed);
  return packs >= 1 && packs <= LIMITS.contentPacks ? packs : null;
}

/** The content as decimal text when it passes the stored rule (greater than 0, up to 6 decimals, up to 1,000,000). */
function amountOf(text: string): string | null {
  const trimmed = text.trim();
  return contentAmountIssue(trimmed) === null ? trimmed : null;
}

function correctionOf(member: MemberContent, packs: number, amount: string, unit: ContentUnit): ContentCorrection {
  return {
    rfc: member.rfc,
    key: member.key,
    description: member.description,
    supplierName: member.storeName,
    packs,
    amount,
    unit,
  };
}

/**
 * Inline editor of the content of one description (D-13, D-14, D-15): pieces per pack, content of
 * each piece and unit, with a live preview of what one purchase is worth. Mounted only while open,
 * so every opening starts from the stored correction or the detected reading. Enter in a number
 * field saves when the values pass the stored rules, Escape discards; the parent returns focus to
 * the pencil of the row after either. `onSaved` runs just before `onClose` after a save, so the
 * parent can announce the recalculated saving once the new row has rendered.
 */
export function ContentEditor({
  member,
  onClose,
  onSaved,
  onAnnounce,
}: {
  member: MemberContent;
  onClose: () => void;
  onSaved?: () => void;
  onAnnounce?: (message: string) => void;
}) {
  const initial = initialDraft(member);
  const [packs, setPacks] = useState(initial.packs);
  const [amount, setAmount] = useState(initial.amount);
  const [unit, setUnit] = useState<ContentUnit>(initial.unit);
  const [errors, setErrors] = useState({ packs: false, amount: false });
  const [refusal, setRefusal] = useState<string | null>(null);
  const packsRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const packsId = useId();
  const amountId = useId();
  const unitLabelId = useId();
  const packsErrorId = useId();
  const amountErrorId = useId();
  const refusalId = useId();

  const setCorrection = useSettingsStore((state) => state.setContentCorrection);
  const removeCorrection = useSettingsStore((state) => state.removeContentCorrection);
  const restoreCorrection = useSettingsStore((state) => state.restoreContentCorrection);

  useEffect(() => {
    packsRef.current?.focus();
  }, []);

  const typedPacks = packsOf(packs);
  const typedAmount = amountOf(amount);
  let preview = "";
  if (typedPacks !== null && typedAmount !== null) {
    const draft = correctionOf(member, typedPacks, typedAmount, unit);
    // The quantity of the latest purchase stands for the invoice quantity (Plan 05-11, A-5); a piece
    // unit has factor 1, so any piece code reads the same total.
    const total = resolveContent(
      { claveUnidad: "H87", cantidad: member.latestCantidad, descripcion: "" },
      draft,
    );
    if (total.ok) {
      preview = contentPreview(
        formatCorrection(draft),
        formatQuantity(member.latestCantidad),
        formatContent(total.amount, total.family),
      );
    }
  }

  const save = () => {
    if (typedPacks === null || typedAmount === null) {
      setErrors({ packs: typedPacks === null, amount: typedAmount === null });
      setRefusal(null);
      (typedPacks === null ? packsRef : amountRef).current?.focus();
      return;
    }
    const result = setCorrection(correctionOf(member, typedPacks, typedAmount, unit));
    if (!result.ok) {
      // Refused: nothing was written. Say why in the editor, in a toast and to screen readers.
      const text = result.reason === "limit" ? contentLimitText(LIMITS.contentCorrections) : copy.editor.refused;
      setRefusal(text);
      toast.error(text);
      onAnnounce?.(text);
      return;
    }
    onSaved?.();
    onClose();
  };

  const restoreDetected = () => {
    const removed = removeCorrection(member.rfc, member.key);
    if (removed !== null) {
      toast(contentRemovedToast(member.description), {
        duration: TOAST_DURATION_MS,
        action: {
          label: copy.editor.undo,
          onClick: () => {
            restoreCorrection(removed);
          },
        },
      });
    }
    onClose();
  };

  const onFieldKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      save();
    }
  };

  // Escape discards, but only when it comes from inside the editor: the open unit list lives in a
  // portal and its Escape must close just the list.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape") return;
    if (!(event.target instanceof Node) || !event.currentTarget.contains(event.target)) return;
    event.preventDefault();
    onClose();
  };

  return (
    <div
      className="flex min-w-0 flex-col gap-3 rounded-lg border bg-background p-3 sm:p-4"
      onKeyDown={onKeyDown}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
        <div className="flex w-full flex-col gap-1.5 sm:w-24">
          <Label htmlFor={packsId}>{copy.editor.packs}</Label>
          <Input
            ref={packsRef}
            id={packsId}
            value={packs}
            inputMode="numeric"
            autoComplete="off"
            aria-invalid={errors.packs ? true : undefined}
            aria-describedby={errors.packs ? packsErrorId : undefined}
            className="h-9 max-sm:h-11"
            onChange={(event) => {
              setPacks(event.target.value);
              setErrors((current) => ({ ...current, packs: false }));
              setRefusal(null);
            }}
            onKeyDown={onFieldKeyDown}
          />
          {errors.packs ? (
            <p id={packsErrorId} className="text-xs text-foreground">
              {copy.editor.packsError}
            </p>
          ) : null}
        </div>
        <div className="flex w-full flex-col gap-1.5 sm:w-[120px]">
          <Label htmlFor={amountId}>{copy.editor.amount}</Label>
          <Input
            ref={amountRef}
            id={amountId}
            value={amount}
            inputMode="decimal"
            autoComplete="off"
            aria-invalid={errors.amount ? true : undefined}
            aria-describedby={errors.amount ? amountErrorId : undefined}
            className="h-9 max-sm:h-11"
            onChange={(event) => {
              setAmount(event.target.value);
              setErrors((current) => ({ ...current, amount: false }));
              setRefusal(null);
            }}
            onKeyDown={onFieldKeyDown}
          />
          {errors.amount ? (
            <p id={amountErrorId} className="text-xs text-foreground">
              {copy.editor.amountError}
            </p>
          ) : null}
        </div>
        <div className="flex w-full flex-col gap-1.5 sm:w-[120px]">
          <Label id={unitLabelId}>{copy.editor.unit}</Label>
          <Select
            value={unit}
            onValueChange={(value) => {
              const option = UNIT_OPTIONS.find((candidate) => candidate.value === value);
              if (option === undefined) return;
              setUnit(option.value);
              setRefusal(null);
            }}
          >
            <SelectTrigger
              aria-labelledby={unitLabelId}
              className="w-full data-[size=default]:h-9 data-[size=default]:max-sm:h-11"
            >
              <SelectValue>{unitLabel(unit)}</SelectValue>
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              {UNIT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value} className="min-h-9 max-sm:min-h-11">
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{copy.editor.helper}</p>
      <p data-slot="content-preview" aria-live="polite" className="min-h-4 text-xs text-muted-foreground">
        {preview}
      </p>
      {refusal !== null ? (
        <p id={refusalId} className="text-xs text-foreground">
          {refusal}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" className="max-sm:h-11" onClick={save}>
          {copy.editor.save}
        </Button>
        <Button type="button" variant="ghost" className="max-sm:h-11" onClick={onClose}>
          {copy.editor.discard}
        </Button>
        {member.correction !== null ? (
          <Button type="button" variant="ghost" className="max-sm:h-11" onClick={restoreDetected}>
            {copy.editor.restore}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
