/**
 * jsdom lacks two browser APIs that cmdk calls while it lays out a list:
 * ResizeObserver and Element.scrollIntoView. Import this module (for its side
 * effect) from a jsdom test that renders the shadcn Command component.
 */
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
}

if (typeof Element !== "undefined" && typeof Element.prototype.scrollIntoView !== "function") {
  Element.prototype.scrollIntoView = function scrollIntoView(): void {};
}
