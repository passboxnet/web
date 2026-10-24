// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const desktop = vi.hoisted(() => ({
  isDesktop: false,
  desktopCopySecret: vi.fn(async (_text: string, _seconds: number) => undefined),
  desktopClearClipboard: vi.fn(async () => undefined),
}));

vi.mock("../desktop", () => ({
  get isDesktop() {
    return desktop.isDesktop;
  },
  desktopCopySecret: desktop.desktopCopySecret,
  desktopClearClipboard: desktop.desktopClearClipboard,
}));

vi.mock("@passbox/ui", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const writeText = vi.fn(async (_text: string) => undefined);
const readText = vi.fn(async () => {
  throw new DOMException("Read permission denied.", "NotAllowedError");
});
let focused = true;

async function load() {
  vi.resetModules();
  return import("./clipboard");
}

beforeEach(() => {
  vi.useFakeTimers();
  focused = true;
  desktop.isDesktop = false;
  writeText.mockClear();
  readText.mockClear();
  desktop.desktopCopySecret.mockClear();
  desktop.desktopClearClipboard.mockClear();
  Object.defineProperty(navigator, "clipboard", { value: { writeText, readText }, configurable: true });
  vi.spyOn(document, "hasFocus").mockImplementation(() => focused);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** Lets pending promise callbacks run. */
async function settle() {
  await vi.advanceTimersByTimeAsync(0);
}

describe("copyToClipboard in the browser", () => {
  it("clears the copied value after the delay without reading the clipboard", async () => {
    const { copyToClipboard } = await load();
    await copyToClipboard("hunter2", "Password");
    expect(writeText).toHaveBeenLastCalledWith("hunter2");

    await vi.advanceTimersByTimeAsync(89_000);
    expect(writeText).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(writeText).toHaveBeenLastCalledWith("");
    expect(writeText).toHaveBeenCalledTimes(2);
    expect(readText).not.toHaveBeenCalled();
  });

  it("waits for focus when the page is in the background", async () => {
    const { copyToClipboard } = await load();
    await copyToClipboard("hunter2", "Password");
    focused = false;
    await vi.advanceTimersByTimeAsync(90_000);
    expect(writeText).toHaveBeenCalledTimes(1);

    focused = true;
    window.dispatchEvent(new Event("focus"));
    await settle();
    expect(writeText).toHaveBeenLastCalledWith("");

    // Only once.
    window.dispatchEvent(new Event("focus"));
    await settle();
    expect(writeText).toHaveBeenCalledTimes(2);
  });

  it("retries on the next focus when the write fails", async () => {
    const { copyToClipboard } = await load();
    await copyToClipboard("hunter2", "Password");
    writeText.mockRejectedValueOnce(new DOMException("Document is not focused.", "NotAllowedError"));
    await vi.advanceTimersByTimeAsync(90_000);
    expect(writeText).toHaveBeenCalledTimes(2);

    window.dispatchEvent(new Event("focus"));
    await settle();
    expect(writeText).toHaveBeenCalledTimes(3);
    expect(writeText).toHaveBeenLastCalledWith("");
  });

  it("does not clear what was copied in the page afterwards", async () => {
    const { copyToClipboard } = await load();
    await copyToClipboard("hunter2", "Password");
    document.dispatchEvent(new Event("copy"));
    await vi.advanceTimersByTimeAsync(120_000);
    expect(writeText).toHaveBeenCalledTimes(1);
  });

  it("restarts the delay for a newer copy", async () => {
    const { copyToClipboard } = await load();
    await copyToClipboard("first", "Password");
    await vi.advanceTimersByTimeAsync(60_000);
    await copyToClipboard("second", "Username");
    await vi.advanceTimersByTimeAsync(60_000);
    expect(writeText).toHaveBeenLastCalledWith("second");
    await vi.advanceTimersByTimeAsync(30_000);
    expect(writeText).toHaveBeenLastCalledWith("");
    expect(writeText).toHaveBeenCalledTimes(3);
  });

  it("clears right away on lock, and not again later", async () => {
    const { clearClipboardNow, copyToClipboard } = await load();
    await copyToClipboard("hunter2", "Password");
    await clearClipboardNow();
    expect(writeText).toHaveBeenLastCalledWith("");
    await vi.advanceTimersByTimeAsync(120_000);
    expect(writeText).toHaveBeenCalledTimes(2);
  });

  it("clears on lock in the background once the page has focus again", async () => {
    const { clearClipboardNow, copyToClipboard } = await load();
    await copyToClipboard("hunter2", "Password");
    focused = false;
    await clearClipboardNow();
    expect(writeText).toHaveBeenCalledTimes(1);

    focused = true;
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    await settle();
    expect(writeText).toHaveBeenLastCalledWith("");
  });

  it("leaves the clipboard alone on lock when nothing was copied", async () => {
    const { clearClipboardNow } = await load();
    await clearClipboardNow();
    expect(writeText).not.toHaveBeenCalled();
  });
});

describe("copyToClipboard in the desktop app", () => {
  it("copies and clears through the shell", async () => {
    desktop.isDesktop = true;
    const { clearClipboardNow, copyToClipboard } = await load();
    await copyToClipboard("hunter2", "Password");
    expect(desktop.desktopCopySecret).toHaveBeenCalledWith("hunter2", 90);
    expect(writeText).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(120_000);
    expect(writeText).not.toHaveBeenCalled();

    await clearClipboardNow();
    expect(desktop.desktopClearClipboard).toHaveBeenCalledTimes(1);
  });
});
