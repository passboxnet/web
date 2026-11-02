/**
 * A sign-in link from `pbx login` (`#/cli-login/{id}#{secret}`). The secret
 * is in the fragment, so no server ever sees it. On load it is kept for this
 * tab (so it survives signing in first) and removed from the address bar;
 * the route keeps only the request ID. It is dropped after an answer or
 * after 10 minutes, when the request has expired anyway.
 */
import { type CliLoginLink, parseCliLoginLink } from "@passbox/client";
import { useSyncExternalStore } from "react";

const KEY = "passbox.cliLogin";
const TTL_MS = 10 * 60 * 1000;

interface Stored extends CliLoginLink {
  savedAt: number;
}

const listeners = new Set<() => void>();

function storage(): Storage | undefined {
  try {
    return window.sessionStorage;
  } catch {
    return undefined;
  }
}

function read(now: number): Stored | undefined {
  try {
    const raw = storage()?.getItem(KEY);
    if (!raw) return undefined;
    const value = JSON.parse(raw) as Partial<Stored>;
    if (typeof value.id !== "string" || typeof value.secret !== "string" || typeof value.savedAt !== "number") {
      return undefined;
    }
    if (now - value.savedAt > TTL_MS || value.savedAt > now) return undefined;
    return { id: value.id, secret: value.secret, savedAt: value.savedAt };
  } catch {
    return undefined;
  }
}

function notify() {
  for (const listener of listeners) listener();
}

/**
 * Keeps a sign-in link from the address bar and replaces the address with
 * `#/cli-login/{id}`. Call before rendering and on every hash change.
 */
export function captureCliLogin(
  location: Pick<Location, "hash" | "pathname" | "search"> = window.location,
  history: Pick<History, "replaceState"> = window.history,
  now: number = Date.now(),
): boolean {
  const link = parseCliLoginLink(location.hash);
  if (!link) return false;
  storage()?.setItem(KEY, JSON.stringify({ ...link, savedAt: now } satisfies Stored));
  history.replaceState(null, "", `${location.pathname}${location.search}#/cli-login/${link.id}`);
  notify();
  return true;
}

/** The secret of the request `id`, if this tab opened its link (in the last 10 minutes). */
export function pendingCliLogin(id: string, now: number = Date.now()): string | undefined {
  const stored = read(now);
  return stored?.id === id ? stored.secret : undefined;
}

/** Drops the kept link after the request was answered (or could not be). */
export function clearPendingCliLogin() {
  storage()?.removeItem(KEY);
  notify();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Whether a sign-in request from pbx is waiting in this tab (for the sign-in screens). */
export function useHasPendingCliLogin(): boolean {
  return useSyncExternalStore(subscribe, () => read(Date.now()) !== undefined);
}
