// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { es } from "@/lib/copy/es";
import { LoginForm } from "./LoginForm";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function getPasswordInput(): HTMLInputElement {
  const input = screen.getByLabelText(es.login.fieldLabel);
  if (!(input instanceof HTMLInputElement)) {
    throw new Error("The password field is not an input element");
  }
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
