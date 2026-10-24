import {
  InvalidCredentialsError,
  InvalidDeviceCodeError,
  InvalidRecoveryCodeError,
  InvalidTwoFactorCodeError,
  type LinkedAccount,
  type PendingOrgRecovery,
  RecoveryExpiredError,
  RecoveryVerificationError,
  TwoFactorRequiredError,
} from "@passbox/client";
import { Button, Input, PasswordInput, Spinner, toast } from "@passbox/ui";
import { ArrowLeft, Building2, CheckCircle2, Clock, KeyRound, Phone, Smartphone } from "lucide-react";
import { type FormEvent, type ReactNode, useCallback, useEffect, useState } from "react";
import { AuthLayout, FormError } from "../auth/AuthLayout";
import { useKit } from "../auth/KitProvider";
import { linkClass } from "../auth/ServerForm";
import { TwoFactorStep } from "../auth/TwoFactorStep";
import { errorMessage, nextFrame } from "../core";
import { PasswordStrength } from "../items/PasswordStrength";
import { useI18n } from "../lib/i18n";
import { meetsPasswordPolicy, useServerMeta } from "../lib/instance";
import { looksLikeRecoveryCode } from "../lib/twoFactor";
import { useClient } from "../useClient";
import { useRecoveryFlow } from "./RecoveryFlow";

/** How often a waiting device asks the server (organization request, device code). */
const ORG_POLL_MS = 10_000;
const LINK_POLL_MS = 2_000;

export function RecoveryScreens() {
  const flow = useRecoveryFlow();
  return (
    <AuthLayout>
      {flow.screen === "code" && <CodeRecovery />}
      {flow.screen === "org" && <OrgRecovery />}
      {flow.screen === "newPassword" && <NewMasterPassword />}
      {flow.screen === "linkDevice" && <LinkDevice />}
    </AuthLayout>
  );
}

function BackLink({ label }: { label?: string }) {
  const flow = useRecoveryFlow();
  const { t } = useI18n();
  return (
    <button type="button" onClick={flow.close} className={`mb-6 inline-flex items-center gap-1.5 ${linkClass}`}>
      <ArrowLeft className="size-3.5" aria-hidden="true" />
      {label ?? t("recovery.back")}
    </button>
  );
}

function Heading({ title, description }: { title: string; description?: ReactNode }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {description && <p className="mt-1.5 text-sm text-text-muted">{description}</p>}
    </div>
  );
}

function useDefaultEmail(): string {
  const client = useClient();
  return client.deviceAccount?.email ?? client.pendingOrgRecovery?.email ?? "";
}

/** Typed errors of the recovery flows, in plain words. */
function recoveryMessage(error: unknown, t: (key: string) => string): string {
  if (error instanceof InvalidRecoveryCodeError) return t("recovery.code.invalid");
  if (error instanceof InvalidCredentialsError) return t("recovery.code.wrong");
  if (error instanceof RecoveryExpiredError) return t("recovery.expired");
  if (error instanceof RecoveryVerificationError) return t("recovery.verificationFailed");
  if (error instanceof InvalidDeviceCodeError) return t("linkDevice.invalid");
  if (error instanceof Error && error.name === "ApiError") {
    const code = (error as { code?: string }).code;
    if (code === "recovery_needs_security_key") return t("recovery.code.needsSecurityKey");
    if (code === "recovery_expired") return t("recovery.expired");
  }
  return errorMessage(error, "general");
}

// --- Recovery code ------------------------------------------------------------------

function CodeRecovery() {
  const client = useClient();
  const flow = useRecoveryFlow();
  const { t } = useI18n();
  const defaultEmail = useDefaultEmail();
  const [email, setEmail] = useState(defaultEmail);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [twoFactor, setTwoFactor] = useState(false);
  const compact = code.replace(/[\s-]/g, "");
  // 2 prefix characters and 55 code characters.
  const complete = compact.length >= 57;
  const looksWrong = complete && !client.isRecoveryCode(code);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!client.isRecoveryCode(code)) {
      setError(t("recovery.code.invalid"));
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const start = await client.startCodeRecovery(email, code);
      if (start.twoFactorMethods) setTwoFactor(true);
      else flow.start("newPassword");
    } catch (e) {
      setError(recoveryMessage(e, t));
    } finally {
      setBusy(false);
    }
  }

  if (twoFactor) return <RecoveryTwoFactor onDone={() => flow.start("newPassword")} />;

  return (
    <>
      <BackLink />
      <Heading title={t("recovery.code.title")} description={t("recovery.code.description")} />
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Input
          label={t("field.email")}
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          label={t("recovery.code.label")}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="R1-XXXXX-XXXXX-…"
          autoComplete="off"
          spellCheck={false}
          className="font-mono uppercase placeholder:normal-case"
          required
          hint={t("recovery.code.hint")}
          error={looksWrong ? t("recovery.code.invalid") : undefined}
        />
        <FormError message={error} />
        <Button type="submit" size="lg" loading={busy}>
          {busy ? t("recovery.code.busy") : t("recovery.code.submit")}
        </Button>
        <p className="text-xs text-text-muted">{t("recovery.code.whatHappens")}</p>
      </form>
    </>
  );
}

