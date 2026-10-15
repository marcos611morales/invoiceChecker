// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SortHeaderButton, SortIcon, ariaSort } from "./SortHeaderButton";

afterEach(cleanup);

describe("ariaSort", () => {
  it("maps asc, desc and false to ascending, descending and none", () => {
    expect(ariaSort("asc")).toBe("ascending");
    expect(ariaSort("desc")).toBe("descending");
    expect(ariaSort(false)).toBe("none");
  });
});

describe("SortIcon", () => {
  it("shows the muted up-down arrow when unsorted", () => {
    const { container } = render(<SortIcon sorted={false} />);
    const icon = container.querySelector("svg");
    expect(icon?.getAttribute("class")).toContain("text-muted-foreground");
    expect(icon?.getAttribute("class")).toContain("lucide-arrow-up-down");
    expect(icon).toHaveAttribute("aria-hidden", "true");
  });

  it("shows ArrowUp or ArrowDown in the primary color when sorted", () => {
    const up = render(<SortIcon sorted="asc" />).container.querySelector("svg");
    expect(up?.getAttribute("class")).toContain("lucide-arrow-up");
    expect(up?.getAttribute("class")).toContain("text-primary");
    cleanup();
    const down = render(<SortIcon sorted="desc" />).container.querySelector("svg");
    expect(down?.getAttribute("class")).toContain("lucide-arrow-down");
    expect(down?.getAttribute("class")).toContain("text-primary");
  });
});

describe("SortHeaderButton", () => {
  it("renders a button with the label and the focus ring classes of the Phase 1 header", () => {
    const onClick = vi.fn();
    render(
      <SortHeaderButton sorted={false} onClick={onClick}>
        Proveedor
      </SortHeaderButton>,
    );
    const button = screen.getByRole("button", { name: "Proveedor" });
    expect(button).toHaveAttribute("type", "button");
    expect(button.className).toContain("focus-visible:ring-2");
    expect(button.className).toContain("focus-visible:ring-ring");
    expect(button.className).toContain("focus-visible:ring-offset-2");
    expect(button.className).not.toContain("flex-row-reverse");
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("puts the icon before the label when right-aligned", () => {
    render(
      <SortHeaderButton sorted="desc" right>
        Gasto neto
      </SortHeaderButton>,
    );
    expect(screen.getByRole("button", { name: "Gasto neto" }).className).toContain("flex-row-reverse");
  });
});
