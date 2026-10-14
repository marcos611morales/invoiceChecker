"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { safeNextPath } from "@/lib/safeNext";

const MSG_EMPTY = "Escribe la contraseña.";
const MSG_WRONG = "Contraseña incorrecta. Revísala e inténtalo de nuevo.";
const MSG_NOT_CONFIGURED =
  "El servidor no está configurado. Avisa a quien administra la app.";
const MSG_FAILURE =
  "No se pudo iniciar sesión. Revisa tu conexión e inténtalo de nuevo.";

function isServerNotConfigured(body: unknown): boolean {
  return (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    body.error === "server_not_configured"
  );
}

export function LoginForm() {
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (password.length === 0) {
      setMessage(MSG_EMPTY);
      return;
    }
    setPending(true);
    setMessage(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.status === 200) {
        // D-05: read ?next= at submit time (never via the search-params hook, Pitfall 6).
        const next = new URLSearchParams(window.location.search).get("next");
        window.location.assign(safeNextPath(next));
        return;
      }
      if (res.status === 401) {
        setMessage(MSG_WRONG);
      } else if (res.status === 500) {
        const body: unknown = await res.json().catch(() => null);
        setMessage(isServerNotConfigured(body) ? MSG_NOT_CONFIGURED : MSG_FAILURE);
      } else {
        setMessage(MSG_FAILURE);
      }
    } catch {
      setMessage(MSG_FAILURE);
    }
    setPending(false);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex w-full max-w-sm flex-col gap-4"
      noValidate
    >
      <h1 className="text-2xl font-semibold">InvoiceChecker</h1>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium">
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoFocus
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-foreground px-4 py-2 font-medium text-background disabled:opacity-60"
      >
        {pending ? "Entrando…" : "Entrar"}
      </button>
      <p role="alert" className="min-h-5 text-sm text-red-600">
        {message}
      </p>
    </form>
  );
}
