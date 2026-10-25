/**
 * Device-local settings of the security check: how breach checks reach
 * Have I Been Pwned and which findings to show. Dismissals per item are not
 * here; they are stored in the item and synced.
 */
import type { BreachMode, FindingKind, ReportOptions } from "@passbox/client";
import { useSyncExternalStore } from "react";

export interface SecuritySettings extends ReportOptions {
  breachMode: BreachMode;
}

const KEY = "passbox.security";
const DEFAULTS: SecuritySettings = { breachMode: "auto", oldAfterDays: 365, expiringWithinDays: 60, disabled: [] };

let current: SecuritySettings = load();
const listeners = new Set<() => void>();

function load(): SecuritySettings {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<SecuritySettings>) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

export function getSecuritySettings(): SecuritySettings {
  return current;
}

export function updateSecuritySettings(change: Partial<SecuritySettings>) {
  current = { ...current, ...change };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // Private mode: keep it for this session.
  }
  for (const listener of listeners) listener();
}

export function toggleKind(kind: FindingKind, enabled: boolean) {
  const disabled = current.disabled.filter((k) => k !== kind);
  updateSecuritySettings({ disabled: enabled ? disabled : [...disabled, kind] });
}

export function useSecuritySettings(): SecuritySettings {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
  );
}
