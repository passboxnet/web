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

/**
 * Tray menu "Lock", screen lock, sleep, closing the window, or showing it
 * again after it was hidden for too long. Once `handler` has run and React has
 * rendered the result, the shell is told with `vault_locked`, because it may
 * wait for that before it shows the window.
 */
export function onLockRequest(handler: () => void): () => void {
  return onDesktopEvent(LOCK_EVENT, () => {
    handler();
    afterRender()
      .then(() => invokeDesktop("vault_locked"))
      .catch((error: unknown) => console.error("Could not confirm the lock", error));
  });
}

/** Global shortcut Ctrl+Shift+Space (Cmd+Shift+Space on macOS). */
export function onCommandPaletteRequest(handler: () => void): () => void {
  return onDesktopEvent(PALETTE_EVENT, handler);
}

/**
 * Resolves after pending React updates are committed. A message task runs after
 * the microtasks React renders in, and unlike timers it is not throttled while
 * the window is hidden.
 */
function afterRender(): Promise<void> {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => {
      channel.port1.close();
      resolve();
    };
    channel.port2.postMessage(undefined);
  });
}

/** Calls an app command of the desktop shell (`invoke_handler` in main.rs). */
async function invokeDesktop(command: string, args?: Record<string, unknown>): Promise<void> {
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke(command, args);
}

/**
 * Copies a secret through the shell. It is marked as excluded from clipboard
 * history and cleared after `clearAfterSeconds` if it is still there, also
 * while the window is hidden.
 */
export function desktopCopySecret(text: string, clearAfterSeconds: number): Promise<void> {
  return invokeDesktop("clipboard_copy", { text, clearAfterSecs: clearAfterSeconds });
}

/** Clears a secret copied with {@link desktopCopySecret} now, if it is still on the clipboard. */
export function desktopClearClipboard(): Promise<void> {
  return invokeDesktop("clipboard_clear");
}

/** Passes the lock settings to the shell, which applies them while the window is hidden. */
export function setDesktopLockSettings(settings: { lockOnClose: boolean; autoLockMinutes: number }): Promise<void> {
  if (!isDesktop) return Promise.resolve();
  return invokeDesktop("set_lock_settings", settings);
}

/**
 * An AI agent waits for an approval: the desktop shell shows the window and
 * asks for attention. No-op in browsers.
 */
export function requestAgentAttention(): Promise<void> {
  if (!isDesktop) return Promise.resolve();
  return invokeDesktop("agent_request_attention");
}
