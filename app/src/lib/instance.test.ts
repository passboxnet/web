import type { Strength } from "@passbox/client";
import { createTranslator } from "@passbox/i18n";
import deCommon from "@passbox/i18n/messages/de/common.json";
import deWeb from "@passbox/i18n/messages/de/web.json";
import enCommon from "@passbox/i18n/messages/en/common.json";
import enWeb from "@passbox/i18n/messages/en/web.json";
import { describe, expect, it } from "vitest";
import { describeAdminEvent } from "../views/admin/EventsPanel";
import { inviteFromHash, meetsPasswordPolicy, parseDomains } from "./instance";
import { formatRoute, parseRoute } from "./route";

const strength = (score: Strength["score"], acceptable: boolean): Strength => ({
  score,
  label: "Strong",
  bits: 45,
  warning: null,
  suggestions: [],
  acceptableMasterPassword: acceptable,
});

describe("password policy", () => {
  it("never accepts less than the client's own minimum", () => {
    expect(meetsPasswordPolicy("short", strength(1, false))).toBe("weak");
    expect(meetsPasswordPolicy("correct horse battery", strength(3, true))).toBe("ok");
  });

  it("applies a stricter server policy", () => {
    const policy = { minScore: 4, minLength: 20 };
    expect(meetsPasswordPolicy("correct horse battery", strength(3, true), policy)).toBe("policy");
    expect(meetsPasswordPolicy("correct horse", strength(4, true), policy)).toBe("policy");
    expect(meetsPasswordPolicy("correct horse battery staple", strength(4, true), policy)).toBe("ok");
    // Length counts characters, not UTF-16 units.
    expect(meetsPasswordPolicy("😀".repeat(12), strength(3, true), { minScore: 3, minLength: 13 })).toBe("policy");
  });
});

describe("invitation links", () => {
  it("reads the token and email from the hash", () => {
    expect(inviteFromHash("#/?invite=abc_DEF-123&email=ada%2Bx%40example.com")).toEqual({
      token: "abc_DEF-123",
      email: "ada+x@example.com",
    });
    expect(inviteFromHash("#/?invite=abc")).toEqual({ token: "abc", email: "" });
    expect(inviteFromHash("#/items")).toBeUndefined();
    expect(inviteFromHash(`#/?invite=${"x".repeat(200)}`)).toBeUndefined();
  });

  it("does not change the vault routes", () => {
    expect(parseRoute("#/?invite=abc&email=a%40b.c")).toEqual({ view: "items", filter: { kind: "all" } });
    expect(parseRoute("#/admin")).toEqual({ view: "admin" });
    expect(formatRoute({ view: "admin" })).toBe("#/admin");
  });
});

describe("allowed domains", () => {
  it("splits, normalizes and deduplicates", () => {
    expect(parseDomains("Example.com\n@corp.example, example.com;  \n")).toEqual(["example.com", "corp.example"]);
    expect(parseDomains("  ")).toEqual([]);
  });
});

describe("admin events", () => {
  const en = createTranslator("en", { en: { ...enCommon, ...enWeb } }).t;
  const de = createTranslator("de", { en: { ...enCommon, ...enWeb }, de: { ...deCommon, ...deWeb } }).t;

  it("describes known events in both languages", () => {
    expect(describeAdminEvent({ action: "user_disabled", details: { email: "ada@example.com" } }, en)).toBe(
      "Disabled ada@example.com",
    );
    expect(describeAdminEvent({ action: "test_mail_sent", details: { to: "ops@example.com" } }, de)).toBe(
      "Testmail an ops@example.com gesendet",
    );
    expect(
      describeAdminEvent({ action: "settings_updated", details: { registration: "invite_only", supportUrl: "" } }, de),
    ).toBe("Einstellungen geändert: wer ein Konto erstellen darf, Hilfe-Adresse");
    expect(describeAdminEvent({ action: "something_new", details: null }, en)).toBe("something_new");
  });
});
