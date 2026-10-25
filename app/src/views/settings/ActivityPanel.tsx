import type { AccountEvent } from "@passbox/api-client";
import { Button, Spinner } from "@passbox/ui";
import { Activity } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { errorMessage } from "../../core";
import { useI18n } from "../../lib/i18n";
import { useClient } from "../../useClient";
import { Panel } from "../PageHeader";
import { localizedDeviceName } from "./DevicesPanel";

const KNOWN = new Set([
  "account_created",
  "login",
  "login_failed",
  "logout",
  "session_revoked",
  "other_sessions_revoked",
  "password_changed",
  "login_two_factor",
  "two_factor_failed",
  "two_factor_enabled",
  "two_factor_disabled",
  "two_factor_method_added",
  "two_factor_method_removed",
  "recovery_code_used",
  "recovery_codes_regenerated",
  "login_recovered",
  "account_recovery_code_created",
  "account_recovery_code_removed",
  "account_recovery_failed",
  "account_recovered_code",
  "account_recovered_org",
  "org_recovery_enabled",
  "org_recovery_admin_added",
  "org_recovery_enrolled",
  "org_recovery_withdrawn",
  "org_recovery_requested",
  "org_recovery_approved",
  "org_recovery_denied",
  "org_member_recovered",
  "emergency_contact_added",
  "emergency_contact_removed",
  "emergency_invitation_accepted",
  "emergency_access_confirmed",
  "emergency_access_requested",
  "emergency_access_approved",
  "emergency_access_denied",
  "emergency_access_used",
  "device_link_created",
  "device_link_approved",
  "service_account_created",
  "service_account_access_changed",
  "service_account_revoked",
  "service_account_deleted",
  "agent_grant_requested",
  "agent_grant_approved",
  "agent_grant_denied",
  "agent_grant_revoked",
  "agent_request_access",
  "agent_run",
  "agent_inject",
  "agent_create",
  "agent_reveal",
  "org_recovery_disabled",
]);
/** Events worth noticing: shown in red. */
const ALERTS = new Set([
  "login_failed",
  "two_factor_failed",
  "account_recovery_failed",
  "account_recovered_code",
  "account_recovered_org",
  "org_recovery_requested",
  "emergency_access_requested",
  "emergency_access_used",
  "agent_reveal",
]);
const COLLAPSED = 8;

/** The last 50 security events of the account (S10, S20). */
export function ActivityPanel() {
  const client = useClient();
  const i18n = useI18n();
  const { t } = i18n;
  const [events, setEvents] = useState<AccountEvent[]>();
  const [error, setError] = useState<string>();
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(() => {
    setError(undefined);
    client
      .activity(50)
      .then(setEvents)
      .catch((e: unknown) => setError(errorMessage(e)));
  }, [client]);

  useEffect(load, [load]);

  const shown = expanded ? events : events?.slice(0, COLLAPSED);

  return (
    <Panel id="activity" icon={<Activity />} title={t("term.activity")} description={t("activity.description")}>
      {error ? (
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-[0.8125rem] text-danger">
          {error}
          <Button size="sm" variant="secondary" onClick={load}>
            {t("action.retry")}
          </Button>
        </div>
      ) : !shown ? (
        <div className="flex justify-center px-5 py-6 text-text-muted">
          <Spinner label={t("app.loading")} />
        </div>
      ) : (
        <>
          {shown.length === 0 ? (
            <p className="px-5 py-4 text-[0.8125rem] text-text-muted">{t("activity.none")}</p>
          ) : (
            <ul className="divide-y divide-border">
              {shown.map((event) => (
                <li
                  key={event.id}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-5 py-3"
                >
                  <div className="min-w-0">
                    <p
                      className={
                        ALERTS.has(event.kind)
                          ? "text-[0.8125rem] font-medium text-danger"
                          : "text-[0.8125rem] font-medium"
                      }
                    >
                      {t(`activity.kind.${KNOWN.has(event.kind) ? event.kind : "other"}`)}
                    </p>
                    <p className="text-xs text-text-muted">
                      {[
                        localizedDeviceName(event.deviceName, t) ||
                          (event.clientKind ? t(`devices.kind.${event.clientKind}`) : ""),
                        event.ip && t("devices.ip", { ip: event.ip }),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <time
                    className="text-xs text-text-muted"
                    dateTime={new Date(event.createdAt).toISOString()}
                    title={i18n.dateTime(event.createdAt)}
                  >
                    {i18n.relativeTime(event.createdAt)}
                  </time>
                </li>
              ))}
            </ul>
          )}
          {events && events.length > COLLAPSED && (
            <div className="px-5 py-3">
              <Button size="sm" variant="ghost" onClick={() => setExpanded((e) => !e)}>
                {expanded ? t("activity.showLess") : t("activity.showAll", { count: events.length })}
              </Button>
            </div>
          )}
          <p className="px-5 py-3 text-xs text-text-muted">{t("activity.footnote")}</p>
        </>
      )}
    </Panel>
  );
}
