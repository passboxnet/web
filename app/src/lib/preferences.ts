import type { Locale } from "@passbox/i18n";
import { useSyncExternalStore } from "react";

export type Theme = "system" | "light" | "dark";
export type LanguagePreference = "system" | Locale;

/** Steps of the first-run checklist the user ticked off by hand. */
export interface ChecklistState {
  dismissed: boolean;
  extension: boolean;
  phone: boolean;
  import: boolean;
  securityCheck: boolean;
}

export interface Preferences {
  theme: Theme;
  /** Minutes of inactivity before the vault locks. */
  autoLockMinutes: number;
  /** Seconds until copied secrets are cleared from the clipboard. */
  clipboardClearSeconds: number;
  /** Desktop app: lock the vault when the window is closed (hidden to the tray). */
  lockOnClose: boolean;
  /** "system" follows the browser's preferred languages. */
  language: LanguagePreference;
  /** "Website-Icons anzeigen": load the icons of saved websites through the user's server. */
  showWebsiteIcons: boolean;
  checklist: ChecklistState;
}

const KEY = "passbox.preferences";
const DEFAULTS: Preferences = {
  theme: "system",
  autoLockMinutes: 15,
  clipboardClearSeconds: 90,
  lockOnClose: true,
  language: "system",
  showWebsiteIcons: true,
  checklist: { dismissed: false, extension: false, phone: false, import: false, securityCheck: false },
};

let current: Preferences = load();
const listeners = new Set<() => void>();

function load(): Preferences {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const stored = JSON.parse(raw) as Partial<Preferences>;
    return { ...DEFAULTS, ...stored, checklist: { ...DEFAULTS.checklist, ...stored.checklist } };
  } catch {
    return DEFAULTS;
  }
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
}

export function getPreferences(): Preferences {
  return current;
}

export function setPreferences(update: Partial<Preferences>) {
  current = { ...current, ...update };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // Preferences are a convenience; ignore storage failures.
  }
  applyTheme(current.theme);
  for (const listener of listeners) listener();
}

export function usePreferences(): Preferences {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
  );
}

/** Calls `listener` after every change. Returns a function that stops listening. */
export function subscribePreferences(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Marks steps of the first-run checklist. */
export function setChecklist(update: Partial<ChecklistState>) {
  setPreferences({ checklist: { ...current.checklist, ...update } });
}
