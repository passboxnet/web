import { Badge, Button, Logo, toast } from "@passbox/ui";
import { Copy, Printer, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { useSnapshot } from "../useClient";

/**
 * Shown once after sign-up. The Secret Key is needed to sign in on new
 * devices and cannot be recovered by the server.
 */
export function EmergencyKitScreen({ secretKey, onDone }: { secretKey: string; onDone: () => void }) {
  const { email } = useSnapshot();
  const [saved, setSaved] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(secretKey);
    toast.success("Secret Key copied", { description: "Store it in a safe place, then clear your clipboard." });
  }

  return (
    <main className="flex min-h-full items-center justify-center bg-canvas px-4 py-12 print:block print:p-0">
      <div className="w-full max-w-2xl">
        <div className="mb-6 flex items-center justify-between print:hidden">
          <Logo className="text-text" />
          <Badge tone="success">Account created</Badge>
        </div>
        <section
          aria-labelledby="kit-title"
          className="overflow-hidden rounded-card border border-border bg-surface shadow-card print:border-0 print:shadow-none"
        >
          <div className="border-b border-border bg-surface-raised px-8 py-6">
            <p className="text-2xs font-semibold tracking-wider text-accent uppercase">Passbox</p>
            <h1 id="kit-title" className="mt-1 text-2xl font-semibold tracking-tight">
              Emergency Kit
            </h1>
            <p className="mt-2 max-w-lg text-sm text-text-muted">
              You need your Secret Key and master password to sign in on a new device. Passbox cannot recover them for
              you. Print this page or save it as a PDF and keep it somewhere safe.
            </p>
          </div>
          <dl className="grid gap-px bg-border sm:grid-cols-2">
            <KitField label="Sign-in address" value={window.location.origin} />
            <KitField label="Email" value={email ?? ""} />
            <div className="bg-surface px-8 py-5 sm:col-span-2">
              <dt className="text-2xs font-semibold tracking-wider text-text-subtle uppercase">Secret Key</dt>
              <dd className="mt-2 flex items-center justify-between gap-4">
                <span
                  className="break-all font-mono text-xl font-medium tracking-wide text-text"
                  data-testid="secret-key"
                >
                  {secretKey}
                </span>
                <Button variant="secondary" size="sm" onClick={copy} className="print:hidden">
                  <Copy />
                  Copy
                </Button>
              </dd>
            </div>
            <div className="bg-surface px-8 py-5 sm:col-span-2">
              <dt className="text-2xs font-semibold tracking-wider text-text-subtle uppercase">Master password</dt>
              <dd className="mt-8 border-b border-dashed border-border-strong">
                <span className="sr-only">Write it down here if you like</span>
              </dd>
            </div>
          </dl>
          <div className="flex items-start gap-3 border-t border-border bg-warning-soft px-8 py-4 text-[13px] text-text print:hidden">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
            Do not store the Emergency Kit in Passbox itself. Keep a printed copy or store the PDF in a separate, secure
            place.
          </div>
        </section>
        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
          <label className="flex items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={saved}
              onChange={(e) => setSaved(e.target.checked)}
              className="size-4 accent-accent"
            />
            I have saved my Emergency Kit
          </label>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer />
              Print or save as PDF
            </Button>
            <Button disabled={!saved} onClick={onDone}>
              Open my vault
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}

function KitField({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface px-8 py-5">
      <dt className="text-2xs font-semibold tracking-wider text-text-subtle uppercase">{label}</dt>
      <dd className="mt-1.5 truncate font-mono text-sm">{value}</dd>
    </div>
  );
}
