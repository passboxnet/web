// @vitest-environment jsdom
import { createTranslator } from "@passbox/i18n";
import deCommon from "@passbox/i18n/messages/de/common.json";
import deWeb from "@passbox/i18n/messages/de/web.json";
import { describe, expect, it } from "vitest";
import { emergencyKitPdf, isKitPending, matchesKitCheck, secretKeyPrefix, setKitPending } from "./kit";

const KEY = "P1-ABCDE-FGHJK-MNPQR-STVWX-YZ2345";

describe("Emergency Kit", () => {
  it("checks the last four characters, forgiving case, spaces and dashes", () => {
    expect(matchesKitCheck(KEY, "2345")).toBe(true);
    expect(matchesKitCheck(KEY, " 23-45 ")).toBe(true);
    expect(matchesKitCheck("P1-AAAAA-AAAAA-AAAAA-AAAAA-AAAbcd", "BCD")).toBe(false);
    expect(matchesKitCheck("P1-AAAAA-AAAAA-AAAAA-AAAAA-AAAbcd", "abcd")).toBe(true);
    expect(matchesKitCheck(KEY, "1234")).toBe(false);
    expect(matchesKitCheck(KEY, "")).toBe(false);
  });

  it("names the key by its first group only", () => {
    expect(secretKeyPrefix(KEY)).toBe("P1-ABCDE…");
  });

  it("remembers a pending kit per account", () => {
    setKitPending("account-1");
    expect(isKitPending("account-1")).toBe(true);
    expect(isKitPending("account-2")).toBe(false);
    setKitPending(undefined);
    expect(isKitPending("account-1")).toBe(false);
  });

  it("puts the whole email and the Secret Key into the PDF", () => {
    const i18n = createTranslator("de", { de: { ...deCommon, ...deWeb } });
    const email = "maximilian.mustermann-schmidt.1975@example-company.com";
    const pdf = Array.from(
      emergencyKitPdf({ email, server: "https://passbox.example.com", secretKey: KEY, createdAt: 0 }, i18n),
      (b) => String.fromCharCode(b),
    ).join("");
    const shown = [...pdf.matchAll(/\(((?:\\.|[^\\)])*)\) Tj/g)].map((m) => m[1]).join("");
    expect(shown).toContain(KEY);
    expect(shown.replace(/\s/g, "")).toContain(email);
    expect(pdf).toContain("Notfall-Kit");
  });
});
