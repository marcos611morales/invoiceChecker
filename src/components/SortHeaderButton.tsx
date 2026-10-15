import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

type SortState = false | "asc" | "desc";

/** Sort indicator of a column header: muted up-down when unsorted, primary arrow when sorted. */
export function SortIcon({ sorted }: { sorted: SortState }) {
  if (sorted === "asc") {
    return <ArrowUp className="size-4 text-primary" aria-hidden="true" />;
  }
  if (sorted === "desc") {
    return <ArrowDown className="size-4 text-primary" aria-hidden="true" />;
  }
  return (
    <ArrowUpDown className="size-4 text-muted-foreground" aria-hidden="true" />
  );
}

/** `aria-sort` value of a column header for the TanStack sorted state. */
export function ariaSort(sorted: SortState): "ascending" | "descending" | "none" {
  if (sorted === "asc") return "ascending";
  if (sorted === "desc") return "descending";
  return "none";
}

/**
 * Sortable column header button shared by the invoice and supplier tables. The
 * icon follows the label, or precedes it when `right` is set (numeric columns).
 */
export function SortHeaderButton({
  sorted,
  onClick,
  right = false,
  children,
}: {
  sorted: SortState;
  onClick?: (event: unknown) => void;
  right?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        right && "flex-row-reverse",
      )}
    >
      {children}
      <SortIcon sorted={sorted} />
    </button>
  );
}
