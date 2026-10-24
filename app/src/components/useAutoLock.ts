import { useEffect } from "react";

const IDLE_MS = 15 * 60 * 1000;
const EVENTS = ["pointerdown", "keydown", "wheel", "touchstart"] as const;

/** Calls `lock` after 15 minutes without user interaction. */
export function useAutoLock(lock: () => void) {
  useEffect(() => {
    let last = Date.now();
    const touch = () => {
      last = Date.now();
    };
    for (const event of EVENTS) window.addEventListener(event, touch, { passive: true });
    const timer = setInterval(() => {
      if (Date.now() - last > IDLE_MS) lock();
    }, 10_000);
    return () => {
      clearInterval(timer);
      for (const event of EVENTS) window.removeEventListener(event, touch);
    };
  }, [lock]);
}
