// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { ParsedInvoice } from "@/domain/cfdi/types";
import { logout } from "@/lib/client/logout";
import { useSessionStore } from "@/stores/sessionStore";
import "../../../tests/support/domPolyfills";
import { AppShell } from "./AppShell";
import { LogoutButton } from "./LogoutButton";
import { useBeforeUnload } from "./useBeforeUnload";

vi.mock("@/lib/client/logout", () => ({
  logout: vi.fn(),
}));

const logoutMock = vi.mocked(logout);

function makeInvoice(uuid: string): ParsedInvoice {
  return {
    uuid,
    version: "4.0",
    fecha: "2025-01-15T10:00:00",
    tipo: "I",
    serie: null,
    folio: null,
    moneda: "MXN",
    tipoCambio: null,
    formaPago: null,
    metodoPago: null,
    subTotal: "100.00",
    descuento: null,
    total: "116.00",
    totalImpuestosTrasladados: null,
    totalImpuestosRetenidos: null,
    impuestos: { traslados: [], retenciones: [] },
    emisor: { rfc: "EMI010101AAA", nombre: null },
    receptor: { rfc: "CAF010101AAA", nombre: null },
    conceptos: [],
    relacionados: [],
    pagos: [],
  };
}

function seedInvoice(): void {
  act(() => {
    const store = useSessionStore.getState();
    store.applyBatch(
      [
        {
          kind: "parsed",
          file: { name: "a.xml", path: "a.xml" },
          result: { ok: true, invoice: makeInvoice("UUID-1") },
        },
      ],
      store.generation,
    );
  });
}

function fireBeforeUnload(): Event {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event;
}

beforeEach(() => {
  logoutMock.mockReset();
  logoutMock.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  act(() => {
    useSessionStore.getState().clearAll();
  });
});

describe("LogoutButton", () => {
  it("with invoices opens the confirmation with focus on Seguir en la sesión", async () => {
    seedInvoice();
    render(<LogoutButton />);
    fireEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("¿Cerrar sesión?")).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        "Se borrarán las facturas cargadas. Tendrás que volver a soltar los archivos.",
      ),
    ).toBeInTheDocument();
    const dismiss = within(dialog).getByRole("button", {
      name: "Seguir en la sesión",
    });
    await waitFor(() => expect(dismiss).toHaveFocus());
    const buttons = within(dialog).getAllByRole("button");
    expect(buttons.map((button) => button.textContent)).toEqual([
      "Seguir en la sesión",
      "Cerrar sesión",
    ]);
    expect(logoutMock).not.toHaveBeenCalled();
  });

  it("dismissing keeps the invoices and does not call logout", async () => {
    seedInvoice();
    render(<LogoutButton />);
    fireEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Seguir en la sesión" }),
    );
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(useSessionStore.getState().invoices).toHaveLength(1);
    expect(logoutMock).not.toHaveBeenCalled();
  });

  it("confirming clears the store before calling logout", async () => {
    seedInvoice();
    const generationBefore = useSessionStore.getState().generation;
    let invoicesAtLogout = -1;
    logoutMock.mockImplementation(() => {
      invoicesAtLogout = useSessionStore.getState().invoices.length;
      return Promise.resolve();
    });
    render(<LogoutButton />);
    fireEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Cerrar sesión" }),
    );
    await waitFor(() => expect(logoutMock).toHaveBeenCalledTimes(1));
    expect(invoicesAtLogout).toBe(0);
    expect(useSessionStore.getState().generation).toBeGreaterThan(
      generationBefore,
    );
  });

  it("with no invoices clears the store and logs out immediately without a dialog", async () => {
    const generationBefore = useSessionStore.getState().generation;
    render(<LogoutButton />);
    fireEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));
    await waitFor(() => expect(logoutMock).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(useSessionStore.getState().generation).toBeGreaterThan(
      generationBefore,
    );
  });
});

describe("useBeforeUnload", () => {
  it("prevents unload while active", () => {
    renderHook(() => useBeforeUnload(true));
    expect(fireBeforeUnload().defaultPrevented).toBe(true);
  });

  it("leaves unload untouched while inactive", () => {
    renderHook(() => useBeforeUnload(false));
    expect(fireBeforeUnload().defaultPrevented).toBe(false);
  });

  it("removes the listener when switching from active to inactive", () => {
    const { rerender } = renderHook(
      ({ active }: { active: boolean }) => useBeforeUnload(active),
      { initialProps: { active: true } },
    );
    expect(fireBeforeUnload().defaultPrevented).toBe(true);
    rerender({ active: false });
    expect(fireBeforeUnload().defaultPrevented).toBe(false);
  });

  it("removes the listener on unmount", () => {
    const { unmount } = renderHook(() => useBeforeUnload(true));
    unmount();
    expect(fireBeforeUnload().defaultPrevented).toBe(false);
  });
});

describe("AppShell unload guard", () => {
  it("registers the guard only once invoices are loaded", () => {
    render(<AppShell />);
    expect(fireBeforeUnload().defaultPrevented).toBe(false);
    seedInvoice();
    expect(fireBeforeUnload().defaultPrevented).toBe(true);
    act(() => {
      useSessionStore.getState().clearAll();
    });
    expect(fireBeforeUnload().defaultPrevented).toBe(false);
  });
});
