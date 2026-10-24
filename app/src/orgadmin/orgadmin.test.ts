import type { AuditRecord } from "@passbox/api-client";
import { AUDIT_CATEGORIES, DEFAULT_POLICY_RULES } from "@passbox/client";
import deOrgAdmin from "@passbox/i18n/messages/de/orgadmin.json";
import enOrgAdmin from "@passbox/i18n/messages/en/orgadmin.json";
import { describe, expect, it } from "vitest";
import { translatorFor } from "../lib/i18n";
import { describeAuditEntry } from "./auditText";
import { activeRules, describeRules } from "./policyText";

const en: Record<string, string> = enOrgAdmin;
const de: Record<string, string> = deOrgAdmin;

describe("admin console messages", () => {
  it("name every audit action, category and policy task", () => {
    const keys = [
      ...Object.values(AUDIT_CATEGORIES)
        .flat()
        .map((action) => `orgAdmin.audit.action.${action}`),
      ...Object.keys(AUDIT_CATEGORIES).map((category) => `orgAdmin.audit.category.${category}`),
      ...["two_factor", "password_strength", "recovery_enrollment", "update_app"].flatMap((kind) => [
        `orgAdmin.banner.${kind}.title`,
        `orgAdmin.banner.${kind}.body`,
      ]),
      ...["owner", "admin", "member", "guest", "view", "edit", "manage"].map((role) => `orgAdmin.role.${role}`),
    ];
    expect(keys.filter((key) => !(key in en) || !(key in de))).toEqual([]);
  });
});

function entry(changes: Partial<AuditRecord>): AuditRecord {
  return {
    orgId: "o",
    seq: 1,
    id: "e",
    createdAt: 0,
    actorId: "a",
    actorEmail: "a@example.com",
    deviceName: "",
    clientKind: "web",
    ip: "",
    action: "member_invited",
    targetType: "",
    targetId: "",
    details: "{}",
    clientEvent: "",
    clientSignature: "",
    prevHash: "",
    hash: "",
    ...changes,
  };
}

const names = {
  member: (id: string) => (id === "b" ? "bob@example.com" : "someone"),
  group: () => "Sales",
  vault: (id: string) => (id === "v" ? "Ops" : "Vault"),
};

describe("audit entries", () => {
  it("are described in plain language", () => {
    const { t } = translatorFor("en");
    expect(
      describeAuditEntry(entry({ details: JSON.stringify({ email: "c@example.com", role: "admin" }) }), names, t),
    ).toBe("Invited c@example.com as Admin");
    expect(
      describeAuditEntry(
        entry({
          action: "item_copied",
          targetType: "item",
          details: JSON.stringify({ vaultId: "v", field: "password" }),
        }),
        names,
        t,
      ),
    ).toBe("Copied the password of an item in Ops");
    expect(
      describeAuditEntry(
        entry({
          action: "member_role_changed",
          targetType: "account",
          targetId: "b",
          details: JSON.stringify({ from: "member", to: "admin" }),
        }),
        names,
        t,
      ),
    ).toBe("Changed the role of bob@example.com from Member to Admin");
    // Actions this app does not know yet stay readable.
    expect(describeAuditEntry(entry({ action: "brand_new_thing" }), names, t)).toBe("Brand new thing");
    const german = translatorFor("de").t;
    expect(describeAuditEntry(entry({ action: "member_signed_in" }), names, german)).toBe("Angemeldet");
  });
});

describe("policy text", () => {
  it("has one line per rule and lists only restricting rules for members", () => {
    const { t } = translatorFor("en");
    const strict = {
      ...DEFAULT_POLICY_RULES,
      requireTwoFactor: true,
      maxAutoLockMinutes: 15,
      shareLinks: "restricted" as const,
      shareLinkMaxDays: 7,
      shareLinkMaxViews: 3,
    };
    expect(describeRules(DEFAULT_POLICY_RULES, t)).toHaveLength(describeRules(strict, t).length);
    expect(activeRules(DEFAULT_POLICY_RULES, t)).toEqual([]);
    expect(activeRules(strict, t)).toEqual([
      "Two-factor sign-in is required.",
      "Apps lock after at most 15 minutes without activity.",
      "Share links last at most 7 days and open at most 3 times.",
    ]);
  });
});
