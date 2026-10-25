// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { useLlmRunStore, type RunStatus } from "@/stores/llmRunStore";
import "../../../tests/support/domPolyfills";
import { RunResult } from "./RunResult";

const LEFT_ONE = "1 sugerencia no cupo en la cola; revisa la cola y vuelve a intentarlo.";
const LEFT_MANY = "4 sugerencias no cupieron en la cola; revisa la cola y vuelve a intentarlo.";

function show(status: RunStatus): void {
  act(() => {
    useLlmRunStore.setState({ status, controller: null });
  });
  render(<RunResult onRetry={vi.fn()} />);
}

afterEach(() => {
  cleanup();
  act(() => {
    useLlmRunStore.setState({ status: { phase: "idle" }, controller: null });
  });
});

describe("RunResult: suggestions that did not fit in the queue (IN-03)", () => {
  it("shows nothing for a clean end that left nothing out", () => {
    show({ phase: "finished", kind: "group", total: 1, received: 3, leftOut: 0 });
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows the plural line for a finished run that left some out", () => {
    show({ phase: "finished", kind: "group", total: 1, received: 3, leftOut: 4 });
    expect(within(screen.getByRole("status")).getByText(LEFT_MANY)).toBeInTheDocument();
  });

  it("shows the singular line for exactly one", () => {
    show({ phase: "finished", kind: "group", total: 1, received: 3, leftOut: 1 });
    expect(screen.getByText(LEFT_ONE)).toBeInTheDocument();
  });

  it("adds the line under a canceled, a partial and a stopped result, and only when it is above zero", () => {
    show({ phase: "canceled", kind: "group", received: 2, leftOut: 4 });
    expect(screen.getByText(LEFT_MANY)).toBeInTheDocument();
    cleanup();
    show({
      phase: "partial",
      kind: "group",
      total: 2,
      received: 2,
      leftOut: 4,
      failed: 1,
      lastError: "upstream_timeout",
    });
    expect(screen.getByText("1 lote falló")).toBeInTheDocument();
    expect(screen.getByText(LEFT_MANY)).toBeInTheDocument();
    cleanup();
    show({
      phase: "stopped",
      kind: "group",
      batch: 1,
      total: 2,
      received: 2,
      leftOut: 4,
      error: "upstream_auth",
    });
    expect(screen.getByText(LEFT_MANY)).toBeInTheDocument();
    cleanup();
    show({ phase: "canceled", kind: "group", received: 2, leftOut: 0 });
    expect(screen.queryByText(/no cupieron|no cupo/)).toBeNull();
  });
});
