import type { PassboxClient } from "@passbox/client";
import { Logo, Spinner } from "@passbox/ui";
import { useEffect, useState, useSyncExternalStore } from "react";
import { EmergencyKitScreen } from "./auth/EmergencyKitScreen";
import { KitProvider, useKit } from "./auth/KitProvider";
import { UnlockScreen } from "./auth/UnlockScreen";
import { WelcomeScreen } from "./auth/WelcomeScreen";
import { errorMessage, loadClient } from "./core";
import { onLockRequest, setDesktopLockSettings } from "./desktop";
import { clearPasswordDrafts } from "./items/ChangePasswordDialog";
import { clearClipboardNow } from "./lib/clipboard";
import { markUsedBefore } from "./lib/firstRun";
import { useI18n } from "./lib/i18n";
import { usePreferences } from "./lib/preferences";
import { RecoveryFlowProvider, useRecoveryFlow } from "./recovery/RecoveryFlow";
import { RecoveryScreens } from "./recovery/RecoveryScreens";
import { AppShell } from "./shell/AppShell";
import { useSsoCallbackRoute } from "./sso/route";
import { SsoCallbackScreen } from "./sso/SsoCallbackScreen";
import { ClientContext, useSnapshot } from "./useClient";

const noSubscribe = () => () => undefined;

export function App() {
  const { t } = useI18n();
  const [client, setClient] = useState<PassboxClient>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    loadClient()
      .then(setClient)
      .catch((e: unknown) => setError(errorMessage(e)));
  }, []);

  // The desktop app asks to lock from its tray menu, when the window closes and
  // when the computer locks or sleeps.
  useEffect(() => (client ? onLockRequest(() => client.lock()) : undefined), [client]);

  // However the vault locks, a copied secret leaves the clipboard. After an
  // unlock, items that have been in the trash for 30 days are deleted.
  useEffect(() => {
    if (!client) return;
    let status = client.getSnapshot().status;
    return client.subscribe(() => {
      const next = client.getSnapshot().status;
      if (status === "unlocked" && next !== "unlocked") {
        void clearClipboardNow();
        clearPasswordDrafts();
      }
      if (status !== "unlocked" && next === "unlocked") {
        markUsedBefore();
        client.purgeTrash().catch((e: unknown) => console.warn("Could not empty the trash", e));
        // What "Forgot master password?" can offer while locked, and emergency
        // access sealed again after vault key changes (best effort).
        client.refreshRecoveryOptions().catch((e: unknown) => console.warn("Could not load recovery options", e));
        client.resealEmergencyAccess().catch((e: unknown) => console.warn("Could not update emergency access", e));
        // Organizations receive security aggregates (numbers only) at most daily
        // (D6), once the first sync has brought the organizations in.
        setTimeout(() => {
          if (client.getSnapshot().status !== "unlocked") return;
          client.reportSecurityAggregates().catch((e: unknown) => console.warn("Could not report security", e));
        }, 15_000);
      }
      status = next;
    });
  }, [client]);

  // The desktop shell applies these while the window is hidden.
  const { lockOnClose, autoLockMinutes: preferred } = usePreferences();
  // An organization policy can cap the auto-lock time (D2).
  const limit = useSyncExternalStore(
    client?.subscribe ?? noSubscribe,
    () => client?.getSnapshot().effectivePolicy.maxAutoLockMinutes ?? null,
  );
  const autoLockMinutes = limit && preferred > limit ? limit : preferred;
  useEffect(() => {
    setDesktopLockSettings({ lockOnClose, autoLockMinutes }).catch((e: unknown) =>
      console.error("Could not pass the lock settings to the desktop app", e),
    );
  }, [lockOnClose, autoLockMinutes]);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-sm text-danger" role="alert">
        {t("app.startFailed", { error })}
      </div>
    );
  }
  if (!client) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-text-muted">
        <Logo className="text-text" />
        <Spinner label={t("app.loading")} />
      </div>
    );
  }
  return (
    <ClientContext.Provider value={client}>
      <KitProvider>
        <RecoveryFlowProvider>
          <Router />
        </RecoveryFlowProvider>
      </KitProvider>
    </ClientContext.Provider>
  );
}

function Router() {
  const { status } = useSnapshot();
  const kit = useKit();
  const recovery = useRecoveryFlow();
  const ssoCallback = useSsoCallbackRoute();

  // Back from the identity provider (single sign-on).
  if (ssoCallback) return <SsoCallbackScreen />;
  if (kit.open) return <EmergencyKitScreen />;
  if (recovery.screen && status !== "unlocked") return <RecoveryScreens />;
  switch (status) {
    case "signed-out":
      return <WelcomeScreen />;
    case "locked":
      return <UnlockScreen />;
    case "unlocked":
      return <AppShell />;
  }
}
