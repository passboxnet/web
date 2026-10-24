import type { ServerMeta } from "@passbox/api-client";
import { Badge, Button, ConfirmDialog, Monogram, SegmentedControl, Switch } from "@passbox/ui";
import { Lock, LogOut } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { isDesktop } from "../desktop";
import { ImportExportPanel } from "../export/ImportExportPanel";
import { setPreferences, type Theme, usePreferences } from "../lib/preferences";
import { serverApi, serverLabel } from "../lib/server";
import { useClient, useSnapshot } from "../useClient";
import { Page, Panel } from "./PageHeader";

export function SettingsView() {
  const client = useClient();
  const { email = "", vaults, items } = useSnapshot();
  const preferences = usePreferences();
  const [meta, setMeta] = useState<ServerMeta>();
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const account = client.deviceAccount;

  useEffect(() => {
    serverApi()
      .meta()
      .then(setMeta)
      .catch(() => undefined);
  }, []);

  return (
    <Page title="Settings" description="Preferences on this device and information about your account.">
      <div className="flex flex-col gap-6">
        <Panel title="Account">
          <Row label="Signed in as">
            <span className="flex items-center gap-2.5">
              <Monogram name={email} size="sm" />
              <span className="text-[13px] font-medium">{email}</span>
            </span>
          </Row>
          <Row label="Account ID">
            <code className="font-mono text-xs text-text-muted">{account?.accountId}</code>
          </Row>
          <Row label="Secret Key" description="Stored on this device. Use your Emergency Kit to sign in elsewhere.">
            <code className="font-mono text-xs text-text-muted">
              {account ? `${account.secretKey.slice(0, 9)}-•••••-•••••-•••••-••••••` : ""}
            </code>
          </Row>
          <Row label="Vault contents">
            <span className="text-[13px] text-text-muted">
              {items.length} {items.length === 1 ? "item" : "items"} in {vaults.length}{" "}
              {vaults.length === 1 ? "vault" : "vaults"}
            </span>
          </Row>
        </Panel>

        <Panel title="Security" description="Applies to this device only.">
          <Row label="Auto-lock" description="Lock the vault after a period without activity.">
            <select
              value={preferences.autoLockMinutes}
              onChange={(e) => setPreferences({ autoLockMinutes: Number(e.target.value) })}
              aria-label="Auto-lock"
              className="h-8 rounded-lg border border-border-strong bg-surface px-2.5 text-[13px] shadow-xs"
            >
              {[1, 5, 15, 30, 60].map((minutes) => (
                <option key={minutes} value={minutes}>
                  After {minutes} {minutes === 1 ? "minute" : "minutes"}
                </option>
              ))}
            </select>
          </Row>
          <Row label="Clear clipboard" description="Remove copied secrets from the clipboard.">
            <select
              value={preferences.clipboardClearSeconds}
              onChange={(e) => setPreferences({ clipboardClearSeconds: Number(e.target.value) })}
              aria-label="Clear clipboard"
              className="h-8 rounded-lg border border-border-strong bg-surface px-2.5 text-[13px] shadow-xs"
            >
              {[30, 60, 90, 180].map((seconds) => (
                <option key={seconds} value={seconds}>
                  After {seconds} seconds
                </option>
              ))}
            </select>
          </Row>
          {isDesktop && (
            <div className="px-5 py-4">
              <Switch
                label="Lock when the window is closed"
                description="Passbox keeps running in the tray after you close the window."
                checked={preferences.lockOnClose}
                onCheckedChange={(lockOnClose) => setPreferences({ lockOnClose })}
              />
            </div>
          )}
          <Row label="Lock now" description="Removes all keys and decrypted data from memory.">
            <Button variant="secondary" size="sm" onClick={() => client.lock()}>
              <Lock />
              Lock vault
            </Button>
          </Row>
        </Panel>

        <ImportExportPanel />

        <Panel title="Appearance">
          <Row label="Theme">
            <SegmentedControl<Theme>
              label="Theme"
              value={preferences.theme}
              onChange={(theme) => setPreferences({ theme })}
              options={[
                { value: "system", label: "System" },
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
              ]}
            />
          </Row>
        </Panel>

        <Panel title="About">
          <Row label="Server" description="Sign out of this device to use a different server.">
            <span className="flex items-center gap-2 text-[13px] text-text-muted">
              <span>{serverLabel()}</span>
              {meta && <Badge tone="success">v{meta.version}</Badge>}
            </span>
          </Row>
          <Row label="Encryption">
            <span className="text-[13px] text-text-muted">XChaCha20-Poly1305 · Argon2id · OPAQUE</span>
          </Row>
          <Row label="License">
            <a
              href="https://github.com/relationsoftware/passbox"
              target="_blank"
              rel="noreferrer noopener"
              className="text-[13px] text-accent hover:underline"
            >
              MIT · Source code on GitHub
            </a>
          </Row>
        </Panel>

        <section className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-danger/30 bg-surface p-5 shadow-card">
          <div>
            <h2 className="text-sm font-semibold">Sign out of this device</h2>
            <p className="mt-0.5 text-[13px] text-text-muted">
              Removes your account and Secret Key from this device. Your data stays safe on the server.
            </p>
          </div>
          <Button variant="danger" size="sm" onClick={() => setConfirmSignOut(true)}>
            <LogOut />
            Sign out
          </Button>
        </section>
      </div>

      <ConfirmDialog
        open={confirmSignOut}
        onOpenChange={setConfirmSignOut}
        title="Sign out of this device?"
        description="You will need your email, master password and the Secret Key from your Emergency Kit to sign in again."
        confirmLabel="Sign out"
        tone="danger"
        onConfirm={() => client.signOut()}
      />
    </Page>
  );
}

function Row({ label, description, children }: { label: string; description?: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-4">
      <div className="min-w-0">
        <p className="text-[13px] font-medium">{label}</p>
        {description && <p className="mt-0.5 text-xs text-text-muted">{description}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
