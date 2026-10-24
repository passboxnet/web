import type { SharedVault } from "@passbox/client";
import { toast } from "@passbox/ui";
import { useEffect, useSyncExternalStore } from "react";
import { i18n } from "../lib/i18n";
import { useClient, useSnapshot } from "../useClient";
import { sharingError } from "./common";

let running = 0;
const lockListeners = new Set<() => void>();

function setRunning(delta: number) {
  running += delta;
  for (const listener of lockListeners) listener();
}

/**
 * Runs a sharing change that replaces keys itself (removing a member, a group
 * member or a vault member). Automatic rotation waits meanwhile, so the same
 * vault is never rotated twice at once.
 */
export async function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  setRunning(1);
  try {
    return await fn();
  } finally {
    setRunning(-1);
  }
}

function useBusy(): boolean {
  return useSyncExternalStore(
    (listener) => {
      lockListeners.add(listener);
      return () => lockListeners.delete(listener);
    },
    () => running > 0,
  );
}

/** Vault keys this device already tried to replace, per epoch (once per page load). */
const attempted = new Set<string>();

/** Vaults marked for a new key (a member left) that this account manages and can open. */
export function rotationsDue(vaults: SharedVault[]): SharedVault[] {
  return vaults.filter((v) => v.rotationPending && v.role === "manage" && v.hasKey);
}

/**
 * After someone left or was removed elsewhere, a manager's device replaces
 * the vault keys. Runs automatically while unlocked and says so with a toast.
 */
export function usePendingRotations() {
  const client = useClient();
  const { sharedVaults } = useSnapshot();
  const busy = useBusy();
  const due = busy ? [] : rotationsDue(sharedVaults).filter((v) => !attempted.has(`${v.vaultId}:${v.keyEpoch}`));
  const key = due.map((v) => `${v.vaultId}:${v.keyEpoch}`).join(",");

  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the set of due vaults changes
  useEffect(() => {
    if (due.length === 0) return;
    for (const vault of due) attempted.add(`${vault.vaultId}:${vault.keyEpoch}`);
    const { t } = i18n();
    const orgIds = [...new Set(due.map((v) => v.orgId))];
    const id = toast.loading(t("sharing.rotation.running", { count: due.length }), {
      description: t("sharing.rotation.runningHint"),
    });
    (async () => {
      try {
        await exclusive(async () => {
          for (const orgId of orgIds) await client.rotatePendingVaults(orgId);
        });
        toast.success(t("sharing.rotation.finished", { count: due.length }), { id, description: undefined });
      } catch (error) {
        toast.error(t("sharing.rotation.failed"), { id, description: sharingError(error, t) });
      }
    })();
  }, [key]);
}
