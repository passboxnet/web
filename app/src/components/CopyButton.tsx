import { Button } from "@passbox/ui";
import { Check, Copy } from "lucide-react";
import { useState } from "react";

/** Clipboard contents are cleared after this many milliseconds. */
const CLEAR_AFTER_MS = 90_000;

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    setTimeout(async () => {
      // Only clear the clipboard if it still holds our value.
      const current = await navigator.clipboard.readText().catch(() => undefined);
      if (current === value) await navigator.clipboard.writeText("");
    }, CLEAR_AFTER_MS);
  }

  return (
    <Button variant="ghost" size="sm" onClick={copy} aria-label={`Copy ${label}`}>
      {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
    </Button>
  );
}
