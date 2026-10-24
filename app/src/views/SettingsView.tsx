import type { ServerMeta } from "@passbox/api-client";
import { LOCALE_NAMES } from "@passbox/i18n";
import { Badge, Button, Monogram, SegmentedControl, Switch } from "@passbox/ui";
import {
  ChevronRight,
  ExternalLink,
  KeyRound,
  LifeBuoy,
  Lock,
  LogOut,
  ShieldAlert,
  ShieldEllipsis,
} from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { useKit } from "../auth/KitProvider";
import { ForgotPasswordDialog, SignOutDialog } from "../auth/SignOutDialog";
import { isDesktop } from "../desktop";
import { ImportExportPanel } from "../export/ImportExportPanel";
import { useI18n } from "../lib/i18n";
import { useIsInstanceAdmin } from "../lib/instance";
import { LINKS } from "../lib/links";
import { type LanguagePreference, setPreferences, type Theme, usePreferences } from "../lib/preferences";
import { serverApi, serverLabel } from "../lib/server";
import { SecurityCodePanel } from "../sharing/SecurityCodePanel";
import { useClient, useSnapshot } from "../useClient";
import { Page, Panel } from "./PageHeader";
import { ActivityPanel } from "./settings/ActivityPanel";
import { ChangeMasterPasswordDialog } from "./settings/ChangeMasterPasswordDialog";
import { DevicesPanel } from "./settings/DevicesPanel";
import { NotificationsPanel } from "./settings/NotificationsPanel";
import { TwoFactorPanel } from "./settings/TwoFactorPanel";

/** A masked Secret Key that reveals nothing but the format (S19). */
export const MASKED_SECRET_KEY = "P1-•••••-•••••-•••••-•••••-••••••";

const selectClass =
  "h-8 rounded-lg border border-border-strong bg-surface px-2.5 text-[0.8125rem] shadow-xs coarse:h-11";

