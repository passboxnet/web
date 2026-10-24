import type { SsoRedeemed } from "@passbox/api-client";
import {
  type PendingDeviceApproval,
  parseSsoCallback,
  type SsoFlowState,
  TwoFactorRequiredError,
} from "@passbox/client";
import { Button, Input, PasswordInput, Spinner } from "@passbox/ui";
import { BadgeCheck, CircleAlert, Laptop, ShieldCheck, Smartphone, UserPlus } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { AuthLayout, FormError } from "../auth/AuthLayout";
import { TwoFactorStep } from "../auth/TwoFactorStep";
import { errorMessage, nextFrame } from "../core";
import { useI18n } from "../lib/i18n";
import { useClient } from "../useClient";
import { loadTrustedDevice, saveTrustedDevice } from "./deviceStore";
import { relayTestResult, startSsoSignIn, takeSsoFlow } from "./flow";
import { ssoErrorMessage } from "./messages";

type Stage =
  | { kind: "working" }
  | { kind: "error"; message: string; flow: SsoFlowState | undefined }
  | { kind: "no-account"; email: string }
  | { kind: "signed-in"; redeemed: SsoRedeemed }
  | { kind: "waiting"; pending: PendingDeviceApproval; redeemed: SsoRedeemed }
  | { kind: "test-done" };

/** Leaves `#/sso?…` so a reload does not try to redeem the ticket again. */
function leaveCallback() {
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#/`);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}

/**
 * Where the identity provider sends the browser back (`#/sso?ticket=…`).
 * Redeems the ticket with this tab's flow secret, then unlocks a trusted
 * device right away, or asks for the master password (and Secret Key on a
 * new device), or for approval by a trusted device.
 */
export function SsoCallbackScreen() {
  const client = useClient();
  const { t } = useI18n();
  const [stage, setStage] = useState<Stage>({ kind: "working" });
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const callback = parseSsoCallback(window.location.hash);
    if (callback?.test) {
      relayTestResult(callback);
      setStage({ kind: "test-done" });
      window.setTimeout(() => window.close(), 400);
      return;
    }
    const flow = takeSsoFlow();
    void (async () => {
      if (callback?.error || !callback?.ticket) {
        setStage({ kind: "error", message: ssoErrorMessage(callback?.error ?? "sso_expired", t), flow });
        return;
      }
      if (!flow) {
        setStage({ kind: "error", message: ssoErrorMessage("sso_expired", t), flow });
        return;
      }
      try {
        const account = client.deviceAccount;
        const device = account ? await loadTrustedDevice(account.accountId) : undefined;
        const redeemed = await client.redeemSso(callback.ticket, flow.flowSecret, device?.deviceId);
        if (redeemed.status === "no_account") {
          setStage({ kind: "no-account", email: redeemed.email });
          return;
        }
        if (redeemed.deviceTrusted && device && device.accountId === redeemed.accountId && redeemed.proof) {
          await client.unlockWithSso(redeemed.proof, device);
          leaveCallback();
          return;
        }
        setStage({ kind: "signed-in", redeemed });
      } catch (e) {
        setStage({ kind: "error", message: errorMessage(e), flow });
      }
    })();
  }, [client, t]);

  if (stage.kind === "test-done") {
    return (
      <AuthLayout>
        <div role="status" className="flex flex-col items-start gap-3">
          <BadgeCheck className="size-6 text-success" aria-hidden="true" />
          <h1 className="text-xl font-semibold">{t("sso.test.popupDone")}</h1>
          <p className="text-sm text-text-muted">{t("sso.test.popupClose")}</p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      {stage.kind === "working" && (
        <div className="flex flex-col items-center gap-3 py-12 text-text-muted">
          <Spinner label={t("sso.callback.working")} />
          <p className="text-sm">{t("sso.callback.working")}</p>
        </div>
      )}
      {stage.kind === "error" && <ErrorStage message={stage.message} flow={stage.flow} />}
      {stage.kind === "no-account" && <NoAccountStage email={stage.email} />}
      {stage.kind === "signed-in" && (
        <SignedInStage
          redeemed={stage.redeemed}
          onWaiting={(pending) => setStage({ kind: "waiting", pending, redeemed: stage.redeemed })}
        />
      )}
      {stage.kind === "waiting" && <WaitingStage pending={stage.pending} />}
    </AuthLayout>
  );
}

