import {
  type AiSettings,
  endpointProblem,
  FEATURES,
  type FeatureId,
  type ModelLocation,
  type ProviderSettings,
  promptApiAvailability,
  providerProblem,
} from "@passbox/ai";
import type { Item } from "@passbox/client";
import { Badge, Button, ConfirmDialog, Input, SegmentedControl, Switch } from "@passbox/ui";
import { ChevronRight, ShieldCheck } from "lucide-react";
import { type ReactNode, useEffect, useId, useState } from "react";
import { useI18n } from "../lib/i18n";
import { itemTitle } from "../lib/items";
import { useClient, useSnapshot } from "../useClient";
import { Panel } from "../views/PageHeader";
import { clearAiLog, setAiSettings, useAiLog, useAiSettings } from "./store";
import { apiKeyOf } from "./useAiGateway";

/** A model name, the same in every language. */
const MODEL_PLACEHOLDER = "llama3.2";

const DEFAULT_PROVIDER: ProviderSettings = { location: "on-device", endpoint: "", model: "" };

const ENDPOINT_PLACEHOLDER: Record<ModelLocation, string> = {
  "on-device": "http://localhost:11434/v1",
  "self-hosted": "https://llm.example.internal/v1",
  cloud: "https://api.mistral.ai/v1",
};

