import type { AccountEvent } from "@passbox/api-client";
import { Button, Spinner } from "@passbox/ui";
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
    <Panel id="activity" title={t("term.activity")} description={t("activity.description")}>
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
                        event.kind === "login_failed"
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
