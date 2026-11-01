import { ALIAS_KEY_HELP, ALIAS_PROVIDER_NAMES, ALIAS_PROVIDERS, AliasError, type AliasProvider } from "@passbox/client";
import { Button, cn, fieldClassName, Input, PasswordInput } from "@passbox/ui";
import { BrandIcon } from "@passbox/ui/brand-icon";
import { AtSign, Copy, ExternalLink } from "lucide-react";
import { type FormEvent, useState } from "react";
import { copyToClipboard } from "../../lib/clipboard";
import { describeError } from "../../lib/errors";
import { useI18n } from "../../lib/i18n";
import { defaultVault } from "../../lib/sharing";
import { useClient, useSnapshot } from "../../useClient";

/** Bundled icons of the alias services (`@passbox/brand-icons`). */
const PROVIDER_ICONS: Record<AliasProvider, string> = {
  simplelogin: "simplelogin",
  addy: "addy",
  fastmail: "fastmail",
  duckduckgo: "duckduckgo",
  firefox_relay: "firefox-relay",
};

/** Email aliases in the generator ("Alias erstellen"): set up a provider once, then create aliases per website. */
export function AliasPanel() {
  const client = useClient();
  const snapshot = useSnapshot();
  const { t } = useI18n();
  const services = client.aliasServices();
  const [setup, setSetup] = useState(false);
  const [serviceId, setServiceId] = useState<string>();
  const [site, setSite] = useState("");
  const [alias, setAlias] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const service = services.find((s) => s.itemId === serviceId) ?? services[0];

  function aliasError(e: unknown): string {
    if (e instanceof AliasError) {
      const provider = ALIAS_PROVIDER_NAMES[e.provider];
      return t(`alias.error.${e.code}`, { provider });
    }
    return describeError(e, t);
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!service) return;
    setBusy(true);
    setError(undefined);
    setAlias(undefined);
    try {
      setAlias(await client.createAlias(service.itemId, site.trim()));
    } catch (e) {
      setError(aliasError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-labelledby="alias-title"
      className="flex flex-col gap-4 rounded-card border border-border bg-surface p-4 shadow-card sm:p-6"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-sunken text-text-muted">
          <AtSign className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 id="alias-title" className="text-sm font-semibold">
            {t("alias.title")}
          </h2>
          <p className="mt-0.5 text-[0.8125rem] text-text-muted">{t("alias.text")}</p>
        </div>
      </div>
      {services.length === 0 || setup ? (
        <AliasSetup
          vaultId={defaultVault(snapshot.vaults, snapshot.orgs)?.id}
          onDone={(id) => {
            setSetup(false);
            if (id) setServiceId(id);
          }}
          canCancel={services.length > 0}
        />
      ) : (
        <form onSubmit={(e) => void create(e)} className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-3">
            {services.length > 1 && (
              <label className="flex flex-col gap-1.5 text-[0.8125rem] font-medium">
                {t("alias.service")}
                <select
                  className={cn(fieldClassName, "h-10 px-2.5 font-normal coarse:h-12")}
                  value={service?.itemId}
                  onChange={(e) => setServiceId(e.target.value)}
                >
                  {services.map((s) => (
                    <option key={s.itemId} value={s.itemId}>
                      {s.title || s.providerName}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="min-w-48 flex-1">
              <Input
                label={t("alias.forSite")}
                placeholder={t("alias.forSitePlaceholder")}
                value={site}
                onChange={(e) => setSite(e.target.value)}
              />
            </div>
            <Button type="submit" loading={busy}>
              {t("alias.create")}
            </Button>
          </div>
          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-text-muted">
            {service && <BrandIcon service={PROVIDER_ICONS[service.provider]} size="sm" decorative />}
            {t("alias.privacy", { provider: service?.providerName ?? "" })}{" "}
            <button type="button" className="font-medium text-accent hover:underline" onClick={() => setSetup(true)}>
              {t("alias.addService")}
            </button>
          </p>
        </form>
      )}
      {alias && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-surface-sunken px-4 py-3">
          <output aria-live="polite" className="min-w-0 flex-1 break-all font-mono text-[0.9375rem]">
            {alias}
          </output>
          <Button size="sm" onClick={() => copyToClipboard(alias, t("alias.copied"))}>
            <Copy />
            {t("action.copy")}
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-[0.8125rem] text-danger">
          {error}
        </p>
      )}
    </section>
  );
}

function AliasSetup({
  vaultId,
  onDone,
  canCancel,
}: {
  vaultId: string | undefined;
  onDone: (id?: string) => void;
  canCancel: boolean;
}) {
  const client = useClient();
  const { t } = useI18n();
  const [provider, setProvider] = useState<AliasProvider>("simplelogin");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [domain, setDomain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const selfHostable = provider === "simplelogin" || provider === "addy";

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!vaultId) return;
    setBusy(true);
    setError(undefined);
    try {
      const id = await client.addAliasService(vaultId, {
        provider,
        apiKey,
        baseUrl: selfHostable ? baseUrl : undefined,
        aliasDomain: provider === "addy" ? domain : undefined,
      });
      onDone(id);
    } catch (e) {
      setError(describeError(e, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void save(e)} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <span id="alias-provider-label" className="text-[0.8125rem] font-medium">
          {t("alias.provider")}
        </span>
        <div
          role="radiogroup"
          aria-labelledby="alias-provider-label"
          className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 sm:grid-cols-3"
        >
          {ALIAS_PROVIDERS.map((p) => (
            // biome-ignore lint/a11y/useSemanticElements: tiles are styled radio buttons
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={provider === p}
              onClick={() => setProvider(p)}
              className={cn(
                "flex min-h-11 items-center gap-2 rounded-lg border bg-surface px-2.5 py-2 text-left text-[0.8125rem] font-medium transition-colors coarse:min-h-12",
                provider === p
                  ? "border-selection-marker ring-2 ring-selection-marker/25"
                  : "border-border hover:border-border-strong",
              )}
            >
              <BrandIcon service={PROVIDER_ICONS[p]} size="sm" decorative />
              <span className="min-w-0 [overflow-wrap:anywhere]">{ALIAS_PROVIDER_NAMES[p]}</span>
            </button>
          ))}
        </div>
      </div>
      <PasswordInput
        label={t("alias.apiKey")}
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        autoComplete="off"
        required
        hint={
          <a
            href={ALIAS_KEY_HELP[provider]}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-accent hover:underline"
          >
            {t("alias.whereKey", { provider: ALIAS_PROVIDER_NAMES[provider] })}
            <ExternalLink className="size-3" aria-hidden="true" />
          </a>
        }
      />
      {selfHostable && (
        <Input
          label={t("alias.server")}
          placeholder={t("alias.serverPlaceholder")}
          hint={t("alias.serverHint")}
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
        />
      )}
      {provider === "addy" && (
        <Input
          label={t("alias.domain")}
          placeholder={t("alias.domainPlaceholder")}
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
        />
      )}
      <p className="text-xs text-text-muted">{t("alias.storeHint")}</p>
      <div className="flex gap-2">
        <Button type="submit" loading={busy} disabled={!vaultId || !apiKey.trim()}>
          {t("alias.save")}
        </Button>
        {canCancel && (
          <Button type="button" variant="ghost" onClick={() => onDone()}>
            {t("action.cancel")}
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-[0.8125rem] text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
