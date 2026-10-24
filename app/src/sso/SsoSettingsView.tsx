import { ApiError, type SsoCheck, type SsoConfig, type SsoSettings, type SsoTestResult } from "@passbox/api-client";
import {
  Badge,
  Button,
  ConfirmDialog,
  cn,
  fieldClassName,
  Input,
  PasswordInput,
  Spinner,
  Switch,
  Textarea,
  toast,
} from "@passbox/ui";
import { ArrowLeft, CircleAlert, CircleCheck, Copy, FlaskConical, PlugZap, Save, Trash2 } from "lucide-react";
import { type FormEvent, type ReactNode, useCallback, useEffect, useState } from "react";
import { FormError } from "../auth/AuthLayout";
import { errorMessage } from "../core";
import { copyToClipboard } from "../lib/clipboard";
import { useI18n } from "../lib/i18n";
import type { Route } from "../lib/route";
import { isOrgAdmin } from "../lib/sharing";
import { orgName } from "../sharing/common";
import { useClient, useSnapshot } from "../useClient";
import { Page, Panel } from "../views/PageHeader";
import { runSsoTest } from "./flow";
import { ssoErrorMessage } from "./messages";
import { EMPTY_SETTINGS, PROVIDERS, preset } from "./providers";
import { ScimPanel } from "./ScimPanel";

const selectClass = cn(fieldClassName, "h-10 px-2.5 coarse:h-12");

/**
 * Single sign-on and provisioning of a team organization (`#/org-sso/{id}`),
 * for owners and admins. Kept apart from the organization admin console so
 * both can evolve independently.
 */
export function SsoSettingsView({ orgId, navigate }: { orgId: string; navigate: (route: Route) => void }) {
  const { t } = useI18n();
  const { orgs } = useSnapshot();
  const org = orgs.find((o) => o.id === orgId);
  const back = (
    <Button variant="secondary" size="sm" onClick={() => navigate({ view: "org", orgId })}>
      <ArrowLeft />
      {org ? orgName(org, t) : t("sharing.title")}
    </Button>
  );
  if (!org || !isOrgAdmin(org) || org.kind !== "team") {
    return (
      <Page title={t("sso.settings.title")}>
        <div className="flex flex-col items-start gap-3 text-[0.8125rem] text-text-muted">
          <p>{org?.kind === "family" ? t("sso.settings.teamOnly") : t("sso.settings.adminsOnly")}</p>
          {back}
        </div>
      </Page>
    );
  }
  return (
    <Page
      title={t("sso.settings.title")}
      description={t("sso.settings.description", { org: orgName(org, t) })}
      actions={back}
    >
      <div className="flex flex-col gap-6">
        <OidcPanel orgId={orgId} />
        <ScimPanel orgId={orgId} />
      </div>
    </Page>
  );
}

function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 text-[0.8125rem]">
      <span className="font-medium">{label}</span>
      {children}
      {hint && <span className="text-xs text-text-muted">{hint}</span>}
    </div>
  );
}

