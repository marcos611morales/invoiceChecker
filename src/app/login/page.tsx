import type { Metadata } from "next";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  // The root title template appends " · InvoiceChecker".
  title: "Entrar",
};

export default function LoginPage() {
  return (
    <main className="relative flex min-h-dvh flex-1 items-center justify-center bg-secondary p-6">
      <div className="fixed top-4 right-4">
        <ThemeToggle />
      </div>
      <LoginForm />
    </main>
  );
}