/** The host an endpoint sends to, for "goes to" lines. */
export function endpointHost(endpoint: string): string | undefined {
  try {
    return new URL(endpoint).host || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Settings → AI: off by default, the provider (where the model runs) and
 * one switch per feature, each saying exactly what it sends. Switching a
 * feature on with a cloud provider asks first.
 */
export function AiPanel() {
  const client = useClient();
  const { t, dateTime, number } = useI18n();
  const { items } = useSnapshot();
  const account = client.deviceAccount?.accountId;
  const settings = useAiSettings(account);
  const log = useAiLog(account);
  const [confirm, setConfirm] = useState<FeatureId>();
  const [browserModel, setBrowserModel] = useState<string>();
  const provider = settings.provider ?? DEFAULT_PROVIDER;
  const keyItems = items.filter((i) => !i.data.trashedAt && apiKeyOf(i));
  const ids = { endpoint: useId(), model: useId(), key: useId(), region: useId() };

  useEffect(() => {
    let cancelled = false;
    promptApiAvailability().then((a) => !cancelled && setBrowserModel(a));
    return () => {
      cancelled = true;
    };
  }, []);

  if (!account) return null;
  const save = (next: Partial<AiSettings>) => setAiSettings(account, { ...settings, ...next });
  const saveProvider = (next: { [K in keyof ProviderSettings]?: ProviderSettings[K] | undefined }) => {
    const merged = { ...provider, ...next } as ProviderSettings;
    if (!merged.apiKeyItemId) delete merged.apiKeyItemId;
    if (!merged.jurisdiction) delete merged.jurisdiction;
    save({ provider: merged });
  };
  const endpoint = endpointProblem(provider.endpoint, provider.location);
  const problem = providerProblem(provider);
  const host = endpointHost(provider.endpoint);
  const where =
    provider.location === "on-device" && !provider.endpoint.trim()
      ? t("ai.where.browser")
      : t(`ai.where.${provider.location}`, { host: host ?? "–" });

  function toggleFeature(feature: FeatureId, on: boolean) {
    if (on && provider.location === "cloud") {
      setConfirm(feature);
      return;
    }
    setFeature(feature, on);
  }

  function setFeature(feature: FeatureId, on: boolean) {
    const features = on
      ? [...new Set([...settings.features, feature])]
      : settings.features.filter((f) => f !== feature);
    save({ features, provider });
  }

  return (
    <Panel id="ai" title={t("ai.title")} description={t("ai.description")}>
      <div className="px-5 py-4">
        <Switch
          label={t("ai.enable")}
          description={t("ai.enableDescription")}
          checked={settings.enabled}
          onCheckedChange={(enabled) => save({ enabled, provider })}
        />
      </div>

      {settings.enabled && (
        <>
          <div className="flex flex-col gap-4 px-5 py-4">
            <div>
              <p className="text-[0.8125rem] font-medium">{t("ai.location")}</p>
              <p className="mt-0.5 text-xs text-text-muted">{t(`ai.location.${provider.location}.description`)}</p>
              <div className="mt-2">
                <SegmentedControl<ModelLocation>
                  label={t("ai.location")}
                  value={provider.location}
                  onChange={(location) => saveProvider({ location })}
                  options={[
                    { value: "on-device", label: t("ai.location.on-device") },
                    { value: "self-hosted", label: t("ai.location.self-hosted") },
                    { value: "cloud", label: t("ai.location.cloud") },
                  ]}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                id={ids.endpoint}
                label={t("ai.endpoint")}
                value={provider.endpoint}
                placeholder={ENDPOINT_PLACEHOLDER[provider.location]}
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                onChange={(e) => saveProvider({ endpoint: e.target.value })}
                hint={
                  provider.location === "on-device" && !provider.endpoint.trim()
                    ? t(browserModel === "available" ? "ai.endpoint.browserReady" : "ai.endpoint.browserMissing")
                    : t("ai.endpoint.hint")
                }
                {...(endpoint ? { error: t(`ai.problem.${endpoint}`) } : {})}
              />
              <Input
                id={ids.model}
                label={t("ai.model")}
                value={provider.model}
                placeholder={MODEL_PLACEHOLDER}
                autoComplete="off"
                spellCheck={false}
                disabled={provider.location === "on-device" && !provider.endpoint.trim()}
                onChange={(e) => saveProvider({ model: e.target.value })}
                hint={t("ai.model.hint")}
                {...(problem === "model_missing" ? { error: t("ai.problem.model_missing") } : {})}
              />
              <KeySelect
                id={ids.key}
                items={keyItems}
                value={provider.apiKeyItemId}
                required={provider.location === "cloud"}
                onChange={(apiKeyItemId) => saveProvider({ apiKeyItemId })}
                error={problem === "key_missing" ? t("ai.problem.key_missing") : undefined}
              />
              {provider.location === "cloud" && (
                <Input
                  id={ids.region}
                  label={t("ai.jurisdiction")}
                  value={provider.jurisdiction ?? ""}
                  placeholder={t("ai.jurisdiction.placeholder")}
                  onChange={(e) => saveProvider({ jurisdiction: e.target.value })}
                  hint={t("ai.jurisdiction.hint")}
                />
              )}
            </div>
            {provider.endpoint.trim() && !endpoint && (
              <p className="text-xs text-text-muted">{t("ai.cors", { origin: window.location.origin })}</p>
            )}
          </div>

          <div className="flex flex-col gap-1 px-5 py-4">
            <p className="text-[0.8125rem] font-medium">{t("ai.features")}</p>
            <p className="text-xs text-text-muted">{t("ai.featuresDescription")}</p>
            <div className="mt-3 flex flex-col gap-4">
              {FEATURES.map((feature) => (
                <div key={feature} className="flex flex-col gap-1.5">
                  <Switch
                    label={t(`ai.feature.${feature}`)}
                    description={t(`ai.feature.${feature}.sends`)}
                    checked={settings.features.includes(feature)}
                    disabled={!!problem}
                    onCheckedChange={(on) => toggleFeature(feature, on)}
                  />
                  {settings.features.includes(feature) && (
                    <p className="flex items-center gap-1.5 text-xs text-text-muted">
                      <ShieldCheck className="size-3.5 text-success" aria-hidden="true" />
                      {t("ai.goesTo", { where })}
                    </p>
                  )}
                </div>
              ))}
            </div>
            {problem && <p className="mt-2 text-xs text-text-muted">{t("ai.completeFirst")}</p>}
          </div>
        </>
      )}

      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-4 text-[0.8125rem] font-medium coarse:py-5">
          <ChevronRight
            className="size-4 text-text-muted transition-transform group-open:rotate-90"
            aria-hidden="true"
          />
          {t("ai.log")}
          <Badge tone="neutral">{log.length}</Badge>
        </summary>
        <div className="border-t border-border px-5 py-4">
          <p className="text-xs text-text-muted">{t("ai.log.description")}</p>
          {log.length === 0 ? (
            <p className="mt-3 text-[0.8125rem] text-text-muted">{t("ai.log.empty")}</p>
          ) : (
            <>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[32rem] text-left text-xs">
                  <thead className="text-text-muted">
                    <tr>
                      <Th>{t("ai.log.time")}</Th>
                      <Th>{t("ai.log.feature")}</Th>
                      <Th>{t("ai.log.where")}</Th>
                      <Th>{t("ai.log.classes")}</Th>
                      <Th>{t("ai.log.size")}</Th>
                      <Th>{t("ai.log.outcome")}</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {[...log].reverse().map((e) => (
                      <tr key={`${e.at}-${e.feature}`}>
                        <td className="py-1.5 pr-3 whitespace-nowrap">{dateTime(e.at)}</td>
                        <td className="py-1.5 pr-3">{t(`ai.feature.${e.feature}`)}</td>
                        <td className="py-1.5 pr-3">{t(`ai.location.${e.location}`)}</td>
                        <td className="py-1.5 pr-3 font-mono">{e.classes.join(", ")}</td>
                        <td className="py-1.5 pr-3 whitespace-nowrap">
                          {t("ai.log.bytes", { bytes: number(e.bytes) })}
                        </td>
                        <td className="py-1.5">
                          <Badge tone={e.outcome === "ok" ? "success" : "warning"}>
                            {t(`ai.log.outcome.${e.outcome}`)}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button className="mt-3" variant="secondary" size="sm" onClick={() => clearAiLog(account)}>
                {t("ai.log.clear")}
              </Button>
            </>
          )}
        </div>
      </details>

      <ConfirmDialog
        open={confirm !== undefined}
        onOpenChange={(open) => !open && setConfirm(undefined)}
        title={t("ai.cloudConfirm.title")}
        description={
          confirm ? (
            <span className="flex flex-col gap-2">
              <span>
                {t("ai.cloudConfirm.text", {
                  host: host ?? "–",
                  jurisdiction: provider.jurisdiction || t("ai.cloudConfirm.unknownJurisdiction"),
                })}
              </span>
              <span className="font-medium">{t(`ai.feature.${confirm}.sends`)}</span>
            </span>
          ) : (
            ""
          )
        }
        confirmLabel={t("ai.cloudConfirm.confirm")}
        onConfirm={() => {
          if (confirm) setFeature(confirm, true);
          setConfirm(undefined);
        }}
      />
    </Panel>
  );
}

function Th({ children }: { children: ReactNode }) {
  return (
    <th scope="col" className="py-1.5 pr-3 font-medium">
      {children}
    </th>
  );
}

function KeySelect({
  id,
  items,
  value,
  required,
  onChange,
  error,
}: {
  id: string;
  items: Item[];
  value: string | undefined;
  required: boolean;
  onChange: (id: string | undefined) => void;
  error: string | undefined;
}) {
  const { t } = useI18n();
  const missing = value !== undefined && !items.some((i) => i.id === value);
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[0.8125rem] font-medium">
        {required ? t("ai.apiKey") : t("ai.apiKeyOptional")}
      </label>
      <select
        id={id}
        value={value ?? ""}
        aria-invalid={!!error || missing}
        aria-describedby={`${id}-hint`}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="h-9 rounded-lg border border-border-strong bg-surface px-2.5 text-sm shadow-xs coarse:h-11"
      >
        <option value="">{t("ai.apiKey.none")}</option>
        {items.map((item) => (
          <option key={item.id} value={item.id}>
            {itemTitle(item, t)}
          </option>
        ))}
      </select>
      <p id={`${id}-hint`} className={error || missing ? "text-xs text-danger" : "text-xs text-text-muted"}>
        {missing ? t("ai.apiKey.gone") : (error ?? t("ai.apiKey.hint"))}
      </p>
    </div>
  );
}
