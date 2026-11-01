import type { BillingInterval, CloudBilling, CloudExtension } from "@passbox/api-client";
import type { Org } from "@passbox/client";
import { AlertCard, Badge, type BadgeTone, Button, SegmentedControl, toast } from "@passbox/ui";
import { CreditCard, ExternalLink, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { errorMessage } from "../core";
import {
  canActivate,
  cloudBilling,
  isActiveStatus,
  planFor,
  planIntervals,
  planPrice,
  pollBilling,
} from "../lib/billing";
import { useI18n } from "../lib/i18n";
import { useServerMeta } from "../lib/instance";
import type { Route } from "../lib/route";
import { useClient } from "../useClient";
import { Panel } from "../views/PageHeader";
import { Loading, Section, Stat } from "./common";

const STATUS_TONE: Record<CloudBilling["status"], BadgeTone> = {
  setup: "neutral",
  active: "success",
  past_due: "warning",
  suspended: "danger",
  canceled: "neutral",
  exempt: "success",
};

interface BillingSectionProps {
  org: Org;
  /** `return` or `cancel` when the browser comes back from the hosted checkout. */
  checkout: "return" | "cancel" | undefined;
  /** Interval chosen when the organization was created. */
  interval: BillingInterval | undefined;
  navigate: (route: Route) => void;
}

/**
 * Business billing of a team on the hosted service: status, members counted
 * and billed, period, "Activate Business" (checkout) and "Manage billing"
 * (portal). Both open the billing service with a top-level redirect; the
 * checkout returns to `#/org/{orgId}/admin/billing?checkout=return`.
 */
export function BillingSection(props: BillingSectionProps) {
  const { t } = useI18n();
  const meta = useServerMeta();
  const cloud = cloudBilling(meta);
  return (
    <Section title={t("orgAdmin.section.billing")} description={t("orgAdmin.billing.description")}>
      {cloud ? (
        <Billing {...props} cloud={cloud} />
      ) : meta === undefined ? (
        <Loading error={undefined} />
      ) : (
        <p className="text-[0.8125rem] text-text-muted">{t("orgAdmin.billing.unavailable")}</p>
      )}
    </Section>
  );
}

function Billing({ org, checkout, interval, navigate, cloud }: BillingSectionProps & { cloud: CloudExtension }) {
  const client = useClient();
  const i18n = useI18n();
  const { t } = i18n;
  const [billing, setBilling] = useState<CloudBilling>();
  const [error, setError] = useState<string>();
  const [confirming, setConfirming] = useState(checkout === "return");
  const [notConfirmed, setNotConfirmed] = useState(false);
  const [canceled, setCanceled] = useState(checkout === "cancel");
  const [busy, setBusy] = useState<"checkout" | "portal">();
  const intervals = planIntervals(cloud);
  const [chosen, setChosen] = useState<BillingInterval>(
    interval && intervals.includes(interval) ? interval : (intervals[0] ?? "month"),
  );

  const load = useCallback(() => {
    setError(undefined);
    client
      .cloudBilling(org.id)
      .then(setBilling)
      .catch((e: unknown) => setError(errorMessage(e)));
  }, [client, org.id]);

  // Back from the checkout: the billing service may tell the server about the
  // payment a moment later, so read the status a few times.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once when the section opens
  useEffect(() => {
    // Drop `?checkout=…` so a reload does not repeat this.
    if (checkout || interval) navigate({ view: "org-admin", orgId: org.id, section: "billing" });
    if (checkout !== "return") {
      load();
      return;
    }
    let cancelled = false;
    pollBilling(
      () => client.cloudBilling(org.id),
      (next) => isActiveStatus(next.status),
    )
      .then((next) => {
        if (cancelled) return;
        setBilling(next);
        if (isActiveStatus(next.status)) {
          toast.success(t("orgAdmin.billing.activated"));
          // The lock (if any) is gone now; fetch the organization's state.
          client.sync().catch(() => undefined);
        } else {
          setNotConfirmed(true);
        }
      })
      .catch((e: unknown) => !cancelled && setError(errorMessage(e)))
      .finally(() => !cancelled && setConfirming(false));
    return () => {
      cancelled = true;
    };
  }, []);

  async function redirect(kind: "checkout" | "portal") {
    setBusy(kind);
    try {
      const { url } =
        kind === "checkout" ? await client.cloudCheckout(org.id, chosen) : await client.cloudPortal(org.id);
      window.location.assign(url);
    } catch (e) {
      toast.error(errorMessage(e));
      setBusy(undefined);
    }
  }

  if (confirming) {
    return (
      <AlertCard tone="info" title={t("orgAdmin.billing.confirming")} description={<Loading error={undefined} />} />
    );
  }
  if (!billing) return <Loading error={error} onRetry={load} />;

  const plan = billing.interval ? planFor(cloud, billing.interval) : undefined;
  const chosenPlan = planFor(cloud, chosen);
  const activate = canActivate(billing.status);
  const date = (ms: number) => i18n.date(ms);

  return (
    <div className="flex flex-col gap-6">
      {canceled && (
        <AlertCard tone="info" title={t("orgAdmin.billing.checkoutCanceled")} onDismiss={() => setCanceled(false)} />
      )}
      {notConfirmed && !isActiveStatus(billing.status) && (
        <AlertCard
          tone="warning"
          title={t("orgAdmin.billing.notConfirmed")}
          action={
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setNotConfirmed(false);
                load();
              }}
            >
              {t("orgAdmin.billing.checkAgain")}
            </Button>
          }
        />
      )}
      {billing.status === "past_due" && <AlertCard tone="warning" title={t("orgAdmin.billing.pastDue")} />}
      {billing.status === "suspended" && <AlertCard tone="danger" title={t("orgAdmin.billing.suspended")} />}
      {billing.status === "exempt" && <AlertCard tone="success" title={t("orgAdmin.billing.exempt")} />}

      {activate && (
        <Panel
          title={t("orgAdmin.billing.activate.title")}
          description={
            billing.status === "canceled" ? t("orgAdmin.billing.activate.again") : t("orgAdmin.billing.activate.text")
          }
          icon={<Sparkles />}
        >
          <div className="flex flex-col gap-4 px-5 py-4" data-testid="billing-activate">
            {intervals.length > 1 && (
              <SegmentedControl<BillingInterval>
                label={t("sharing.create.interval")}
                value={chosen}
                onChange={setChosen}
                options={intervals.map((value) => ({ value, label: t(`sharing.create.interval.${value}`) }))}
              />
            )}
            {chosenPlan && <p className="text-[0.9375rem] font-semibold">{planPrice(chosenPlan, t, i18n.locale)}</p>}
            <p className="text-xs text-text-muted">
              {t("orgAdmin.billing.seatsHint")} {t("orgAdmin.billing.activate.redirect")}
            </p>
            <div>
              <Button
                loading={busy === "checkout"}
                disabled={busy !== undefined || !chosenPlan}
                onClick={() => void redirect("checkout")}
              >
                <Sparkles />
                {t("orgAdmin.billing.activate.action")}
              </Button>
            </div>
          </div>
        </Panel>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label={t("orgAdmin.billing.status")}
          value={t(`orgAdmin.billing.status.${billing.status}`)}
          tone={
            billing.status === "active" || billing.status === "exempt"
              ? "good"
              : billing.status === "past_due"
                ? "warn"
                : billing.status === "suspended"
                  ? "bad"
                  : "neutral"
          }
        />
        <Stat
          label={t("orgAdmin.billing.seatsCounted")}
          value={i18n.number(billing.seatsCounted)}
          hint={t("orgAdmin.billing.seatsHint")}
        />
        <Stat
          label={t("orgAdmin.billing.seatsBilled")}
          value={i18n.number(billing.seatsBilled)}
          hint={
            billing.pendingSeats !== null && billing.currentPeriodEnd !== null
              ? t("orgAdmin.billing.pendingSeats", {
                  count: billing.pendingSeats,
                  date: date(billing.currentPeriodEnd),
                })
              : undefined
          }
        />
        <Stat
          label={t("orgAdmin.billing.periodEnd")}
          value={billing.currentPeriodEnd !== null ? date(billing.currentPeriodEnd) : "–"}
        />
      </div>

      <Panel
        title={t("orgAdmin.billing.plan")}
        icon={<CreditCard />}
        actions={
          !activate && billing.status !== "exempt" ? (
            <Button
              size="sm"
              variant="secondary"
              loading={busy === "portal"}
              disabled={busy !== undefined}
              onClick={() => void redirect("portal")}
            >
              <ExternalLink />
              {t("orgAdmin.billing.manage")}
            </Button>
          ) : undefined
        }
      >
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 px-5 py-4 text-[0.8125rem] sm:grid-cols-3">
          <div>
            <dt className="text-xs text-text-muted">{t("orgAdmin.billing.plan")}</dt>
            <dd className="mt-0.5 flex items-center gap-2 font-medium">
              {t("orgAdmin.billing.planBusiness")}
              <Badge tone={STATUS_TONE[billing.status]}>{t(`orgAdmin.billing.status.${billing.status}`)}</Badge>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">{t("orgAdmin.billing.interval")}</dt>
            <dd className="mt-0.5 font-medium">
              {billing.interval ? t(`orgAdmin.billing.interval.${billing.interval}`) : "–"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">{t("orgAdmin.billing.price")}</dt>
            <dd className="mt-0.5 font-medium">{plan ? planPrice(plan, t, i18n.locale) : "–"}</dd>
          </div>
        </dl>
        {!activate && billing.status !== "exempt" && (
          <p className="border-t border-hairline px-5 py-3 text-xs text-text-muted">
            {t("orgAdmin.billing.manageText")}
          </p>
        )}
      </Panel>
    </div>
  );
}
