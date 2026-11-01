import type { Org } from "@passbox/client";
import { Button, cn, fieldClassName, SidebarItem } from "@passbox/ui";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  CreditCard,
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
import { cloudBilling, isBusinessOrg } from "../lib/billing";
import { useI18n } from "../lib/i18n";
import { useServerMeta } from "../lib/instance";
import type { Route } from "../lib/route";
import { isOrgAdmin } from "../lib/sharing";
import { OrgIcon, orgName } from "../sharing/common";
import { useSnapshot } from "../useClient";
import { ConsoleFrame, ConsoleIdentity, ConsoleNav } from "../views/admin/console";
import { Page } from "../views/PageHeader";
import { ActivitySection } from "./ActivitySection";
import { BillingSection } from "./BillingSection";
import { useOrgReport } from "./common";
import { IntegrationsSection } from "./IntegrationsSection";
import { MembersSection } from "./MembersSection";
import { OverviewSection } from "./OverviewSection";
import { PoliciesSection } from "./PoliciesSection";
import { RecoverySection } from "./RecoverySection";
import { ReportsSection } from "./ReportsSection";
import { GroupsSection, SettingsSection } from "./SettingsSection";
import { type AdminSection, sectionsFor } from "./sections";
import { VaultsSection } from "./VaultsSection";

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
  billing: CreditCard,
  settings: Settings,
};

interface OrgAdminViewProps {
  orgId: string;
  section: string | undefined;
  /** Back from the hosted checkout (Billing). */
  checkout?: "return" | "cancel" | undefined;
  /** Interval chosen when the Business organization was created. */
  interval?: "month" | "year" | undefined;
  navigate: (route: Route) => void;
}

/**
 * The admin console of an organization: a separate area for owners and
 * admins with members, groups, vaults and their access, policies, the audit
 * log, reports, recovery, integrations and settings.
 */
export function OrgAdminView({ orgId, section, checkout, interval, navigate }: OrgAdminViewProps) {
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
  return <Console org={org} section={section} checkout={checkout} interval={interval} navigate={navigate} />;
}

function Console({
  org,
  section,
  checkout,
  interval,
  navigate,
}: {
  org: Org;
  section: string | undefined;
  checkout: "return" | "cancel" | undefined;
  interval: "month" | "year" | undefined;
  navigate: (route: Route) => void;
}) {
  const { t } = useI18n();
  const meta = useServerMeta();
  // While the server's meta loads, a link to Billing (back from the checkout) stays on Billing.
  const sections = sectionsFor(
    org,
    isBusinessOrg(org, cloudBilling(meta)) || (meta === undefined && section === "billing" && org.kind === "team"),
  );
  const current: AdminSection = sections.includes(section as AdminSection) ? (section as AdminSection) : "overview";
  const go = (next: AdminSection) => navigate({ view: "org-admin", orgId: org.id, section: next });
  const report = useOrgReport(org);
  const name = orgName(org, t);
  const adminOrgs = useSnapshot().orgs.filter(isOrgAdmin);

  const nav = (
    <ConsoleNav
      label={t("orgAdmin.sections")}
      heading={
        <div className="flex flex-col gap-3">
          {adminOrgs.length > 1 && (
            <label className="flex flex-col gap-1 px-1 text-xs text-text-muted">
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
          <ConsoleIdentity tile={<OrgIcon kind={org.kind} />} name={name} caption={t("orgAdmin.title")} />
        </div>
      }
      footer={
        <button
          type="button"
          onClick={() => navigate({ view: "org", orgId: org.id })}
          className="flex min-h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-text-muted hover:bg-surface-raised hover:text-text focus-visible:outline-2 focus-visible:outline-focus coarse:min-h-11"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          {t("orgAdmin.back", { name })}
        </button>
      }
    >
      {sections.map((id) => {
        const Icon = ICONS[id];
        return (
          <SidebarItem
            key={id}
            icon={<Icon aria-hidden="true" />}
            label={t(`orgAdmin.section.${id}`)}
            active={id === current}
            onClick={() => go(id)}
          />
        );
      })}
    </ConsoleNav>
  );

  return (
    <ConsoleFrame
      label={t("orgAdmin.titleFor", { name })}
      nav={nav}
      top={
        <div className="border-b border-hairline bg-surface px-4 py-3 md:hidden">
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
      }
    >
      {current === "overview" && <OverviewSection org={org} data={report} go={go} />}
      {current === "members" && <MembersSection org={org} data={report} navigate={navigate} />}
      {current === "groups" && <GroupsSection org={org} />}
      {current === "vaults" && <VaultsSection org={org} data={report} navigate={navigate} />}
      {current === "policies" && <PoliciesSection org={org} data={report} />}
      {current === "activity" && <ActivitySection org={org} />}
      {current === "reports" && <ReportsSection org={org} data={report} />}
      {current === "recovery" && <RecoverySection org={org} data={report} />}
      {current === "integrations" && <IntegrationsSection org={org} />}
      {current === "billing" && (
        <BillingSection org={org} checkout={checkout} interval={interval} navigate={navigate} />
      )}
      {current === "settings" && <SettingsSection org={org} navigate={navigate} />}
    </ConsoleFrame>
  );
}

export type ReportState = ReturnType<typeof useOrgReport>;
