/**
 * The AI gateway for the signed-in account. The provider's API key comes
 * from the vault item chosen in the settings and goes only into the HTTP
 * request's Authorization header.
 */
import { AiError, AiGateway, type AiSettings, type FeatureId, providerFromSettings } from "@passbox/ai";
import { FIELD, fieldValue, type Item } from "@passbox/client";
import { useMemo } from "react";
import { useClient, useSnapshot } from "../useClient";
import { appendAiLog, useAiSettings } from "./store";

/** The secret of an API key item: its password, else its first concealed field. */
export function apiKeyOf(item: Item | undefined): string | undefined {
  if (!item) return undefined;
  return (
    fieldValue(item.data, FIELD.password) ??
    item.data.fields.find((f) => f.type === "concealed" && f.value.trim() !== "")?.value
  );
}

export function buildGateway(
  account: string | undefined,
  settings: AiSettings,
  items: readonly Item[],
): { gateway: AiGateway; problem?: AiError } {
  if (!account || !settings.enabled || !settings.provider) return { gateway: AiGateway.disabled() };
  const key = settings.provider.apiKeyItemId
    ? apiKeyOf(items.find((i) => i.id === settings.provider?.apiKeyItemId))
    : undefined;
  try {
    const provider = providerFromSettings(settings.provider, key);
    return { gateway: new AiGateway({ settings, provider, onLog: (entry) => appendAiLog(account, entry) }) };
  } catch (error) {
    return {
      gateway: AiGateway.disabled(),
      problem: error instanceof AiError ? error : new AiError("settings", String(error)),
    };
  }
}

export function useAiGateway(): {
  gateway: AiGateway;
  settings: AiSettings;
  account: string | undefined;
  problem?: AiError;
  enabled: (feature: FeatureId) => boolean;
} {
  const client = useClient();
  const { items } = useSnapshot();
  const account = client.deviceAccount?.accountId;
  const settings = useAiSettings(account);
  return useMemo(() => {
    const built = buildGateway(account, settings, items);
    return { ...built, settings, account, enabled: (f: FeatureId) => built.gateway.isEnabled(f) };
  }, [account, settings, items]);
}