function OidcPanel({ orgId }: { orgId: string }) {
  const client = useClient();
  const { t } = useI18n();
  const [config, setConfig] = useState<SsoConfig | null>();
  const [settings, setSettings] = useState<SsoSettings>(EMPTY_SETTINGS);
  const [secret, setSecret] = useState("");
  const [domains, setDomains] = useState("");
  const [loadError, setLoadError] = useState<string>();
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [check, setCheck] = useState<SsoCheck>();
  const [testing, setTesting] = useState(false);
  const [test, setTest] = useState<SsoTestResult>();
  const [removing, setRemoving] = useState(false);

  const apply = useCallback((loaded: SsoConfig | null) => {
    setConfig(loaded);
    if (loaded) {
      const { hasClientSecret: _s, redirectUri: _r, discovery: _d, updatedAt: _u, ...rest } = loaded;
      setSettings(rest);
      setDomains(loaded.allowedDomains.join("\n"));
    }
  }, []);

  const load = useCallback(() => {
    setLoadError(undefined);
    client.sso
      .config(orgId)
      .then(apply)
      .catch((e: unknown) => setLoadError(errorMessage(e)));
  }, [client, orgId, apply]);
  useEffect(load, [load]);

  const update = (changes: Partial<SsoSettings>) => setSettings((s) => ({ ...s, ...changes }));
  const parsedDomains = domains
    .split(/[\s,;]+/)
    .map((d) => d.trim().replace(/^@/, "").toLowerCase())
    .filter(Boolean);
  const redirectUri = check?.redirectUri ?? config?.redirectUri ?? null;
  const current = preset(settings.provider);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(undefined);
    try {
      const saved = await client.sso.saveConfig(orgId, {
        ...settings,
        allowedDomains: parsedDomains,
        ...(secret ? { clientSecret: secret } : {}),
      });
      apply(saved);
      setSecret("");
      toast.success(saved.enabled ? t("sso.settings.savedOn") : t("sso.settings.saved"));
    } catch (e) {
      if (e instanceof ApiError && e.body?.details?.code === "sso_domain_taken") {
        setError(t("sso.error.sso_domain_taken", { domain: String(e.body.details.domain ?? "") }));
      } else {
        setError(errorMessage(e));
      }
    } finally {
      setSaving(false);
    }
  }

  async function runCheck() {
    setChecking(true);
    setCheck(undefined);
    try {
      setCheck(await client.sso.check(orgId, settings.issuer.trim() || undefined));
    } catch (e) {
      toast.error(t("sso.settings.checkFailed"), { description: errorMessage(e) });
    } finally {
      setChecking(false);
    }
  }

  async function runTest() {
    setTesting(true);
    setTest(undefined);
    try {
      const start = await client.sso.testStart(orgId);
      const result = await runSsoTest(start.authorizationUrl);
      if (result.error || !result.ticket) {
        toast.error(t("sso.test.failed"), { description: ssoErrorMessage(result.error ?? "sso_failed", t) });
        return;
      }
      setTest(await client.sso.testResult(orgId, { ticket: result.ticket, flowSecret: start.flowSecret }));
    } catch (e) {
      const message =
        e instanceof Error && e.message === "popup_blocked"
          ? t("sso.test.popupBlocked")
          : e instanceof Error && e.message === "timeout"
            ? t("sso.test.timeout")
            : errorMessage(e);
      toast.error(t("sso.test.failed"), { description: message });
    } finally {
      setTesting(false);
    }
  }

  async function remove() {
    try {
      await client.sso.removeConfig(orgId);
      setConfig(null);
      setSettings(EMPTY_SETTINGS);
      setDomains("");
      setCheck(undefined);
      setTest(undefined);
      toast.success(t("sso.settings.removed"));
    } catch (e) {
      toast.error(t("sso.settings.removeFailed"), { description: errorMessage(e) });
    }
  }

  if (loadError) {
    return (
      <Panel id="sso-oidc" title={t("sso.settings.oidcTitle")}>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-[0.8125rem] text-danger">
          {loadError}
          <Button size="sm" variant="secondary" onClick={load}>
            {t("action.retry")}
          </Button>
        </div>
      </Panel>
    );
  }
  if (config === undefined) {
    return (
      <Panel id="sso-oidc" title={t("sso.settings.oidcTitle")}>
        <div className="flex justify-center px-5 py-6 text-text-muted">
          <Spinner label={t("app.loading")} />
        </div>
      </Panel>
    );
  }

  return (
    <Panel
      id="sso-oidc"
      title={t("sso.settings.oidcTitle")}
      description={
        <span className="flex flex-wrap items-center gap-2">
          {t("sso.settings.oidcDescription")}
          {config?.enabled ? (
            <Badge tone="success">{t("sso.settings.statusOn")}</Badge>
          ) : (
            <Badge>{config ? t("sso.settings.statusOff") : t("sso.settings.statusNone")}</Badge>
          )}
        </span>
      }
    >
      <form onSubmit={save} className="flex flex-col gap-5 px-5 py-5" aria-label={t("sso.settings.oidcTitle")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("sso.settings.provider")}>
            <select
              aria-label={t("sso.settings.provider")}
              className={selectClass}
              value={settings.provider}
              onChange={(event) => {
                const next = preset(event.target.value as SsoSettings["provider"]);
                update({ provider: next.id, ...(config ? {} : next.defaults) });
              }}
            >
              {PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>
          <Input
            label={t("sso.settings.displayName")}
            value={settings.displayName}
            onChange={(event) => update({ displayName: event.target.value })}
            placeholder={t("sso.settings.displayNamePlaceholder", { provider: current.label })}
            hint={t("sso.settings.displayNameHint")}
            required
            maxLength={80}
          />
        </div>
        <Input
          label={t("sso.settings.issuer")}
          value={settings.issuer}
          onChange={(event) => update({ issuer: event.target.value })}
          placeholder={current.issuerPlaceholder}
          hint={t("sso.settings.issuerHint")}
          type="url"
          inputMode="url"
          spellCheck={false}
          required
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={t("sso.settings.clientId")}
            value={settings.clientId}
            onChange={(event) => update({ clientId: event.target.value })}
            spellCheck={false}
            autoComplete="off"
            required
          />
          <PasswordInput
            label={t("sso.settings.clientSecret")}
            value={secret}
            onChange={(event) => setSecret(event.target.value)}
            autoComplete="new-password"
            placeholder={config?.hasClientSecret ? t("sso.settings.secretStored") : ""}
            hint={t("sso.settings.clientSecretHint")}
          />
        </div>
        <Field
          label={t("sso.settings.redirectUri")}
          hint={redirectUri ? t("sso.settings.redirectUriHint") : t("sso.settings.redirectUriMissing")}
        >
          <span className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg bg-surface-sunken px-3 py-2 font-mono text-xs">
              {redirectUri ?? "—"}
            </code>
            {redirectUri && (
              <Button
                type="button"
                size="icon"
                variant="secondary"
                aria-label={t("sso.settings.copyRedirectUri")}
                onClick={() => void copyToClipboard(redirectUri, t("sso.settings.redirectUri"))}
              >
                <Copy />
              </Button>
            )}
          </span>
        </Field>
        <Textarea
          label={t("sso.settings.domains")}
          value={domains}
          onChange={(event) => setDomains(event.target.value)}
          placeholder="example.com"
          hint={t("sso.settings.domainsHint")}
          rows={2}
          spellCheck={false}
        />

        <details className="rounded-lg border border-border px-4 py-3 text-[0.8125rem]">
          <summary className="cursor-pointer font-medium">{t("sso.settings.advanced")}</summary>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label={t("sso.settings.tokenAuth")}>
              <select
                aria-label={t("sso.settings.tokenAuth")}
                className={selectClass}
                value={settings.tokenAuthMethod}
                onChange={(event) => update({ tokenAuthMethod: event.target.value as SsoSettings["tokenAuthMethod"] })}
              >
                <option value="client_secret_basic">{t("sso.settings.tokenAuth.basic")}</option>
                <option value="client_secret_post">{t("sso.settings.tokenAuth.post")}</option>
                <option value="none">{t("sso.settings.tokenAuth.none")}</option>
              </select>
            </Field>
            <Input
              label={t("sso.settings.scopes")}
              value={settings.scopes}
              onChange={(event) => update({ scopes: event.target.value })}
              spellCheck={false}
            />
            <Input
              label={t("sso.settings.emailClaim")}
              value={settings.emailClaim}
              onChange={(event) => update({ emailClaim: event.target.value })}
              spellCheck={false}
            />
            <Input
              label={t("sso.settings.nameClaim")}
              value={settings.nameClaim}
              onChange={(event) => update({ nameClaim: event.target.value })}
              spellCheck={false}
            />
            <Input
              label={t("sso.settings.groupsClaim")}
              value={settings.groupsClaim}
              onChange={(event) => update({ groupsClaim: event.target.value })}
              spellCheck={false}
            />
            <Input
              label={t("sso.settings.reauthHours")}
              type="number"
              min={1}
              max={720}
              value={String(settings.reauthHours)}
              onChange={(event) => update({ reauthHours: Number(event.target.value) || 1 })}
              hint={t("sso.settings.reauthHoursHint")}
            />
          </div>
          <div className="mt-4">
            <Switch
              checked={settings.requireVerifiedEmail}
              onCheckedChange={(requireVerifiedEmail) => update({ requireVerifiedEmail })}
              label={t("sso.settings.requireVerified")}
              description={t("sso.settings.requireVerifiedText")}
            />
          </div>
        </details>

        <div className="flex flex-col gap-4 border-t border-border pt-5">
          <Switch
            checked={settings.enabled}
            onCheckedChange={(enabled) =>
              update({ enabled, ...(enabled ? {} : { required: false, allowDeviceUnlock: false }) })
            }
            label={t("sso.settings.enabled")}
            description={t("sso.settings.enabledText")}
          />
          <Switch
            checked={settings.required}
            disabled={!settings.enabled}
            onCheckedChange={(required) => update({ required })}
            label={t("sso.settings.required")}
            description={t("sso.settings.requiredText")}
          />
          <Switch
            checked={settings.allowDeviceUnlock}
            disabled={!settings.enabled}
            onCheckedChange={(allowDeviceUnlock) => update({ allowDeviceUnlock })}
            label={t("sso.settings.deviceUnlock")}
            description={t("sso.settings.deviceUnlockText")}
          />
        </div>

        {check && <CheckResult check={check} />}
        <FormError message={error} />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" loading={saving}>
            <Save />
            {t("action.save")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            loading={checking}
            onClick={() => void runCheck()}
            disabled={!settings.issuer}
          >
            <PlugZap />
            {t("sso.settings.check")}
          </Button>
          <Button type="button" variant="secondary" loading={testing} onClick={() => void runTest()} disabled={!config}>
            <FlaskConical />
            {t("sso.test.button")}
          </Button>
          {config && (
            <Button type="button" variant="ghost" className="ml-auto text-danger" onClick={() => setRemoving(true)}>
              <Trash2 />
              {t("sso.settings.remove")}
            </Button>
          )}
        </div>
        {!config && <p className="text-xs text-text-muted">{t("sso.test.saveFirst")}</p>}
      </form>
      {test && <TestResult result={test} />}
      <ConfirmDialog
        open={removing}
        onOpenChange={setRemoving}
        title={t("sso.settings.removeTitle")}
        description={t("sso.settings.removeText")}
        confirmLabel={t("sso.settings.remove")}
        tone="danger"
        onConfirm={() => void remove()}
      />
    </Panel>
  );
}

function CheckResult({ check }: { check: SsoCheck }) {
  const { t } = useI18n();
  return (
    <div
      role="status"
      className={cn(
        "flex gap-3 rounded-lg px-4 py-3 text-[0.8125rem]",
        check.ok ? "bg-success-soft" : "bg-danger-soft",
      )}
      data-testid="sso-check"
    >
      {check.ok ? (
        <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
      ) : (
        <CircleAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
      )}
      <div className="min-w-0">
        <p className="font-medium">
          {check.ok ? t("sso.check.ok", { keys: check.keys }) : ssoErrorMessage(check.problem?.code ?? "sso_failed", t)}
        </p>
        {check.discovery && (
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            <dt className="text-text-muted">{t("sso.check.authorization")}</dt>
            <dd className="truncate font-mono">{check.discovery.authorizationEndpoint}</dd>
            <dt className="text-text-muted">{t("sso.check.token")}</dt>
            <dd className="truncate font-mono">{check.discovery.tokenEndpoint}</dd>
            {check.algorithms.length > 0 && (
              <>
                <dt className="text-text-muted">{t("sso.check.algorithms")}</dt>
                <dd className="font-mono">{check.algorithms.join(", ")}</dd>
              </>
            )}
          </dl>
        )}
      </div>
    </div>
  );
}

function TestResult({ result }: { result: SsoTestResult }) {
  const { t } = useI18n();
  const ok = result.outcome === "ok";
  return (
    <section
      aria-label={t("sso.test.resultTitle")}
      className="border-t border-border px-5 py-5"
      data-testid="sso-test-result"
    >
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        {t("sso.test.resultTitle")}
        <Badge tone={ok ? "success" : "warning"}>{ok ? t("sso.test.wouldSignIn") : t("sso.test.wouldFail")}</Badge>
      </h3>
      {!ok && <p className="mt-2 text-[0.8125rem] text-text-muted">{ssoErrorMessage(result.outcome, t)}</p>}
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[0.8125rem]">
        <dt className="text-text-muted">{t("sso.test.subject")}</dt>
        <dd className="break-all font-mono text-xs">{result.subject}</dd>
        <dt className="text-text-muted">{t("field.email")}</dt>
        <dd className="break-all">
          {result.email ?? "—"}{" "}
          {result.email && (
            <Badge tone={result.emailVerified ? "success" : "warning"}>
              {result.emailVerified ? t("sso.test.verified") : t("sso.test.unverified")}
            </Badge>
          )}
        </dd>
        <dt className="text-text-muted">{t("sso.test.name")}</dt>
        <dd>{result.name || "—"}</dd>
        <dt className="text-text-muted">{t("sso.test.groups")}</dt>
        <dd>{result.groups.length ? result.groups.join(", ") : "—"}</dd>
      </dl>
      <details className="mt-3 text-[0.8125rem]">
        <summary className="cursor-pointer text-text-muted">{t("sso.test.allClaims")}</summary>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-xs">
          {Object.entries(result.claims).map(([name, value]) => (
            <div key={name} className="contents">
              <dt className="text-text-muted">{name}</dt>
              <dd className="break-all">{value}</dd>
            </div>
          ))}
        </dl>
      </details>
    </section>
  );
}
