import { useEffect, useState } from "react";

/** Revealed secrets hide again after this long (S22). */
export const AUTO_HIDE_MS = 30_000;

/**
 * Reveal state for a secret that hides itself after 30 seconds and when the
 * window loses focus, so it never stays visible during screen sharing or
 * when the user walks away.
 */
export function useAutoHide(delay = AUTO_HIDE_MS): [boolean, (revealed: boolean) => void] {
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    if (!revealed) return;
    const hide = () => setRevealed(false);
    const timer = setTimeout(hide, delay);
    const onVisibility = () => document.visibilityState === "hidden" && hide();
    window.addEventListener("blur", hide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("blur", hide);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [revealed, delay]);
  return [revealed, setRevealed];
}
