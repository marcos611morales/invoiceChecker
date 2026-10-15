"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TruncatedText } from "@/components/TruncatedText";
import { entryAmount, type IvaMode } from "@/domain/accounting/aggregate";
import { toMoneyString } from "@/domain/accounting/decimal";
import type { LedgerEntry } from "@/domain/accounting/ledger";
import {
  AMOUNT_CHANGING_TYPES,
  INCIDENT_ORDER,
  type Incident,
  type IncidentType,
  type QualitySummary,
} from "@/domain/accounting/quality";
import { es } from "@/lib/copy/es";
import {
  ceroRow,
  datosInvalidosRow,
  excluidaRow,
  groupTriggerText,
  incidentTitle,
  monedaRow,
  ncSinRelacionadaRow,
  ncVariasRelacionadasRow,
  ppdRow,
  redondeoConceptosRow,
  redondeoTotalRow,
  sustitucionRow,
  sustituidaRow,
} from "@/lib/copy/messages";
import {
  formatFechaIso,
  formatMoney,
  formatTotal,
  invoiceRef,
  monthYearLabel,
  shortUuid,
} from "@/lib/format";
import { useSessionStore } from "@/stores/sessionStore";

/** Empty value, the same dash the rest of the app shows. */
const MISSING = "—";

/** Dismissed-at counts by type: the accordion of a type is open while its rows exceed this number. */
type DismissedAt = ReadonlyMap<IncidentType, number>;

function monthText(month: string | null): string {
  return month === null ? MISSING : monthYearLabel(month);
}

/** Row sentences of one incident; rounding can carry two (Total and concepts). */
function sentencesOf(
  incident: Incident,
  byUuid: ReadonlyMap<string, LedgerEntry>,
): string[] {
  const { detail, entry } = incident;
  switch (detail.kind) {
    case "nc-sin-relacionada":
      return [ncSinRelacionadaRow(monthText(detail.month))];
    case "nc-varias-relacionadas":
      return [
        ncVariasRelacionadasRow(monthText(detail.month), detail.relatedLoadedCount),
      ];
    case "sustituciones":
      return [sustitucionRow(shortUuid(detail.targetUuid), detail.state)];
    case "moneda-sin-tc":
      return [monedaRow(detail.moneda)];
    case "datos-invalidos":
      return [datosInvalidosRow(detail.field)];
    case "cero":
      return [ceroRow()];
    case "redondeo": {
      const sentences: string[] = [];
      const { moneda } = entry.invoice;
      if (detail.totalDiff !== null) {
        sentences.push(
          redondeoTotalRow(formatTotal(toMoneyString(detail.totalDiff), moneda)),
        );
      }
      if (detail.conceptsDiff !== null) {
        sentences.push(
          redondeoConceptosRow(formatTotal(toMoneyString(detail.conceptsDiff), moneda)),
        );
      }
      return sentences;
    }
    case "ppd-sin-complemento":
      return [ppdRow()];
    case "excluidas":
      return [excluidaRow()];
    case "sustituidas": {
      const substitute =
        detail.substitutedBy === null ? undefined : byUuid.get(detail.substitutedBy);
      const ref =
        substitute !== undefined
          ? invoiceRef(substitute.invoice.folio, substitute.uuid)
          : detail.substitutedBy === null
            ? MISSING
            : shortUuid(detail.substitutedBy);
      return [sustituidaRow(ref)];
    }
  }
}

function Dot() {
  return (
    <span aria-hidden="true" className="shrink-0 text-muted-foreground">
      ·
    </span>
  );
}

function IncidentRow({
  incident,
  mode,
  byUuid,
  reincludable,
}: {
  incident: Incident;
  mode: IvaMode;
  byUuid: ReadonlyMap<string, LedgerEntry>;
  reincludable: boolean;
}) {
  const requestFocus = useSessionStore((s) => s.requestFocus);
  const reincludeInvoice = useSessionStore((s) => s.reincludeInvoice);
  const { entry } = incident;
  const amount = entryAmount(entry, mode);
  return (
    <li
      data-testid={`quality-row-${incident.key}`}
      className="flex flex-col gap-1 border-b px-4 py-2 last:border-b-0"
    >
      <div className="flex min-w-0 items-baseline gap-1.5 text-sm">
        <span className="shrink-0 tabular-nums">{formatFechaIso(entry.invoice.fecha)}</span>
        <Dot />
        <div className="min-w-0">
          <TruncatedText text={entry.supplierName} />
        </div>
        <Dot />
        <span className="shrink-0">{invoiceRef(entry.invoice.folio, entry.uuid)}</span>
        <Dot />
        <span className="shrink-0 tabular-nums">
          {amount === null ? MISSING : formatMoney(amount)}
        </span>
      </div>
      {sentencesOf(incident, byUuid).map((sentence) => (
        <p key={sentence} className="text-sm [overflow-wrap:anywhere]">
          {sentence}
        </p>
      ))}
      <div className="flex flex-wrap gap-2 pt-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            requestFocus(entry.uuid);
          }}
        >
          {es.quality.seeInvoice}
        </Button>
        {reincludable && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              reincludeInvoice(entry.uuid);
            }}
          >
            {es.quality.reinclude}
          </Button>
        )}
      </div>
    </li>
  );
}

