"use client";

import { Fragment, useEffect, useMemo, useRef, useState, type Ref } from "react";
import { Pencil } from "lucide-react";
import { TruncatedText } from "@/components/TruncatedText";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ComparedPurchase, ProductComparison } from "@/domain/prices/compare";
import { memberContents, type MemberContent } from "@/domain/prices/members";
import { ruleMapKey } from "@/domain/settings/normalize";
import type { ContentCorrection } from "@/domain/settings/types";
import { IconAction } from "@/features/products/IconAction";
import { es } from "@/lib/copy/es";
import {
  captureContentAria,
  contentSavedAnnouncement,
  editContentAria,
  notNormalizedReasonText,
  showMore,
  usesXmlQuantityText,
} from "@/lib/copy/messages";
import { formatContent, formatCorrection, formatMoney } from "@/lib/format";
import { useSettingsStore } from "@/stores/settingsStore";
import { ContentEditor } from "./ContentEditor";

/**
 * Prefix of the id of the section heading «Contenido de cada descripción». Several products can be
 * open at once, so the real id carries the product id (`contentSectionId`); the missing-content
 * notice focuses it (D-13).
 */
export const CONTENT_SECTION_ID = "prices-content";

/** The id of the content section heading of one product. */
export function contentSectionId(productId: string): string {
  return `${CONTENT_SECTION_ID}-${productId}`;
}

/** Members shown before «Mostrar {n} más» (UI-SPEC E8 overflow). */
const FIRST_PAGE = 10;

const copy = es.prices.detail.content;

/**
 * What the product lacks to compare all of its purchases: the descriptions that are piece units
 * without a size next to sized siblings, and how many purchases they leave out (D-13, D-28). This
 * is the content a typed correction can supply.
 */
export function missingContent(row: ProductComparison): { descriptions: number; purchases: number } {
  const members = new Set<string>();
  let purchases = 0;
  for (const purchase of row.purchases) {
    if (purchase.status === "not-normalized" && purchase.reason === "unsized-with-sized-siblings") {
      members.add(purchase.memberKey);
      purchases += 1;
    }
  }
  return { descriptions: members.size, purchases };
}

/** The purchase that explains why a member is «No normalizado»: the latest one with that reason. */
function reasonPurchase(
  row: ProductComparison,
  member: MemberContent,
): Extract<ComparedPurchase, { status: "not-normalized" }> | null {
  let found: Extract<ComparedPurchase, { status: "not-normalized" }> | null = null;
  for (const purchase of row.purchases) {
    if (
      purchase.memberKey === member.memberKey &&
      purchase.status === "not-normalized" &&
      purchase.reason === member.reason &&
      (found === null || purchase.fecha > found.fecha)
    ) {
      found = purchase;
    }
  }
  return found;
}

/** «Contenido por compra» cell of one member, by how its content was obtained. */
function ContentCell({ row, member }: { row: ProductComparison; member: MemberContent }) {
  if (member.status === "not-normalized") {
    const purchase = reasonPurchase(row, member);
    return (
      <div className="flex flex-col items-start gap-1">
        <Badge variant="outline">{es.prices.notNormalized}</Badge>
        {purchase !== null ? (
          <span className="text-xs text-muted-foreground">{notNormalizedReasonText(purchase, row.family)}</span>
        ) : null}
      </div>
    );
  }
  if (member.status === "corrected" && member.correction !== null) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span>{formatCorrection(member.correction)}</span>
        <Badge variant="outline">{copy.corrected}</Badge>
      </div>
    );
  }
  if (member.status === "detected" && member.detected !== null) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground">{formatContent(member.detected.amount, member.detected.family)}</span>
        <Badge variant="outline">{copy.detected}</Badge>
      </div>
    );
  }
  if (member.status === "unsized") return <span className="text-muted-foreground">{copy.unsized}</span>;
  return <span className="text-muted-foreground">{usesXmlQuantityText(member.xmlFamily)}</span>;
}

/**
 * The «Contenido de cada descripción» section of an opened product (D-13, D-14): one row per
 * description with how its content was read — detected from the description, typed by the user,
 * absent, or taken from the XML quantity — and the way to fix it. Members bought by weight or
 * volume have no edit button. Every description, store name and reason is rendered as React text.
 */
