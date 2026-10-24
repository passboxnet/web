import type { PassboxClient } from "@passbox/client";
import { useEffect, useState } from "react";
import { loadClient } from "./core";
import { EmergencyKitScreen } from "./screens/EmergencyKitScreen";
import { UnlockScreen } from "./screens/UnlockScreen";
import { VaultScreen } from "./screens/VaultScreen";
import { WelcomeScreen } from "./screens/WelcomeScreen";
import { ClientContext, useSnapshot } from "./useClient";

export function App() {
  const [client, setClient] = useState<PassboxClient>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    loadClient()
      .then(setClient)
      .catch((e: unknown) => setError(String(e)));
  }, []);

  if (error) return <p className="p-8 text-danger">Passbox could not start: {error}</p>;
  if (!client) return null;
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
      return <VaultScreen />;
  }
}
