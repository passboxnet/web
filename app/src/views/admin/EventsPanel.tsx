import type { AdminEvent, AdminEvents } from "@passbox/api-client";
import type { Translate } from "@passbox/i18n";
import { Badge, Button, Spinner } from "@passbox/ui";
import { useCallback, useEffect, useState } from "react";
import { errorMessage } from "../../core";
import { useI18n } from "../../lib/i18n";
import { useClient } from "../../useClient";
import { Panel } from "../PageHeader";

const KNOWN = new Set([
  "instance_admin_bootstrap",
  "settings_updated",
  "user_disabled",
  "user_enabled",
  "test_mail_sent",
  "invite_created",
  "invite_used",
  "invite_revoked",
]);
const SETTING_KEYS = new Set([
  "instanceName",
  "registration",
  "allowedDomains",
  "supportUrl",
  "defaultLocale",
  "passwordPolicy",
]);

/** A short, localized description of an admin event. */
export function describeAdminEvent(event: Pick<AdminEvent, "action" | "details">, t: Translate): string {
  const details = event.details ?? {};
  const email = typeof details.email === "string" ? details.email : typeof details.to === "string" ? details.to : "";
  if (event.action === "settings_updated") {
    const changed = Object.keys(details)
      .filter((key) => SETTING_KEYS.has(key))
      .map((key) => t(`admin.events.setting.${key}`));
    return t("admin.events.settings_updated", { settings: changed.join(", ") });
  }
  if (KNOWN.has(event.action)) return t(`admin.events.${event.action}`, { email });
  return event.action;
}

/** The instance audit log of admin actions, with the result of the hash chain check. */
export function EventsPanel({ revision }: { revision: number }) {
  const client = useClient();
  const i18n = useI18n();
  const { t } = i18n;
  const [data, setData] = useState<AdminEvents>();
  const [error, setError] = useState<string>();

  // biome-ignore lint/correctness/useExhaustiveDependencies: reloads when the parent reports a change
  const load = useCallback(() => {
    setError(undefined);
    client.admin
      .adminEvents({ limit: 100 })
      .then(setData)
      .catch((e: unknown) => setError(errorMessage(e)));
  }, [client, revision]);

  useEffect(load, [load]);

  return (
    <Panel id="admin-events" title={t("admin.events.title")} description={t("admin.events.description")}>
      {error ? (
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-[0.8125rem] text-danger">
          {error}
          <Button size="sm" variant="secondary" onClick={load}>
            {t("action.retry")}
          </Button>
        </div>
      ) : !data ? (
        <div className="flex justify-center px-5 py-6 text-text-muted">
          <Spinner label={t("app.loading")} />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 px-5 py-3 text-[0.8125rem]" role="status">
            {data.chain.valid ? (
              <Badge tone="success">{t("admin.events.chainValid", { count: data.chain.length })}</Badge>
            ) : (
              <Badge tone="danger">{t("admin.events.chainBroken", { seq: data.chain.brokenAt ?? 0 })}</Badge>
            )}
            <span className="text-xs text-text-muted">{t("admin.events.chainHint")}</span>
          </div>
          {data.events.length === 0 ? (
            <p className="px-5 py-4 text-[0.8125rem] text-text-muted">{t("admin.events.none")}</p>
          ) : (
            <ul className="divide-y divide-border">
              {data.events.map((event) => (
                <li key={event.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-5 py-3">
                  <span className="w-10 shrink-0 text-xs text-text-subtle tabular-nums">{`#${event.seq}`}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[0.8125rem] font-medium break-words">{describeAdminEvent(event, t)}</p>
                    <p className="text-xs text-text-muted" title={i18n.dateTime(event.createdAt)}>
                      {t("admin.events.meta", {
                        actor: event.actorEmail,
                        time: i18n.relativeTime(event.createdAt),
                        ip: event.ip || "–",
                      })}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Panel>
  );
}
