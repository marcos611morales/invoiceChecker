"use client";

import { useEffect, useState } from "react";
import { CircleAlert } from "lucide-react";
import { receptorDistinto } from "@/domain/import/report";
import type { LoadedInvoice } from "@/domain/import/types";
import { es } from "@/lib/copy/es";
import {
  duplicateRowText,
  groupTriggerText,
  ignoredReasonText,
  receptorDistintoText,
  rejectReasonText,
} from "@/lib/copy/messages";
import { useSessionStore, type ImportFocus } from "@/stores/sessionStore";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const REJECTED_ID = "rechazados";

interface ReportRow {
  key: string;
  name: string;
  path: string;
  detail: string;
}

interface ReportSection {
  id: string;
  label: string;
  rows: ReportRow[];
  /** Rejected rows carry the destructive CircleAlert icon (UI-SPEC). */
  rejected?: boolean;
}

function invoiceRows(
  invoices: readonly LoadedInvoice[],
  tipos: readonly LoadedInvoice["invoice"]["tipo"][],
): ReportRow[] {
  const rows: ReportRow[] = [];
  invoices.forEach(({ file, invoice }, index) => {
    if (!tipos.includes(invoice.tipo)) return;
    const issuer = invoice.emisor.nombre;
    rows.push({
      key: `${file.path}-${index}`,
      name: file.name,
      path: file.path,
      detail: issuer !== null && issuer !== "" ? issuer : invoice.emisor.rfc,
    });
  });
  return rows;
}

function FileRow({ row, rejected }: { row: ReportRow; rejected: boolean }) {
  return (
    <li className="flex gap-2 border-b px-4 py-2 last:border-b-0">
      {rejected && (
        <CircleAlert
          aria-hidden="true"
          className="mt-0.5 size-4 shrink-0 text-destructive"
        />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Tooltip>
          <TooltipTrigger className="block w-full min-w-0 cursor-default truncate text-left font-mono text-xs">
            {row.name}
          </TooltipTrigger>
          <TooltipContent className="font-mono break-all">
            {row.path}
          </TooltipContent>
        </Tooltip>
        <span className="text-sm [overflow-wrap:anywhere]">{row.detail}</span>
      </div>
    </li>
  );
}

/** Ordered per-group file lists of the whole session (D-19, D-14, D-16, D-18, D-12, D-13). */
export function ReportAccordions() {
  const invoices = useSessionStore((s) => s.invoices);
  const rejected = useSessionStore((s) => s.rejected);
  const duplicates = useSessionStore((s) => s.duplicates);
  const ignored = useSessionStore((s) => s.ignored);
  const importFocus = useSessionStore((s) => s.importFocus);
  const clearImportFocus = useSessionStore((s) => s.clearImportFocus);

  const [openOthers, setOpenOthers] = useState<string[]>([]);
  // Rejected count at which the user last closed Rechazados; 0 = never closed.
  const [dismissedAt, setDismissedAt] = useState(0);

  // "Ver en Importación" (D-32): the request is applied once through derived state during
  // render, guarded by the last request seen, and cleared from an effect. Sections the
  // user opened or closed before stay as they are.
  const [handledFocus, setHandledFocus] = useState<ImportFocus | null>(null);
  if (importFocus !== handledFocus) {
    setHandledFocus(importFocus);
    if (importFocus === REJECTED_ID) {
      setDismissedAt(0);
    } else if (importFocus === "duplicados") {
      setOpenOthers((current) =>
        current.includes("duplicados") ? current : [...current, "duplicados"],
      );
    }
  }
  useEffect(() => {
    if (importFocus !== null) clearImportFocus();
  }, [importFocus, clearImportFocus]);

  const rejectedCount = rejected.length;
  // Derived during render: open while there are rejections the user has not dismissed.
  const effectiveDismissedAt = dismissedAt > rejectedCount ? 0 : dismissedAt;
  const rejectedOpen = rejectedCount > 0 && rejectedCount > effectiveDismissedAt;

  const sections: ReportSection[] = [
    {
      id: REJECTED_ID,
      label: es.report.groups.rejected,
      rejected: true,
      rows: rejected.map((item, index) => ({
        key: `${item.file.path}-${index}`,
        name: item.file.name,
        path: item.file.path,
        detail: rejectReasonText(item.reason, item.detail),
      })),
    },
    {
      id: "receptor-distinto",
      label: es.report.groups.differentReceptor,
      rows: receptorDistinto(invoices).map((item, index) => ({
        key: `${item.file.path}-${index}`,
        name: item.file.name,
        path: item.file.path,
        detail: receptorDistintoText(item.file.name, item.rfc),
      })),
    },
    {
      id: "duplicados",
      label: es.report.groups.duplicates,
      rows: duplicates.map((item, index) => ({
        key: `${item.file.path}-${index}`,
        name: item.file.name,
        path: item.file.path,
        detail: duplicateRowText(item),
      })),
    },
    {
      id: "ignorados",
      label: es.report.groups.ignored,
      rows: ignored.map((item, index) => ({
        key: `${item.file.path}-${index}`,
        name: item.file.name,
        path: item.file.path,
        detail: ignoredReasonText(item.kind),
      })),
    },
    {
      id: "ingreso",
      label: es.report.groups.income,
      rows: invoiceRows(invoices, ["I"]),
    },
    {
      id: "egreso",
      label: es.report.groups.expense,
      rows: invoiceRows(invoices, ["E"]),
    },
    {
      id: "pago",
      label: es.report.groups.payment,
      rows: invoiceRows(invoices, ["P"]),
    },
    {
      id: "traslado-nomina",
      label: es.report.groups.transferAndPayroll,
      rows: invoiceRows(invoices, ["T", "N"]),
    },
  ];
  const visible = sections.filter((section) => section.rows.length > 0);
  const visibleIds = new Set(visible.map((section) => section.id));

  const value = [
    ...(rejectedOpen ? [REJECTED_ID] : []),
    ...openOthers.filter((id) => visibleIds.has(id)),
  ];

  function onValueChange(next: readonly unknown[]) {
    const ids = next.filter((item): item is string => typeof item === "string");
    const nowOpen = ids.includes(REJECTED_ID);
    if (rejectedOpen && !nowOpen) setDismissedAt(rejectedCount);
    if (!rejectedOpen && nowOpen) setDismissedAt(0);
    setOpenOthers(ids.filter((id) => id !== REJECTED_ID));
  }

  if (visible.length === 0) return null;

  return (
    <Accordion
      multiple
      value={value}
      onValueChange={onValueChange}
      className="overflow-hidden rounded-lg border"
    >
      {visible.map((section) => (
        <AccordionItem key={section.id} value={section.id}>
          <AccordionTrigger className="h-10 items-center rounded-none px-4 py-0 font-semibold hover:bg-secondary hover:no-underline">
            {groupTriggerText(section.label, section.rows.length)}
          </AccordionTrigger>
          <AccordionContent className="pb-0">
            <ScrollArea
              className="border-t [&_[data-slot=scroll-area-viewport]]:max-h-80"
            >
              <ul>
                {section.rows.map((row) => (
                  <FileRow
                    key={row.key}
                    row={row}
                    rejected={section.rejected === true}
                  />
                ))}
              </ul>
            </ScrollArea>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
