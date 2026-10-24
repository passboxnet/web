import { ApiError } from "@passbox/api-client";
import type { Translate } from "@passbox/i18n";
import { ssoErrorMessage } from "../sso/messages";

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
  if (error instanceof Error && error.name === "InvalidTwoFactorCodeError") return t("error.invalidTwoFactorCode");
  if (error instanceof Error && error.name === "TwoFactorExpiredError") return t("error.twoFactorExpired");
  if (error instanceof Error && error.name === "ReauthenticationRequiredError") return t("errors.reauthenticate");
  if (error instanceof Error && error.name === "InvalidRecoveryCodeError") return t("recovery.code.invalid");
  if (error instanceof Error && error.name === "RecoveryExpiredError") return t("recovery.expired");
  if (error instanceof Error && error.name === "RecoveryVerificationError") return t("recovery.verificationFailed");
  if (error instanceof Error && error.name === "InvalidDeviceCodeError") return t("linkDevice.invalid");
  if (error instanceof Error && error.name === "PolicyViolationError") {
    const rule = (error as Error & { rule?: string }).rule;
    return rule === "personal_vault" ? t("orgAdmin.error.personalVault") : t("orgAdmin.error.policy");
  }
  if (error instanceof ApiError) {
    if (error.code?.startsWith("sso_")) return ssoErrorMessage(error.code, t);
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
      case "invalid_two_factor_code":
        return t("error.invalidTwoFactorCode");
      case "two_factor_expired":
        return t("error.twoFactorExpired");
      case "account_disabled":
        return t("errors.accountDisabled");
      case "registration_closed":
        return t("errors.registrationClosed");
      case "domain_not_allowed":
        return t("errors.domainNotAllowed");
      case "invitation_invalid":
        return t("errors.invitationInvalid");
      case "recovery_expired":
        return t("recovery.expired");
      case "recovery_needs_security_key":
        return t("recovery.code.needsSecurityKey");
      case "two_factor_required":
        return t("recovery.twoFactor.description");
      case "emergency_access_waiting":
        return t("errors.emergencyWaiting");
      case "device_link_expired":
        return t("linkDevice.invalid");
      case "policy_violation":
        return /personal vault/i.test(error.body?.message ?? "")
          ? t("orgAdmin.error.personalVault")
          : /two-factor/i.test(error.body?.message ?? "")
            ? t("orgAdmin.error.twoFactorRequired")
            : t("orgAdmin.error.policy");
      case "forbidden":
        return t("errors.forbidden");
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
