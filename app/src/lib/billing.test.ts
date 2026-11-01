import type { CloudBilling, CloudPlan, ServerMeta } from "@passbox/api-client";
import type { OrgMember } from "@passbox/client";
import { createTranslator } from "@passbox/i18n";
import deWeb from "@passbox/i18n/messages/de/web.json";
import enWeb from "@passbox/i18n/messages/en/web.json";
import { describe, expect, it, vi } from "vitest";
import {
  canActivate,
  cloudBilling,
  familyMemberCount,
  formatPrice,
  isActiveStatus,
  isBusinessOrg,
  lockKind,
  planFor,
  planIntervals,
  planPrice,
  pollBilling,
} from "./billing";
import { formatRoute, parseRoute } from "./route";

const plan = (interval: "month" | "year", amountCents: number): CloudPlan => ({
  code: interval === "month" ? "business-monthly" : "business-yearly",
  interval,
  amountCents,
  currency: "EUR",
  perUnit: true,
  unitLabel: "member",
});
const hosted: Pick<ServerMeta, "extensions"> = {
  extensions: { cloud: { billing: true, plans: [plan("year", 3000), plan("month", 300)] } },
};

describe("hosted billing", () => {
  it("exists only on the hosted service", () => {
    expect(cloudBilling(hosted)).toBeDefined();
    expect(cloudBilling({})).toBeUndefined();
    expect(cloudBilling({ extensions: {} })).toBeUndefined();
    expect(cloudBilling(undefined)).toBeUndefined();
    expect(isBusinessOrg({ kind: "team" }, cloudBilling(hosted))).toBe(true);
    expect(isBusinessOrg({ kind: "family" }, cloudBilling(hosted))).toBe(false);
    expect(isBusinessOrg({ kind: "team" }, undefined)).toBe(false);
  });

  it("takes plans and prices from the server", () => {
    const cloud = cloudBilling(hosted);
    expect(planIntervals(cloud)).toEqual(["month", "year"]);
    expect(planFor(cloud, "year")?.amountCents).toBe(3000);
    expect(planIntervals({ billing: true, plans: [plan("year", 3000)] })).toEqual(["year"]);
    expect(planIntervals(undefined)).toEqual([]);
  });

  it("formats prices per locale, with cents only when needed", () => {
    expect(formatPrice(300, "EUR", "en")).toBe("€3");
    expect(formatPrice(3000, "EUR", "de")).toMatch(/^30\s€$/);
    expect(formatPrice(299, "EUR", "en")).toBe("€2.99");
    const en = createTranslator("en", { en: enWeb }).t;
    const de = createTranslator("de", { en: enWeb, de: deWeb }).t;
    expect(planPrice(plan("month", 300), en, "en")).toBe("€3 per member per month");
    expect(planPrice(plan("year", 3000), de, "de")).toMatch(/^30\s€ pro Mitglied und Jahr$/);
  });

  it("explains known lock reasons and falls back for others", () => {
    expect(lockKind("billing:payment_overdue")).toBe("paymentOverdue");
    expect(lockKind("billing:no_plan")).toBe("noPlan");
    expect(lockKind("abuse:review")).toBe("other");
  });

  it("knows when Business works and when it can be activated", () => {
    expect(
      ["setup", "active", "past_due", "suspended", "canceled", "exempt"].map((s) => isActiveStatus(s as never)),
    ).toEqual([false, true, true, false, false, true]);
    expect(canActivate("setup")).toBe(true);
    expect(canActivate("canceled")).toBe(true);
    expect(canActivate("suspended")).toBe(false);
  });

  it("counts family members without guests and without people who have not accepted", () => {
    const m = (role: string, status: string) => ({ accountId: role + status, role, status }) as OrgMember;
    const members = [
      m("owner", "confirmed"),
      m("member", "confirmed"),
      m("member", "accepted"),
      m("guest", "confirmed"),
      m("member", "suspended"),
    ];
    expect(familyMemberCount({ members })).toBe(3);
  });
});

describe("pollBilling", () => {
  const status = (s: CloudBilling["status"]): CloudBilling => ({
    status: s,
    planCode: null,
    interval: null,
    seatsCounted: 1,
    seatsBilled: 0,
    pendingSeats: null,
    currentPeriodEnd: null,
    readOnly: false,
  });

  it("reads until the subscription is active", async () => {
    const read = vi
      .fn<() => Promise<CloudBilling>>()
      .mockResolvedValueOnce(status("setup"))
      .mockResolvedValueOnce(status("setup"))
      .mockResolvedValue(status("active"));
    const sleep = vi.fn(async () => undefined);
    const result = await pollBilling(read, (b) => isActiveStatus(b.status), { attempts: 6, sleep });
    expect(result.status).toBe("active");
    expect(read).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("gives up after the last attempt", async () => {
    const read = vi.fn(async () => status("setup"));
    const result = await pollBilling(read, (b) => isActiveStatus(b.status), {
      attempts: 3,
      sleep: async () => undefined,
    });
    expect(result.status).toBe("setup");
    expect(read).toHaveBeenCalledTimes(3);
  });
});

describe("checkout return route", () => {
  it("parses and formats the billing section with checkout and interval", () => {
    expect(parseRoute("#/org/o1/admin/billing?checkout=return")).toEqual({
      view: "org-admin",
      orgId: "o1",
      section: "billing",
      checkout: "return",
    });
    expect(parseRoute("#/org/o1/admin/billing?checkout=nonsense&interval=week")).toEqual({
      view: "org-admin",
      orgId: "o1",
      section: "billing",
    });
    expect(formatRoute({ view: "org-admin", orgId: "o1", section: "billing", interval: "year" })).toBe(
      "#/org/o1/admin/billing?interval=year",
    );
    expect(formatRoute({ view: "org-admin", orgId: "o1", section: "members" })).toBe("#/org/o1/admin/members");
  });
});
