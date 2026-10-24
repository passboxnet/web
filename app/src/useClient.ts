import type { ClientSnapshot, PassboxClient } from "@passbox/client";
import { createContext, useContext, useSyncExternalStore } from "react";

export const ClientContext = createContext<PassboxClient | undefined>(undefined);

export function useClient(): PassboxClient {
  const client = useContext(ClientContext);
  if (!client) throw new Error("useClient must be used inside ClientContext");
  return client;
}

export function useSnapshot(): ClientSnapshot {
  const client = useClient();
  return useSyncExternalStore(client.subscribe, client.getSnapshot);
}
