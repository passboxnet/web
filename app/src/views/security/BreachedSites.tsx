/**
 * Breached websites ("compromised websites") in the security check: the
 * facts of each breach, the in-app banner for newly published breaches and
 * the background refresh of the breach catalogue with notifications.
 *
 * The catalogue is Have I Been Pwned's public list (CC BY 4.0), the same
 * document for everyone; matching against the vault happens on this device
 * (`client.securityReport`). Notifications appear only when the vault has
 * affected logins, and never name a sensitive breach.
 */
import {
  type BreachedSite,
  CREDENTIAL_CLASSES,
  dataClassKey,
  type Finding,
  type SecurityReport,
} from "@passbox/client";
import { Badge, Button } from "@passbox/ui";
import { BrandIcon } from "@passbox/ui/brand-icon";
import { ExternalLink, ShieldAlert, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { desktopNotify } from "../../desktop";
import { type Translator, useI18n } from "../../lib/i18n";
import type { Route } from "../../lib/route";
import { useSecuritySettings } from "../../lib/securitySettings";
import { useClient, useSnapshot } from "../../useClient";

const HIBP_URL = "https://haveibeenpwned.com/";
/** A name, not translated. */
const HIBP_NAME = "Have I Been Pwned";
/** How often an unlocked app checks for a newer catalogue. */
const REFRESH_MS = 6 * 60 * 60 * 1000;
/** Per account (email): the catalogue version the user was last notified about. */
const NOTIFIED_KEY = "passbox.breachNotified";

/** A breach date (`YYYY-MM-DD`) in the locale's format; the raw text if it does not parse. */
export function breachDate(i18n: Translator, date: string): string {
  const ms = Date.parse(`${date}T12:00:00Z`);
  return Number.isNaN(ms) ? date : i18n.date(ms);
}

/** What leaked, translated where Passbox knows the data class ("Passwörter, E-Mail-Adressen"). */
export function dataClassesText(t: Translator["t"], classes: readonly string[], limit = 4): string {
  // Credentials first (passwords before hints): they decide what to do.
  const rank = (c: string) => {
    const index = CREDENTIAL_CLASSES.indexOf(c);
    return index < 0 ? CREDENTIAL_CLASSES.length : index;
  };
  const names = [...classes]
    .sort((a, b) => rank(a) - rank(b))
    .map((c) => {
      const key = dataClassKey(c);
      return key ? t(`security.dataClass.${key}`) : c;
    });
  const shown = names.slice(0, limit);
  return names.length > limit
    ? t("security.breachedSite.more", { list: shown.join(", "), count: names.length - limit })
    : shown.join(", ");
}

/** The detail line of a `breached_site` finding ("Netflix hatte am 3. März 2026 ein Datenleck (…)"). */
export function breachedSiteText(i18n: Translator, finding: Finding, siteName: string): string {
  const { t } = i18n;
  const data = dataClassesText(t, finding.dataClasses ?? []);
  if (!finding.breachDate) {
    return t(finding.possibly ? "security.breachedSite.possiblyUndated" : "security.breachedSite.affectedUndated", {
      site: siteName,
      data,
    });
  }
  const params = { site: siteName, date: breachDate(i18n, finding.breachDate), data };
  return t(finding.possibly ? "security.breachedSite.possibly" : "security.breachedSite.affected", params);
}

/** The breaches behind the `breached_site` category: date, what leaked, how many accounts, source. */
export function BreachFacts({ report }: { report: SecurityReport }) {
  const i18n = useI18n();
  const { t } = i18n;
  const sites = report.breachedSites.filter((s) => s.affected.length + s.possibly.length + s.fixed.length > 0);
  if (sites.length === 0) return null;
  return (
    <section aria-labelledby="breach-facts" className="rounded-card border border-border bg-surface shadow-card">
      <header className="border-b border-border px-5 py-4">
        <h3 id="breach-facts" className="text-sm font-semibold">
          {t("security.breachedSite.factsTitle")}
        </h3>
        <p className="mt-0.5 text-[0.8125rem] text-text-muted">{t("security.breachedSite.factsText")}</p>
      </header>
      <ul className="divide-y divide-border">
        {sites.map((site) => {
          const open = site.affected.length + site.possibly.length;
          return (
            <li key={site.name} className="px-5 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[0.8125rem] font-semibold">{site.title}</span>
                <span className="text-xs text-text-muted">{site.domain}</span>
                {site.exposesCredentials ? (
                  <Badge tone="danger">{t("security.breachedSite.credentials")}</Badge>
                ) : (
                  <Badge tone="neutral">{t("security.breachedSite.noCredentials")}</Badge>
                )}
                {!site.verified && <Badge tone="warning">{t("security.breachedSite.unverified")}</Badge>}
              </div>
              <dl className="mt-2 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-[max-content_1fr]">
                <dt className="text-text-muted">{t("security.breachedSite.when")}</dt>
                <dd>
                  {site.breachDate ? breachDate(i18n, site.breachDate) : t("security.breachedSite.unknownDate")}
                  {site.addedDate && (
                    <span className="text-text-muted">
                      {" "}
                      · {t("security.breachedSite.published", { date: i18n.date(Date.parse(site.addedDate)) })}
                    </span>
                  )}
                </dd>
                <dt className="text-text-muted">{t("security.breachedSite.what")}</dt>
                <dd>{dataClassesText(t, site.dataClasses, 8)}</dd>
                <dt className="text-text-muted">{t("security.breachedSite.accounts")}</dt>
                <dd>
                  {t("security.breachedSite.accountCount", {
                    count: site.pwnCount,
                    number: i18n.number(site.pwnCount),
                  })}
                </dd>
                <dt className="text-text-muted">{t("security.breachedSite.yours")}</dt>
                <dd>{t("security.breachedSite.yourCounts", { open, fixed: site.fixed.length })}</dd>
              </dl>
            </li>
          );
        })}
      </ul>
      <Attribution className="border-t border-border px-5 py-3" />
    </section>
  );
}

/** "Quelle: Have I Been Pwned" with its icon and the license (CC BY 4.0 asks for attribution). */
export function Attribution({ className }: { className?: string }) {
  const { t } = useI18n();
  return (
    <p className={`flex flex-wrap items-center gap-1.5 text-xs text-text-muted ${className ?? ""}`}>
      <BrandIcon service="hibp" size="sm" decorative />
      <span>
        {t("security.breachedSite.source")}{" "}
        <a
          href={HIBP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-accent hover:underline"
        >
          {HIBP_NAME}
          <ExternalLink className="ml-0.5 inline size-3 align-[-1px]" aria-hidden="true" />
          <span className="sr-only">{t("security.opensNewTab")}</span>
        </a>{" "}
        ({t("security.breachedSite.license")})
      </span>
    </p>
  );
}

function notifiedKey(accountId: string | undefined): string | undefined {
  return accountId ? `${NOTIFIED_KEY}.${accountId}` : undefined;
}

/** The notification text for new breaches: never names a sensitive one. */
export function alertText(t: Translator["t"], alerts: readonly BreachedSite[]): { title: string; body: string } {
  const named = alerts.filter((a) => !a.sensitive).map((a) => a.title);
  const logins = new Set(alerts.flatMap((a) => [...a.affected, ...a.possibly])).size;
  const title =
    named.length === 1 && alerts.length === 1
      ? t("security.breachAlert.titleOne", { site: named[0] ?? "" })
      : t("security.breachAlert.titleMany", { count: alerts.length });
  return { title, body: t("security.breachAlert.body", { count: logins }) };
}

/**
 * Keeps the breach catalogue current while the vault is unlocked (at
 * unlock, every six hours, when the tab becomes visible again or the device
 * comes back online) and notifies once per catalogue version when it brings
 * breaches that concern saved logins.
 */
export function useBreachCatalogRefresh() {
  const client = useClient();
  const { t } = useI18n();
  const settings = useSecuritySettings();
  const { email } = useSnapshot();
  const accountId = email;

  useEffect(() => {
    let stopped = false;
    let last = 0;
    async function refresh() {
      if (stopped || Date.now() - last < 60_000) return;
      last = Date.now();
      try {
        const status = await client.refreshBreachCatalog();
        if (stopped || client.getSnapshot().status !== "unlocked") return;
        const alerts = client.breachAlerts(settings);
        const key = notifiedKey(accountId);
        if (alerts.length === 0 || !key) return;
        if (window.localStorage.getItem(key) === status.version) return;
        window.localStorage.setItem(key, status.version);
        const { title, body } = alertText(t, alerts);
        if (await desktopNotify(title, body).catch(() => false)) return;
        if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.hidden) {
          new Notification(title, { body, tag: "passbox-breach", icon: "/favicon.svg" });
        }
      } catch (error) {
        // Offline or an older server: the stored or bundled catalogue stays in use.
        console.warn("Could not refresh the breach catalogue", error);
      }
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), REFRESH_MS);
    const onVisible = () => {
      if (!document.hidden) void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
    };
  }, [client, t, settings, accountId]);
}

