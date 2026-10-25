import type { Org } from "@passbox/client";
import { useI18n } from "../lib/i18n";
import { useSnapshot } from "../useClient";
import { Panel } from "../views/PageHeader";
import { OrgRequests } from "../views/RecoveryRequestsView";
import { OrgRecoveryRow } from "../views/settings/RecoveryPanel";
import { Meter, Section } from "./common";
import type { ReportState } from "./OrgAdminView";

/** Recovery through the organization (C1) from the admin's side: set-up, approvers, enrollment and requests. */
export function RecoverySection({ org, data }: { org: Org; data: ReportState }) {
  const { t } = useI18n();
  const { policies } = useSnapshot();
  const required = policies.find((p) => p.orgId === org.id)?.rules.requireRecoveryEnrollment ?? false;
  // Guests are never recovered by the organization (B8).
  const active = data.report?.members.filter((m) => m.status === "confirmed" && m.role !== "guest") ?? [];
  const missing = active.filter((m) => !m.recoveryEnrolled);

  return (
    <Section title={t("orgAdmin.section.recovery")} description={t("orgAdmin.recovery.description")}>
      <Panel id="recovery-setup" title={t("orgAdmin.recovery.setup")}>
        <OrgRecoveryRow org={org} onChange={data.reload} />
      </Panel>
      {data.report?.recoverySetUp && (
        <Panel
          id="recovery-enrollment"
          title={t("orgAdmin.recovery.enrollment")}
          description={required ? t("orgAdmin.recovery.required") : t("orgAdmin.recovery.optional")}
        >
          <div className="flex flex-wrap items-center gap-4 px-5 py-4">
            <Meter
              value={active.length ? (active.length - missing.length) / active.length : 1}
              label={t("orgAdmin.recovery.enrollment")}
            />
            <span className="text-[0.8125rem] text-text-muted">
              {t("orgAdmin.recovery.enrolledCount", { count: active.length - missing.length, total: active.length })}
            </span>
          </div>
          {missing.length > 0 && (
            <div className="px-5 py-4">
              <p className="text-xs font-medium text-text-muted">{t("orgAdmin.recovery.missing")}</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {missing.map((m) => (
                  <li key={m.accountId} className="rounded-md bg-surface-sunken px-2 py-1 text-xs">
                    {m.email}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>
      )}
      <OrgRequests org={org} />
      <p className="text-xs text-text-muted">{t("orgAdmin.recovery.honest")}</p>
    </Section>
  );
}
