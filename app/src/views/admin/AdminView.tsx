import type { AdminSettings, InstanceSettings, MailLocale, RegistrationMode } from "@passbox/api-client";
import { LOCALE_NAMES } from "@passbox/i18n";
import {
  AlertCard,
  Badge,
  Button,
  cn,
  EmptyState,
  fieldClassName,
  Input,
  SegmentedControl,
  SidebarItem,
  Spinner,
  StatTile,
  Textarea,
  toast,
} from "@passbox/ui";
import { Building2, Inbox, Mail, Save, ScrollText, Send, Server, ShieldAlert, UserCheck, Users } from "lucide-react";
import { type FormEvent, type ReactNode, useCallback, useEffect, useState } from "react";
import { FormError } from "../../auth/AuthLayout";
import { errorMessage } from "../../core";
import { useI18n } from "../../lib/i18n";
import { parseDomains, refreshServerMeta, useIsInstanceAdmin } from "../../lib/instance";
import { useClient } from "../../useClient";
import { ConsoleFrame, ConsoleHeader, ConsoleIdentity, ConsoleNav, ConsolePanel, StatGrid } from "./console";
import { EventsPanel } from "./EventsPanel";
import { InvitesPanel } from "./InvitesPanel";
import { UsersPanel } from "./UsersPanel";

const selectClass = cn(fieldClassName, "h-10 px-2.5 coarse:h-12");

const SECTIONS = [
  { id: "instance", icon: <Server />, title: "admin.settings.title" },
  { id: "mail", icon: <Mail />, title: "admin.mail.title" },
  { id: "invites", icon: <Send />, title: "admin.invites.title" },
  { id: "users", icon: <Users />, title: "admin.users.title" },
  { id: "admin-events", icon: <ScrollText />, title: "admin.events.title" },
] as const;
const SECTION_IDS = SECTIONS.map((section) => section.id);

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
  const active = useActiveSection(SECTION_IDS, data !== undefined);

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
      <ConsoleFrame label={t("admin.title")} nav={null}>
        <ConsoleHeader title={t("admin.title")} />
        <EmptyState
          icon={<ShieldAlert />}
          title={t("admin.notAdmin")}
          className="rounded-card border border-hairline bg-surface"
        />
      </ConsoleFrame>
    );
  }

  const nav = (
    <ConsoleNav
      label={t("admin.console.sections")}
      heading={
        <ConsoleIdentity
          tile={<Server />}
          name={data?.settings.instanceName ?? t("admin.title")}
          caption={t("admin.console.eyebrow")}
        />
      }
    >
      {SECTIONS.map((section) => (
        <SidebarItem
          key={section.id}
          icon={section.icon}
          label={t(section.title)}
          active={active === section.id}
          disabled={!data}
          onClick={() => document.getElementById(section.id)?.scrollIntoView({ block: "start" })}
        />
      ))}
    </ConsoleNav>
  );

  return (
    <ConsoleFrame label={t("admin.title")} nav={nav}>
      <ConsoleHeader
        eyebrow={t("admin.console.eyebrow")}
        title={t("admin.title")}
        description={t("admin.description")}
      />
      {error && (
        <AlertCard
          tone="danger"
          title={error}
          action={
            <Button size="sm" variant="secondary" onClick={load}>
              {t("action.retry")}
            </Button>
          }
        />
      )}
      {!data ? (
        !error && (
          <div className="flex justify-center py-10 text-text-muted">
            <Spinner label={t("app.loading")} />
          </div>
        )
      ) : (
        <>
          <Overview data={data} />
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
        </>
      )}
    </ConsoleFrame>
  );
}

/** The section in view, for the navigation's current item. */
function useActiveSection(ids: readonly string[], ready: boolean): string | undefined {
  const [active, setActive] = useState<string | undefined>(ids[0]);
  useEffect(() => {
    if (!ready || typeof IntersectionObserver === "undefined") return;
    const visible = new Map<string, boolean>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) visible.set(entry.target.id, entry.isIntersecting);
        const first = ids.find((id) => visible.get(id));
        if (first) setActive(first);
      },
      { rootMargin: "0px 0px -55% 0px" },
    );
    for (const id of ids) {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, [ids, ready]);
  return active;
}

/** Big-number tiles: who is on the server and how mail delivery is doing. */
function Overview({ data }: { data: AdminSettings }) {
  const i18n = useI18n();
  const { t } = i18n;
  const { usage, mail } = data;
  return (
    <StatGrid>
      {usage && (
        <>
          <StatTile
            tone="accent"
            icon={<Users />}
            value={i18n.number(usage.accounts)}
            label={t("admin.overview.accounts")}
            detail={t("admin.overview.accountsDetail")}
          />
          <StatTile
            tone="accent"
            icon={<Building2 />}
            value={i18n.number(usage.organizations)}
            label={t("admin.overview.organizations")}
            detail={t("admin.overview.organizationsDetail")}
          />
          <StatTile
            tone="success"
            icon={<UserCheck />}
            value={i18n.number(usage.members)}
            label={t("admin.overview.members")}
            detail={t("admin.overview.membersDetail", {
              guests: usage.guests,
              serviceAccounts: usage.serviceAccounts,
            })}
          />
        </>
      )}
      <StatTile
        tone={mail.failed > 0 || !mail.configured ? "warning" : "neutral"}
        icon={<Inbox />}
        value={i18n.number(mail.pending)}
        label={t("admin.overview.mailQueue")}
        detail={t("admin.overview.mailQueueDetail", { failed: mail.failed })}
      />
    </StatGrid>
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
    <ConsolePanel
      id="instance"
      icon={<Server />}
      title={t("admin.settings.title")}
      description={t("admin.settings.description")}
    >
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
        <Input
          label={t("admin.settings.agentLimit")}
          hint={t("admin.settings.agentLimitHint", { env: data.envAgentLimitPerMember ?? 0 })}
          type="number"
          min={0}
          max={10000}
          placeholder={t("admin.settings.agentLimitPlaceholder", { env: data.envAgentLimitPerMember ?? 0 })}
          value={form.agentLimitPerMember ?? ""}
          data-testid="admin-agent-limit"
          onChange={(e) =>
            set({ agentLimitPerMember: e.target.value === "" ? null : Math.max(0, Math.floor(Number(e.target.value))) })
          }
        />
        <FormError message={error} />
        <div>
          <Button type="submit" loading={busy}>
            <Save />
            {t("admin.settings.save")}
          </Button>
        </div>
      </form>
    </ConsolePanel>
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
    <ConsolePanel
      id="mail"
      icon={<Mail />}
      title={t("admin.mail.title")}
      description={t("admin.mail.description")}
      actions={
        <Button variant="secondary" size="sm" loading={busy} onClick={() => void sendTest()}>
          <Send />
          {t("admin.mail.sendTest")}
        </Button>
      }
    >
      {!mail.configured && (
        <div className="px-5 py-4">
          <AlertCard
            tone="warning"
            title={t("admin.mail.notConfigured")}
            description={t("admin.mail.notConfiguredHint")}
            className="shadow-none"
          />
        </div>
      )}
      <dl className="grid gap-x-8 gap-y-3 px-5 py-4 text-[0.8125rem] sm:grid-cols-[auto_1fr]">
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
        <dd className="tabular-nums">
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
    </ConsolePanel>
  );
}
