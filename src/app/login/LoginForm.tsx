"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { CircleAlert, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { es } from "@/lib/copy/es";
import { safeNextPath } from "@/lib/safeNext";

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
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (password.length === 0) {
      setMessage(es.login.emptyPassword);
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
        setMessage(es.login.wrongPassword);
      } else if (res.status === 500) {
        const body: unknown = await res.json().catch(() => null);
        setMessage(isServerNotConfigured(body) ? es.login.serverNotConfigured : es.login.networkError);
      } else {
        setMessage(es.login.networkError);
      }
    } catch {
      setMessage(es.login.networkError);
    }
    setPending(false);
  }

  return (
    <Card className="w-96 max-w-[calc(100%-2rem)] border border-border bg-background ring-0 [--card-spacing:--spacing(4)] sm:[--card-spacing:--spacing(6)]">
      <CardHeader>
        <h1 className="text-xl leading-[1.2] font-semibold">
          {es.global.appName}
        </h1>
        <p className="text-sm text-muted-foreground">{es.global.subtitle}</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <Field>
            <FieldLabel htmlFor="password" className="font-semibold">
              {es.login.fieldLabel}
            </FieldLabel>
            <InputGroup className="h-9 max-sm:h-11">
              <InputGroupInput
                id="password"
                name="password"
                type={visible ? "text" : "password"}
                autoFocus
                autoComplete="current-password"
                className="h-full"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={message !== null}
                aria-describedby={message !== null ? "password-error" : undefined}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  type="button"
                  size="icon-sm"
                  aria-label={
                    visible ? es.login.hidePassword : es.login.showPassword
                  }
                  aria-pressed={visible}
                  onClick={() => setVisible((v) => !v)}
                  className="max-sm:size-11"
                >
                  {visible ? (
                    <EyeOff className="size-5" aria-hidden="true" />
                  ) : (
                    <Eye className="size-5" aria-hidden="true" />
                  )}
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
            {message !== null ? (
              <FieldError
                id="password-error"
                className="flex items-start gap-1"
              >
                <CircleAlert
                  className="mt-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
                <span>{message}</span>
              </FieldError>
            ) : null}
          </Field>
          <Button type="submit" size="lg" disabled={pending} className="w-full font-semibold">
            {pending ? es.login.submitPending : es.login.submit}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
