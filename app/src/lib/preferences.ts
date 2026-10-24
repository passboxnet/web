import { useSyncExternalStore } from "react";

export type Theme = "system" | "light" | "dark";

export interface Preferences {
  theme: Theme;
  /** Minutes of inactivity before the vault locks. */
  autoLockMinutes: number;
  /** Seconds until copied secrets are cleared from the clipboard. */
  clipboardClearSeconds: number;
  /** Desktop app: lock the vault when the window is closed (hidden to the tray). */
  lockOnClose: boolean;
}

const KEY = "passbox.preferences";
const DEFAULTS: Preferences = { theme: "system", autoLockMinutes: 15, clipboardClearSeconds: 90, lockOnClose: true };

let current: Preferences = load();
const listeners = new Set<() => void>();

function load(): Preferences {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Preferences>) } : DEFAULTS;
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
