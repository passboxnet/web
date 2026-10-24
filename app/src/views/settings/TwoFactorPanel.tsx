import type { SecurityKeyInfo, TwoFactorStatus } from "@passbox/api-client";
import {
  InvalidTwoFactorCodeError,
  ReauthenticationRequiredError,
  TwoFactorRequiredError,
  webAuthnAvailable,
} from "@passbox/client";
import { Badge, Button, ConfirmDialog, Dialog, Input, PasswordInput, Spinner, Switch, toast } from "@passbox/ui";
import { Copy, Download, KeyRound, Printer, ShieldCheck, Trash2 } from "lucide-react";
import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FormError } from "../../auth/AuthLayout";
import { TwoFactorStep } from "../../auth/TwoFactorStep";
import { errorMessage, nextFrame } from "../../core";
import { downloadFile } from "../../export/download";
import { copyToClipboard } from "../../lib/clipboard";
import { useI18n } from "../../lib/i18n";
import { groupSecret, qrMatrix, qrPath, recoveryCodesText, secondFactorFromInput } from "../../lib/twoFactor";
import { useClient, useSnapshot } from "../../useClient";
import { Panel } from "../PageHeader";

/** The user closed a dialog instead of confirming with the master password. */
export class ReauthCancelled extends Error {}

/**
 * Settings → Two-factor sign-in: authenticator app, security keys, recovery
 * codes and turning it off. Changes need a recent login; when the server asks
 * for one, the master password (and the second factor) are asked again.
 */
