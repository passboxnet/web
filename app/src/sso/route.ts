import { useSyncExternalStore } from "react";

function subscribe(listener: () => void) {
  window.addEventListener("hashchange", listener);
  return () => window.removeEventListener("hashchange", listener);
}

/** Whether the page shows the identity provider's redirect back (`#/sso?…`). */
export function useSsoCallbackRoute(): boolean {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash);
  return hash === "#/sso" || hash.startsWith("#/sso?");
}
