/**
 * Business billing on the hosted service (passbox.net). Everything here
 * depends on `meta.extensions.cloud`: on a self-hosted server there are no
 * plans, no billing section and no prices, and every feature is free.
 */
import type {
  BillingInterval,
  CloudBilling,
  CloudBillingStatus,
  CloudExtension,
  CloudPlan,
  ServerMeta,
} from "@passbox/api-client";
import type { Org } from "@passbox/client";
import type { Locale, Translate } from "@passbox/i18n";

/** The hosted service's billing, or `undefined` on a self-hosted server. */
export function cloudBilling(meta: Pick<ServerMeta, "extensions"> | undefined): CloudExtension | undefined {
  const cloud = meta?.extensions?.cloud;
  return cloud?.billing ? cloud : undefined;
}

/** The plan for an interval, if the hosted service offers it. */
export function planFor(cloud: CloudExtension | undefined, interval: BillingInterval): CloudPlan | undefined {
  return cloud?.plans.find((plan) => plan.interval === interval);
}

/** The intervals the hosted service offers, monthly first. */
export function planIntervals(cloud: CloudExtension | undefined): BillingInterval[] {
  return (["month", "year"] as const).filter((interval) => planFor(cloud, interval));
}

/** Whether an organization is billed on this server: a team on the hosted service. */
export function isBusinessOrg(org: Pick<Org, "kind">, cloud: CloudExtension | undefined): boolean {
  return cloud !== undefined && org.kind === "team";
}

/** A price such as "€3" or "3 €"; cents only when there are any. */
export function formatPrice(amountCents: number, currency: string, locale: Locale): string {
  const whole = amountCents % 100 === 0;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amountCents / 100);
}

/** "€3 per member per month" for a plan. */
export function planPrice(plan: CloudPlan, t: Translate, locale: Locale): string {
  return t(`billing.price.${plan.interval}`, { price: formatPrice(plan.amountCents, plan.currency, locale) });
}

/** How the app explains a lock: by its reason, with a fallback for reasons it does not know. */
export type LockKind = "paymentOverdue" | "noPlan" | "other";

export function lockKind(reason: string): LockKind {
  if (reason === "billing:payment_overdue") return "paymentOverdue";
  if (reason === "billing:no_plan") return "noPlan";
  return "other";
}

/** Statuses in which Business works (members can join, nothing is read-only). */
export function isActiveStatus(status: CloudBillingStatus): boolean {
  return status === "active" || status === "exempt" || status === "past_due";
}

/** Statuses in which the owner or an admin can start a checkout. */
export function canActivate(status: CloudBillingStatus): boolean {
  return status === "setup" || status === "canceled";
}

/**
 * People who count towards a family's member limit: everyone who joined or
 * accepted an invitation, except guests. Pending invitations are not counted.
 */
export function familyMemberCount(org: Pick<Org, "members">): number {
  return org.members.filter((m) => m.role !== "guest" && (m.status === "confirmed" || m.status === "accepted")).length;
}

/**
 * Reads the billing status until `done` says so or the attempts are used up.
 * Used after returning from the checkout, while the billing service is still
 * telling the server about the payment. Resolves with the last status read.
 */
export async function pollBilling(
  read: () => Promise<CloudBilling>,
  done: (billing: CloudBilling) => boolean,
  options: { attempts?: number; delayMs?: number; sleep?: (ms: number) => Promise<void> } = {},
): Promise<CloudBilling> {
  const attempts = Math.max(1, options.attempts ?? 6);
  const delayMs = options.delayMs ?? 2000;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  let billing = await read();
  for (let attempt = 1; attempt < attempts && !done(billing); attempt++) {
    await sleep(delayMs);
    billing = await read();
  }
  return billing;
}
