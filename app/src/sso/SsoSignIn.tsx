import type { SsoOption } from "@passbox/api-client";
import { Button, Dialog, Input } from "@passbox/ui";
import { Building2, LogIn, ShieldCheck } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { FormError } from "../auth/AuthLayout";
import { linkClass } from "../auth/ServerForm";
import { errorMessage } from "../core";
import { useI18n } from "../lib/i18n";
import { useClient } from "../useClient";
import { loadTrustedDevice } from "./deviceStore";
import { startSsoSignIn } from "./flow";
import { ProviderIcon } from "./ProviderIcon";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The organization that signs in `email` with SSO, looked up as the user types. */
export function useSsoOption(email: string): SsoOption | undefined {
  const client = useClient();
  const [option, setOption] = useState<SsoOption>();
  const domain = EMAIL.test(email.trim()) ? email.trim().toLowerCase().split("@")[1] : undefined;
  useEffect(() => {
    setOption(undefined);
    if (!domain) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      client
        .ssoFor(`sso-check@${domain}`)
        .then((found) => !cancelled && setOption(found))
        .catch(() => undefined);
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [client, domain]);
  return option;
}

/** Below the email field of the sign-in form: "Sign in with Acme (Okta)". */
export function SsoSignInOption({ email }: { email: string }) {
  const client = useClient();
  const { t } = useI18n();
  const option = useSsoOption(email);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [dialogOpen, setDialogOpen] = useState(false);

  async function start(target: SsoOption, address: string) {
    setBusy(true);
    setError(undefined);
    try {
      await startSsoSignIn(client, target.orgId, address);
    } catch (e) {
      setBusy(false);
      setError(errorMessage(e));
    }
  }

  return (
    <>
      {option ? (
        <div
          className="flex flex-col gap-2.5 rounded-lg border border-info/25 bg-accent-soft p-3"
          data-testid="sso-option"
        >
          <p className="flex items-start gap-2 text-[0.8125rem]">
            {option.provider === "generic" ? (
              <Building2 className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
            ) : (
              <ProviderIcon provider={option.provider} size="sm" />
            )}
            <span>
              {option.required
                ? t("sso.signIn.required", { name: option.displayName })
                : t("sso.signIn.available", { name: option.displayName })}
            </span>
          </p>
          <Button type="button" variant="secondary" loading={busy} onClick={() => void start(option, email)}>
            <LogIn />
            {t("sso.signIn.button")}
          </Button>
          <FormError message={error} />
        </div>
      ) : (
        <div className="text-center">
          <button type="button" className={linkClass} onClick={() => setDialogOpen(true)}>
            {t("sso.signIn.link")}
          </button>
        </div>
      )}
      <SsoEmailDialog open={dialogOpen} onOpenChange={setDialogOpen} initialEmail={email} />
    </>
  );
}

/** "Sign in with SSO" without an email typed yet: asks for the work email. */
function SsoEmailDialog({
  open,
  onOpenChange,
  initialEmail,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialEmail: string;
}) {
  const client = useClient();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email")).trim();
    setBusy(true);
    setError(undefined);
    try {
      const option = await client.ssoFor(email);
      if (!option) {
        setBusy(false);
        setError(t("sso.signIn.notFound"));
        return;
      }
      await startSsoSignIn(client, option.orgId, email);
    } catch (e) {
      setBusy(false);
      setError(errorMessage(e));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={t("sso.signIn.dialogTitle")} size="sm">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <p className="text-[0.8125rem] text-text-muted">{t("sso.signIn.dialogText")}</p>
        <Input
          label={t("sso.signIn.workEmail")}
          name="email"
          type="email"
          autoComplete="username"
          defaultValue={initialEmail}
          required
          autoFocus
        />
        <FormError message={error} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            {t("action.cancel")}
          </Button>
          <Button type="submit" loading={busy}>
            {t("action.continue")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/**
 * On the unlock screen: "Unlock with SSO" on a trusted device, or "Sign in
 * with SSO" when the organization requires it (the master password follows).
 * Returns whether this device can only unlock with SSO (it has no Secret Key).
 */
export function SsoUnlockOption({ email, onlySso }: { email: string; onlySso: boolean }) {
  const client = useClient();
  const { t } = useI18n();
  const option = useSsoOption(email);
  const [trusted, setTrusted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const accountId = client.deviceAccount?.accountId;

  useEffect(() => {
    if (!accountId) return;
    let cancelled = false;
    loadTrustedDevice(accountId)
      .then((device) => !cancelled && setTrusted(device !== undefined))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  if (!option || !(onlySso || (trusted && option.deviceUnlock) || option.required)) return null;
  const unlockWithSso = trusted && option.deviceUnlock;

  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-border bg-surface p-3 shadow-xs">
      <p className="flex items-start gap-2 text-[0.8125rem]">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
        <span>
          {unlockWithSso
            ? t("sso.unlock.trusted", { name: option.displayName })
            : option.required
              ? t("sso.signIn.required", { name: option.displayName })
              : t("sso.unlock.newDevice", { name: option.displayName })}
        </span>
      </p>
      <Button
        type="button"
        variant={unlockWithSso || onlySso ? "primary" : "secondary"}
        loading={busy}
        onClick={async () => {
          setBusy(true);
          setError(undefined);
          try {
            await startSsoSignIn(client, option.orgId, email);
          } catch (e) {
            setBusy(false);
            setError(errorMessage(e));
          }
        }}
      >
        <LogIn />
        {unlockWithSso ? t("sso.unlock.button") : t("sso.signIn.button")}
      </Button>
      <FormError message={error} />
    </div>
  );
}
