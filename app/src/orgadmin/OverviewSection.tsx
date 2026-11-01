import type { ChainCheck } from "@passbox/api-client";
import type { Org } from "@passbox/client";
import { Badge, Button, cn } from "@passbox/ui";
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronRight,
  Gauge,
  Info,
  KeyRound,
  ListChecks,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  UserRound,
  Users,
  Vault as VaultIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useI18n } from "../lib/i18n";
import { awaitingConfirmation } from "../lib/sharing";
import { useClient, useSnapshot } from "../useClient";
import { ConsolePanel } from "../views/admin/console";
import { Loading, Meter, Section, Stat } from "./common";
import type { ReportState } from "./OrgAdminView";
import type { AdminSection } from "./sections";

interface Attention {
  id: string;
  tone: "warn" | "bad" | "info";
  text: string;
  action: string;
  section: AdminSection;
}

export function OverviewSection({
  org,
  data,
  go,
}: {
  org: Org;
  data: ReportState;
  go: (section: AdminSection) => void;
}) {
  const client = useClient();
  const { t } = useI18n();
  const { sharedVaults, policies } = useSnapshot();
  const [chain, setChain] = useState<ChainCheck>();
  // Policies and the activity log are for teams; a family keeps only the recovery rule.
  const team = org.kind === "team";
  const policy = team ? policies.find((p) => p.orgId === org.id) : undefined;

  useEffect(() => {
    if (!team) return;
    client.orgAdmin
      .verifyAudit(org.id)
      .then(setChain)
      .catch(() => setChain(undefined));
  }, [client, org.id, team]);

  const { report } = data;
  if (!report) return <Loading error={data.error} onRetry={data.reload} />;

  const active = report.members.filter((m) => m.status === "confirmed");
  // Guests are free and view-only: counted separately, never as members.
  const members = active.filter((m) => m.role !== "guest");
  const guests = report.guestCount ?? active.length - members.length;
  const withTwoFactor = active.filter((m) => m.twoFactor).length;
  // Guests are never recovered by the organization.
  const enrolled = members.filter((m) => m.recoveryEnrolled).length;
  const scores = active.flatMap((m) => (m.security ? [m.security.score] : []));
  const average = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : undefined;
  const waiting = awaitingConfirmation(org).length;
  const pendingRotation = sharedVaults.filter((v) => v.orgId === org.id && v.rotationPending).length;
  const unused = report.vaults.filter((v) => v.unused).length;
  const share = (count: number) => (active.length ? count / active.length : 1);

  const attention: Attention[] = [];
  if (waiting > 0) {
    attention.push({
      id: "waiting",
      tone: "warn",
      text: t("orgAdmin.overview.waiting", { count: waiting }),
      action: t("orgAdmin.overview.review"),
      section: "members",
    });
  }
  if (report.pendingRecoveryRequests > 0) {
    attention.push({
      id: "recovery",
      tone: "bad",
      text: t("orgAdmin.overview.recoveryRequests", { count: report.pendingRecoveryRequests }),
      action: t("orgAdmin.overview.review"),
      section: "recovery",
    });
  }
  if (pendingRotation > 0) {
    attention.push({
      id: "rotation",
      tone: "warn",
      text: t("orgAdmin.overview.rotation", { count: pendingRotation }),
      action: t("orgAdmin.overview.open"),
      section: "vaults",
    });
  }
  if (chain && !chain.valid) {
    attention.push({
      id: "chain",
      tone: "bad",
      text: t("orgAdmin.overview.chainBroken", { seq: chain.brokenAt ?? 0 }),
      action: t("orgAdmin.overview.open"),
      section: "activity",
    });
  }
  if (policy?.needsResign) {
    attention.push({
      id: "resign",
      tone: "warn",
      text: t("orgAdmin.overview.resign"),
      action: t("orgAdmin.overview.open"),
      section: "policies",
    });
  }
  if (policy?.rules.requireTwoFactor && withTwoFactor < active.length) {
    attention.push({
      id: "twoFactor",
      tone: "warn",
      text: t("orgAdmin.overview.withoutTwoFactor", { count: active.length - withTwoFactor }),
      action: t("orgAdmin.overview.open"),
      section: "reports",
    });
  }
  if (team && !policy) {
    attention.push({
      id: "policy",
      tone: "info",
      text: t("orgAdmin.overview.noPolicy"),
      action: t("orgAdmin.overview.setUp"),
      section: "policies",
    });
  }
  if (!report.recoverySetUp) {
    attention.push({
      id: "recoverySetup",
      tone: "info",
      text: t("orgAdmin.overview.noRecovery"),
      action: t("orgAdmin.overview.setUp"),
      section: "recovery",
    });
  }
  if (unused > 0) {
    attention.push({
      id: "unused",
      tone: "info",
      text: t("orgAdmin.overview.unused", { count: unused, days: report.unusedAfterDays }),
      action: t("orgAdmin.overview.open"),
      section: "reports",
    });
  }

  return (
    <Section title={t("orgAdmin.section.overview")} description={t("orgAdmin.overview.description")}>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label={t("orgAdmin.overview.members")}
          icon={<Users />}
          value={report.memberCount ?? members.length}
          hint={t("orgAdmin.overview.membersHint", { invited: report.pendingInvitations, waiting })}
          onClick={() => go("members")}
        />
        <Stat
          label={t("orgAdmin.overview.twoFactor")}
          icon={<ShieldCheck />}
          value={`${withTwoFactor}/${active.length}`}
          hint={<Meter value={share(withTwoFactor)} label={t("orgAdmin.overview.twoFactor")} />}
          tone={withTwoFactor === active.length ? "good" : "warn"}
          onClick={() => go("reports")}
        />
        <Stat
          label={t("orgAdmin.overview.recovery")}
          icon={<KeyRound />}
          value={report.recoverySetUp ? `${enrolled}/${members.length}` : "–"}
          hint={
            report.recoverySetUp ? (
              <Meter value={members.length ? enrolled / members.length : 1} label={t("orgAdmin.overview.recovery")} />
            ) : (
              t("orgAdmin.overview.recoveryOff")
            )
          }
          onClick={() => go("recovery")}
        />
        <Stat
          label={t("orgAdmin.overview.score")}
          icon={<Gauge />}
          value={average ?? "–"}
          hint={t("orgAdmin.overview.scoreHint", { count: scores.length, total: active.length })}
          tone={average === undefined ? "neutral" : average >= 80 ? "good" : average >= 50 ? "warn" : "bad"}
          onClick={() => go("reports")}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 2xl:grid-cols-5">
        <Stat
          label={t("orgAdmin.overview.guests")}
          icon={<UserRound />}
          value={guests}
          hint={t("orgAdmin.overview.guestsHint")}
          onClick={() => go("members")}
        />
        <Stat
          label={t("orgAdmin.overview.agents")}
          icon={<Bot />}
          value={report.serviceAccountCount ?? "–"}
          hint={
            !report.agentLimitPerMember
              ? t("orgAdmin.overview.agentsUnlimited")
              : t("orgAdmin.overview.agentsHint", {
                  allowed: report.agentLimitPerMember * Math.max(1, report.memberCount ?? members.length),
                  perMember: report.agentLimitPerMember,
                })
          }
        />
        <Stat
          label={t("orgAdmin.overview.vaults")}
          icon={<VaultIcon />}
          value={report.vaults.length}
          hint={t("orgAdmin.overview.vaultsHint", { pending: pendingRotation })}
          onClick={() => go("vaults")}
        />
        {team && (
          <>
            <Stat
              label={t("orgAdmin.overview.policy")}
              icon={<ScrollText />}
              value={policy ? t("orgAdmin.overview.policyVersion", { version: policy.version }) : "–"}
              hint={
                policy ? (
                  policy.source === "verified" && !policy.needsResign ? (
                    <Badge tone="success">{t("orgAdmin.policy.verified")}</Badge>
                  ) : (
                    <Badge tone="warning">{t("orgAdmin.policy.pinned")}</Badge>
                  )
                ) : (
                  t("orgAdmin.overview.noPolicyShort")
                )
              }
              onClick={() => go("policies")}
            />
            <Stat
              label={t("orgAdmin.overview.audit")}
              icon={<Activity />}
              value={chain ? chain.length : "–"}
              hint={
                chain ? (
                  chain.valid ? (
                    <Badge tone="success">{t("orgAdmin.audit.chainValid")}</Badge>
                  ) : (
                    <Badge tone="danger">{t("orgAdmin.audit.chainBroken", { seq: chain.brokenAt ?? 0 })}</Badge>
                  )
                ) : undefined
              }
              onClick={() => go("activity")}
            />
          </>
        )}
      </div>

      <ConsolePanel id="attention" icon={<ListChecks />} title={t("orgAdmin.overview.attention")}>
        {attention.length === 0 ? (
          <p className="flex items-center gap-3 px-5 py-4 text-[0.8125rem] text-text-muted">
            <span className="flex size-8 items-center justify-center rounded-[9px] bg-success-soft text-success">
              <CheckCircle2 className="size-4" aria-hidden="true" />
            </span>
            {t("orgAdmin.overview.allGood")}
          </p>
        ) : (
          <ul className="divide-y divide-hairline">
            {attention.map((entry) => {
              const Icon = entry.tone === "info" ? Info : entry.tone === "bad" ? ShieldAlert : AlertTriangle;
              return (
                <li key={entry.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-[9px] [&_svg]:size-4",
                      entry.tone === "bad"
                        ? "bg-danger-soft text-danger"
                        : entry.tone === "warn"
                          ? "bg-warning-soft text-warning"
                          : "bg-accent-soft text-accent",
                    )}
                  >
                    <Icon aria-hidden="true" />
                  </span>
                  <p className="min-w-0 flex-1 text-[0.8125rem]">{entry.text}</p>
                  <Button size="sm" variant="secondary" shape="pill" onClick={() => go(entry.section)}>
                    {entry.action}
                    <ChevronRight />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </ConsolePanel>
    </Section>
  );
}