function RecoveryTwoFactor({ onDone }: { onDone: () => void }) {
  const client = useClient();
  const { t } = useI18n();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      const method = looksLikeRecoveryCode(code) ? "recovery" : "totp";
      await client.completeRecoveryTwoFactor(method, code);
      onDone();
    } catch (e) {
      setError(e instanceof InvalidTwoFactorCodeError ? t("error.invalidTwoFactorCode") : recoveryMessage(e, t));
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <BackLink />
      <Heading title={t("recovery.twoFactor.title")} description={t("recovery.twoFactor.description")} />
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Input
          label={t("recovery.twoFactor.label")}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoComplete="one-time-code"
          inputMode={looksLikeRecoveryCode(code) ? "text" : "numeric"}
          spellCheck={false}
          className="font-mono tracking-widest"
          required
          autoFocus
          hint={t("recovery.twoFactor.hint")}
        />
        <FormError message={error} />
        <Button type="submit" size="lg" loading={busy}>
          {t("action.continue")}
        </Button>
      </form>
    </>
  );
}

// --- Organization -----------------------------------------------------------------------

function OrgRecovery() {
  const client = useClient();
  const [pending, setPending] = useState<PendingOrgRecovery | undefined>(() => client.pendingOrgRecovery);
  return pending ? (
    <OrgRecoveryWaiting pending={pending} onReset={() => setPending(undefined)} />
  ) : (
    <OrgRecoveryRequest onRequested={setPending} />
  );
}

