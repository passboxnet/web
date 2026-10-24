import { Button, Logo } from "@passbox/ui";
import { Printer } from "lucide-react";
import { useState } from "react";
import { useSnapshot } from "../useClient";

/**
 * Shown once after sign-up. The Secret Key is needed to sign in on new
 * devices and cannot be recovered by the server.
 */
export function EmergencyKitScreen({ secretKey, onDone }: { secretKey: string; onDone: () => void }) {
  const { email } = useSnapshot();
  const [saved, setSaved] = useState(false);

  return (
    <main className="flex min-h-full items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl">
        <section
          aria-labelledby="kit-title"
          className="rounded-card border border-border bg-surface p-8 shadow-sm print:border-0 print:shadow-none"
        >
          <Logo className="text-text" />
          <h1 id="kit-title" className="mt-6 text-2xl font-semibold">
            Your Emergency Kit
          </h1>
          <p className="mt-2 text-sm text-text-muted">
            Print this page or save it as a PDF, and keep it somewhere safe. You need your Secret Key to sign in on a
            new device. Passbox cannot recover it for you.
          </p>
          <dl className="mt-6 divide-y divide-border rounded-lg border border-border">
            <div className="px-4 py-3">
              <dt className="text-xs font-medium text-text-muted">Sign-in address</dt>
              <dd className="mt-1 font-mono text-sm">{window.location.origin}</dd>
            </div>
            <div className="px-4 py-3">
              <dt className="text-xs font-medium text-text-muted">Email</dt>
              <dd className="mt-1 font-mono text-sm">{email}</dd>
            </div>
            <div className="px-4 py-3">
              <dt className="text-xs font-medium text-text-muted">Secret Key</dt>
              <dd className="mt-1 break-all font-mono text-lg tracking-wide" data-testid="secret-key">
                {secretKey}
              </dd>
            </div>
            <div className="px-4 py-3">
              <dt className="text-xs font-medium text-text-muted">Master password</dt>
              <dd className="mt-6 border-b border-dashed border-border">
                <span className="sr-only">Write it down here if you like</span>
              </dd>
            </div>
          </dl>
          <div className="mt-6 flex flex-col gap-4 print:hidden">
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer className="size-4" aria-hidden="true" />
              Print or save as PDF
            </Button>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={saved}
                onChange={(e) => setSaved(e.target.checked)}
                className="size-4 accent-accent"
              />
              I have saved my Emergency Kit
            </label>
            <Button size="lg" disabled={!saved} onClick={onDone}>
              Open my vault
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}
