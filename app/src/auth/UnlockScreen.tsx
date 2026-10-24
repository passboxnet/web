import { TwoFactorRequiredError } from "@passbox/client";
import { Button, Monogram, PasswordInput } from "@passbox/ui";
import { KeyRound } from "lucide-react";
import { type FormEvent, useState } from "react";
import { errorMessage, nextFrame } from "../core";
import { useI18n } from "../lib/i18n";
import { PendingRecoveryNotice } from "../recovery/PendingRecoveryNotice";
import { SsoUnlockOption } from "../sso/SsoSignIn";
import { useClient, useSnapshot } from "../useClient";
import { AuthLayout, FormError } from "./AuthLayout";
import { useKit } from "./KitProvider";
import { linkClass } from "./ServerForm";
import { ForgotPasswordDialog, SignOutDialog } from "./SignOutDialog";
import { TwoFactorStep } from "./TwoFactorStep";

export function UnlockScreen() {
  const client = useClient();
  const kit = useKit();
  const { t } = useI18n();
  const { email = "" } = useSnapshot();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [twoFactor, setTwoFactor] = useState(false);
  // Approved by another trusted device: no Secret Key here, so only SSO unlocks.
  const onlySso = client.deviceAccount?.secretKey === "";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = String(new FormData(event.currentTarget).get("password"));
    setBusy(true);
    setError(undefined);
    await nextFrame();
    try {
      await client.unlock(password);
    } catch (e) {
      setBusy(false);
      if (e instanceof TwoFactorRequiredError) {
        setTwoFactor(true);
        return;
      }
      // Only the master password is typed here, so only it can be wrong.
      setError(errorMessage(e, "unlock"));
    }
  }

  if (twoFactor) {
    return (
      <AuthLayout>
        <TwoFactorStep
          onCancel={(message) => {
            setTwoFactor(false);
            setError(message);
          }}
        />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <PendingRecoveryNotice />
      <form onSubmit={submit} className="flex flex-col gap-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("unlock.title")}</h1>
          <div className="mt-4 flex items-center gap-3 rounded-lg border border-border bg-surface p-3 shadow-xs">
            <Monogram name={email} size="lg" />
            <div className="min-w-0">
              <p className="text-sm font-medium break-all">{email}</p>
              <p className="text-xs text-text-muted">{t("unlock.keyStored")}</p>
            </div>
          </div>
        </div>
        <SsoUnlockOption email={email} onlySso={onlySso} />
        {kit.afterUnlock && (
          <p
            role="status"
            className="flex items-start gap-2 rounded-lg bg-accent-soft px-3 py-2.5 text-[0.8125rem] text-text"
          >
            <KeyRound className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
            {t("unlock.kitAfterUnlock")}
          </p>
        )}
        {!onlySso && (
          <>
            <PasswordInput
              label={t("term.masterPassword")}
              name="password"
              autoComplete="current-password"
              autoFocus
              required
              labelAction={
                <button type="button" onClick={() => setForgotOpen(true)} className={linkClass}>
                  {t("forgot.link")}
                </button>
              }
            />
            <FormError message={error} />
            <Button type="submit" size="lg" loading={busy}>
              {busy ? t("unlock.busy") : t("action.unlock")}
            </Button>
          </>
        )}
        <div className="border-t border-border pt-4 text-center">
          <button type="button" onClick={() => setSignOutOpen(true)} className={linkClass}>
            {t("unlock.otherAccount")}
          </button>
        </div>
      </form>
      <SignOutDialog open={signOutOpen} onOpenChange={setSignOutOpen} variant="otherAccount" />
      <ForgotPasswordDialog open={forgotOpen} onOpenChange={setForgotOpen} />
    </AuthLayout>
  );
}
