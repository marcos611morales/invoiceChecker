// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { es } from "@/lib/copy/es";
import { hardNavigate } from "@/lib/client/navigation";
import { logout } from "@/lib/client/logout";
import { LoginForm } from "./LoginForm";

// jsdom's window.location cannot be spied on, so navigation goes through a mockable seam.
vi.mock("@/lib/client/navigation", () => ({ hardNavigate: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  window.history.replaceState(null, "", "/");
});

function getPasswordInput(): HTMLInputElement {
  const input = screen.getByLabelText(es.login.fieldLabel);
  if (!(input instanceof HTMLInputElement)) {
    throw new Error("The password field is not an input element");
  }
  return input;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function typeAndSubmit(value: string): HTMLInputElement {
  const input = getPasswordInput();
  fireEvent.change(input, { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: es.login.submit }));
  return input;
}

describe("LoginForm card content", () => {
  it("shows the app name, subtitle, password field and submit button without a logo", () => {
    render(<LoginForm />);
    expect(
      screen.getByRole("heading", { name: "InvoiceChecker" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Análisis de gastos del Coworking Café"),
    ).toBeInTheDocument();
    expect(getPasswordInput()).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Entrar" })).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();
    expect(document.querySelector("img")).toBeNull();
  });
});

describe("LoginForm show/hide password", () => {
  it("toggles the input type, aria-pressed and aria-label, keeps focus and never submits", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<LoginForm />);
    const input = getPasswordInput();
    fireEvent.change(input, { target: { value: "secreto" } });

    const toggle = screen.getByRole("button", { name: "Mostrar contraseña" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(toggle).toHaveAttribute("type", "button");
    expect(input).toHaveAttribute("type", "password");

    toggle.focus();
    fireEvent.click(toggle);
    expect(input).toHaveAttribute("type", "text");
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(toggle).toHaveAttribute("aria-label", "Ocultar contraseña");
    expect(document.activeElement).toBe(toggle);

    fireEvent.click(toggle);
    expect(input).toHaveAttribute("type", "password");
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(toggle).toHaveAttribute("aria-label", "Mostrar contraseña");
    expect(document.activeElement).toBe(toggle);

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("LoginForm empty submit", () => {
  it("shows the empty-password message without calling the server", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<LoginForm />);

    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Escribe la contraseña.");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("LoginForm pending state (D-03)", () => {
  it("disables the button, shows the spinner and 'Entrando…', and sends one request only", async () => {
    let resolveFetch: (res: Response) => void = () => {};
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(<LoginForm />);

    typeAndSubmit("secreto");

    const button = await screen.findByRole("button", { name: "Entrando…" });
    expect(button).toBeDisabled();
    expect(button.querySelector('[data-slot="spinner"]')).not.toBeNull();

    // A second submit while pending must not send a second request.
    const form = container.querySelector("form");
    if (!form) throw new Error("The login form is missing");
    fireEvent.submit(form);
    fireEvent.click(button);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFetch(jsonResponse(401, { error: "invalid_credentials" }));
    });
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: es.login.submit }),
      ).toBeEnabled(),
    );
  });
});

describe("LoginForm error states (D-03)", () => {
  it("wrong password: alert copy, aria-invalid, aria-describedby, refocus with content selected, cleared on typing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(401, {})),
    );
    render(<LoginForm />);

    const input = typeAndSubmit("incorrecta");

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "Contraseña incorrecta. Revísala e inténtalo de nuevo.",
    );
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.getAttribute("aria-describedby")).toBe(alert.id);
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe("incorrecta".length);

    fireEvent.change(input, { target: { value: "incorrect" } });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(input).toHaveAttribute("aria-invalid", "false");
    expect(input).not.toHaveAttribute("aria-describedby");
  });

  it("server not configured: shows its own copy", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(500, { error: "server_not_configured" })),
    );
    render(<LoginForm />);

    const input = typeAndSubmit("secreto");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "El servidor no está configurado. Avisa a quien administra la app.",
    );
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(document.activeElement).toBe(input);
  });

  it("network failure: shows its own copy", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    render(<LoginForm />);

    const input = typeAndSubmit("secreto");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se pudo iniciar sesión. Revisa tu conexión e inténtalo de nuevo.",
    );
    expect(document.activeElement).toBe(input);
  });
});

describe("LoginForm redirect after login (D-05, T-01-22)", () => {
  it("lands on / when ?next= is protocol-relative", async () => {
    window.history.replaceState(null, "", "/login?next=%2F%2Fevil.com");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(200, { ok: true })),
    );
    render(<LoginForm />);

    typeAndSubmit("secreto");

    await waitFor(() => expect(hardNavigate).toHaveBeenCalledWith("/"));
    expect(hardNavigate).toHaveBeenCalledTimes(1);
  });

  it("lands on the internal ?next= path including its query", async () => {
    window.history.replaceState(null, "", "/login?next=%2Ffoo%3Fx%3D1");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(200, { ok: true })),
    );
    render(<LoginForm />);

    typeAndSubmit("secreto");

    await waitFor(() => expect(hardNavigate).toHaveBeenCalledWith("/foo?x=1"));
  });

  it("lands on / when there is no ?next=", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(200, { ok: true })),
    );
    render(<LoginForm />);

    typeAndSubmit("secreto");

    await waitFor(() => expect(hardNavigate).toHaveBeenCalledWith("/"));
  });
});

describe("logout through the navigation seam", () => {
  it("posts to /api/auth/logout and then navigates to /login", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await logout();

    expect(fetchMock).toHaveBeenCalledWith("/api/auth/logout", {
      method: "POST",
    });
    expect(hardNavigate).toHaveBeenCalledWith("/login");
  });

  it("navigates to /login even when the request rejects", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );

    await logout();

    expect(hardNavigate).toHaveBeenCalledWith("/login");
  });
});
