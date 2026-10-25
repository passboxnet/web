/**
 * AI settings and the local AI log, per account and per device (browser
 * storage). Off by default. The API key itself is a vault item; settings
 * hold its ID only. The log holds metadata of requests (feature, provider,
 * data classes, size, outcome), never their content.
 */
import { type AiLogEntry, type AiSettings, DEFAULT_AI_SETTINGS, parseAiSettings } from "@passbox/ai";
import { useSyncExternalStore } from "react";

const SETTINGS_KEY = (account: string) => `passbox.ai.${account}`;
const LOG_KEY = (account: string) => `passbox.ai.log.${account}`;
const LOG_LIMIT = 50;

const listeners = new Set<() => void>();
const cache = new Map<string, { settings: AiSettings; log: AiLogEntry[] }>();

function read<T>(key: string, parse: (raw: unknown) => T, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? parse(JSON.parse(raw)) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be full or blocked; the settings stay for this session.
  }
}

function parseLog(raw: unknown): AiLogEntry[] {
  return Array.isArray(raw) ? (raw.filter((e) => e && typeof e === "object") as AiLogEntry[]).slice(-LOG_LIMIT) : [];
}

function entry(account: string) {
  let state = cache.get(account);
  if (!state) {
    state = {
      settings: read(SETTINGS_KEY(account), parseAiSettings, { ...DEFAULT_AI_SETTINGS, features: [] }),
      log: read(LOG_KEY(account), parseLog, []),
    };
    cache.set(account, state);
  }
  return state;
}

function notify() {
  for (const listener of listeners) listener();
}

export function getAiSettings(account: string | undefined): AiSettings {
  return account ? entry(account).settings : DEFAULT_AI_SETTINGS;
}

export function setAiSettings(account: string, settings: AiSettings) {
  const state = entry(account);
  cache.set(account, { ...state, settings: parseAiSettings(settings) });
  write(SETTINGS_KEY(account), parseAiSettings(settings));
  notify();
}

export function appendAiLog(account: string, item: AiLogEntry) {
  const state = entry(account);
  const log = [...state.log, item].slice(-LOG_LIMIT);
  cache.set(account, { ...state, log });
  write(LOG_KEY(account), log);
  notify();
}

export function clearAiLog(account: string) {
  const state = entry(account);
  cache.set(account, { ...state, log: [] });
  write(LOG_KEY(account), []);
  notify();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const EMPTY_LOG: AiLogEntry[] = [];

export function useAiSettings(account: string | undefined): AiSettings {
  return useSyncExternalStore(subscribe, () => getAiSettings(account));
}

export function useAiLog(account: string | undefined): AiLogEntry[] {
  return useSyncExternalStore(subscribe, () => (account ? entry(account).log : EMPTY_LOG));
}
