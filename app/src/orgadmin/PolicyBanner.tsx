import { type Org, type PolicyTask, policyTasks } from "@passbox/client";
import { Button, toast } from "@passbox/ui";
import { ScrollText } from "lucide-react";
import { useEffect, useState } from "react";
import { errorMessage } from "../core";
import { useI18n } from "../lib/i18n";
import type { Route } from "../lib/route";
import { orgName } from "../sharing/common";
import { useClient, useSnapshot } from "../useClient";
import { activeRules } from "./policyText";

/**
 * What an organization's policy asks of this account (D2): turn on
 * two-factor sign-in, choose a stronger master password, enroll in
 * recovery, or update the app for rules it does not know.
 */
export function PolicyBanner({ navigate }: { navigate: (route: Route) => void }) {
  const client = useClient();
  const { t } = useI18n();
  const { effectivePolicy, orgs } = useSnapshot();
  const [twoFactor, setTwoFactor] = useState<boolean>();
  const [enrolledOrgs, setEnrolledOrgs] = useState<string[]>();
  const [busy, setBusy] = useState(false);
  const needsTwoFactorState = effectivePolicy.requireTwoFactor;
  const needsRecoveryState = effectivePolicy.recoveryEnrollmentOrgs.length > 0;
  const policyKey = JSON.stringify(effectivePolicy);

  // biome-ignore lint/correctness/useExhaustiveDependencies: refresh when the policy changes
  useEffect(() => {
    if (needsTwoFactorState) {
      client
        .twoFactorStatus()
        .then((status) => setTwoFactor(status.enabled))
        .catch(() => setTwoFactor(undefined));
    }
    if (needsRecoveryState) {
      // Members agreed to recovery when they joined: seal the share
      // automatically once confirmed; the banner remains for what fails.
      client
        .enrollRequiredOrgRecovery()
        .catch(() => [])
        .then(() => client.recoveryStatus())
        .then((status) => setEnrolledOrgs(status.orgEscrows.map((e) => e.orgId)))
        .catch(() => setEnrolledOrgs(undefined));
    }
  }, [client, policyKey]);

  const tasks = policyTasks(effectivePolicy, {
    twoFactor,
    passwordScore: client.unlockPasswordScore,
    // Unknown enrollment never produces a task.
    enrolledOrgs: enrolledOrgs ?? effectivePolicy.recoveryEnrollmentOrgs,
  });
  if (tasks.length === 0) return null;

  const names = (task: PolicyTask) =>
    task.orgIds
      .map((id) => orgs.find((o) => o.id === id))
      .filter((o): o is Org => o !== undefined)
      .map((o) => orgName(o, t))
      .join(", ");

  async function enroll(orgIds: string[]) {
    setBusy(true);
    try {
      for (const orgId of orgIds) await client.enrollOrgRecovery(orgId);
      const status = await client.recoveryStatus();
      setEnrolledOrgs(status.orgEscrows.map((e) => e.orgId));
      toast.success(t("orgAdmin.banner.enrolled"));
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="status"
      className="flex flex-col gap-2 border-b border-accent/25 bg-accent-soft px-4 py-2.5 text-[0.8125rem]"
    >
      {tasks.map((task) => (
        <div key={task.kind} className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <ScrollText className="size-4 shrink-0 text-accent" aria-hidden="true" />
          <p className="min-w-0 flex-1">
            <strong className="font-semibold">{t(`orgAdmin.banner.${task.kind}.title`, { orgs: names(task) })}</strong>
            <span className="hidden sm:inline"> – {t(`orgAdmin.banner.${task.kind}.body`)}</span>
          </p>
          {task.kind === "two_factor" && (
            <Button size="sm" onClick={() => navigate({ view: "settings", section: "two-factor" })}>
              {t("orgAdmin.banner.two_factor.action")}
            </Button>
          )}
          {task.kind === "password_strength" && (
            <Button size="sm" onClick={() => navigate({ view: "settings", section: "security" })}>
              {t("orgAdmin.banner.password_strength.action")}
            </Button>
          )}
          {task.kind === "recovery_enrollment" && (
            <Button size="sm" loading={busy} onClick={() => void enroll(task.orgIds)}>
              {t("orgAdmin.banner.recovery_enrollment.action")}
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}

/** The rules of an organization's policy in plain language, for every member. */
export function PolicySummary({ org }: { org: Org }) {
  const { t } = useI18n();
  const { policies } = useSnapshot();
  const policy = policies.find((p) => p.orgId === org.id);
  if (!policy) return null;
  const lines = activeRules(policy.rules, t);
  return (
    <section aria-labelledby="policy-summary" className="rounded-card border border-border bg-surface shadow-card">
      <header className="border-b border-border px-5 py-4">
        <h2 id="policy-summary" className="text-sm font-semibold">
          {t("orgAdmin.summary.title")}
        </h2>
        <p className="mt-0.5 text-[0.8125rem] text-text-muted">
          {t("orgAdmin.summary.text", { version: policy.version })}
        </p>
      </header>
      {lines.length === 0 ? (
        <p className="px-5 py-4 text-[0.8125rem] text-text-muted">{t("orgAdmin.summary.none")}</p>
      ) : (
        <ul className="flex list-disc flex-col gap-1 py-4 pr-5 pl-10 text-[0.8125rem]">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
