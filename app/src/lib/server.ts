import { createClient, type PassboxApi } from "@passbox/api-client";
import { isDesktop } from "../desktop";

/**
 * Which Passbox server the app talks to.
 *
 * Served by a Passbox server, the web client uses its own origin. The desktop
 * app, or a user who chose "Use a different server", uses the URL stored here.
 */
const KEY = "passbox.server";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** Normalizes what the user typed to a server URL. Throws an `Error` with a readable message. */
export function parseServerUrl(input: string): string {
  let text = input.trim();
  if (!text) throw new Error("Enter the address of your Passbox server.");
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) text = `https://${text}`;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new Error("This is not a valid address.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Use an address that starts with https:// or http://.");
  }
  if (url.username || url.password) throw new Error("Remove the user name and password from the address.");
  if (url.search || url.hash) throw new Error("Remove everything after ? or # from the address.");
  // The desktop app's content security policy only allows plain HTTP to this computer.
  if (isDesktop && url.protocol === "http:" && !LOCAL_HOSTS.has(url.hostname)) {
    throw new Error("The desktop app connects to https:// servers only (plain http:// works for localhost).");
  }
  return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
}

/** The server chosen on this device, if any. */
export function storedServerUrl(): string | undefined {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? parseServerUrl(raw) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The server this app talks to. `undefined` only in the desktop app before a
 * server has been chosen.
 */
export function serverUrl(): string | undefined {
  return storedServerUrl() ?? (isDesktop ? undefined : window.location.origin);
}

/** Whether "use the server that serves this page" is an option (browsers only). */
export const canUseOwnOrigin = !isDesktop;

/**
 * Stores the server (or forgets it with `undefined`) and reloads the app so
 * every client uses it.
 */
export function changeServer(url: string | undefined) {
  if (url === undefined) window.localStorage.removeItem(KEY);
  else window.localStorage.setItem(KEY, parseServerUrl(url));
  window.location.reload();
}

/** Short form for display, for example `passbox.example.com` or `localhost:8080/vault`. */
export function serverLabel(url: string | undefined = serverUrl()): string {
  if (!url) return "No server";
  const { host, pathname } = new URL(url);
  return pathname === "/" ? host : `${host}${pathname}`;
}

/** An API client without a session for the given server (default: the current one). */
export function serverApi(url: string | undefined = serverUrl()): PassboxApi {
  return createClient({ baseUrl: url ?? "" });
}