function OrgRecoveryRequest({ onRequested }: { onRequested: (pending: PendingOrgRecovery) => void }) {
  const client = useClient();
  const { t } = useI18n();
  const options = client.recoveryOptions;
  const orgs = options?.orgs ?? [];
  const defaultEmail = useDefaultEmail();
  const [email, setEmail] = useState(defaultEmail);
  const [orgId, setOrgId] = useState(orgs[0]?.orgId ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      onRequested(await client.requestOrgRecovery(email, orgId || undefined));
    } catch (e) {
      setError(recoveryMessage(e, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <BackLink />
      <Heading title={t("recovery.org.title")} description={t("recovery.org.description")} />
      <ol className="mb-6 flex flex-col gap-3 text-sm">
        {[t("recovery.org.step1"), t("recovery.org.step2"), t("recovery.org.step3")].map((step, index) => (
          <li key={step} className="flex gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
              {index + 1}
            </span>
            <span className="pt-0.5">{step}</span>
          </li>
        ))}
      </ol>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Input
          label={t("field.email")}
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        {orgs.length > 1 && (
          <label className="flex flex-col gap-1.5 text-[0.8125rem] font-medium">
            {t("recovery.org.which")}
            <select
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
              className="h-9 rounded-lg border border-border-strong bg-surface px-2.5 text-sm shadow-xs coarse:h-11"
            >
              {orgs.map((org) => (
                <option key={org.orgId} value={org.orgId}>
                  {org.name ?? org.orgId}
                </option>
              ))}
            </select>
          </label>
        )}
        <FormError message={error} />
        <Button type="submit" size="lg" loading={busy}>
          <Building2 />
          {t("recovery.org.submit")}
        </Button>
        <p className="text-xs text-text-muted">{t("recovery.org.privacy")}</p>
      </form>
    </>
  );
}

function OrgRecoveryWaiting({ pending, onReset }: { pending: PendingOrgRecovery; onReset: () => void }) {
  const client = useClient();
  const flow = useRecoveryFlow();
  const i18n = useI18n();
  const { t } = i18n;
  const [status, setStatus] = useState<string>("pending");
  const [error, setError] = useState<string>();
  const [checking, setChecking] = useState(false);

  const check = useCallback(async () => {
    setChecking(true);
    try {
      const next = await client.checkOrgRecovery();
      setStatus(next);
      setError(undefined);
      if (next === "approved") flow.start("newPassword");
    } catch (e) {
      setError(recoveryMessage(e, t));
    } finally {
      setChecking(false);
    }
  }, [client, flow, t]);

  useEffect(() => {
    void check();
    const timer = setInterval(() => void check(), ORG_POLL_MS);
    return () => clearInterval(timer);
  }, [check]);

  if (status === "denied" || status === "expired" || status === "cancelled" || status === "completed") {
    return (
      <>
        <BackLink />
        <Heading
          title={t(`recovery.org.status.${status}.title`)}
          description={t(`recovery.org.status.${status}.body`)}
        />
        <Button
          size="lg"
          onClick={() => {
            void client.cancelOrgRecovery();
            onReset();
          }}
        >
          {t("recovery.org.again")}
        </Button>
      </>
    );
  }

  return (
    <>
      <BackLink label={t("recovery.org.leave")} />
      <Heading title={t("recovery.org.waitingTitle")} description={t("recovery.org.waitingBody")} />
      <section
        aria-labelledby="request-code"
        className="rounded-card border border-accent/30 bg-accent-soft p-5 text-center shadow-card"
      >
        <p id="request-code" className="flex items-center justify-center gap-2 text-sm font-semibold">
          <Phone className="size-4 text-accent" aria-hidden="true" />
          {t("recovery.org.codeLabel")}
        </p>
        <p
          className="mt-3 font-mono text-2xl font-semibold tracking-wider text-text tabular-nums"
          data-testid="request-code"
        >
          {pending.requestCode}
        </p>
        <p className="mt-3 text-xs text-text-muted">{t("recovery.org.codeHint")}</p>
      </section>
      <p className="mt-5 flex items-center gap-2 text-[0.8125rem] text-text-muted" role="status">
        {checking ? <Spinner label={t("recovery.org.checking")} /> : <Clock className="size-4" aria-hidden="true" />}
        {t("recovery.org.validUntil", { time: i18n.dateTime(pending.expiresAt) })}
      </p>
      <FormError message={error} />
      <div className="mt-6 flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => void check()} loading={checking}>
          {t("recovery.org.checkNow")}
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            void client.cancelOrgRecovery();
            toast.info(t("recovery.org.cancelled"));
            onReset();
            flow.close();
          }}
        >
          {t("recovery.org.cancel")}
        </Button>
      </div>
    </>
  );
}

// --- New master password -------------------------------------------------------------------

