import type { AccountPreferences } from "@passbox/api-client";
import { Switch, toast } from "@passbox/ui";
import { useEffect, useState } from "react";
import { errorMessage } from "../../core";
import { useI18n } from "../../lib/i18n";
import { useClient } from "../../useClient";
import { Panel } from "../PageHeader";

/**
 * Mail notifications from the server. Mails use the language chosen for
 * Passbox, so the panel also keeps the account's mail language in step.
 */
export function NotificationsPanel() {
  const client = useClient();
  const { t, locale } = useI18n();
  const [preferences, setPreferences] = useState<AccountPreferences>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    client
      .preferences()
      .then(async (current) => {
        // Mails follow the language of the app.
        const next = current.locale === locale ? current : await client.updatePreferences({ locale });
        if (!cancelled) setPreferences(next);
      })
      .catch((e: unknown) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [client, locale]);

  async function setNotifyNewDevice(notifyNewDevice: boolean) {
    const previous = preferences;
    if (previous) setPreferences({ ...previous, notifyNewDevice });
    try {
      setPreferences(await client.updatePreferences({ notifyNewDevice }));
    } catch (e) {
      setPreferences(previous);
      toast.error(t("notifications.failed"), { description: errorMessage(e) });
    }
  }

  return (
    <Panel id="notifications" title={t("notifications.title")} description={t("notifications.description")}>
      <div className="px-5 py-4">
        {error ? (
          <p className="text-[0.8125rem] text-danger">{error}</p>
        ) : (
          <Switch
            label={t("notifications.newDevice")}
            description={t("notifications.newDeviceDescription")}
            checked={preferences?.notifyNewDevice ?? true}
            disabled={!preferences}
            onCheckedChange={(checked) => void setNotifyNewDevice(checked)}
          />
        )}
      </div>
    </Panel>
  );
}