export function SettingsView() {
  const client = useClient();
  const kit = useKit();
  const i18n = useI18n();
  const { t } = i18n;
  const { email = "", vaults, items } = useSnapshot();
  const preferences = usePreferences();
  const [meta, setMeta] = useState<ServerMeta>();
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [changeOpen, setChangeOpen] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const account = client.deviceAccount;
  const isAdmin = useIsInstanceAdmin(client);

  useEffect(() => {
    serverApi()
      .meta()
      .then(setMeta)
      .catch(() => undefined);
  }, []);

  return (
    <Page title={t("term.settings")} description={t("settings.description")}>
      <div className="flex flex-col gap-6">
        <Panel id="account" title={t("settings.account")}>
          <Row label={t("settings.signedInAs")}>
            <span className="flex items-center gap-2.5">
              <Monogram name={email} size="sm" />
              <span className="text-[0.8125rem] font-medium break-all">{email}</span>
            </span>
          </Row>
          <Row label={t("term.emergencyKit")} description={t("settings.kitDescription")}>
            <span className="flex flex-wrap items-center gap-2">
              {kit.pending && <Badge tone="warning">{t("settings.kitPending")}</Badge>}
              <Button variant={kit.pending ? "primary" : "secondary"} size="sm" onClick={kit.requestKit}>
                <KeyRound />
                {t("signOut.showKit")}
              </Button>
            </span>
          </Row>
          <Row label={t("term.secretKey")} description={t("settings.secretKeyDescription")}>
            <code className="font-mono text-xs text-text-muted">
              <span className="sr-only">{t("settings.secretKeyMasked")}</span>
              <span aria-hidden="true">{MASKED_SECRET_KEY}</span>
            </code>
          </Row>
          <Row label={t("term.masterPassword")} description={t("settings.passwordDescription")}>
            <span className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setForgotOpen(true)}>
                {t("forgot.link")}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setChangeOpen(true)}>
                {t("changeMaster.title")}
              </Button>
            </span>
          </Row>
          <Row label={t("settings.contents")}>
            <span className="text-[0.8125rem] text-text-muted">
              {t("settings.contentsValue", { items: items.length, vaults: vaults.length })}
            </span>
          </Row>
        </Panel>

        <TwoFactorPanel />
        <SecurityCodePanel />
        <DevicesPanel />
        <ActivityPanel />
        <NotificationsPanel />

        {isAdmin && (
          <Panel id="administration" title={t("admin.title")}>
            <Row label={t("settings.adminLabel")} description={t("settings.adminDescription")}>
              <a
                href="#/admin"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border-strong bg-surface px-3 text-[0.8125rem] font-medium shadow-xs hover:bg-surface-sunken coarse:h-11"
              >
                <ShieldEllipsis className="size-4" aria-hidden="true" />
                {t("settings.openAdmin")}
              </a>
            </Row>
          </Panel>
        )}

        <Panel id="security" title={t("settings.security")} description={t("settings.securityDescription")}>
          <Row label={t("settings.autoLock")} description={t("settings.autoLockDescription")}>
            <select
              value={preferences.autoLockMinutes}
              onChange={(e) => setPreferences({ autoLockMinutes: Number(e.target.value) })}
              aria-label={t("settings.autoLock")}
              className={selectClass}
            >
              {[1, 5, 15, 30, 60].map((minutes) => (
                <option key={minutes} value={minutes}>
                  {t("settings.afterMinutes", { minutes })}
                </option>
              ))}
            </select>
          </Row>
          <Row label={t("settings.clipboard")} description={t("settings.clipboardDescription")}>
            <select
              value={preferences.clipboardClearSeconds}
              onChange={(e) => setPreferences({ clipboardClearSeconds: Number(e.target.value) })}
              aria-label={t("settings.clipboard")}
              className={selectClass}
            >
              {[30, 60, 90, 180].map((seconds) => (
                <option key={seconds} value={seconds}>
                  {t("settings.afterSeconds", { seconds })}
                </option>
              ))}
            </select>
          </Row>
          {isDesktop && (
            <div className="px-5 py-4">
              <Switch
                label={t("settings.lockOnClose")}
                description={t("settings.lockOnCloseDescription")}
                checked={preferences.lockOnClose}
                onCheckedChange={(lockOnClose) => setPreferences({ lockOnClose })}
              />
            </div>
          )}
          <Row label={t("settings.lockNow")} description={t("settings.lockNowDescription")}>
            <Button variant="secondary" size="sm" onClick={() => client.lock()}>
              <Lock />
              {t("shell.lockVault")}
            </Button>
          </Row>
        </Panel>

        <ImportExportPanel />

        <Panel id="appearance" title={t("settings.appearance")}>
          <Row label={t("settings.language")}>
            <SegmentedControl<LanguagePreference>
              label={t("settings.language")}
              value={preferences.language}
              onChange={(language) => setPreferences({ language })}
              options={[
                { value: "system", label: t("settings.languageSystem") },
                { value: "de", label: LOCALE_NAMES.de },
                { value: "en", label: LOCALE_NAMES.en },
              ]}
            />
          </Row>
          <Row label={t("settings.theme")}>
            <SegmentedControl<Theme>
              label={t("settings.theme")}
              value={preferences.theme}
              onChange={(theme) => setPreferences({ theme })}
              options={[
                { value: "system", label: t("settings.themeSystem") },
                { value: "light", label: t("settings.themeLight") },
                { value: "dark", label: t("settings.themeDark") },
              ]}
            />
          </Row>
        </Panel>

        <Panel id="about" title={t("settings.about")}>
          <div className="flex items-start gap-3 bg-warning-soft px-5 py-4 text-[0.8125rem]">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
            <div>
              <p className="font-semibold">{t("settings.auditTitle")}</p>
              <p className="mt-0.5">{t("notice.preview")}</p>
              <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                <ExternalTextLink href={LINKS.design}>{t("settings.readDesign")}</ExternalTextLink>
                <ExternalTextLink href={LINKS.security}>{t("settings.reportVulnerability")}</ExternalTextLink>
              </p>
            </div>
          </div>
          {meta?.supportUrl && (
            <Row label={t("settings.support")} description={t("settings.supportDescription")}>
              <ExternalTextLink href={meta.supportUrl}>
                <LifeBuoy className="size-3.5" aria-hidden="true" />
                {t("settings.supportLink")}
              </ExternalTextLink>
            </Row>
          )}
          <Row label={t("settings.server")} description={t("settings.serverDescription")}>
            <span className="flex items-center gap-2 text-[0.8125rem] text-text-muted">
              <span>
                {meta?.instanceName && meta.instanceName !== "Passbox"
                  ? `${meta.instanceName} · ${serverLabel()}`
                  : serverLabel()}
              </span>
              {meta && <Badge tone="success">v{meta.version}</Badge>}
            </span>
          </Row>
          <Row label={t("settings.license")}>
            <ExternalTextLink href={LINKS.repository}>{t("settings.licenseValue")}</ExternalTextLink>
          </Row>
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-4 text-[0.8125rem] font-medium coarse:py-5">
              <ChevronRight
                className="size-4 text-text-muted transition-transform group-open:rotate-90"
                aria-hidden="true"
              />
              {t("settings.technical")}
            </summary>
            <dl className="grid gap-x-6 gap-y-3 border-t border-border px-5 py-4 text-[0.8125rem] sm:grid-cols-[auto_1fr]">
              <dt className="text-text-muted">{t("settings.accountId")}</dt>
              <dd>
                <code className="font-mono text-xs break-all">{account?.accountId}</code>
              </dd>
              <dt className="text-text-muted">{t("settings.encryption")}</dt>
              <dd>{t("settings.encryptionValue")}</dd>
              <dt className="text-text-muted">{t("settings.keyDerivation")}</dt>
              <dd>
                {account
                  ? t("settings.kdfValue", {
                      memory: Math.round(account.kdfParams.memoryKib / 1024),
                      iterations: account.kdfParams.iterations,
                      parallelism: account.kdfParams.parallelism,
                    })
                  : ""}
              </dd>
              <dt className="text-text-muted">{t("settings.serverVersion")}</dt>
              <dd>{meta ? `${meta.name} ${meta.version}` : "–"}</dd>
            </dl>
          </details>
        </Panel>

        <section className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-danger/30 bg-surface p-5 shadow-card">
          <div>
            <h2 className="text-sm font-semibold">{t("settings.signOutTitle")}</h2>
            <p className="mt-0.5 text-[0.8125rem] text-text-muted">{t("settings.signOutDescription")}</p>
          </div>
          <Button variant="danger" size="sm" onClick={() => setSignOutOpen(true)}>
            <LogOut />
            {t("signOut.confirm")}
          </Button>
        </section>
      </div>

      <SignOutDialog open={signOutOpen} onOpenChange={setSignOutOpen} />
      <ChangeMasterPasswordDialog open={changeOpen} onOpenChange={setChangeOpen} />
      <ForgotPasswordDialog open={forgotOpen} onOpenChange={setForgotOpen} />
    </Page>
  );
}

function ExternalTextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="inline-flex items-center gap-1 text-[0.8125rem] text-accent hover:underline coarse:py-2"
    >
      {children}
      <ExternalLink className="size-3" aria-hidden="true" />
    </a>
  );
}

function Row({ label, description, children }: { label: string; description?: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-4">
      <div className="min-w-0 max-w-md">
        <p className="text-[0.8125rem] font-medium">{label}</p>
        {description && <p className="mt-0.5 text-xs text-text-muted">{description}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
