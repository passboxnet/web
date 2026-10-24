import { Logo } from "@passbox/ui";
import type { ReactNode } from "react";
import { ServerStatus } from "./ServerStatus";

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-full items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo className="text-text" />
        </div>
        <div className="rounded-card border border-border bg-surface p-6 shadow-sm">{children}</div>
        <ServerStatus />
      </div>
    </main>
  );
}

export function FormError({ message }: { message: string | undefined }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
      {message}
    </p>
  );
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === "ApiError" || error.name === "InvalidCredentialsError" || error.name === "ConflictError") {
      return error.message;
    }
    if (error instanceof TypeError) return "The server could not be reached. Check your connection.";
    return error.message;
  }
  return String(error);
}
