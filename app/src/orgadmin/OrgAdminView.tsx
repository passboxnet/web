import type { Org } from "@passbox/client";
import { Button, cn, fieldClassName } from "@passbox/ui";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  KeyRound,
  LayoutDashboard,
  type LucideIcon,
  Plug,
  ScrollText,
  Settings,
  ShieldAlert,
  Users,
  UsersRound,
  Vault as VaultIcon,
} from "lucide-react";
import { useI18n } from "../lib/i18n";
import type { Route } from "../lib/route";
import { isOrgAdmin } from "../lib/sharing";
import { OrgIcon, orgName } from "../sharing/common";
import { useSnapshot } from "../useClient";
import { Page } from "../views/PageHeader";
import { ActivitySection } from "./ActivitySection";
import { useOrgReport } from "./common";
import { IntegrationsSection } from "./IntegrationsSection";
import { MembersSection } from "./MembersSection";
import { OverviewSection } from "./OverviewSection";
import { PoliciesSection } from "./PoliciesSection";
import { RecoverySection } from "./RecoverySection";
import { ReportsSection } from "./ReportsSection";
import { GroupsSection, SettingsSection } from "./SettingsSection";
import { VaultsSection } from "./VaultsSection";

export const ADMIN_SECTIONS = [
  "overview",
  "members",
  "groups",
  "vaults",
  "policies",
  "activity",
  "reports",
  "recovery",
  "integrations",
  "settings",
] as const;
export type AdminSection = (typeof ADMIN_SECTIONS)[number];

const ICONS: Record<AdminSection, LucideIcon> = {
  overview: LayoutDashboard,
  members: Users,
  groups: UsersRound,
  vaults: VaultIcon,
  policies: ScrollText,
  activity: Activity,
  reports: BarChart3,
  recovery: KeyRound,
  integrations: Plug,
  settings: Settings,
};

/** Sections a family's organizer sees; groups and SIEM integrations are for teams. */
function sectionsFor(org: Org): AdminSection[] {
  return org.kind === "team"
    ? [...ADMIN_SECTIONS]
    : ADMIN_SECTIONS.filter((s) => s !== "groups" && s !== "integrations");
}

interface OrgAdminViewProps {
  orgId: string;
  section: string | undefined;
  navigate: (route: Route) => void;
}

/**
 * The admin console of an organization (D1): a separate area for owners and
 * admins with members, groups, vaults and their access, policies, the audit
 * log, reports, recovery, integrations and settings.
 */
export function OrgAdminView({ orgId, section, navigate }: OrgAdminViewProps) {
  const { t } = useI18n();
  const { orgs } = useSnapshot();
  const org = orgs.find((o) => o.id === orgId);

  if (!org || !isOrgAdmin(org)) {
    return (
      <Page title={t("orgAdmin.title")}>
        <div className="flex flex-col items-start gap-3 text-[0.8125rem] text-text-muted">
          <p className="flex items-center gap-2">
            <ShieldAlert className="size-4" aria-hidden="true" />
            {org ? t("orgAdmin.notAdmin") : t("sharing.org.gone")}
          </p>
          <Button variant="secondary" size="sm" onClick={() => navigate({ view: "sharing" })}>
            <ArrowLeft />
            {t("sharing.title")}
          </Button>
        </div>
      </Page>
    );
  }
  return <Console org={org} section={section} navigate={navigate} />;
}

function Console({
  org,
  section,
  navigate,
}: {
  org: Org;
  section: string | undefined;
  navigate: (route: Route) => void;
}) {
  const { t } = useI18n();
  const sections = sectionsFor(org);
  const current: AdminSection = sections.includes(section as AdminSection) ? (section as AdminSection) : "overview";
  const go = (next: AdminSection) => navigate({ view: "org-admin", orgId: org.id, section: next });
  const report = useOrgReport(org);
  const name = orgName(org, t);
  const adminOrgs = useSnapshot().orgs.filter(isOrgAdmin);

  return (
    <section aria-label={t("orgAdmin.titleFor", { name })} className="flex min-w-0 flex-1 overflow-hidden bg-canvas">
      <nav
        aria-label={t("orgAdmin.sections")}
        className="hidden w-56 shrink-0 flex-col gap-1 overflow-y-auto border-r border-border bg-surface px-3 py-6 md:flex"
      >
        {adminOrgs.length > 1 && (
          <label className="mb-3 flex flex-col gap-1 px-2 text-xs text-text-muted">
            {t("orgAdmin.switchOrg")}
            <select
              className={cn(fieldClassName, "h-9 px-2 text-[0.8125rem] text-text coarse:h-11")}
              value={org.id}
              onChange={(e) => navigate({ view: "org-admin", orgId: e.target.value, section: current })}
            >
              {adminOrgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {orgName(o, t)}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="mb-4 flex items-start gap-2.5 px-2">
          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
            <OrgIcon kind={org.kind} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[0.8125rem] font-semibold" title={name}>
              {name}
            </p>
            <p className="text-xs text-text-muted">{t("orgAdmin.title")}</p>
          </div>
        </div>
        {sections.map((id) => {
          const Icon = ICONS[id];
          const active = id === current;
          return (
            <button
              key={id}
              type="button"
              onClick={() => go(id)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-8 items-center gap-2.5 rounded-md px-2 text-[0.8125rem] font-medium transition-colors coarse:h-11",
                active ? "bg-accent-soft text-accent" : "text-text-muted hover:bg-surface-sunken hover:text-text",
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              {t(`orgAdmin.section.${id}`)}
            </button>
          );
        })}
        <div className="mt-auto border-t border-border px-2 pt-3">
          <button
            type="button"
            onClick={() => navigate({ view: "org", orgId: org.id })}
            className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            {t("orgAdmin.back", { name })}
          </button>
        </div>
      </nav>
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <div className="border-b border-border bg-surface px-4 py-3 md:hidden">
          <label className="flex flex-col gap-1 text-xs text-text-muted">
            {t("orgAdmin.sectionsFor", { name })}
            <select
              className={cn(fieldClassName, "h-10 px-2.5 text-sm text-text coarse:h-12")}
              value={current}
              onChange={(e) => go(e.target.value as AdminSection)}
            >
              {sections.map((id) => (
                <option key={id} value={id}>
                  {t(`orgAdmin.section.${id}`)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-10">
          {current === "overview" && <OverviewSection org={org} data={report} go={go} />}
          {current === "members" && <MembersSection org={org} data={report} navigate={navigate} />}
          {current === "groups" && <GroupsSection org={org} />}
          {current === "vaults" && <VaultsSection org={org} data={report} navigate={navigate} />}
          {current === "policies" && <PoliciesSection org={org} data={report} />}
          {current === "activity" && <ActivitySection org={org} />}
          {current === "reports" && <ReportsSection org={org} data={report} />}
          {current === "recovery" && <RecoverySection org={org} data={report} />}
          {current === "integrations" && <IntegrationsSection org={org} />}
          {current === "settings" && <SettingsSection org={org} navigate={navigate} />}
        </div>
      </div>
    </section>
  );
}

export type ReportState = ReturnType<typeof useOrgReport>;
