/**
 * Bridge to the Passbox desktop app (apps/desktop, Tauri). Everything here is
 * a no-op in browsers, and the Tauri API is only loaded inside the desktop app.
 */

/** True when the web client runs inside the desktop app. */
export const isDesktop = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/** Events sent by the desktop shell. Keep in sync with apps/desktop/src-tauri/src/main.rs. */
const LOCK_EVENT = "passbox://lock";
const PALETTE_EVENT = "passbox://command-palette";

/** Calls `handler` when the shell emits `event`. Returns a function that stops listening. */
function onDesktopEvent(event: string, handler: () => void): () => void {
  if (!isDesktop) return () => undefined;
  let stop: (() => void) | undefined;
  let stopped = false;
  import("@tauri-apps/api/event")
    .then(({ listen }) => listen(event, () => handler()))
    .then((unlisten) => {
      if (stopped) unlisten();
      else stop = unlisten;
    })
    .catch((error: unknown) => console.error(`Could not listen to ${event}`, error));
  return () => {
    stopped = true;
    stop?.();
  };
}

/** Tray menu "Lock", screen lock or sleep. */
export function onLockRequest(handler: () => void): () => void {
  return onDesktopEvent(LOCK_EVENT, handler);
}

/** Global shortcut Ctrl+Shift+Space (Cmd+Shift+Space on macOS). */
export function onCommandPaletteRequest(handler: () => void): () => void {
  return onDesktopEvent(PALETTE_EVENT, handler);
}
