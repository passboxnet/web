import type { PassboxClient } from "@passbox/client";
import { Logo, Spinner } from "@passbox/ui";
import { useEffect, useState } from "react";
import { EmergencyKitScreen } from "./auth/EmergencyKitScreen";
import { UnlockScreen } from "./auth/UnlockScreen";
import { WelcomeScreen } from "./auth/WelcomeScreen";
import { errorMessage, loadClient } from "./core";
import { onLockRequest } from "./desktop";
import { AppShell } from "./shell/AppShell";
import { ClientContext, useSnapshot } from "./useClient";

export function App() {
  const [client, setClient] = useState<PassboxClient>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    loadClient()
      .then(setClient)
      .catch((e: unknown) => setError(errorMessage(e)));
  }, []);

  // The desktop app asks to lock from its tray menu and when the computer locks or sleeps.
  useEffect(() => (client ? onLockRequest(() => client.lock()) : undefined), [client]);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-sm text-danger" role="alert">
        Passbox could not start: {error}
      </div>
    );
  }
  if (!client) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-text-muted">
        <Logo className="text-text" />
        <Spinner label="Loading" />
      </div>
    );
  }
  return (
    <ClientContext.Provider value={client}>
      <Router />
    </ClientContext.Provider>
  );
}

function Router() {
  const { status } = useSnapshot();
  // Shown once after sign-up, before the vault opens.
  const [newSecretKey, setNewSecretKey] = useState<string>();

  if (newSecretKey) {
    return <EmergencyKitScreen secretKey={newSecretKey} onDone={() => setNewSecretKey(undefined)} />;
  }
  switch (status) {
    case "signed-out":
      return <WelcomeScreen onSignedUp={setNewSecretKey} />;
    case "locked":
      return <UnlockScreen />;
    case "unlocked":
      return <AppShell />;
  }
}
