"use client";

/** RED skeleton: renders the test id only, no items and no behavior yet. */
export function IvaToggle({ variant }: { variant: "bar" | "subbar" }) {
  return <div data-testid={`iva-toggle-${variant}`} />;
}
