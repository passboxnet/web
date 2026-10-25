import { InvalidTwoFactorCodeError, TwoFactorExpiredError, webAuthnAvailable } from "@passbox/client";
import { Button, Input, Switch, toast } from "@passbox/ui";
import { KeyRound } from "lucide-react";
import { type FormEvent, useState } from "react";
import { errorMessage } from "../core";
import { useI18n } from "../lib/i18n";
import { looksLikeRecoveryCode, secondFactorFromInput } from "../lib/twoFactor";
import { useClient } from "../useClient";
import { FormError } from "./AuthLayout";
import { linkClass } from "./ServerForm";

/**
 * The second step of a sign-in, unlock or re-check when the account has
 * two-factor sign-in on: a code from the authenticator app, a recovery code
 * or a security key. Shown after `client` threw `TwoFactorRequiredError`.
 */
export function TwoFactorStep({
  onDone,
  onCancel,
  heading = "h1",
}: {
  /** Called once the login is complete. */
  onDone?: () => void;
  /** Called when the user goes back, or the pending login expired (with a message). */
  onCancel: (message?: string) => void;
  /** `none` inside dialogs that have their own title. */
  heading?: "h1" | "h2" | "none";
}) {
  const client = useClient();
  const { t } = useI18n();
  const challenge = client.pendingTwoFactor;
  const methods = challenge?.methods ?? [];
  const hasApp = methods.includes("totp");
  const hasRecovery = methods.includes("recovery");
  const canUseKey = methods.includes("webauthn") && challenge?.webauthn !== undefined && webAuthnAvailable();
  const [useRecovery, setUseRecovery] = useState(!hasApp);
  const [code, setCode] = useState("");
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState<"code" | "key">();
  const [error, setError] = useState<string>();

  async function finish(run: () => Promise<{ recoveryCodesRemaining?: number }>, kind: "code" | "key") {
    setBusy(kind);
    setError(undefined);
    try {
      const { recoveryCodesRemaining } = await run();
      if (recoveryCodesRemaining !== undefined) {
        toast.info(t("twoFactor.recoveryUsed", { count: recoveryCodesRemaining }));
      }
      onDone?.();
    } catch (e) {
      setBusy(undefined);
      if (e instanceof TwoFactorExpiredError) {
        onCancel(t("error.twoFactorExpired"));
      } else if (e instanceof InvalidTwoFactorCodeError) {
        setError(t("error.invalidTwoFactorCode"));
        setCode("");
      } else if (kind === "key" && e instanceof DOMException) {
        setError(t("twoFactor.keyFailed"));
      } else {
        setError(errorMessage(e));
      }
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!code.trim()) return;
    void finish(() => client.completeTwoFactor(secondFactorFromInput(code), { rememberDevice: remember }), "code");
  }

  function signWithKey() {
    void finish(() => client.completeTwoFactorWithSecurityKey({ rememberDevice: remember }), "key");
  }

  const Heading = heading === "none" ? undefined : heading;
  const recoveryMode = useRecovery || looksLikeRecoveryCode(code);

  return (
    <div className="flex flex-col gap-5">
      {Heading && (
        <div>
          <Heading className={heading === "h1" ? "text-title text-text" : "text-base font-semibold"}>
            {t("twoFactor.title")}
          </Heading>
          <p className="mt-1.5 text-sm text-text-muted">
            {hasApp ? t("twoFactor.description") : t("twoFactor.descriptionKey")}
          </p>
        </div>
      )}
      {heading === "none" && (
        <p className="text-sm text-text-muted">{hasApp ? t("twoFactor.description") : t("twoFactor.descriptionKey")}</p>
      )}
      {canUseKey && (
        <Button
          size="lg"
          variant={hasApp ? "secondary" : "primary"}
          loading={busy === "key"}
          disabled={busy === "code"}
          onClick={signWithKey}
        >
          <KeyRound />
          {busy === "key" ? t("twoFactor.keyWaiting") : t("twoFactor.useKey")}
        </Button>
      )}
      {methods.includes("webauthn") && !canUseKey && !hasApp && (
        <p className="rounded-lg bg-surface-sunken px-3 py-2.5 text-[0.8125rem]">{t("twoFactor.keyUnavailable")}</p>
      )}
      {(hasApp || hasRecovery) && (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Input
            label={recoveryMode ? t("twoFactor.recoveryLabel") : t("twoFactor.codeLabel")}
            name="twoFactorCode"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode={useRecovery ? "text" : "numeric"}
            autoComplete="one-time-code"
            placeholder={useRecovery ? t("twoFactor.recoveryPlaceholder") : "123456"}
            spellCheck={false}
            autoFocus={!canUseKey}
            className="font-mono tracking-wider"
            maxLength={40}
            required
          />
          <Switch
            label={t("twoFactor.remember")}
            description={t("twoFactor.rememberHint")}
            checked={remember}
            onCheckedChange={setRemember}
          />
          <FormError message={error} />
          <Button type="submit" size="lg" shape="pill" loading={busy === "code"} disabled={busy === "key"}>
            {t("twoFactor.verify")}
          </Button>
        </form>
      )}
      {!(hasApp || hasRecovery) && <FormError message={error} />}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <button
          type="button"
          className={linkClass}
          onClick={() => {
            client.cancelTwoFactor();
            onCancel();
          }}
        >
          {t("twoFactor.back")}
        </button>
        {hasApp && hasRecovery && (
          <button
            type="button"
            className={linkClass}
            onClick={() => {
              setUseRecovery(!useRecovery);
              setCode("");
              setError(undefined);
            }}
          >
            {useRecovery ? t("twoFactor.useCode") : t("twoFactor.useRecovery")}
          </button>
        )}
      </div>
    </div>
  );
}