function ErrorStage({ message, flow }: { message: string; flow: SsoFlowState | undefined }) {
  const client = useClient();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("sso.callback.failedTitle")}</h1>
        <p role="alert" className="mt-3 flex gap-2 rounded-lg bg-danger-soft p-3 text-[0.8125rem] text-text">
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
          {message}
        </p>
      </div>
      <FormError message={error} />
      <div className="flex flex-wrap gap-2">
        {flow && (
          <Button
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await startSsoSignIn(client, flow.orgId, flow.email);
              } catch (e) {
                setBusy(false);
                setError(errorMessage(e));
              }
            }}
          >
            {t("sso.callback.retry")}
          </Button>
        )}
        <Button variant="secondary" onClick={leaveCallback}>
          {t("sso.callback.back")}
        </Button>
      </div>
    </div>
  );
}

function NoAccountStage({ email }: { email: string }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("sso.noAccount.title")}</h1>
        <p className="mt-2 text-sm text-text-muted">{t("sso.noAccount.text", { email })}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={leaveCallback}>
          <UserPlus />
          {t("sso.noAccount.create")}
        </Button>
      </div>
    </div>
  );
}

/**
 * The identity provider confirmed the person. Decrypting still needs the
 * master password (and the Secret Key on a new device), unless a trusted
 * device approves this one.
 */
