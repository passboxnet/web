import { useEffect } from "react";

const EVENTS = ["pointerdown", "keydown", "wheel", "touchstart"] as const;

/** Calls `lock` after `minutes` without user interaction. */
export function useAutoLock(lock: () => void, minutes: number) {
  useEffect(() => {
    let last = Date.now();
    const touch = () => {
      last = Date.now();
    };
    for (const event of EVENTS) window.addEventListener(event, touch, { passive: true });
    const timer = setInterval(() => {
      if (Date.now() - last > minutes * 60_000) lock();
    }, 10_000);
    return () => {
      clearInterval(timer);
      for (const event of EVENTS) window.removeEventListener(event, touch);
    };
  }, [lock, minutes]);
}
