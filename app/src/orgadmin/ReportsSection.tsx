import type { OrgReport } from "@passbox/api-client";
import type { Org } from "@passbox/client";
import { Badge, Button, SegmentedControl, Switch } from "@passbox/ui";
import { BrandIcon } from "@passbox/ui/brand-icon";
import { Check, Download, Minus } from "lucide-react";
import { useState } from "react";
import { downloadFile } from "../export/download";
import { useI18n } from "../lib/i18n";
import { vaultRoleKey } from "../lib/sharing";
import { Cell, Loading, Meter, Section, Table, useNames } from "./common";
import type { ReportState } from "./OrgAdminView";

type Tab = "security" | "access" | "vaults";

/** Reports (D6): security per member, access per person and vault, unused vaults. */
export function ReportsSection({ org, data }: { org: Org; data: ReportState }) {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("security");
  const { report } = data;
  return (
    <Section title={t("orgAdmin.section.reports")} description={t("orgAdmin.reports.description")}>
      <SegmentedControl<Tab>
        label={t("orgAdmin.reports.tabs")}
        value={tab}
        onChange={setTab}
        options={[
          { value: "security", label: t("orgAdmin.reports.tab.security") },
          { value: "access", label: t("orgAdmin.reports.tab.access") },
          { value: "vaults", label: t("orgAdmin.reports.tab.vaults") },
        ]}
      />
      {!report ? (
        <Loading error={data.error} onRetry={data.reload} />
      ) : tab === "security" ? (
        <SecurityReport report={report} />
      ) : tab === "access" ? (
        <AccessReport org={org} report={report} />
      ) : (
        <VaultReport org={org} report={report} />
      )}
    </Section>
  );
}

