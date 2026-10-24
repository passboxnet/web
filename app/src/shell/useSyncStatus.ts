import { useCallback, useEffect, useState } from "react";
import { useClient } from "../useClient";

const SYNC_INTERVAL_MS = 30_000;

export type SyncState = { kind: "idle"; at: number } | { kind: "syncing" } | { kind: "error"; at: number };

/** Syncs periodically and on focus, and exposes the state for the status indicator. */
export function useSyncStatus(): [SyncState, () => void] {
  const client = useClient();
  const [state, setState] = useState<SyncState>({ kind: "idle", at: Date.now() });

  const sync = useCallback(() => {
    setState({ kind: "syncing" });
    client
      .sync()
      .then(() => setState({ kind: "idle", at: Date.now() }))
      .catch(() => setState({ kind: "error", at: Date.now() }));
  }, [client]);

  useEffect(() => {
    const timer = setInterval(sync, SYNC_INTERVAL_MS);
    window.addEventListener("focus", sync);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", sync);
    };
  }, [sync]);

  return [state, sync];
}