export function TwoFactorPanel() {
  const client = useClient();
  const i18n = useI18n();
  const { t } = i18n;
  const [status, setStatus] = useState<TwoFactorStatus>();
  const [error, setError] = useState<string>();
  const [dialog, setDialog] = useState<"totp" | "key" | "disable" | "newCodes" | "removeApp">();
  const [removeKey, setRemoveKey] = useState<SecurityKeyInfo>();
  const [codes, setCodes] = useState<string[]>();
  const reauth = useReauthentication();
  // WebAuthn needs a domain name: an IP address is no valid relying party ID.
  const keysAvailable = webAuthnAvailable() && !/^[\d.]+$|^\[/.test(window.location.hostname);

  const load = useCallback(() => {
    setError(undefined);
    client
      .twoFactorStatus()
      .then(setStatus)
      .catch((e: unknown) => setError(errorMessage(e)));
  }, [client]);
  useEffect(load, [load]);

  async function guarded(action: () => Promise<void>) {
    try {
      await reauth.run(action);
    } catch (e) {
      if (!(e instanceof ReauthCancelled)) toast.error(errorMessage(e));
    } finally {
      load();
    }
  }

  function enabled(recoveryCodes?: string[]) {
    if (!status?.enabled) toast.success(t("twoFactor.enabled"), { description: t("twoFactor.enabledHint") });
    if (recoveryCodes) setCodes(recoveryCodes);
    load();
  }

  const onlyOne = status ? Number(status.totp) + status.securityKeys.length === 1 : false;

  return (
    <Panel id="two-factor" title={t("term.twoFactor")} description={t("settings.twoFactorDescription")}>
      {error ? (
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-[0.8125rem] text-danger">
          {error}
          <Button size="sm" variant="secondary" onClick={load}>
            {t("action.retry")}
          </Button>
        </div>
      ) : !status ? (
        <div className="flex justify-center px-5 py-6 text-text-muted">
          <Spinner label={t("app.loading")} />
        </div>
      ) : (
        <>
          <Row
            label={t("twoFactor.status")}
            description={status.enabled ? t("twoFactor.enabledHint") : t("twoFactor.offDescription")}
          >
            <Badge tone={status.enabled ? "success" : "neutral"}>
              {status.enabled ? t("twoFactor.on") : t("twoFactor.off")}
            </Badge>
          </Row>
          <Row label={t("twoFactor.app")} description={t("twoFactor.appDescription")}>
            {status.totp ? (
              <span className="flex flex-wrap items-center gap-2">
                <Badge tone="success">{t("twoFactor.appActive")}</Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={onlyOne}
                  title={onlyOne ? t("twoFactor.lastFactor") : undefined}
                  onClick={() => setDialog("removeApp")}
                >
                  {t("twoFactor.remove")}
                </Button>
              </span>
            ) : (
              <Button variant="secondary" size="sm" onClick={() => setDialog("totp")}>
                <ShieldCheck />
                {t("twoFactor.setUp")}
              </Button>
            )}
          </Row>
          <div className="px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
              <div className="min-w-0 max-w-md">
                <p className="text-[0.8125rem] font-medium">{t("twoFactor.keys")}</p>
                <p className="mt-0.5 text-xs text-text-muted">
                  {keysAvailable ? t("twoFactor.keysDescription") : t("twoFactor.keysUnavailable")}
                </p>
              </div>
              <Button variant="secondary" size="sm" disabled={!keysAvailable} onClick={() => setDialog("key")}>
                <KeyRound />
                {t("twoFactor.addKey")}
              </Button>
            </div>
            {status.securityKeys.length > 0 && (
              <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
                {status.securityKeys.map((key) => (
                  <li key={key.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-[0.8125rem] font-medium break-all">{key.name}</p>
                      <p className="text-xs text-text-muted">
                        {t("twoFactor.keyMeta", {
                          added: i18n.date(key.createdAt),
                          used: key.lastUsedAt
                            ? t("twoFactor.keyLastUsed", { time: i18n.relativeTime(key.lastUsedAt) })
                            : t("twoFactor.keyNeverUsed"),
                        })}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("twoFactor.removeKey", { name: key.name })}
                      disabled={onlyOne}
                      title={onlyOne ? t("twoFactor.lastFactor") : undefined}
                      onClick={() => setRemoveKey(key)}
                    >
                      <Trash2 />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {status.enabled && (
            <>
              <Row label={t("twoFactor.recoveryCodes")} description={t("twoFactor.recoveryDescription")}>
                <span className="flex flex-wrap items-center gap-2">
                  <Badge tone={status.recoveryCodesRemaining > 2 ? "neutral" : "warning"}>
                    {t("twoFactor.recoveryRemaining", { count: status.recoveryCodesRemaining })}
                  </Badge>
                  <Button variant="secondary" size="sm" onClick={() => setDialog("newCodes")}>
                    {t("twoFactor.newCodes")}
                  </Button>
                </span>
              </Row>
              <Row label={t("twoFactor.disableLabel")} description={t("twoFactor.disableDescription")}>
                <Button variant="danger" size="sm" onClick={() => setDialog("disable")}>
                  {t("twoFactor.disable")}
                </Button>
              </Row>
            </>
          )}
        </>
      )}

      <TotpSetupDialog
        open={dialog === "totp"}
        onOpenChange={(open) => setDialog(open ? "totp" : undefined)}
        run={reauth.run}
        onEnabled={(recoveryCodes) => {
          setDialog(undefined);
          enabled(recoveryCodes);
        }}
      />
      <AddKeyDialog
        open={dialog === "key"}
        onOpenChange={(open) => setDialog(open ? "key" : undefined)}
        run={reauth.run}
        onAdded={(recoveryCodes) => {
          setDialog(undefined);
          toast.success(t("twoFactor.keyAdded"));
          enabled(recoveryCodes);
        }}
      />
      <DisableDialog
        open={dialog === "disable"}
        onOpenChange={(open) => setDialog(open ? "disable" : undefined)}
        hasKeys={(status?.securityKeys.length ?? 0) > 0}
        onDisabled={() => {
          setDialog(undefined);
          toast.success(t("twoFactor.disabled"));
          load();
        }}
      />
      <ConfirmDialog
        open={dialog === "newCodes"}
        onOpenChange={(open) => setDialog(open ? "newCodes" : undefined)}
        title={t("twoFactor.newCodesTitle")}
        description={t("twoFactor.newCodesDescription")}
        confirmLabel={t("twoFactor.newCodes")}
        onConfirm={() => {
          setDialog(undefined);
          void guarded(async () => setCodes(await client.regenerateRecoveryCodes()));
        }}
      />
      <ConfirmDialog
        open={dialog === "removeApp"}
        onOpenChange={(open) => setDialog(open ? "removeApp" : undefined)}
        title={t("twoFactor.removeAppTitle")}
        description={t("twoFactor.removeAppDescription")}
        confirmLabel={t("twoFactor.remove")}
        tone="danger"
        onConfirm={() => {
          setDialog(undefined);
          void guarded(async () => {
            await client.removeTotp();
            toast.success(t("twoFactor.removed"));
          });
        }}
      />
      <ConfirmDialog
        open={removeKey !== undefined}
        onOpenChange={(open) => !open && setRemoveKey(undefined)}
        title={t("twoFactor.removeKeyTitle")}
        description={t("twoFactor.removeKeyDescription", { name: removeKey?.name ?? "" })}
        confirmLabel={t("twoFactor.remove")}
        tone="danger"
        onConfirm={() => {
          const id = removeKey?.id ?? "";
          setRemoveKey(undefined);
          void guarded(async () => {
            await client.removeSecurityKey(id);
            toast.success(t("twoFactor.removed"));
          });
        }}
      />
      <RecoveryCodesDialog codes={codes} onClose={() => setCodes(undefined)} />
      {reauth.dialog}
    </Panel>
  );
}

function Row({ label, description, children }: { label: string; description?: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-4">
      <div className="min-w-0 max-w-md">
        <p className="text-[0.8125rem] font-medium">{label}</p>
        {description && <p className="mt-0.5 text-xs text-text-muted">{description}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

type Run = <T>(action: () => Promise<T>) => Promise<T>;

/**
 * Runs actions that need a recent login. When the server refuses one with
 * `reauthentication_required`, asks for the master password (and the second
 * factor, if needed) and runs it again.
 */
export function useReauthentication(): { run: Run; dialog: ReactNode } {
  const [waiting, setWaiting] = useState<{ resolve: () => void; reject: (error: Error) => void }>();
  const run = useCallback<Run>(async (action) => {
    try {
      return await action();
    } catch (error) {
      if (!(error instanceof ReauthenticationRequiredError)) throw error;
      await new Promise<void>((resolve, reject) => setWaiting({ resolve, reject }));
      return action();
    }
  }, []);
  const dialog = (
    <ReauthDialog
      open={waiting !== undefined}
      onDone={() => {
        waiting?.resolve();
        setWaiting(undefined);
      }}
      onCancel={() => {
        waiting?.reject(new ReauthCancelled());
        setWaiting(undefined);
      }}
    />
  );
  return { run, dialog };
}

function ReauthDialog({ open, onDone, onCancel }: { open: boolean; onDone: () => void; onCancel: () => void }) {
  const client = useClient();
  const { t } = useI18n();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [twoFactor, setTwoFactor] = useState(false);

  function close() {
    setPassword("");
    setError(undefined);
    setTwoFactor(false);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    await nextFrame();
    try {
      await client.reauthenticate(password);
      close();
      onDone();
    } catch (e) {
      if (e instanceof TwoFactorRequiredError) setTwoFactor(true);
      else setError(errorMessage(e, "unlock"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          client.cancelTwoFactor();
          close();
          onCancel();
        }
      }}
      title={twoFactor ? t("twoFactor.title") : t("twoFactorReauth.title")}
      description={twoFactor ? undefined : t("twoFactorReauth.description")}
      size="sm"
    >
      {twoFactor ? (
        <TwoFactorStep
          heading="none"
          onDone={() => {
            close();
            onDone();
          }}
          onCancel={(message) => {
            setTwoFactor(false);
            setError(message);
          }}
        />
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <PasswordInput
            label={t("term.masterPassword")}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            required
          />
          <FormError message={error} />
          <Button type="submit" loading={busy}>
            {t("twoFactorReauth.submit")}
          </Button>
        </form>
      )}
    </Dialog>
  );
}

export function QrCode({ text, label }: { text: string; label: string }) {
  const { path, side } = useMemo(() => {
    const matrix = qrMatrix(text);
    return { path: qrPath(matrix, 4), side: matrix.size + 8 };
  }, [text]);
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${side} ${side}`}
      className="size-44 rounded-lg border border-border bg-white"
      shapeRendering="crispEdges"
    >
      <path d={path} fill="#000" />
    </svg>
  );
}

function TotpSetupDialog({
  open,
  onOpenChange,
  run,
  onEnabled,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  run: Run;
  onEnabled: (recoveryCodes?: string[]) => void;
}) {
  const client = useClient();
  const { t } = useI18n();
  const [setup, setSetup] = useState<{ secret: string; uri: string }>();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const started = useRef(false);

  useEffect(() => {
    if (!open) {
      started.current = false;
      setSetup(undefined);
      setCode("");
      setError(undefined);
      return;
    }
    if (started.current) return;
    started.current = true;
    run(() => client.startTotpSetup())
      .then(setSetup)
      .catch((e: unknown) => {
        if (e instanceof ReauthCancelled) onOpenChange(false);
        else setError(errorMessage(e));
      });
  }, [open, client, run, onOpenChange]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      const { recoveryCodes } = await run(() => client.confirmTotpSetup(code));
      onEnabled(recoveryCodes);
    } catch (e) {
      setError(e instanceof InvalidTwoFactorCodeError ? t("error.invalidTwoFactorCode") : errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={t("twoFactor.setupTitle")}>
      {!setup ? (
        error ? (
          <FormError message={error} />
        ) : (
          <div className="flex justify-center py-6 text-text-muted">
            <Spinner label={t("app.loading")} />
          </div>
        )
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <p className="text-sm">{t("twoFactor.setupScan")}</p>
          <div className="flex flex-wrap items-center gap-4">
            <QrCode text={setup.uri} label={t("twoFactor.qrLabel")} />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-text-muted">{t("twoFactor.manualKey")}</p>
              <code className="mt-1 block font-mono text-sm break-words" data-testid="totp-secret">
                {groupSecret(setup.secret)}
              </code>
              <Button
                variant="ghost"
                size="sm"
                className="mt-1 -ml-2"
                onClick={() => void copyToClipboard(setup.secret, t("twoFactor.copyKey"))}
              >
                <Copy />
                {t("twoFactor.copyKey")}
              </Button>
            </div>
          </div>
          <Input
            label={t("twoFactor.setupCode")}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            className="font-mono tracking-wider"
            maxLength={10}
            required
          />
          <FormError message={error} />
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              {t("action.cancel")}
            </Button>
            <Button type="submit" loading={busy}>
              {t("twoFactor.turnOn")}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}

function AddKeyDialog({
  open,
  onOpenChange,
  run,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  run: Run;
  onAdded: (recoveryCodes?: string[]) => void;
}) {
  const client = useClient();
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      const { recoveryCodes } = await run(() => client.addSecurityKey(name.trim() || t("twoFactor.keyNameDefault")));
      setName("");
      onAdded(recoveryCodes);
    } catch (e) {
      if (e instanceof ReauthCancelled) return;
      setError(e instanceof DOMException ? t("twoFactor.keyCancelled") : errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) setError(undefined);
        onOpenChange(isOpen);
      }}
      title={t("twoFactor.addKeyTitle")}
      description={t("twoFactor.addKeyDescription")}
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Input
          label={t("twoFactor.keyName")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("twoFactor.keyNamePlaceholder")}
          maxLength={80}
          autoFocus
        />
        <FormError message={error} />
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t("action.cancel")}
          </Button>
          <Button type="submit" loading={busy}>
            <KeyRound />
            {t("twoFactor.addKeySubmit")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function DisableDialog({
  open,
  onOpenChange,
  hasKeys,
  onDisabled,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hasKeys: boolean;
  onDisabled: () => void;
}) {
  const client = useClient();
  const { t } = useI18n();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"code" | "key">();
  const [error, setError] = useState<string>();

  async function disable(kind: "code" | "key") {
    setBusy(kind);
    setError(undefined);
    try {
      await client.disableTwoFactor(kind === "key" ? { method: "webauthn" } : secondFactorFromInput(code));
      setCode("");
      onDisabled();
    } catch (e) {
      if (e instanceof InvalidTwoFactorCodeError) setError(t("error.invalidTwoFactorCode"));
      else if (e instanceof DOMException) setError(t("twoFactor.keyFailed"));
      else setError(errorMessage(e));
    } finally {
      setBusy(undefined);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          setCode("");
          setError(undefined);
        }
        onOpenChange(isOpen);
      }}
      title={t("twoFactor.disableTitle")}
      description={t("twoFactor.disableConfirmDescription")}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void disable("code");
        }}
        className="flex flex-col gap-4"
      >
        {hasKeys && webAuthnAvailable() && (
          <Button
            variant="secondary"
            loading={busy === "key"}
            disabled={busy === "code"}
            onClick={() => disable("key")}
          >
            <KeyRound />
            {t("twoFactor.useKey")}
          </Button>
        )}
        <Input
          label={t("twoFactor.codeLabel")}
          hint={t("twoFactor.useRecovery")}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoComplete="one-time-code"
          className="font-mono tracking-wider"
          maxLength={40}
          required
        />
        <FormError message={error} />
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t("action.cancel")}
          </Button>
          <Button type="submit" variant="danger" loading={busy === "code"} disabled={busy === "key"}>
            {t("twoFactor.disableSubmit")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/** Prints plain text from a hidden frame, so only the codes end up on paper. */
function printText(title: string, text: string) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;width:0;height:0;border:0;left:-9999px";
  document.body.append(frame);
  const doc = frame.contentDocument;
  if (!doc) {
    frame.remove();
    return;
  }
  doc.title = title;
  const pre = doc.createElement("pre");
  pre.style.cssText = "font: 14pt/1.6 ui-monospace, monospace; white-space: pre-wrap";
  pre.textContent = text;
  doc.body.append(pre);
  frame.contentWindow?.focus();
  frame.contentWindow?.print();
  setTimeout(() => frame.remove(), 60_000);
}

function RecoveryCodesDialog({ codes, onClose }: { codes: string[] | undefined; onClose: () => void }) {
  const i18n = useI18n();
  const { t } = i18n;
  const { email = "" } = useSnapshot();
  const [saved, setSaved] = useState(false);
  const text = codes
    ? recoveryCodesText(codes, t("twoFactor.fileHeader", { email }), t("twoFactor.fileNote"), i18n.dateTime(Date.now()))
    : "";

  return (
    <Dialog
      open={codes !== undefined}
      onOpenChange={(open) => {
        if (!open) {
          setSaved(false);
          onClose();
        }
      }}
      title={t("twoFactor.codesTitle")}
      description={t("twoFactor.codesDescription")}
      footer={
        <Button
          disabled={!saved}
          onClick={() => {
            setSaved(false);
            onClose();
          }}
        >
          {t("action.done")}
        </Button>
      }
    >
      <ol
        aria-label={t("twoFactor.codesListLabel")}
        className="grid grid-cols-1 gap-x-6 gap-y-1.5 rounded-lg bg-surface-sunken p-4 font-mono text-sm sm:grid-cols-2"
        data-testid="recovery-codes"
      >
        {codes?.map((code) => (
          <li key={code} className="tracking-wide">
            {code}
          </li>
        ))}
      </ol>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => downloadFile(t("twoFactor.fileName"), text, "text/plain;charset=utf-8")}
        >
          <Download />
          {t("twoFactor.download")}
        </Button>
        <Button variant="secondary" size="sm" onClick={() => printText(t("twoFactor.codesTitle"), text)}>
          <Printer />
          {t("twoFactor.print")}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void copyToClipboard((codes ?? []).join("\n"), t("twoFactor.codesListLabel"))}
        >
          <Copy />
          {t("action.copy")}
        </Button>
      </div>
      <div className="mt-4">
        <Switch label={t("twoFactor.codesSaved")} checked={saved} onCheckedChange={setSaved} />
      </div>
    </Dialog>
  );
}
