import { toast } from "@passbox/ui";
import { desktopClearClipboard, desktopCopySecret, isDesktop } from "../desktop";
import { i18n } from "./i18n";
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
 * history (see src-tauri/src/clipboard.rs in passboxnet/desktop).
 */

/** The secret this page copied and has not cleared yet. */
let copied: string | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;
let waitingForFocus = false;
let watchingCopies = false;

/**
 * Copies a value, confirms with a toast and clears the clipboard later if it
 * still holds the value. `label` names what was copied, already translated
 * ("Password").
 */
export async function copyToClipboard(value: string, label: string) {
  const { t } = i18n();
  const seconds = getPreferences().clipboardClearSeconds;
  try {
    if (isDesktop) {
      await desktopCopySecret(value, seconds);
    } else {
      await navigator.clipboard.writeText(value);
      remember(value, seconds);
    }
  } catch {
    toast.error(t("clipboard.failed"), {
      description: isDesktop ? t("clipboard.unavailable") : t("clipboard.blocked"),
    });
    return;
  }
  toast.success(t("clipboard.copied", { label }), {
    // Browsers cannot clear the clipboard from a background tab.
    description: isDesktop ? t("clipboard.clears", { seconds }) : t("clipboard.clearsWeb", { seconds }),
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
