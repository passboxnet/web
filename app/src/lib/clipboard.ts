import { toast } from "@passbox/ui";
import { getPreferences } from "./preferences";

/** Copies a value, confirms with a toast and clears the clipboard later if it still holds the value. */
export async function copyToClipboard(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    toast.error("Copying failed", { description: "The browser blocked access to the clipboard." });
    return;
  }
  const seconds = getPreferences().clipboardClearSeconds;
  toast.success(`${label} copied`, { description: `Clears from the clipboard in ${seconds} seconds.` });
  setTimeout(async () => {
    const current = await navigator.clipboard.readText().catch(() => undefined);
    if (current === value) await navigator.clipboard.writeText("").catch(() => undefined);
  }, seconds * 1000);
}
