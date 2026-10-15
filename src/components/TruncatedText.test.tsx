// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TruncatedText } from "./TruncatedText";
import "../../tests/support/domPolyfills";

const TOUCH_QUERY = "(hover: none), (pointer: coarse)";
const LONG_NAME = "Distribuidora-Mayorista-de-Abarrotes-".repeat(3).slice(0, 90);

/** Stubs window.matchMedia so only the touch query reports `touch`. */
function stubMatchMedia(touch: boolean): void {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string): MediaQueryList => {
      const matches = query === TOUCH_QUERY ? touch : false;
      return {
        matches,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      };
    },
  });
}

function removeMatchMedia(): void {
  Reflect.deleteProperty(window, "matchMedia");
}

afterEach(() => {
  cleanup();
  removeMatchMedia();
  vi.restoreAllMocks();
});

describe("TruncatedText: pointer devices (UI-SPEC decision 9)", () => {
  it("renders the text in a truncating button whose accessible name is the full text", () => {
    stubMatchMedia(false);
    render(<TruncatedText text={LONG_NAME} />);
    const button = screen.getByRole("button", { name: LONG_NAME });
    expect(button).toHaveAttribute("aria-label", LONG_NAME);
    expect(button.className).toContain("truncate");
    expect(button.className).toContain("min-w-0");
    expect(button.textContent).toBe(LONG_NAME);
  });

  it("shows the full text in a Tooltip on focus and never uses a Popover", async () => {
    stubMatchMedia(false);
    render(<TruncatedText text={LONG_NAME} />);
    const button = screen.getByRole("button", { name: LONG_NAME });
    fireEvent.focus(button);
    const tip = await screen.findByRole("tooltip");
    expect(tip).toHaveTextContent(LONG_NAME);
    expect(document.querySelector("[data-slot='popover-content']")).toBeNull();
    // A click on a pointer device opens no popover either.
    fireEvent.click(button);
    expect(document.querySelector("[data-slot='popover-content']")).toBeNull();
  });

  it("behaves as a pointer device when window.matchMedia does not exist and does not throw", () => {
    removeMatchMedia();
    expect(typeof window.matchMedia).not.toBe("function");
    expect(() => render(<TruncatedText text="Proveedor corto" />)).not.toThrow();
    expect(screen.getByRole("button", { name: "Proveedor corto" })).toBeInTheDocument();
  });

  it("keeps the full text only in the aria-label and the popup, never as overflowing markup", () => {
    stubMatchMedia(false);
    render(<TruncatedText text={LONG_NAME} className="max-w-[280px]" />);
    const button = screen.getByRole("button", { name: LONG_NAME });
    expect(button.className).toContain("truncate");
    expect(button.className).toContain("max-w-[280px]");
    expect(LONG_NAME).toHaveLength(90);
  });

  it("renders markup in the name as plain text (T-02-20)", () => {
    stubMatchMedia(false);
    const hostile = "<img src=x onerror=alert(1)> Proveedor";
    render(<TruncatedText text={hostile} />);
    const button = screen.getByRole("button", { name: hostile });
    expect(button.textContent).toBe(hostile);
    expect(button.querySelector("img")).toBeNull();
  });
});

describe("TruncatedText: touch devices (UI-SPEC decision 9)", () => {
  it("opens the full text in a Popover on tap and does not use the Tooltip", async () => {
    stubMatchMedia(true);
    render(<TruncatedText text={LONG_NAME} />);
    const button = screen.getByRole("button", { name: LONG_NAME });
    expect(document.querySelector("[data-slot='popover-content']")).toBeNull();
    fireEvent.click(button);
    const popup = await screen.findByText(LONG_NAME, { selector: "[data-slot='popover-content']" });
    expect(popup).toBeInTheDocument();
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("closes the Popover on Escape", async () => {
    stubMatchMedia(true);
    render(<TruncatedText text={LONG_NAME} />);
    fireEvent.click(screen.getByRole("button", { name: LONG_NAME }));
    await screen.findByText(LONG_NAME, { selector: "[data-slot='popover-content']" });
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    await vi.waitFor(() => {
      expect(document.querySelector("[data-slot='popover-content']")).toBeNull();
    });
  });

  it("closes the Popover on an outside click", async () => {
    stubMatchMedia(true);
    render(
      <div>
        <TruncatedText text={LONG_NAME} />
        <p>fuera</p>
      </div>,
    );
    fireEvent.click(screen.getByRole("button", { name: LONG_NAME }));
    await screen.findByText(LONG_NAME, { selector: "[data-slot='popover-content']" });
    const outside = screen.getByText("fuera");
    fireEvent.pointerDown(outside);
    fireEvent.mouseDown(outside);
    fireEvent.pointerUp(outside);
    fireEvent.mouseUp(outside);
    fireEvent.click(outside);
    await vi.waitFor(() => {
      expect(document.querySelector("[data-slot='popover-content']")).toBeNull();
    });
  });
});
