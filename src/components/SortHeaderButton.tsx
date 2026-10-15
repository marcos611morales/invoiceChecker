import type { ReactNode } from "react";

/** RED stub: signatures only. */
export function SortIcon(_props: { sorted: false | "asc" | "desc" }) {
  return null;
}

export function ariaSort(_sorted: false | "asc" | "desc"): "ascending" | "descending" | "none" {
  return "none";
}

export function SortHeaderButton(props: {
  sorted: false | "asc" | "desc";
  onClick?: (event: unknown) => void;
  right?: boolean;
  children: ReactNode;
}) {
  return <div>{props.children}</div>;
}
