import { ApiError } from "@passbox/api-client";
import { InvalidCredentialsError } from "@passbox/client";
import { createTranslator } from "@passbox/i18n";
import deCommon from "@passbox/i18n/messages/de/common.json";
import deWeb from "@passbox/i18n/messages/de/web.json";
import enCommon from "@passbox/i18n/messages/en/common.json";
import enWeb from "@passbox/i18n/messages/en/web.json";
import { describe, expect, it } from "vitest";
import { describeError, SecretKeyFormatError } from "./errors";

const en = createTranslator("en", { en: { ...enCommon, ...enWeb } }).t;
const de = createTranslator("de", { en: { ...enCommon, ...enWeb }, de: { ...deCommon, ...deWeb } }).t;
const api = (status: number, error: string, details?: Record<string, unknown>) =>
  new ApiError(status, "/x", { error, message: "raw server text", ...(details ? { details } : {}) });

describe("error messages", () => {
  it("names only the master password on the unlock screen", () => {
    expect(describeError(new InvalidCredentialsError(), en, "unlock")).toMatch(/^Wrong master password/);
    expect(describeError(new InvalidCredentialsError(), de, "unlock")).toMatch(/^Master-Passwort falsch/);
    expect(describeError(new InvalidCredentialsError(), en, "signIn")).toMatch(/email, master password or Secret Key/);
  });

  it("says how long to wait when rate limited", () => {
    expect(describeError(api(429, "rate_limited", { retryAfterSeconds: 61 }), en)).toContain("2 minutes");
    expect(describeError(api(429, "rate_limited", { retryAfterSeconds: 30 }), de)).toContain("in 1 Minute");
  });

  it("maps every server error code and never shows raw server text", () => {
    for (const code of [
      "account_disabled",
      "registration_closed",
      "domain_not_allowed",
      "invitation_invalid",
      "forbidden",
      "invalid_credentials",
      "rate_limited",
      "conflict",
      "unauthorized",
      "reauthentication_required",
      "invalid_two_factor_code",
      "two_factor_expired",
      "not_found",
      "bad_request",
      "internal",
      "something_new",
      "org_read_only",
      "business_activation_required",
      "family_limit_reached",
    ]) {
      const message = describeError(api(400, code), en);
      expect(message, code).not.toContain("raw server text");
      expect(message, code).not.toMatch(/^[a-z_.]+$/);
    }
    expect(describeError(api(409, "conflict"), en, "signUp")).toContain("already exists");
    expect(describeError(api(401, "invalid_two_factor_code"), de)).toContain("30 Sekunden");
  });

  it("explains the hosted service's billing errors", () => {
    expect(describeError(api(403, "org_read_only"), en)).toContain("read-only");
    expect(describeError(api(403, "business_activation_required"), de)).toContain("Business");
    expect(describeError(api(403, "family_limit_reached", { limit: 6 }), en)).toContain("at most 6 members");
    expect(describeError(api(403, "family_limit_reached", { limit: 6 }), de)).toContain("höchstens 6 Mitglieder");
    expect(describeError(api(403, "family_limit_reached"), en)).not.toContain("{limit}");
  });

  it("explains network failures and Secret Key typos", () => {
    expect(describeError(new TypeError("Failed to fetch"), en)).toContain("could not be reached");
    expect(describeError(new SecretKeyFormatError(), de)).toContain("P1-");
    expect(describeError(new Error("boom"), en)).toContain("Something went wrong");
  });
});
