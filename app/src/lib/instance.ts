import type { PasswordPolicy, ServerMeta } from "@passbox/api-client";
import type { PassboxClient, Strength } from "@passbox/client";
import { useEffect, useState } from "react";
import { serverApi, serverUrl } from "./server";

/** The clients' own minimum; a server can only make it stricter. */
export const DEFAULT_PASSWORD_POLICY: PasswordPolicy = { minScore: 3, minLength: 12 };

/** Whether a new master password is good enough here and for the server's policy. */
export function meetsPasswordPolicy(
  password: string,
  strength: Strength,
  policy: PasswordPolicy = DEFAULT_PASSWORD_POLICY,
): "ok" | "weak" | "policy" {
  if (!strength.acceptableMasterPassword) return "weak";
  if (strength.score < policy.minScore || [...password].length < policy.minLength) return "policy";
  return "ok";
}

const metaCache = new Map<string, Promise<ServerMeta>>();

/**
 * Public information about the server (instance name, registration mode,
 * password policy). Loaded once per server address; `undefined` while
 * loading or when the server cannot be reached.
 */
export function useServerMeta(): ServerMeta | undefined {
  const url = serverUrl() ?? "";
  const [meta, setMeta] = useState<ServerMeta>();
  useEffect(() => {
    let cancelled = false;
    let request = metaCache.get(url);
    if (!request) {
      request = serverApi().meta();
      metaCache.set(url, request);
      // A failed request is retried the next time.
      request.catch(() => metaCache.delete(url));
    }
    request.then((value) => !cancelled && setMeta(value)).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [url]);
  return meta;
}

/** Forgets the cached server information, for example after an admin changed it. */
export function refreshServerMeta() {
  metaCache.clear();
}

const adminCache = new WeakMap<PassboxClient, { token: string | undefined; value: Promise<boolean> }>();

/** Whether the signed-in account is an instance admin (checked once per unlock). */
export function useIsInstanceAdmin(client: PassboxClient): boolean {
  const [admin, setAdmin] = useState(false);
  const token = client.token;
  useEffect(() => {
    let cancelled = false;
    let cached = adminCache.get(client);
    if (!cached || cached.token !== token) {
      cached = {
        token,
        value: client
          .accountInfo()
          .then((account) => account.instanceAdmin === true)
          .catch(() => false),
      };
      adminCache.set(client, cached);
    }
    cached.value.then((value) => !cancelled && setAdmin(value));
    return () => {
      cancelled = true;
    };
  }, [client, token]);
  return admin;
}

/** An invitation from a link such as `#/?invite=…&email=…`. */
export interface InviteLink {
  token: string;
  email: string;
}

export function inviteFromHash(hash: string = window.location.hash): InviteLink | undefined {
  const query = hash.split("?")[1];
  if (!query) return undefined;
  const params = new URLSearchParams(query);
  const token = params.get("invite");
  if (!token || token.length > 128) return undefined;
  return { token, email: params.get("email") ?? "" };
}

/** Domains for the `domains` registration mode, from text with one or more per line. */
export function parseDomains(text: string): string[] {
  const domains = text
    .split(/[\s,;]+/)
    .map((domain) => domain.trim().replace(/^@/, "").toLowerCase())
    .filter(Boolean);
  return [...new Set(domains)];
}
