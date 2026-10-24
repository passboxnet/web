/**
 * Pending AI agent requests (F7), shared by the approval dialog and the
 * sidebar. Polls the server while the vault is unlocked: every few seconds
 * while the page is visible, less often in the background (the desktop app
 * keeps polling while its window is hidden).
 */
import type { AgentRequest, PassboxClient } from "@passbox/client";
import { useSyncExternalStore } from "react";

const VISIBLE_INTERVAL_MS = 4000;
const HIDDEN_INTERVAL_MS = 15000;

let pending: AgentRequest[] = [];
const listeners = new Set<() => void>();
let refreshNow: (() => void) | undefined;

function emit(next: AgentRequest[]) {
  const same = next.length === pending.length && next.every((r, i) => r.id === pending[i]?.id);
  if (same) return;
  pending = next;
  for (const listener of listeners) listener();
}

/** Starts polling for `client`; returns a function that stops it. */
export function startAgentRequestPolling(client: PassboxClient): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let unsupported = false;

  async function tick() {
    if (stopped || unsupported) return;
    try {
      const requests = await client.agentRequests("pending");
      if (!stopped)
        emit(requests.filter((r) => r.expiresAt > Date.now()).sort((a, b) => a.createdAt - b.createdAt));
    } catch (error) {
      // An older server without agent support: stop asking.
      if ((error as { status?: number }).status === 404) unsupported = true;
    }
    if (!stopped) {
      const hidden = typeof document !== "undefined" && document.visibilityState === "hidden";
      timer = setTimeout(() => void tick(), hidden ? HIDDEN_INTERVAL_MS : VISIBLE_INTERVAL_MS);
    }
  }

  refreshNow = () => {
    clearTimeout(timer);
    void tick();
  };
  void tick();
  return () => {
    stopped = true;
    clearTimeout(timer);
    refreshNow = undefined;
    emit([]);
  };
}

/** Asks the server again right away (after a decision). */
export function refreshAgentRequests(): void {
  refreshNow?.();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Requests waiting for this account's decision, oldest first. */
export function usePendingAgentRequests(): AgentRequest[] {
  return useSyncExternalStore(
    subscribe,
    () => pending,
    () => pending,
  );
}

/** Whether a command allowlist entry is a prefix (`terraform *`). */
export function isPrefixPattern(command: string): boolean {
  return command.trimEnd().endsWith("*");
}