export function ContentTable({
  row,
  onAnnounce,
}: {
  row: ProductComparison;
  /** Receives the polite announcements of the editor; the Precios tab renders them in a live region. */
  onAnnounce?: (message: string) => void;
}) {
  const contentCorrections = useSettingsStore((state) => state.contentCorrections);
  const corrections = useMemo(() => {
    const map = new Map<string, ContentCorrection>();
    for (const correction of contentCorrections) {
      map.set(ruleMapKey(correction.rfc, correction.key), correction);
    }
    return map;
  }, [contentCorrections]);
  const members = useMemo(() => memberContents(row, corrections), [row, corrections]);
  const [showAll, setShowAll] = useState(false);
  // Member identity of the row being edited; one editor at a time.
  const [editing, setEditing] = useState<string | null>(null);
  // The pencil (or «Capturar contenido») of each row, to return focus to after the editor closes.
  const actionButtons = useRef(new Map<string, HTMLButtonElement>());
  const focusAfterClose = useRef<string | null>(null);
  // Set by the editor when it saved: the announcement is made once the recalculated row has rendered.
  const announceSaved = useRef(false);

  useEffect(() => {
    if (editing === null && focusAfterClose.current !== null) {
      const key = focusAfterClose.current;
      focusAfterClose.current = null;
      actionButtons.current.get(key)?.focus();
    }
    if (announceSaved.current) {
      announceSaved.current = false;
      onAnnounce?.(
        contentSavedAnnouncement(row.name, row.saving === null ? null : formatMoney(row.saving)),
      );
    }
  });

  if (members.length === 0) return null;

  const visible = showAll ? members : members.slice(0, FIRST_PAGE);
  const hidden = members.length - visible.length;
  const headingId = contentSectionId(row.productId);
  return (
    <section aria-labelledby={headingId} className="flex min-w-0 flex-col gap-2">
      <h3 id={headingId} tabIndex={-1} className="text-sm font-semibold outline-none">
        {copy.heading}
      </h3>
      <p className="text-xs text-muted-foreground">{copy.intro}</p>
      <div className="min-w-0 overflow-x-auto">
        <Table className="min-w-[760px]">
          <TableHeader>
            <TableRow className="bg-background hover:bg-background">
              <TableHead className="font-semibold">{copy.columns.description}</TableHead>
              <TableHead className="font-semibold">{copy.columns.store}</TableHead>
              <TableHead className="font-semibold">{copy.columns.content}</TableHead>
              <TableHead className="text-right font-semibold">{copy.columns.purchases}</TableHead>
              <TableHead>
                <span className="sr-only">{es.prices.actionsHeader}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((member) => (
              <Fragment key={member.memberKey}>
                <TableRow className="h-14 hover:bg-background">
                  <TableCell className="max-w-[320px] whitespace-normal">
                    <TruncatedText
                      text={member.description}
                      className="line-clamp-2 whitespace-normal break-words"
                    />
                  </TableCell>
                  <TableCell className="max-w-[200px] whitespace-normal break-words">
                    {member.storeName}
                  </TableCell>
                  <TableCell className="whitespace-normal tabular-nums">
                    <ContentCell row={row} member={member} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{member.purchases}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <MemberAction
                      member={member}
                      buttonRef={(element) => {
                        if (element === null) actionButtons.current.delete(member.memberKey);
                        else actionButtons.current.set(member.memberKey, element);
                      }}
                      onEdit={() => {
                        setEditing(member.memberKey);
                      }}
                    />
                  </TableCell>
                </TableRow>
                {editing === member.memberKey ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={5} className="p-2 whitespace-normal sm:p-3">
                      <ContentEditor
                        member={member}
                        onAnnounce={onAnnounce}
                        onSaved={() => {
                          announceSaved.current = true;
                        }}
                        onClose={() => {
                          focusAfterClose.current = member.memberKey;
                          setEditing(null);
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ) : null}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </div>
      {hidden > 0 ? (
        <div>
          <Button
            type="button"
            variant="ghost"
            className="max-sm:h-11"
            onClick={() => {
              setShowAll(true);
            }}
          >
            {showMore(hidden)}
          </Button>
        </div>
      ) : null}
    </section>
  );
}

/**
 * The action of one member: the pencil for an editable member, «Capturar contenido» for an editable
 * member that is not normalized and has no correction yet, nothing for a member bought by weight,
 * volume or in an unknown unit (D-14).
 */
function MemberAction({
  member,
  onEdit,
  buttonRef,
}: {
  member: MemberContent;
  onEdit: () => void;
  buttonRef: Ref<HTMLButtonElement>;
}) {
  if (!member.editable) return null;
  if (member.status === "not-normalized" && member.correction === null) {
    return (
      <Button
        ref={buttonRef}
        type="button"
        variant="outline"
        aria-label={captureContentAria(member.description, member.storeName)}
        className="max-sm:h-11"
        onClick={onEdit}
      >
        {copy.capture}
      </Button>
    );
  }
  return (
    <IconAction
      label={editContentAria(member.description, member.storeName)}
      onClick={onEdit}
      buttonRef={buttonRef}
    >
      <Pencil aria-hidden="true" />
    </IconAction>
  );
}