/**
 * Brings the per-type "dismissed at" counts up to date with the current row counts.
 * A type seen for the first time starts at 0 when it changes amounts (open while it
 * has rows) and at its current count otherwise (closed until it gains rows); a count
 * that fell below its mark is lowered to the new count, so a later growth is "gained
 * rows" again. Returns the same map when nothing changes.
 */
function reconcile(dismissed: DismissedAt, counts: ReadonlyMap<IncidentType, number>): DismissedAt {
  let next: Map<IncidentType, number> | null = null;
  for (const type of INCIDENT_ORDER) {
    const count = counts.get(type) ?? 0;
    const current = dismissed.get(type);
    if (current === undefined) {
      if (!AMOUNT_CHANGING_TYPES.has(type)) {
        next ??= new Map(dismissed);
        next.set(type, count);
      }
    } else if (current > count) {
      next ??= new Map(dismissed);
      next.set(type, count);
    }
  }
  return next ?? dismissed;
}

/**
 * Ordered accordions of the incident types that have rows (D-31). The four
 * amount-changing types open by themselves; the others, the informational
 * "Notas de crédito con varias relacionadas" included (D-46), start closed. A type
 * re-opens when a later batch gives it more rows than when the user last closed it.
 * Each panel scrolls inside a 320 px area (E8 overflow).
 */
export function QualityAccordions({
  summary,
  ledger,
  mode,
}: {
  summary: QualitySummary;
  ledger: readonly LedgerEntry[];
  mode: IvaMode;
}) {
  const [stored, setStored] = useState<DismissedAt>(() => new Map());

  const counts = new Map<IncidentType, number>();
  for (const type of INCIDENT_ORDER) {
    counts.set(type, summary.byType.get(type)?.length ?? 0);
  }
  // Derived during render (not in an effect): fold new rows into the dismissed marks.
  const dismissed = reconcile(stored, counts);
  if (dismissed !== stored) setStored(dismissed);

  const byUuid = new Map<string, LedgerEntry>();
  for (const entry of ledger) {
    if (!byUuid.has(entry.uuid)) byUuid.set(entry.uuid, entry);
  }

  const visible = INCIDENT_ORDER.filter((type) => (counts.get(type) ?? 0) > 0);
  const isOpen = (type: IncidentType): boolean =>
    (counts.get(type) ?? 0) > (dismissed.get(type) ?? 0);
  const value = visible.filter(isOpen);

  function onValueChange(next: readonly unknown[]) {
    const ids = new Set(
      next.filter((item): item is string => typeof item === "string"),
    );
    let updated: Map<IncidentType, number> | null = null;
    for (const type of visible) {
      const wasOpen = isOpen(type);
      const nowOpen = ids.has(type);
      if (wasOpen === nowOpen) continue;
      updated ??= new Map(dismissed);
      // Closing remembers how many rows were there; opening by hand clears the mark.
      updated.set(type, nowOpen ? 0 : (counts.get(type) ?? 0));
    }
    if (updated !== null) setStored(updated);
  }

  if (visible.length === 0) return null;

  return (
    <Accordion
      multiple
      value={value}
      onValueChange={onValueChange}
      className="overflow-hidden rounded-lg border"
    >
      {visible.map((type) => {
        const incidents = summary.byType.get(type) ?? [];
        return (
          <AccordionItem key={type} value={type}>
            <AccordionTrigger
              data-testid={`quality-trigger-${type}`}
              className="h-10 items-center rounded-none px-4 py-0 font-semibold hover:bg-secondary hover:no-underline"
            >
              {groupTriggerText(incidentTitle(type), incidents.length)}
            </AccordionTrigger>
            <AccordionContent className="pb-0">
              <ScrollArea className="border-t [&_[data-slot=scroll-area-viewport]]:max-h-80">
                <ul>
                  {incidents.map((incident) => (
                    <IncidentRow
                      key={incident.key}
                      incident={incident}
                      mode={mode}
                      byUuid={byUuid}
                      reincludable={type === "excluidas" || type === "sustituidas"}
                    />
                  ))}
                </ul>
              </ScrollArea>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
