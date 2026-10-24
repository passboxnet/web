import type { AdminSettings, InstanceSettings, MailLocale, RegistrationMode } from "@passbox/api-client";
import { LOCALE_NAMES } from "@passbox/i18n";
import { Badge, Button, cn, fieldClassName, Input, SegmentedControl, Spinner, Textarea, toast } from "@passbox/ui";
import { Mail, Save, ShieldAlert } from "lucide-react";
import { type FormEvent, type ReactNode, useCallback, useEffect, useState } from "react";
import { FormError } from "../../auth/AuthLayout";
import { errorMessage } from "../../core";
import { useI18n } from "../../lib/i18n";
import { parseDomains, refreshServerMeta, useIsInstanceAdmin } from "../../lib/instance";
import { useClient } from "../../useClient";
import { Page, Panel } from "../PageHeader";
import { EventsPanel } from "./EventsPanel";
import { InvitesPanel } from "./InvitesPanel";
import { UsersPanel } from "./UsersPanel";

const selectClass = cn(fieldClassName, "h-10 px-2.5 coarse:h-12");

/** Instance administration for self-hosters (A7, D1). Only instance admins see it. */
export function AdminView() {
  const client = useClient();
  const { t } = useI18n();
  const isAdmin = useIsInstanceAdmin(client);
  const [data, setData] = useState<AdminSettings>();
  const [error, setError] = useState<string>();
  // Bumped after changes so the audit log reloads.
  const [revision, setRevision] = useState(0);
  const changed = useCallback(() => setRevision((r) => r + 1), []);

  const load = useCallback(() => {
    setError(undefined);
    client.admin
      .adminSettings()
      .then(setData)
      .catch((e: unknown) => setError(errorMessage(e)));
  }, [client]);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  if (!isAdmin) {
    return (
      <Page title={t("admin.title")}>
        <p className="flex items-center gap-2 text-sm text-text-muted">
          <ShieldAlert className="size-4" aria-hidden="true" />
          {t("admin.notAdmin")}
        </p>
      </Page>
    );
  }

  return (
    <Page title={t("admin.title")} description={t("admin.description")}>
      {error && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-card border border-danger/30 bg-surface px-5 py-4 text-[0.8125rem] text-danger">
          {error}
          <Button size="sm" variant="secondary" onClick={load}>
            {t("action.retry")}
          </Button>
        </div>
      )}
      {!data ? (
        !error && (
          <div className="flex justify-center py-10 text-text-muted">
            <Spinner label={t("app.loading")} />
          </div>
        )
      ) : (
        <div className="flex flex-col gap-6">
          <SettingsPanel
            data={data}
            onSaved={(next) => {
              setData(next);
              refreshServerMeta();
              changed();
            }}
          />
          <MailPanel
            data={data}
            onSent={() => {
              load();
              changed();
            }}
          />
          <InvitesPanel registration={data.settings.registration} onChange={changed} />
          <UsersPanel onChange={changed} />
          <EventsPanel revision={revision} />
        </div>
      )}
    </Page>
  );
}

