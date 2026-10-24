import type { SessionInfo } from "@passbox/api-client";
import { Badge, Button, ConfirmDialog, Spinner, toast } from "@passbox/ui";
import { Globe, Laptop, LogOut, Monitor, Puzzle, Smartphone, Terminal } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { errorMessage } from "../../core";
import { useI18n } from "../../lib/i18n";
import { useClient } from "../../useClient";
import { Panel } from "../PageHeader";

const KIND_ICONS = {
  web: Globe,
  extension: Puzzle,
  desktop: Monitor,
  ios: Smartphone,
  android: Smartphone,
  cli: Terminal,
};

/** Where the account is signed in, with "Sign out" per device (S10). */
export function DevicesPanel() {
  const client = useClient();
  const i18n = useI18n();
  const { t } = i18n;
  const [sessions, setSessions] = useState<SessionInfo[]>();
  const [error, setError] = useState<string>();
  const [revoking, setRevoking] = useState<SessionInfo>();
  const [revokingOthers, setRevokingOthers] = useState(false);

  const load = useCallback(() => {
    setError(undefined);
    client
      .sessions()
      .then((list) =>
        setSessions([...list].sort((a, b) => Number(b.current) - Number(a.current) || b.lastUsedAt - a.lastUsedAt)),
      )
      .catch((e: unknown) => setError(errorMessage(e)));
  }, [client]);

  useEffect(load, [load]);

  async function revoke(session: SessionInfo) {
    try {
      await client.revokeSession(session.id);
      toast.success(t("devices.revoked", { name: deviceLabel(session) }));
      load();
    } catch (e) {
      toast.error(t("devices.revokeFailed"), { description: errorMessage(e) });
    }
  }

  async function revokeOthers() {
    try {
      await client.revokeOtherSessions();
      toast.success(t("devices.revokedOthers"));
      load();
    } catch (e) {
      toast.error(t("devices.revokeFailed"), { description: errorMessage(e) });
    }
  }

  const deviceLabel = (session: SessionInfo) =>
    localizedDeviceName(session.deviceName, t) || t(`devices.kind.${session.clientKind || "unknown"}`);
  const others = sessions?.filter((s) => !s.current) ?? [];

  return (
    <Panel id="devices" title={t("term.devices")} description={t("devices.description")}>
      {error ? (
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-[0.8125rem] text-danger">
          {error}
          <Button size="sm" variant="secondary" onClick={load}>
            {t("action.retry")}
          </Button>
        </div>
      ) : !sessions ? (
        <div className="flex justify-center px-5 py-6 text-text-muted">
          <Spinner label={t("app.loading")} />
        </div>
      ) : (
        <>
          <ul className="divide-y divide-border">
            {sessions.map((session) => {
              const Icon = KIND_ICONS[session.clientKind as keyof typeof KIND_ICONS] ?? Laptop;
              return (
                <li key={session.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-sunken text-text-muted">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-[0.8125rem] font-medium">
                      {deviceLabel(session)}
                      {session.current && <Badge tone="accent">{t("devices.thisDevice")}</Badge>}
                    </p>
                    <p className="text-xs text-text-muted" title={i18n.dateTime(session.lastUsedAt)}>
                      {t("devices.lastActive", { time: i18n.relativeTime(session.lastUsedAt) })}
                      {session.ip && ` · ${t("devices.ip", { ip: session.ip })}`}
                    </p>
                  </div>
                  {!session.current && (
                    <Button size="sm" variant="secondary" onClick={() => setRevoking(session)}>
                      <LogOut />
                      {t("action.signOut")}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
          {others.length > 0 && (
            <div className="flex justify-end px-5 py-3">
              <Button size="sm" variant="ghost" className="text-danger" onClick={() => setRevokingOthers(true)}>
                {t("devices.signOutOthers")}
              </Button>
            </div>
          )}
        </>
      )}
      <ConfirmDialog
        open={revoking !== undefined}
        onOpenChange={(open) => !open && setRevoking(undefined)}
        title={t("devices.confirmTitle", { name: revoking ? deviceLabel(revoking) : "" })}
        description={t("devices.confirmText")}
        confirmLabel={t("action.signOut")}
        tone="danger"
        onConfirm={() => revoking && void revoke(revoking)}
      />
      <ConfirmDialog
        open={revokingOthers}
        onOpenChange={setRevokingOthers}
        title={t("devices.othersTitle")}
        description={t("devices.othersText", { count: others.length })}
        confirmLabel={t("devices.signOutOthers")}
        tone="danger"
        onConfirm={() => void revokeOthers()}
      />
    </Panel>
  );
}

/** Device names are stored as "Chrome on Windows"; show them in the user's language. */
export function localizedDeviceName(name: string, t: (key: string, params?: Record<string, string>) => string): string {
  const match = /^(.+) on (.+)$/.exec(name);
  return match ? t("devices.nameOn", { app: match[1] ?? "", os: match[2] ?? "" }) : name;
}
