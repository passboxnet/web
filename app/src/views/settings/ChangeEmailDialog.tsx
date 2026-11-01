import type { PendingEmailChange } from "@passbox/api-client";
import { TwoFactorRequiredError } from "@passbox/client";
import { Button, Dialog, Input, PasswordInput, toast } from "@passbox/ui";
import { type FormEvent, useEffect, useState } from "react";
import { FormError } from "../../auth/AuthLayout";
import { TwoFactorStep } from "../../auth/TwoFactorStep";
import { errorMessage, nextFrame } from "../../core";
import { useI18n } from "../../lib/i18n";
import { useClient, useSnapshot } from "../../useClient";

/**
 * Changes the account's email address: the server mails a code to the new
 * address, and the change takes effect once it is entered. The master
 * password and the Secret Key stay the same.
 */
export function ChangeEmailDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const client = useClient();
  const { email = "" } = useSnapshot();
  const i18n = useI18n();
  const { t } = i18n;
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState<PendingEmailChange | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  // Without a recent login, sending the code needs a fresh one, which may ask for the second factor.
  const [twoFactor, setTwoFactor] = useState(false);

  // A change started earlier (on this or another device) continues with its code.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    client
      .pendingEmailChange()
      .then((change) => {
        if (!cancelled) setPending(change);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [client, open]);

  function reset() {
    setNewEmail("");
    setPassword("");
    setCode("");
    setPending(null);
    setError(undefined);
    setTwoFactor(false);
  }

  async function send(address: string) {
    setPending(await client.startEmailChange(password, address, i18n.locale));
    setPassword("");
    setCode("");
  }

  async function submitAddress(event: FormEvent) {
    event.preventDefault();
    setError(undefined);
    if (newEmail.trim().toLowerCase() === email) {
      setError(t("changeEmail.same"));
      return;
    }
    setBusy(true);
    await nextFrame();
    try {
      // Checked on this device first: a wrong password must not lock the vault.
      if (!(await client.verifyMasterPassword(password))) {
        setError(t("error.wrongMasterPassword"));
        return;
      }
      await send(newEmail);
    } catch (e) {
      if (e instanceof TwoFactorRequiredError) setTwoFactor(true);
      else setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(event: FormEvent) {
    event.preventDefault();
    setError(undefined);
    setBusy(true);
    try {
      const changed = await client.confirmEmailChange(code);
      toast.success(t("changeEmail.done"), { description: t("changeEmail.doneHint", { email: changed }) });
      reset();
      onOpenChange(false);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function startOver() {
    setError(undefined);
    await client.cancelEmailChange().catch(() => undefined);
    setNewEmail(pending?.newEmail ?? "");
    setPending(null);
    setCode("");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) reset();
        onOpenChange(isOpen);
      }}
      title={t("changeEmail.title")}
      description={t("changeEmail.description")}
    >
      {twoFactor ? (
        <TwoFactorStep
          heading="none"
          onDone={() => {
            setTwoFactor(false);
            setBusy(true);
            send(newEmail)
              .catch((e: unknown) => setError(errorMessage(e)))
              .finally(() => setBusy(false));
          }}
          onCancel={(message) => {
            setTwoFactor(false);
            setError(message);
          }}
        />
      ) : pending ? (
        <form onSubmit={submitCode} className="flex flex-col gap-4">
          <p className="text-body">{t("changeEmail.codeSent", { email: pending.newEmail })}</p>
          <Input
            label={t("changeEmail.code")}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={8}
            required
            autoFocus
          />
          <FormError message={error} />
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={startOver}>
              {t("changeEmail.other")}
            </Button>
            <Button type="submit" loading={busy} disabled={code.trim().length < 6}>
              {t("changeEmail.confirm")}
            </Button>
          </div>
        </form>
      ) : (
        <form onSubmit={submitAddress} className="flex flex-col gap-4">
          <Input
            type="email"
            label={t("changeEmail.new")}
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            autoComplete="email"
            required
            autoFocus
          />
          <PasswordInput
            label={t("changeEmail.password")}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <FormError message={error} />
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              {t("action.cancel")}
            </Button>
            <Button type="submit" loading={busy}>
              {t("changeEmail.sendCode")}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
