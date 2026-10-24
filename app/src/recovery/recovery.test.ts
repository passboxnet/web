import { ApiError } from "@passbox/api-client";
import { InvalidDeviceCodeError, InvalidRecoveryCodeError, RecoveryExpiredError } from "@passbox/client";
import { createTranslator } from "@passbox/i18n";
import deCommon from "@passbox/i18n/messages/de/common.json";
import deWeb from "@passbox/i18n/messages/de/web.json";
import enCommon from "@passbox/i18n/messages/en/common.json";
import enWeb from "@passbox/i18n/messages/en/web.json";
import { describe, expect, it } from "vitest";
import { describeError } from "../lib/errors";
import { formatRoute, parseRoute } from "../lib/route";
import { DEFAULT_WAIT_DAYS, daysUntil, WAIT_CHOICES } from "../views/settings/EmergencyPanel";

const DAY = 24 * 60 * 60 * 1000;

describe("recovery and emergency access screens", () => {
  it("route to recovery requests and released emergency access", () => {
    expect(parseRoute("#/recovery-requests")).toEqual({ view: "recovery-requests" });
    expect(parseRoute("#/emergency/abc123")).toEqual({ view: "emergency", grantId: "abc123" });
    expect(formatRoute({ view: "emergency", grantId: "abc123" })).toBe("#/emergency/abc123");
    expect(formatRoute({ view: "recovery-requests" })).toBe("#/recovery-requests");
    expect(parseRoute("#/settings/emergency")).toEqual({ view: "settings", section: "emergency" });
  });

  it("count waiting days up", () => {
    const now = 1_000_000;
    expect(daysUntil(now + 7 * DAY, now)).toBe(7);
    expect(daysUntil(now + 6 * DAY + 1, now)).toBe(7);
    expect(daysUntil(now + 1, now)).toBe(1);
    expect(daysUntil(now - DAY, now)).toBe(0);
    expect(WAIT_CHOICES).toContain(DEFAULT_WAIT_DAYS);
    expect(Math.min(...WAIT_CHOICES)).toBe(1);
    expect(Math.max(...WAIT_CHOICES)).toBe(30);
  });

  it("explain recovery errors in both languages", () => {
    for (const [locale, catalog] of [
      ["en", { ...enCommon, ...enWeb }],
      ["de", { ...deCommon, ...deWeb }],
    ] as const) {
      const { t } = createTranslator(locale, { [locale]: catalog });
      for (const error of [
        new InvalidRecoveryCodeError(),
        new RecoveryExpiredError(),
        new InvalidDeviceCodeError(),
        new ApiError(403, "/x", { error: "recovery_expired", message: "" }),
        new ApiError(403, "/x", { error: "emergency_access_waiting", message: "" }),
        new ApiError(403, "/x", { error: "device_link_expired", message: "" }),
        new ApiError(403, "/x", { error: "recovery_needs_security_key", message: "" }),
      ]) {
        const message = describeError(error, t);
        expect(message).not.toMatch(/^(recovery|errors|linkDevice)\./);
        expect(message.length).toBeGreaterThan(10);
      }
    }
  });

  it("use formal German", () => {
    const keys = Object.entries(deWeb).filter(([key]) =>
      /^(recovery|recoveryCode|emergency|addDevice|linkDevice|forgot)\./.test(key),
    );
    expect(keys.length).toBeGreaterThan(100);
    for (const [key, value] of keys) {
      expect(value, key).not.toMatch(/\b(du|dein|deine|dich|dir)\b/i);
    }
  });
});
