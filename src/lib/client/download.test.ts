// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { downloadBlob } from "./download";

beforeEach(() => {
  vi.useFakeTimers();
  URL.createObjectURL = vi.fn(() => "blob:fake-url");
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("downloadBlob", () => {
  it("clicks a temporary anchor with the download attribute and removes it", () => {
    const clicked: { href: string; download: string; connected: boolean }[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function click(
      this: HTMLAnchorElement,
    ) {
      clicked.push({ href: this.href, download: this.download, connected: this.isConnected });
    });
    const blob = new Blob(["{}"], { type: "application/json" });
    downloadBlob(blob, "invoicechecker-ajustes-2026-10-17.json");
    expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
    expect(clicked).toEqual([
      { href: "blob:fake-url", download: "invoicechecker-ajustes-2026-10-17.json", connected: true },
    ]);
    expect(document.querySelector("a[download]")).toBeNull();
  });

  it("revokes the object URL only after a delay", () => {
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    downloadBlob(new Blob(["x"]), "a.json");
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(999);
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith("blob:fake-url");
  });
});
