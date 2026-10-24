import { ApiError } from "@passbox/api-client";
import type { Translate } from "@passbox/i18n";

/**
 * Where an error happened. The same server answer means different things:
 * "invalid credentials" on the unlock screen can only be the master password,
 * while on sign-in it can be any of email, password or Secret Key.
 */
export type ErrorContext = "unlock" | "signIn" | "signUp" | "general";

/** Thrown by the app for a Secret Key that fails the local format check. */
export class SecretKeyFormatError extends Error {
  constructor() {
    super("invalid Secret Key format");
    this.name = "SecretKeyFormatError";
  }
}

/** Turns any error into a message that says what happened and what to do. */
export function describeError(error: unknown, t: Translate, context: ErrorContext = "general"): string {
  // fetch() rejects with a TypeError when the server cannot be reached.
  if (error instanceof TypeError) return t("error.network");
  if (error instanceof Error && error.name === "SecretKeyFormatError") return t("error.invalidSecretKey");
  if (error instanceof Error && error.name === "InvalidCredentialsError") {
    return context === "unlock" ? t("error.wrongMasterPassword") : t("error.invalidCredentials");
  }
  if (error instanceof Error && error.name === "ConflictError") return t("error.conflict");
  if (error instanceof ApiError) {
    switch (error.code) {
      case "invalid_credentials":
        return context === "unlock" ? t("error.wrongMasterPassword") : t("error.invalidCredentials");
      case "rate_limited": {
        const seconds = Number(error.body?.details?.retryAfterSeconds);
        const minutes = Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds / 60) : 15;
        return t("error.rateLimited", { minutes });
      }
      case "conflict":
        return context === "signUp" ? t("errors.accountExists") : t("error.conflict");
      case "unauthorized":
        return t("errors.sessionExpired");
      case "reauthentication_required":
        return t("errors.reauthenticate");
      case "not_found":
        return t("errors.notFound");
      case "bad_request":
        return t("errors.badRequest");
      case "internal":
        return t("errors.server");
      default:
        return error.status >= 500 ? t("errors.server") : t("errors.unexpected", { status: error.status });
    }
  }
  return t("errors.unknown");
}
