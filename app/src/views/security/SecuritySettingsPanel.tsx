import type { BreachMode, EmailMonitoring, FindingKind, MonitoredEmail } from "@passbox/client";
import { Badge, Button, ConfirmDialog, cn, fieldClassName, Input, SegmentedControl, Switch, toast } from "@passbox/ui";
import { BrandIcon } from "@passbox/ui/brand-icon";
import { Mail, RefreshCw, Trash2 } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { describeError } from "../../lib/errors";
import { useI18n } from "../../lib/i18n";
import { useServerMeta } from "../../lib/instance";
import { toggleKind, updateSecuritySettings, useSecuritySettings } from "../../lib/securitySettings";
import { useClient } from "../../useClient";
import { Panel } from "../PageHeader";

const OLD_AFTER = [0, 180, 365, 730];
const EXPIRING = [30, 60, 90, 180];
/** Findings the user may turn off entirely. */
const OPTIONAL: FindingKind[] = [
  "old",
  "passkey_available",
  "missing_url",
  "missing_username",
  "totp_in_same_item",
  "duplicate",
];

/** Settings of the security check: breach check route, thresholds, optional findings and email monitoring. */
export function SecuritySettingsPanel() {
  const { t } = useI18n();
  const settings = useSecuritySettings();
  const meta = useServerMeta();
  const proxy = meta?.breachProxy === true;
  return (
    <div className="flex flex-col gap-6">
      <EmailMonitoringPanel available={meta?.emailMonitoring === true} />
      <Panel id="security-settings" title={t("security.settings.title")} description={t("security.settings.text")}>
        <div className="flex flex-col gap-2 px-5 py-4">
          <SegmentedControl<BreachMode>
            label={t("security.settings.route")}
            value={settings.breachMode}
            onChange={(breachMode) => updateSecuritySettings({ breachMode })}
            options={[
              { value: "auto", label: t("security.settings.routeAuto") },
              { value: "server", label: t("security.settings.routeServer") },
              { value: "direct", label: t("security.settings.routeDirect") },
            ]}
          />
          <p className="flex items-start gap-2 text-xs text-text-muted">
            <BrandIcon service="hibp" size="sm" decorative />
            <span>
              {t(`security.settings.routeHint.${settings.breachMode}`)}{" "}
              {meta && !proxy && t("security.settings.noProxy")}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-4 px-5 py-4">
          <label className="flex flex-col gap-1.5 text-[0.8125rem] font-medium">
            {t("security.settings.oldAfter")}
            <select
              className={cn(fieldClassName, "h-10 px-2.5 font-normal coarse:h-12")}
              value={settings.oldAfterDays}
              onChange={(e) => updateSecuritySettings({ oldAfterDays: Number(e.target.value) })}
            >
              {OLD_AFTER.map((days) => (
                <option key={days} value={days}>
                  {days === 0 ? t("security.settings.never") : t("security.settings.days", { count: days })}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-[0.8125rem] font-medium">
            {t("security.settings.expiring")}
            <select
              className={cn(fieldClassName, "h-10 px-2.5 font-normal coarse:h-12")}
              value={settings.expiringWithinDays}
              onChange={(e) => updateSecuritySettings({ expiringWithinDays: Number(e.target.value) })}
            >
              {EXPIRING.map((days) => (
                <option key={days} value={days}>
                  {t("security.settings.days", { count: days })}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex flex-col gap-4 px-5 py-4">
          {OPTIONAL.map((kind) => (
            <Switch
              key={kind}
              checked={!settings.disabled.includes(kind)}
              onCheckedChange={(on) => toggleKind(kind, on)}
              label={t(`security.kind.${kind}.title`)}
              description={t(`security.kind.${kind}.summary`)}
            />
          ))}
        </div>
      </Panel>
    </div>
  );
}

function EmailMonitoringPanel({ available }: { available: boolean }) {
  const client = useClient();
  const i18n = useI18n();
  const { t } = i18n;
  const [state, setState] = useState<EmailMonitoring>();
  const [error, setError] = useState<string>();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<MonitoredEmail>();

  useEffect(() => {
    if (!available) return;
    let cancelled = false;
    client
      .emailMonitoring()
      .then((value) => !cancelled && setState(value))
      .catch((e: unknown) => !cancelled && setError(describeError(e, t)));
    return () => {
      cancelled = true;
    };
  }, [client, available, t]);

  async function act(action: () => Promise<unknown>) {
    setBusy(true);
    setError(undefined);
    try {
      await action();
      setState(await client.emailMonitoring());
    } catch (e) {
      setError(describeError(e, t));
    } finally {
      setBusy(false);
    }
  }

  async function add(event: FormEvent) {
    event.preventDefault();
    if (!email.trim()) return;
    await act(async () => {
      await client.addMonitoredEmail(email.trim(), i18n.locale);
      setEmail("");
      toast.success(t("security.monitor.codeSent"));
    });
  }

  return (
    <Panel id="email-monitoring" title={t("security.monitor.title")} description={t("security.monitor.text")}>
      {!available ? (
        <p className="px-5 py-4 text-[0.8125rem] text-text-muted">{t("security.monitor.unavailable")}</p>
      ) : (
        <>
          {state?.emails.map((entry) => (
            <MonitoredRow
              key={entry.id}
              entry={entry}
              busy={busy}
              onVerify={(code) => act(() => client.verifyMonitoredEmail(entry.id, code))}
              onCheck={() => act(() => client.checkMonitoredEmail(entry.id))}
              onResend={() => act(() => client.addMonitoredEmail(entry.email, i18n.locale))}
              onRemove={() => setRemoving(entry)}
            />
          ))}
          <form onSubmit={(e) => void add(e)} className="flex flex-col gap-3 px-5 py-4">
            <p className="text-xs text-text-muted">{t("security.monitor.consent")}</p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-60 flex-1">
                <Input
                  type="email"
                  label={t("security.monitor.add")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
              <Button type="submit" loading={busy}>
                <Mail className="size-4" aria-hidden="true" />
                {t("security.monitor.addAction")}
              </Button>
            </div>
          </form>
        </>
      )}
      {error && (
        <p role="alert" className="px-5 py-3 text-[0.8125rem] text-danger">
          {error}
        </p>
      )}
      <ConfirmDialog
        open={removing !== undefined}
        onOpenChange={(open) => !open && setRemoving(undefined)}
        title={t("security.monitor.removeTitle")}
        description={t("security.monitor.removeText", { email: removing?.email ?? "" })}
        confirmLabel={t("security.monitor.remove")}
        tone="danger"
        onConfirm={() => {
          const entry = removing;
          setRemoving(undefined);
          if (entry) void act(() => client.removeMonitoredEmail(entry.id));
        }}
      />
    </Panel>
  );
}

function MonitoredRow({
  entry,
  busy,
  onVerify,
  onCheck,
  onResend,
  onRemove,
}: {
  entry: MonitoredEmail;
  busy: boolean;
  onVerify: (code: string) => Promise<void>;
  onCheck: () => Promise<void>;
  onResend: () => Promise<void>;
  onRemove: () => void;
}) {
  const i18n = useI18n();
  const { t } = i18n;
  const [code, setCode] = useState("");
  return (
    <div className="flex flex-col gap-3 px-5 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-medium">{entry.email}</span>
        {!entry.verified ? (
          <Badge tone="warning">{t("security.monitor.unconfirmed")}</Badge>
        ) : entry.breaches.length > 0 ? (
          <Badge tone="danger">{t("security.monitor.breaches", { count: entry.breaches.length })}</Badge>
        ) : (
          <Badge tone="success">{t("security.monitor.clean")}</Badge>
        )}
        {entry.verified && (
          <Button size="sm" variant="ghost" onClick={() => void onCheck()} disabled={busy}>
            <RefreshCw className="size-3.5" aria-hidden="true" />
            {t("security.monitor.check")}
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={onRemove}
          aria-label={t("security.monitor.removeLabel", { email: entry.email })}
        >
          <Trash2 className="size-3.5" aria-hidden="true" />
        </Button>
      </div>
      {!entry.verified && (
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void onVerify(code).then(() => setCode(""));
          }}
        >
          <div className="w-40">
            <Input
              label={t("security.monitor.code")}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={8}
            />
          </div>
          <Button type="submit" loading={busy} disabled={code.trim().length < 6}>
            {t("security.monitor.confirm")}
          </Button>
          <Button type="button" variant="ghost" onClick={() => void onResend()} disabled={busy}>
            {t("security.monitor.resend")}
          </Button>
        </form>
      )}
      {entry.verified && (
        <p className="text-xs text-text-muted">
          {entry.checkError
            ? entry.checkError
            : entry.checkedAt > 0
              ? t("security.monitor.checked", { time: i18n.relativeTime(entry.checkedAt) })
              : t("security.monitor.pending")}
        </p>
      )}
      {entry.breaches.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {entry.breaches.map((breach) => (
            <li key={breach.name} className="rounded-md bg-surface-sunken px-3 py-2 text-xs">
              <span className="font-medium">{breach.title}</span>
              {breach.domain && <span className="text-text-muted"> · {breach.domain}</span>}
              <span className="text-text-muted"> · {breach.breachDate}</span>
              {breach.dataClasses.length > 0 && (
                <span className="mt-0.5 block text-text-muted">{breach.dataClasses.join(", ")}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
