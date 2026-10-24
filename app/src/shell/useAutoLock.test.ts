// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startAutoLock } from "./useAutoLock";

let stop: (() => void) | undefined;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  stop?.();
  stop = undefined;
  vi.useRealTimers();
});

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", { value: state, configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("startAutoLock", () => {
  it("locks after the inactivity time on the regular check", () => {
    const lock = vi.fn();
    stop = startAutoLock(lock, 1);
    vi.advanceTimersByTime(50_000);
    expect(lock).not.toHaveBeenCalled();
    vi.advanceTimersByTime(10_000);
    expect(lock).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(60_000);
    expect(lock).toHaveBeenCalledTimes(1);
  });

  it("activity postpones the lock", () => {
    const lock = vi.fn();
    stop = startAutoLock(lock, 1);
    vi.advanceTimersByTime(50_000);
    window.dispatchEvent(new Event("keydown"));
    vi.advanceTimersByTime(50_000);
    expect(lock).not.toHaveBeenCalled();
  });

  // Timers do not run while the computer sleeps or are throttled while the
  // window is hidden; the clock moves on anyway.
  describe("after time passed without the timer running", () => {
    let now = 0;
    const clock = () => now;

    beforeEach(() => {
      now = 1_000_000;
    });

    it("re-checks when the page becomes visible", () => {
      const lock = vi.fn();
      stop = startAutoLock(lock, 5, clock);
      now += 6 * 60_000;
      setVisibility("visible");
      expect(lock).toHaveBeenCalledTimes(1);
    });

    it("does not lock on visibility before the time is up", () => {
      const lock = vi.fn();
      stop = startAutoLock(lock, 5, clock);
      now += 4 * 60_000;
      setVisibility("visible");
      expect(lock).not.toHaveBeenCalled();
    });

    it("re-checks on focus and pageshow", () => {
      const onFocus = vi.fn();
      stop = startAutoLock(onFocus, 5, clock);
      now += 6 * 60_000;
      window.dispatchEvent(new Event("focus"));
      expect(onFocus).toHaveBeenCalledTimes(1);
      stop();

      const onPageShow = vi.fn();
      stop = startAutoLock(onPageShow, 5, clock);
      now += 6 * 60_000;
      window.dispatchEvent(new Event("pageshow"));
      expect(onPageShow).toHaveBeenCalledTimes(1);
    });

    it("the first interaction after the time is up locks instead of counting as activity", () => {
      const lock = vi.fn();
      stop = startAutoLock(lock, 5, clock);
      now += 6 * 60_000;
      window.dispatchEvent(new Event("pointerdown"));
      expect(lock).toHaveBeenCalledTimes(1);
    });

    it("stops listening when stopped", () => {
      const lock = vi.fn();
      startAutoLock(lock, 5, clock)();
      now += 6 * 60_000;
      setVisibility("visible");
      window.dispatchEvent(new Event("focus"));
      expect(lock).not.toHaveBeenCalled();
    });
  });
});