function SecurityReport({ report }: { report: OrgReport }) {
  const i18n = useI18n();
  const { t } = i18n;
  const [problemsOnly, setProblemsOnly] = useState(false);
  const active = report.members.filter((m) => m.status === "confirmed");
  const twoFactor = active.filter((m) => m.twoFactor).length;
  const rows = active.filter(
    (m) =>
      !problemsOnly ||
      !m.twoFactor ||
      (m.security && (m.security.weak > 0 || m.security.reused > 0 || m.security.passwordPolicy === 0)),
  );

  function exportCsv() {
    const header =
      "email,role,two_factor,recovery_enrolled,score,logins,weak,reused,unsecured,master_password_policy,reported_at";
    const lines = active.map((m) =>
      [
        m.email,
        m.role,
        m.twoFactor,
        m.recoveryEnrolled,
        m.security?.score ?? "",
        m.security?.total ?? "",
        m.security?.weak ?? "",
        m.security?.reused ?? "",
        m.security?.unsecured ?? "",
        m.security
          ? m.security.passwordPolicy === 1
            ? "yes"
            : m.security.passwordPolicy === 0
              ? "no"
              : "unknown"
          : "",
        m.security ? new Date(m.security.reportedAt).toISOString() : "",
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
    downloadFile(
      `passbox-security-${new Date().toISOString().slice(0, 10)}.csv`,
      `${header}\n${lines.join("\n")}\n`,
      "text/csv",
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-card border border-border bg-surface px-5 py-4 shadow-card">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-text-muted">{t("orgAdmin.overview.twoFactor")}</span>
          <Meter value={active.length ? twoFactor / active.length : 1} label={t("orgAdmin.overview.twoFactor")} />
        </div>
        <p className="min-w-0 flex-1 text-xs text-text-muted">{t("orgAdmin.reports.securityHint")}</p>
        <Switch label={t("orgAdmin.reports.problemsOnly")} checked={problemsOnly} onCheckedChange={setProblemsOnly} />
        <Button size="sm" variant="secondary" onClick={exportCsv}>
          <Download />
          {t("orgAdmin.reports.exportCsv")}
        </Button>
      </div>
      <Table
        label={t("orgAdmin.reports.tab.security")}
        head={[
          t("orgAdmin.members.col.member"),
          t("orgAdmin.members.col.twoFactor"),
          t("orgAdmin.members.col.recovery"),
          t("orgAdmin.members.col.score"),
          t("orgAdmin.reports.col.findings"),
          t("orgAdmin.reports.col.masterPassword"),
          t("orgAdmin.reports.col.reported"),
        ]}
      >
        {rows.length === 0 && (
          <tr>
            <Cell colSpan={7} className="text-text-muted">
              {t("orgAdmin.reports.noProblems")}
            </Cell>
          </tr>
        )}
        {rows.map((m) => (
          <tr key={m.accountId} data-testid="security-row">
            <Cell className="font-medium break-all">{m.email}</Cell>
            <Cell>
              {m.twoFactor ? (
                <Check className="size-4 text-success" aria-label={t("orgAdmin.members.twoFactorOn")} />
              ) : (
                <Badge tone="warning">{t("orgAdmin.members.off")}</Badge>
              )}
            </Cell>
            <Cell>
              {m.recoveryEnrolled ? (
                <Check className="size-4 text-success" aria-label={t("orgAdmin.members.enrolled")} />
              ) : (
                <Minus className="size-4 text-text-subtle" aria-label={t("orgAdmin.members.notEnrolled")} />
              )}
            </Cell>
            <Cell className="tabular-nums">{m.security?.score ?? "–"}</Cell>
            <Cell className="text-xs whitespace-nowrap">
              {m.security
                ? t("orgAdmin.reports.findings", {
                    weak: m.security.weak,
                    reused: m.security.reused,
                    unsecured: m.security.unsecured,
                    total: m.security.total,
                  })
                : t("orgAdmin.reports.notReported")}
            </Cell>
            <Cell className="text-xs">
              {!m.security || m.security.passwordPolicy === -1 ? (
                <span className="text-text-muted">{t("orgAdmin.reports.unknown")}</span>
              ) : m.security.passwordPolicy === 1 ? (
                t("orgAdmin.reports.meetsPolicy")
              ) : (
                <Badge tone="warning">{t("orgAdmin.reports.belowPolicy")}</Badge>
              )}
            </Cell>
            <Cell className="whitespace-nowrap text-xs text-text-muted">
              {m.security ? i18n.relativeTime(m.security.reportedAt) : "–"}
            </Cell>
          </tr>
        ))}
      </Table>
      <BreachedSitesReport report={report} />
      <p className="text-xs text-text-muted">{t("orgAdmin.reports.privacy")}</p>
    </div>
  );
}

/**
 * Breached websites (Have I Been Pwned) of logins in this organization's
 * vaults: per breach, how many members still have affected logins and how
 * many changed them. Numbers only, from the members' apps.
 */
function BreachedSitesReport({ report }: { report: OrgReport }) {
  const { t } = useI18n();
  const sites = report.siteBreaches ?? [];
  return (
    <section aria-labelledby="org-breached-sites" className="flex flex-col gap-2">
      <h3 id="org-breached-sites" className="text-sm font-semibold">
        {t("orgAdmin.reports.breaches.title")}
      </h3>
      <p className="text-xs text-text-muted">{t("orgAdmin.reports.breaches.hint")}</p>
      <Table
        label={t("orgAdmin.reports.breaches.title")}
        head={[t("orgAdmin.reports.breaches.col.site"), t("orgAdmin.reports.breaches.col.status")]}
      >
        {sites.length === 0 && (
          <tr>
            <Cell colSpan={2} className="text-text-muted">
              {t("orgAdmin.reports.breaches.none")}
            </Cell>
          </tr>
        )}
        {sites.map((site) => (
          <tr key={site.name} data-testid="breach-row">
            <Cell className="font-medium">{site.title}</Cell>
            <Cell className="text-xs">
              {site.affectedMembers > 0 ? (
                <Badge tone="danger">
                  {t("orgAdmin.reports.breaches.status", {
                    affected: site.affectedMembers + site.fixedMembers,
                    fixed: site.fixedMembers,
                  })}
                </Badge>
              ) : (
                <Badge tone="success">{t("orgAdmin.reports.breaches.allFixed", { fixed: site.fixedMembers })}</Badge>
              )}
            </Cell>
          </tr>
        ))}
      </Table>
      <p className="flex items-center gap-1.5 text-xs text-text-muted">
        <BrandIcon service="hibp" size="sm" decorative />
        {t("orgAdmin.reports.breaches.source")}
      </p>
    </section>
  );
}

const ROLE_SHORT: Record<string, string> = {
  view: "orgAdmin.access.short.view",
  edit: "orgAdmin.access.short.edit",
  manage: "orgAdmin.access.short.manage",
};

function AccessReport({ org, report }: { org: Org; report: OrgReport }) {
  const { t } = useI18n();
  const names = useNames(org);
  const members = report.members.filter((m) => m.status !== "accepted");
  const vaults = report.vaults;
  const cell = (accountId: string, vaultId: string) =>
    report.access.find((a) => a.accountId === accountId && a.vaultId === vaultId);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-text-muted">{t("orgAdmin.access.legend")}</p>
      <div className="overflow-x-auto rounded-card border border-border bg-surface shadow-card">
        <table className="border-collapse text-left text-[0.8125rem]" aria-label={t("orgAdmin.reports.tab.access")}>
          <thead>
            <tr className="border-b border-border text-xs text-text-muted">
              <th scope="col" className="sticky left-0 bg-surface px-4 py-2.5 font-medium">
                {t("orgAdmin.members.col.member")}
              </th>
              {vaults.map((v) => (
                <th
                  key={v.vaultId}
                  scope="col"
                  className="max-w-[8rem] truncate px-3 py-2.5 font-medium"
                  title={names.vault(v.vaultId)}
                >
                  {names.vault(v.vaultId)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {members.map((m) => (
              <tr key={m.accountId}>
                <th scope="row" className="sticky left-0 bg-surface px-4 py-2.5 font-medium whitespace-nowrap">
                  {m.email}
                </th>
                {vaults.map((v) => {
                  const entry = cell(m.accountId, v.vaultId);
                  const viaGroup = entry?.via.some((via) => via !== "direct");
                  return (
                    <td key={v.vaultId} className="px-3 py-2.5 text-center">
                      {entry ? (
                        <span
                          className="inline-flex items-center gap-0.5"
                          title={`${t(vaultRoleKey(entry.role))}${
                            viaGroup
                              ? ` · ${entry.via
                                  .filter((x) => x !== "direct")
                                  .map(names.group)
                                  .join(", ")}`
                              : ""
                          }`}
                        >
                          <Badge tone={entry.role === "manage" ? "accent" : "neutral"}>
                            {t(ROLE_SHORT[entry.role] ?? "orgAdmin.access.short.view")}
                            {viaGroup ? "*" : ""}
                          </Badge>
                          <span className="sr-only">{t(vaultRoleKey(entry.role))}</span>
                        </span>
                      ) : (
                        <>
                          <span className="text-text-subtle" aria-hidden="true">
                            ·
                          </span>
                          <span className="sr-only">{t("orgAdmin.access.none")}</span>
                        </>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function VaultReport({ org, report }: { org: Org; report: OrgReport }) {
  const i18n = useI18n();
  const { t } = i18n;
  const names = useNames(org);
  const unused = report.vaults.filter((v) => v.unused);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-text-muted">{t("orgAdmin.reports.unusedHint", { days: report.unusedAfterDays })}</p>
      <Table
        label={t("orgAdmin.reports.tab.vaults")}
        head={[
          t("orgAdmin.vaults.col.vault"),
          t("orgAdmin.vaults.col.items"),
          t("orgAdmin.reports.col.lastWrite"),
          t("orgAdmin.reports.col.lastUse"),
        ]}
      >
        {unused.length === 0 && (
          <tr>
            <Cell colSpan={4} className="text-text-muted">
              {t("orgAdmin.reports.noUnused")}
            </Cell>
          </tr>
        )}
        {unused.map((v) => (
          <tr key={v.vaultId}>
            <Cell className="font-medium">{names.vault(v.vaultId)}</Cell>
            <Cell className="tabular-nums">{v.itemCount}</Cell>
            <Cell className="text-xs text-text-muted">
              {v.lastWriteAt ? i18n.date(v.lastWriteAt) : t("orgAdmin.members.never")}
            </Cell>
            <Cell className="text-xs text-text-muted">
              {v.lastUsedAt ? i18n.date(v.lastUsedAt) : t("orgAdmin.reports.noUsage")}
            </Cell>
          </tr>
        ))}
      </Table>
    </div>
  );
}
