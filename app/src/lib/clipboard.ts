import { toast } from "@passbox/ui";
import { desktopClearClipboard, desktopCopySecret, isDesktop } from "../desktop";
import { getPreferences } from "./preferences";

/*
 * Browsers only let a page write to the clipboard while it has focus, and do
 * not let it read without a permission prompt. So the web client never reads:
 * it remembers the secret it copied and writes "" when the time is up, unless
 * something else was copied in this page since. If the page is in the
 * background then, clearing waits until it is focused again. Locking clears
 * right away (or as soon as the page has focus).
 *
 * In the desktop app the shell copies and clears natively instead, which also
 * works while the window is hidden and keeps the secret out of clipboard
 * history (see apps/desktop/src-tauri/src/clipboard.rs).
 */

/** The secret this page copied and has not cleared yet. */
let copied: string | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;
let waitingForFocus = false;
let watchingCopies = false;

/** Copies a value, confirms with a toast and clears the clipboard later if it still holds the value. */
export async function copyToClipboard(value: string, label: string) {
  const seconds = getPreferences().clipboardClearSeconds;
  try {
    if (isDesktop) {
      await desktopCopySecret(value, seconds);
    } else {
      await navigator.clipboard.writeText(value);
      remember(value, seconds);
    }
  } catch {
    toast.error("Copying failed", {
      description: isDesktop ? "The clipboard is not available." : "The browser blocked access to the clipboard.",
    });
    return;
  }
  toast.success(`${label} copied`, {
    description: isDesktop
      ? `Clears from the clipboard in ${seconds} seconds.`
      : // Browsers cannot clear the clipboard from a background tab.
        `Clears from the clipboard in ${seconds} seconds, or when you return to Passbox if you have switched away.`,
  });
}

/** Clears a copied secret now, for example when the vault locks. */
export async function clearClipboardNow(): Promise<void> {
  if (isDesktop) {
    await desktopClearClipboard().catch((error: unknown) => console.error("Could not clear the clipboard", error));
    return;
  }
  clearTimeout(timer);
  timer = undefined;
  await clearIfFocused();
}

function remember(value: string, seconds: number) {
  watchCopies();
  forget();
  copied = value;
  timer = setTimeout(() => {
    timer = undefined;
    void clearIfFocused();
  }, seconds * 1000);
}

/** Stops tracking: the clipboard was cleared or holds something else now. */
function forget() {
  copied = undefined;
  clearTimeout(timer);
  timer = undefined;
  stopWaitingForFocus();
}

async function clearIfFocused() {
  const value = copied;
  if (value === undefined) return;
  if (!document.hasFocus()) {
    waitForFocus();
    return;
  }
  try {
    await navigator.clipboard.writeText("");
  } catch {
    // Focus can be lost between the check and the write.
    waitForFocus();
    return;
  }
  // Unless a new secret was copied meanwhile, which has its own timer.
  if (copied === value) forget();
}

function onReturn() {
  if (document.visibilityState === "visible") void clearIfFocused();
}

function waitForFocus() {
  if (waitingForFocus) return;
  waitingForFocus = true;
  window.addEventListener("focus", onReturn);
  document.addEventListener("visibilitychange", onReturn);
}

function stopWaitingForFocus() {
  if (!waitingForFocus) return;
  waitingForFocus = false;
  window.removeEventListener("focus", onReturn);
  document.removeEventListener("visibilitychange", onReturn);
}

/** Copying or cutting text in this page replaces the secret: do not clear that. */
function watchCopies() {
  if (watchingCopies) return;
  watchingCopies = true;
  document.addEventListener("copy", forget);
  document.addEventListener("cut", forget);
}