function SignedInStage({
  redeemed,
  onWaiting,
}: {
  redeemed: SsoRedeemed;
  onWaiting: (pending: PendingDeviceApproval) => void;
}) {
  const client = useClient();
  const { t } = useI18n();
  const [busy, setBusy] = useState<"password" | "device">();
  const [error, setError] = useState<string>();
  const [twoFactor, setTwoFactor] = useState(false);
  const [proofUsed, setProofUsed] = useState(false);
  const account = client.deviceAccount;
  const knownDevice = account !== undefined && account.accountId === redeemed.accountId && account.secretKey !== "";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!redeemed.proof || proofUsed) return;
    const form = new FormData(event.currentTarget);
    setBusy("password");
    setError(undefined);
    await nextFrame();
    // A proof works once, also for a failed attempt.
    setProofUsed(true);
    try {
      if (knownDevice) {
        await client.unlock(String(form.get("password")), { ssoProof: redeemed.proof });
      } else {
        await client.signIn(redeemed.email, String(form.get("password")), String(form.get("secretKey")), {
          ssoProof: redeemed.proof,
        });
      }
      leaveCallback();
    } catch (e) {
      setBusy(undefined);
      if (e instanceof TwoFactorRequiredError) {
        setTwoFactor(true);
        return;
      }
      setError(errorMessage(e, knownDevice ? "unlock" : "signIn"));
    }
  }

  async function requestApproval() {
    if (!redeemed.proof || proofUsed) return;
    setBusy("device");
    setError(undefined);
    setProofUsed(true);
    try {
      onWaiting(await client.requestDeviceApproval(redeemed.proof));
    } catch (e) {
      setBusy(undefined);
      setError(errorMessage(e));
    }
  }

  if (twoFactor) {
    return (
      <TwoFactorStep
        onCancel={(message) => {
          setTwoFactor(false);
          setError(message);
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("sso.callback.signedInTitle")}</h1>
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-success-soft px-3 py-2.5 text-[0.8125rem]">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
          {t("sso.callback.verified", { email: redeemed.email })}
        </p>
        <p className="mt-3 text-sm text-text-muted">
          {knownDevice ? t("sso.callback.passwordUnlock") : t("sso.callback.passwordNewDevice")}
        </p>
      </div>
      {proofUsed && !busy ? (
        <div className="flex flex-col gap-3">
          <FormError message={error} />
          <p className="text-[0.8125rem] text-text-muted">{t("sso.callback.proofUsed")}</p>
          <Button onClick={() => void startSsoSignIn(client, redeemed.orgId, redeemed.email)}>
            {t("sso.callback.retry")}
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <input type="hidden" name="username" autoComplete="username" value={redeemed.email} />
          <PasswordInput
            label={t("term.masterPassword")}
            name="password"
            autoComplete="current-password"
            autoFocus
            required
          />
          {!knownDevice && (
            <Input
              label={t("term.secretKey")}
              name="secretKey"
              placeholder="P1-XXXXX-XXXXX-XXXXX-XXXXX-XXXXXX"
              autoComplete="off"
              spellCheck={false}
              className="font-mono uppercase placeholder:normal-case"
              required
              hint={t("signIn.secretKeyHint")}
            />
          )}
          <FormError message={error} />
          <Button type="submit" size="lg" loading={busy === "password"} disabled={busy === "device"}>
            {knownDevice ? t("action.unlock") : t("action.signIn")}
          </Button>
        </form>
      )}
      {redeemed.deviceUnlock && !proofUsed && (
        <div className="border-t border-border pt-4">
          <p className="text-[0.8125rem] font-medium">{t("sso.callback.noPasswordTitle")}</p>
          <p className="mt-1 text-xs text-text-muted">{t("sso.callback.noPasswordText")}</p>
          <Button
            className="mt-3"
            variant="secondary"
            loading={busy === "device"}
            disabled={busy === "password"}
            onClick={() => void requestApproval()}
          >
            <Smartphone />
            {t("sso.callback.requestApproval")}
          </Button>
        </div>
      )}
    </div>
  );
}

/** The new device shows its code until a trusted device approves it. */
function WaitingStage({ pending }: { pending: PendingDeviceApproval }) {
  const client = useClient();
  const { t } = useI18n();
  const [error, setError] = useState<string>();
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    let stopped = false;
    async function poll() {
      while (!stopped) {
        await new Promise((resolve) => setTimeout(resolve, 2500));
        if (stopped) return;
        try {
          const result = await client.checkDeviceApproval(pending);
          if (result.status === "approved") {
            try {
              await saveTrustedDevice(result.device);
            } catch (e) {
              console.warn("Could not store the trusted device key", e);
            }
            leaveCallback();
            return;
          }
          if (result.status === "denied") {
            setDenied(true);
            return;
          }
        } catch (e) {
          setError(errorMessage(e));
          return;
        }
      }
    }
    void poll();
    return () => {
      stopped = true;
    };
  }, [client, pending]);

  return (
    <div className="flex flex-col gap-5" data-testid="sso-waiting">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("sso.approval.waitTitle")}</h1>
        <p className="mt-2 text-sm text-text-muted">{t("sso.approval.waitText")}</p>
      </div>
      <div className="rounded-card border border-border bg-surface p-5 text-center shadow-card">
        <p className="text-xs font-medium tracking-wide text-text-muted uppercase">{t("sso.approval.code")}</p>
        <p className="mt-2 font-mono text-2xl font-semibold tracking-widest" data-testid="sso-approval-code">
          {pending.approvalCode}
        </p>
      </div>
      <p className="flex items-start gap-2 text-[0.8125rem] text-text-muted">
        <Laptop className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {t("sso.approval.where")}
      </p>
      {denied ? (
        <p role="alert" className="text-[0.8125rem] text-danger">
          {t("sso.approval.denied")}
        </p>
      ) : error ? (
        <FormError message={error} />
      ) : (
        <div className="flex items-center gap-2 text-[0.8125rem] text-text-muted">
          <Spinner label={t("sso.approval.waiting")} />
          {t("sso.approval.waiting")}
        </div>
      )}
      <Button variant="secondary" onClick={leaveCallback}>
        {t("action.cancel")}
      </Button>
    </div>
  );
}
