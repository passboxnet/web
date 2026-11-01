import type { Org } from "@passbox/client";
import { Button, cn, fieldClassName, toast } from "@passbox/ui";
import { Save } from "lucide-react";
import { useEffect, useState } from "react";
import { FormError } from "../auth/AuthLayout";
import { errorMessage } from "../core";
import { useI18n } from "../lib/i18n";
import type { Route } from "../lib/route";
import { GroupsPanel } from "../sharing/GroupsPanel";
import { OrgSettingsPanel } from "../sharing/OrgSettingsPanel";
import { useClient } from "../useClient";
import { Panel } from "../views/PageHeader";
import { Section } from "./common";

const RETENTION = [0, 30, 90, 180, 365, 730, 2555];

export function GroupsSection({ org }: { org: Org }) {
  const { t } = useI18n();
  return (
    <Section title={t("orgAdmin.section.groups")} description={t("orgAdmin.groups.description")}>
      <GroupsPanel org={org} />
    </Section>
  );
}

/** Organization settings: name, audit log retention (teams), leaving and deleting. */
export function SettingsSection({ org, navigate }: { org: Org; navigate: (route: Route) => void }) {
  const client = useClient();
  const { t } = useI18n();
  const [days, setDays] = useState<number>();
  const [saved, setSaved] = useState<number>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  // The activity log is for teams: families have no retention to set.
  const team = org.kind === "team";

  useEffect(() => {
    if (!team) return;
    client.orgAdmin
      .settings(org.id)
      .then((settings) => {
        setDays(settings.auditRetentionDays);
        setSaved(settings.auditRetentionDays);
      })
      .catch((e: unknown) => setError(errorMessage(e)));
  }, [client, org.id, team]);

  async function save() {
    if (days === undefined) return;
    setBusy(true);
    setError(undefined);
    try {
      const next = await client.orgAdmin.putSettings(org.id, { auditRetentionDays: days });
      setSaved(next.auditRetentionDays);
      toast.success(t("orgAdmin.settings.saved"));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title={t("orgAdmin.section.settings")} description={t("orgAdmin.settings.description")}>
      {team && (
        <Panel
          id="audit-retention"
          title={t("orgAdmin.settings.retention")}
          description={t("orgAdmin.settings.retentionText")}
        >
          <div className="flex flex-wrap items-end gap-3 px-5 py-4">
            <label className="flex flex-col gap-1.5 text-[0.8125rem] font-medium">
              {t("orgAdmin.settings.keep")}
              <select
                className={cn(fieldClassName, "h-10 px-2.5 font-normal coarse:h-12")}
                value={days ?? 0}
                disabled={days === undefined}
                onChange={(e) => setDays(Number(e.target.value))}
              >
                {RETENTION.map((value) => (
                  <option key={value} value={value}>
                    {value === 0 ? t("orgAdmin.settings.forever") : t("orgAdmin.settings.days", { count: value })}
                  </option>
                ))}
              </select>
            </label>
            <Button onClick={() => void save()} loading={busy} disabled={days === undefined || days === saved}>
              <Save />
              {t("orgAdmin.settings.save")}
            </Button>
          </div>
          {days !== undefined && days !== 0 && (
            <p className="px-5 py-3 text-xs text-text-muted">
              {t("orgAdmin.settings.retentionWarning", { count: days })}
            </p>
          )}
          {error && (
            <div className="px-5 py-3">
              <FormError message={error} />
            </div>
          )}
        </Panel>
      )}
      <OrgSettingsPanel org={org} navigate={navigate} />
    </Section>
  );
}