function SettingsPanel({ data, onSaved }: { data: AdminSettings; onSaved: (next: AdminSettings) => void }) {
  const client = useClient();
  const { t } = useI18n();
  const [form, setForm] = useState<InstanceSettings>(data.settings);
  const [domains, setDomains] = useState(data.settings.allowedDomains.join("\n"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const set = (changes: Partial<InstanceSettings>) => setForm((current) => ({ ...current, ...changes }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(undefined);
    const allowedDomains = parseDomains(domains);
    if (form.registration === "domains" && allowedDomains.length === 0) {
      setError(t("admin.settings.domainsRequired"));
      return;
    }
    setBusy(true);
    try {
      const next = await client.admin.updateAdminSettings({ ...form, allowedDomains });
      setForm(next.settings);
      setDomains(next.settings.allowedDomains.join("\n"));
      onSaved(next);
      toast.success(t("admin.settings.saved"));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel id="instance" title={t("admin.settings.title")} description={t("admin.settings.description")}>
      <form onSubmit={submit} className="flex flex-col gap-5 px-5 py-5">
        <Input
          label={t("admin.settings.name")}
          hint={t("admin.settings.nameHint")}
          value={form.instanceName}
          maxLength={60}
          required
          onChange={(e) => set({ instanceName: e.target.value })}
        />
        <div className="flex flex-col gap-2">
          <span className="text-[0.8125rem] font-medium">{t("admin.settings.registration")}</span>
          <SegmentedControl<RegistrationMode>
            label={t("admin.settings.registration")}
            value={form.registration}
            onChange={(registration) => set({ registration })}
            options={[
              { value: "open", label: t("admin.registration.open") },
              { value: "invite_only", label: t("admin.registration.invite_only") },
              { value: "domains", label: t("admin.registration.domains") },
            ]}
          />
          <p className="text-xs text-text-muted">{t(`admin.registration.${form.registration}.hint`)}</p>
        </div>
        {form.registration === "domains" && (
          <Textarea
            label={t("admin.settings.domains")}
            hint={t("admin.settings.domainsHint")}
            value={domains}
            rows={3}
            placeholder={t("admin.settings.domainsPlaceholder")}
            onChange={(e) => setDomains(e.target.value)}
          />
        )}
        <Input
          label={t("admin.settings.supportUrl")}
          hint={t("admin.settings.supportUrlHint")}
          value={form.supportUrl}
          placeholder={t("admin.settings.supportUrlPlaceholder")}
          onChange={(e) => set({ supportUrl: e.target.value })}
        />
        <div className="grid gap-5 sm:grid-cols-3">
          <Field label={t("admin.settings.locale")} hint={t("admin.settings.localeHint")}>
            <select
              className={selectClass}
              value={form.defaultLocale}
              aria-label={t("admin.settings.locale")}
              onChange={(e) => set({ defaultLocale: e.target.value as MailLocale })}
            >
              <option value="en">{LOCALE_NAMES.en}</option>
              <option value="de">{LOCALE_NAMES.de}</option>
            </select>
          </Field>
          <Field label={t("admin.settings.minScore")} hint={t("admin.settings.minScoreHint")}>
            <select
              className={selectClass}
              value={form.passwordPolicy.minScore}
              aria-label={t("admin.settings.minScore")}
              onChange={(e) => set({ passwordPolicy: { ...form.passwordPolicy, minScore: Number(e.target.value) } })}
            >
              <option value={3}>{t("strength.3")}</option>
              <option value={4}>{t("strength.4")}</option>
            </select>
          </Field>
          <Input
            label={t("admin.settings.minLength")}
            type="number"
            min={12}
            max={128}
            value={form.passwordPolicy.minLength}
            onChange={(e) =>
              set({ passwordPolicy: { ...form.passwordPolicy, minLength: Number(e.target.value) || 12 } })
            }
          />
        </div>
        <FormError message={error} />
        <div>
          <Button type="submit" loading={busy}>
            <Save />
            {t("admin.settings.save")}
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[0.8125rem] font-medium">{label}</span>
      {children}
      {hint && <span className="text-xs text-text-muted">{hint}</span>}
    </div>
  );
}

function MailPanel({ data, onSent }: { data: AdminSettings; onSent: () => void }) {
  const client = useClient();
  const i18n = useI18n();
  const { t } = i18n;
  const { mail } = data;
  const [busy, setBusy] = useState(false);

  async function sendTest() {
    setBusy(true);
    try {
      const result = await client.admin.sendTestMail();
      if (result.mailConfigured) toast.success(t("admin.mail.testQueued", { email: result.to }));
      else toast.success(t("admin.mail.testLogged"));
      onSent();
    } catch (e) {
      toast.error(t("admin.mail.testFailed"), { description: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel id="mail" title={t("admin.mail.title")} description={t("admin.mail.description")}>
      {!mail.configured && (
        <div role="status" className="flex items-start gap-3 bg-warning-soft px-5 py-4 text-[0.8125rem]">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
          <div>
            <p className="font-semibold">{t("admin.mail.notConfigured")}</p>
            <p className="mt-0.5">{t("admin.mail.notConfiguredHint")}</p>
          </div>
        </div>
      )}
      <dl className="grid gap-x-6 gap-y-3 px-5 py-4 text-[0.8125rem] sm:grid-cols-[auto_1fr]">
        <dt className="text-text-muted">{t("admin.mail.status")}</dt>
        <dd>
          {mail.configured ? (
            <Badge tone="success">{t(`admin.mail.transport.${mail.transport}`)}</Badge>
          ) : (
            <Badge tone="warning">{t("admin.mail.transport.log")}</Badge>
          )}
        </dd>
        {mail.host && (
          <>
            <dt className="text-text-muted">{t("admin.mail.host")}</dt>
            <dd className="font-mono text-xs break-all">{mail.host}</dd>
          </>
        )}
        <dt className="text-text-muted">{t("admin.mail.from")}</dt>
        <dd className="break-all">{mail.from}</dd>
        <dt className="text-text-muted">{t("admin.mail.publicUrl")}</dt>
        <dd className="break-all">{mail.publicUrl ?? t("admin.mail.publicUrlMissing")}</dd>
        <dt className="text-text-muted">{t("admin.mail.queue")}</dt>
        <dd>
          {t("admin.mail.queueValue", { pending: mail.pending, failed: mail.failed })}
          {mail.lastSentAt ? ` · ${t("admin.mail.lastSent", { time: i18n.relativeTime(mail.lastSentAt) })}` : ""}
        </dd>
        {mail.lastError && (
          <>
            <dt className="text-text-muted">{t("admin.mail.lastError")}</dt>
            <dd className="font-mono text-xs break-all text-danger">{mail.lastError}</dd>
          </>
        )}
      </dl>
      <div className="px-5 py-4">
        <Button variant="secondary" size="sm" loading={busy} onClick={() => void sendTest()}>
          <Mail />
          {t("admin.mail.sendTest")}
        </Button>
      </div>
    </Panel>
  );
}