function NewMasterPassword() {
  const client = useClient();
  const flow = useRecoveryFlow();
  const kit = useKit();
  const meta = useServerMeta();
  const { t } = useI18n();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const email = client.pendingOrgRecovery?.email ?? client.deviceAccount?.email ?? "";

  if (!client.recoveryReady) {
    return (
      <>
        <BackLink />
        <Heading title={t("recovery.expiredTitle")} description={t("recovery.expired")} />
      </>
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const policy = meta?.passwordPolicy;
    const verdict = meetsPasswordPolicy(password, client.estimateStrength(password, [email]), policy);
    if (verdict === "weak") {
      setError(t("signUp.tooWeak"));
      return;
    }
    if (verdict === "policy" && policy) {
      setError(t("signUp.policy", { length: policy.minLength, strength: t(`strength.${policy.minScore}`) }));
      return;
    }
    if (password !== confirm) {
      setError(t("signUp.mismatch"));
      return;
    }
    setBusy(true);
    setError(undefined);
    await nextFrame();
    try {
      const result = await client.finishRecovery(password);
      kit.startOnboarding(result.accountId, { recoveryCode: result.recoveryCode, recovered: true });
      flow.close();
      toast.success(t("recovery.done"), { description: t("recovery.doneHint") });
    } catch (e) {
      setBusy(false);
      setError(recoveryMessage(e, t));
    }
  }

  return (
    <>
      <div className="mb-4 flex items-center gap-2 text-[0.8125rem] font-medium text-success-text" role="status">
        <CheckCircle2 className="size-4" aria-hidden="true" />
        {t("recovery.newPassword.verified")}
      </div>
      <Heading title={t("recovery.newPassword.title")} description={t("recovery.newPassword.description")} />
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <PasswordInput
            label={t("changeMaster.new")}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoFocus
          />
          {password && <PasswordStrength password={password} context={[email]} master />}
        </div>
        <PasswordInput
          label={t("signUp.confirm")}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
        <ul className="flex flex-col gap-1.5 rounded-lg border border-border bg-surface-sunken p-3 text-[0.8125rem] text-text-muted">
          <li className="flex gap-2">
            <KeyRound className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            {t("recovery.newPassword.newSecretKey")}
          </li>
          <li className="flex gap-2">
            <Smartphone className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            {t("recovery.newPassword.signOut")}
          </li>
        </ul>
        <FormError message={error} />
        <Button type="submit" size="lg" loading={busy}>
          {busy ? t("recovery.newPassword.busy") : t("recovery.newPassword.submit")}
        </Button>
      </form>
    </>
  );
}

// --- Signing in with a code from another device ---------------------------------------------

function LinkDevice() {
  const client = useClient();
  const { t } = useI18n();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState<string>();
  const [linked, setLinked] = useState<LinkedAccount>();

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!client.isDeviceCode(code)) {
      setError(t("linkDevice.format"));
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      await client.claimDeviceLink(code);
      setWaiting(true);
    } catch (e) {
      setError(recoveryMessage(e, t));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!waiting) return;
    let stopped = false;
    const timer = setInterval(() => {
      client
        .pollDeviceLink()
        .then((account) => {
          if (account && !stopped) {
            setLinked(account);
            setWaiting(false);
          }
        })
        .catch((e: unknown) => {
          if (stopped) return;
          setWaiting(false);
          setError(recoveryMessage(e, t));
        });
    }, LINK_POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [waiting, client, t]);

  if (linked) return <LinkedSignIn account={linked} />;

  if (waiting) {
    return (
      <>
        <BackLink />
        <Heading title={t("linkDevice.waitingTitle")} description={t("linkDevice.waitingBody")} />
        <div className="flex items-center gap-3 rounded-lg border border-border bg-surface p-4 text-sm" role="status">
          <Spinner label={t("linkDevice.waiting")} />
          {t("linkDevice.waiting")}
        </div>
      </>
    );
  }

  return (
    <>
      <BackLink />
      <Heading title={t("linkDevice.title")} description={t("linkDevice.description")} />
      <ol className="mb-6 flex list-decimal flex-col gap-2 pl-5 text-sm text-text-muted">
        <li>{t("linkDevice.step1")}</li>
        <li>{t("linkDevice.step2")}</li>
        <li>{t("linkDevice.step3")}</li>
      </ol>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Input
          label={t("linkDevice.codeLabel")}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="XXXX-XXXX-XXXX-XXXX"
          autoComplete="off"
          spellCheck={false}
          className="font-mono tracking-wider uppercase placeholder:normal-case"
          required
          autoFocus
        />
        <FormError message={error} />
        <Button type="submit" size="lg" loading={busy}>
          {t("action.continue")}
        </Button>
        <p className="text-xs text-text-muted">{t("linkDevice.privacy")}</p>
      </form>
    </>
  );
}

function LinkedSignIn({ account }: { account: LinkedAccount }) {
  const client = useClient();
  const flow = useRecoveryFlow();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [twoFactor, setTwoFactor] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = String(new FormData(event.currentTarget).get("password"));
    setBusy(true);
    setError(undefined);
    await nextFrame();
    try {
      await client.signIn(account.email, password, account.secretKey);
      flow.close();
    } catch (e) {
      setBusy(false);
      if (e instanceof TwoFactorRequiredError) {
        setTwoFactor(true);
        return;
      }
      setError(errorMessage(e, "unlock"));
    }
  }

  if (twoFactor) {
    return (
      <TwoFactorStep
        onDone={flow.close}
        onCancel={(message) => {
          setTwoFactor(false);
          setError(message);
        }}
      />
    );
  }

  return (
    <>
      <div className="mb-4 flex items-center gap-2 text-[0.8125rem] font-medium text-success-text" role="status">
        <CheckCircle2 className="size-4" aria-hidden="true" />
        {t("linkDevice.received")}
      </div>
      <Heading title={t("linkDevice.signInTitle")} description={t("linkDevice.signInBody", { email: account.email })} />
      <form onSubmit={submit} className="flex flex-col gap-4">
        <PasswordInput
          label={t("term.masterPassword")}
          name="password"
          autoComplete="current-password"
          autoFocus
          required
        />
        <FormError message={error} />
        <Button type="submit" size="lg" loading={busy}>
          {busy ? t("signIn.busy") : t("action.signIn")}
        </Button>
      </form>
    </>
  );
}
