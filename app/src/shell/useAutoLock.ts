import { useEffect } from "react";

const ACTIVITY_EVENTS = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
/** How often the timer checks while nothing else happens. */
const CHECK_INTERVAL_MS = 10_000;

/**
 * Calls `lock` after `minutes` without user interaction. Returns a function
 * that stops watching.
 *
 * Timers are throttled in background tabs and stop while the computer sleeps,
 * so the time is also checked as soon as the page becomes visible or focused
 * again (`visibilitychange`, `focus`, `pageshow`), before it shows the vault
 * again, and before an interaction counts as activity: the click that brings
 * the window back must not keep an expired vault open.
 */
export function startAutoLock(lock: () => void, minutes: number, now: () => number = Date.now): () => void {
  const limit = minutes * 60_000;
  let last = now();
  let locked = false;

  const check = () => {
    if (!locked && now() - last >= limit) {
      locked = true;
      lock();
    }
  };
  const touch = () => {
    check();
    if (!locked) last = now();
  };
  const onVisibility = () => {
    if (document.visibilityState === "visible") check();
  };

  for (const event of ACTIVITY_EVENTS) window.addEventListener(event, touch, { capture: true, passive: true });
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("focus", check);
  window.addEventListener("pageshow", check);
  const timer = setInterval(check, CHECK_INTERVAL_MS);

  return () => {
    clearInterval(timer);
    for (const event of ACTIVITY_EVENTS) window.removeEventListener(event, touch, { capture: true });
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("focus", check);
    window.removeEventListener("pageshow", check);
  };
}

/** Calls `lock` after `minutes` without user interaction. See {@link startAutoLock}. */
export function useAutoLock(lock: () => void, minutes: number) {
  useEffect(() => startAutoLock(lock, minutes), [lock, minutes]);
}
