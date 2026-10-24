import type { Translate } from "@passbox/i18n";

/** Server error codes of SSO and SCIM with their own message. */
const KNOWN = new Set([
  "sso_required",
  "sso_expired",
  "sso_failed",
  "sso_not_configured",
  "sso_public_url_missing",
  "sso_idp_denied",
  "sso_token_rejected",
  "sso_invalid_token",
  "sso_unreachable",
  "sso_insecure_url",
  "sso_http_error",
  "sso_invalid_response",
  "sso_issuer_mismatch",
  "sso_unsupported_provider",
  "sso_no_email",
  "sso_email_unverified",
  "sso_domain_not_allowed",
  "sso_domain_taken",
  "sso_not_member",
  "sso_suspended",
  "sso_no_account",
  "sso_proof_invalid",
  "sso_team_only",
  "sso_device_unlock_not_allowed",
  "sso_device_not_trusted",
  "sso_request_expired",
  "account_disabled",
]);

/** What an SSO error code means for the user and what to do. */
export function ssoErrorMessage(code: string, t: Translate): string {
  return KNOWN.has(code) ? t(`sso.error.${code}`) : t("sso.error.sso_failed");
}