/** The in-app banner for newly published breaches of saved logins, until the user looks at them or closes it. */
export function BreachAlertBanner({ navigate }: { navigate: (route: Route) => void }) {
  const client = useClient();
  const snapshot = useSnapshot();
  const { t } = useI18n();
  const settings = useSecuritySettings();
  const [closed, setClosed] = useState(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: the snapshot changes with items and the catalogue.
  const alerts = useMemo(() => client.breachAlerts(settings), [client, snapshot, settings]);
  if (closed || alerts.length === 0) return null;
  const { title, body } = alertText(t, alerts);
  const done = () => {
    client.acknowledgeBreachAlerts();
    setClosed(true);
  };
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-danger/25 bg-danger-soft px-4 py-2.5 text-[0.8125rem]"
    >
      <ShieldAlert className="size-4 shrink-0 text-danger" aria-hidden="true" />
      <p className="min-w-0 flex-1">
        <strong className="font-semibold">{title}</strong> <span>{body}</span>
      </p>
      <Button
        size="sm"
        onClick={() => {
          done();
          navigate({ view: "watchtower" });
        }}
      >
        {t("security.breachAlert.show")}
      </Button>
      <Button size="sm" variant="ghost" onClick={done} aria-label={t("security.breachAlert.close")}>
        <X className="size-4" aria-hidden="true" />
      </Button>
    </div>
  );
}

/** Asks for browser notifications (a click is needed); hidden in the desktop app and when decided. */
export function NotificationPermission() {
  const { t } = useI18n();
  const [permission, setPermission] = useState(
    typeof Notification === "undefined" ? "unsupported" : Notification.permission,
  );
  if ("__TAURI_INTERNALS__" in window || permission === "unsupported") return null;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <p className="min-w-0 flex-1 text-[0.8125rem] text-text-muted">
        {permission === "granted"
          ? t("security.breachAlert.notifyOn")
          : permission === "denied"
            ? t("security.breachAlert.notifyBlocked")
            : t("security.breachAlert.notifyAsk")}
      </p>
      {permission === "default" && (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => void Notification.requestPermission().then((p) => setPermission(p))}
        >
          {t("security.breachAlert.notifyAllow")}
        </Button>
      )}
    </div>
  );
}
