import { createClient, type PassboxApi } from "@passbox/api-client";
import { isDesktop } from "../desktop";

/**
 * Which Passbox server the app talks to.
 *
 * Served by a Passbox server, the web client uses its own origin. The desktop
 * app, or a user who chose "Use a different server", uses the URL stored here.
 */
const KEY = "passbox.server";

/** Why an address was rejected. The UI shows `server.error.<code>`. */
export type ServerUrlProblem = "empty" | "invalid" | "scheme" | "credentials" | "query" | "insecure";

export class ServerUrlError extends Error {
  constructor(readonly code: ServerUrlProblem) {
    super(`invalid server address: ${code}`);
    this.name = "ServerUrlError";
  }
}

/** Loopback hosts, where plain http never crosses a network. */
export function isLoopbackHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "[::1]" || /^127(\.\d{1,3}){3}$/.test(hostname);
}

/**
 * Normalizes what the user typed to a server URL. Throws a `ServerUrlError`.
 * Plain http is only accepted for this computer: anywhere else, anyone on the
 * network could read and change what the server sends.
 */
export function parseServerUrl(input: string): string {
  let text = input.trim();
  if (!text) throw new ServerUrlError("empty");
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) text = `https://${text}`;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new ServerUrlError("invalid");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new ServerUrlError("scheme");
  if (url.username || url.password) throw new ServerUrlError("credentials");
  if (url.search || url.hash) throw new ServerUrlError("query");
  if (url.protocol === "http:" && !isLoopbackHost(url.hostname)) throw new ServerUrlError("insecure");
  return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
}

/**
 * True when this page itself was loaded over plain http from another
 * computer. Then a network attacker could change the app and read the
 * master password, so the app shows a warning.
 */
export function isInsecurePage(location: Pick<Location, "protocol" | "hostname"> = window.location): boolean {
  return !isDesktop && location.protocol === "http:" && !isLoopbackHost(location.hostname);
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
  if (!url) return "";
  const { host, pathname } = new URL(url);
  return pathname === "/" ? host : `${host}${pathname}`;
}

/** An API client without a session for the given server (default: the current one). */
export function serverApi(url: string | undefined = serverUrl()): PassboxApi {
  return createClient({ baseUrl: url ?? "" });
}
