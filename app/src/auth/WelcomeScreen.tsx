import type { ServerMeta } from "@passbox/api-client";
import { Button, Input, PasswordInput, SegmentedControl } from "@passbox/ui";
import { ChevronRight, Info, LifeBuoy, Sparkles } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { errorMessage, loadCore, nextFrame } from "../core";
import { PasswordStrength } from "../items/PasswordStrength";
import { SecretKeyFormatError } from "../lib/errors";
import { wasUsedBefore } from "../lib/firstRun";
import { useI18n } from "../lib/i18n";
import { type InviteLink, inviteFromHash, meetsPasswordPolicy, useServerMeta } from "../lib/instance";
import { serverUrl } from "../lib/server";
import { useClient } from "../useClient";
import { AuthLayout, FormError } from "./AuthLayout";
import { useKit } from "./KitProvider";
import { linkClass, ServerForm } from "./ServerForm";
import { ForgotPasswordDialog } from "./SignOutDialog";

/** Characters of a Secret Key without dashes: "P1" plus 26. */
const SECRET_KEY_LENGTH = 28;

export function WelcomeScreen() {
  const { t } = useI18n();
  const [invite] = useState<InviteLink | undefined>(() => inviteFromHash());
  // First visit on this device or an invitation: most people are here to create an account.
  const [mode, setMode] = useState<"sign-in" | "sign-up">(() => (invite || !wasUsedBefore() ? "sign-up" : "sign-in"));
  const [choosingServer, setChoosingServer] = useState(false);
  const meta = useServerMeta();
  // Servers that only accept invited accounts hide "Create account" without an invitation.
  const signUpClosed = meta?.registration === "invite_only" && !invite;
  useEffect(() => {
    if (signUpClosed) setMode("sign-in");
  }, [signUpClosed]);

  // The desktop app has no server of its own: ask for one first.
  if (!serverUrl() || choosingServer) {
    return (
      <AuthLayout>
        <ServerForm onCancel={serverUrl() ? () => setChoosingServer(false) : undefined} />
      </AuthLayout>
    );
  }
  return (
    <AuthLayout>
      <h1 className="text-2xl font-semibold tracking-tight">
        {mode === "sign-in" ? t("signIn.title") : t("signUp.title")}
      </h1>
      <p className="mt-1.5 text-sm text-text-muted">
        {mode === "sign-in" ? t("signIn.description") : t("signUp.description")}
      </p>
      {signUpClosed ? (
        <p
          role="note"
          className="mt-6 flex gap-2 rounded-lg border border-border bg-surface-sunken p-3 text-[0.8125rem] text-text-muted"
        >
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {t("welcome.inviteOnly")}
        </p>
      ) : (
        <SegmentedControl
          className="mt-6 w-full"
          label={t("welcome.modeLabel")}
          value={mode}
          onChange={setMode}
          options={[
            { value: "sign-in", label: t("action.signIn") },
            { value: "sign-up", label: t("action.createAccount") },
          ]}
        />
      )}
      <div className="mt-6">
        {mode === "sign-in" || signUpClosed ? <SignInForm /> : <SignUpForm invite={invite} meta={meta} />}
      </div>
      {meta?.supportUrl && (
        <a
          href={meta.supportUrl}
          target="_blank"
          rel="noreferrer noopener"
          className={`mt-6 inline-flex items-center gap-1.5 ${linkClass}`}
        >
          <LifeBuoy className="size-3.5" aria-hidden="true" />
          {t("welcome.support", { name: meta.instanceName ?? "Passbox" })}
        </a>
      )}
      <details className="group mt-6">
        <summary className={`flex cursor-pointer list-none items-center gap-1 ${linkClass}`}>
          <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" aria-hidden="true" />
          {t("welcome.advanced")}
        </summary>
        <button type="button" onClick={() => setChoosingServer(true)} className={`mt-2 ml-5 ${linkClass}`}>
          {t("server.title.change")}
        </button>
      </details>
    </AuthLayout>
  );
}

/** Checks the Secret Key locally, so a typo never costs a sign-in attempt. */
async function checkSecretKey(input: string, t: (key: string, params?: Record<string, number>) => string) {
  const core = await loadCore();
  try {
    core.normalizeSecretKey(input);
    return undefined;
  } catch {
    const compact = input.replace(/[\s-]/g, "").toUpperCase();
    if (compact.startsWith("P1") && compact.length < SECRET_KEY_LENGTH && /^[0-9A-Z]*$/.test(compact)) {
      return t("signIn.secretKeyLength", { missing: SECRET_KEY_LENGTH - compact.length });
    }
    throw new SecretKeyFormatError();
  }
}

function SignInForm() {
  const client = useClient();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [forgotOpen, setForgotOpen] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(undefined);
    try {
      const problem = await checkSecretKey(String(form.get("secretKey")), t);
      if (problem) {
        setError(problem);
        return;
      }
    } catch (e) {
      setError(errorMessage(e, "signIn"));
      return;
    }
    setBusy(true);
    await nextFrame();
    try {
      await client.signIn(String(form.get("email")), String(form.get("password")), String(form.get("secretKey")));
    } catch (e) {
      setError(errorMessage(e, "signIn"));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Input
        label={t("field.email")}
        name="email"
        type="email"
        autoComplete="username"
        placeholder={t("field.emailPlaceholder")}
        required
      />
      <PasswordInput
        label={t("term.masterPassword")}
        name="password"
        autoComplete="current-password"
        required
        labelAction={
          <button type="button" onClick={() => setForgotOpen(true)} className={linkClass}>
            {t("forgot.link")}
          </button>
        }
      />
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
      <FormError message={error} />
      <Button type="submit" size="lg" loading={busy} className="mt-1">
        {busy ? t("signIn.busy") : t("action.signIn")}
      </Button>
      <ForgotPasswordDialog open={forgotOpen} onOpenChange={setForgotOpen} />
    </form>
  );
}

function SignUpForm({ invite, meta }: { invite: InviteLink | undefined; meta: ServerMeta | undefined }) {
  const client = useClient();
  const kit = useKit();
  const { t, locale } = useI18n();
  const [email, setEmail] = useState(invite?.email ?? "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [suggestion, setSuggestion] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function suggest() {
    const core = await loadCore();
    setSuggestion(
      core.generatePassphrase(JSON.stringify({ words: 5, separator: "-", capitalize: true, includeDigit: true })),
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
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
      const { accountId } = await client.signUp(email, password, {
        locale,
        ...(invite ? { inviteToken: invite.token } : {}),
      });
      // The invitation is used up; keep it out of the address bar.
      if (invite) window.history.replaceState(null, "", "#/");
      kit.startOnboarding(accountId);
    } catch (e) {
      setError(errorMessage(e, "signUp"));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Input
        label={t("field.email")}
        name="email"
        type="email"
        autoComplete="username"
        placeholder={t("field.emailPlaceholder")}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        hint={
          invite
            ? t("signUp.invited")
            : meta?.registration === "domains" && meta.allowedDomains?.length
              ? t("signUp.domainsHint", { domains: meta.allowedDomains.join(", ") })
              : undefined
        }
      />
      <div className="flex flex-col gap-2">
        <PasswordInput
          label={t("term.masterPassword")}
          name="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          hint={t("signUp.passwordHint")}
        />
        {password && <PasswordStrength password={password} context={[email]} master />}
        {suggestion ? (
          <div className="rounded-lg border border-accent/20 bg-accent-soft p-3 text-[0.8125rem]">
            <p className="text-text-muted">{t("signUp.suggestion")}</p>
            <p className="mt-1 font-mono text-[0.9375rem] font-medium break-all text-text">{suggestion}</p>
            <p className="mt-1 text-xs text-text-muted">{t("signUp.suggestionHint")}</p>
            <div className="mt-2 flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  setPassword(suggestion);
                  setConfirm(suggestion);
                  setSuggestion(undefined);
                }}
              >
                {t("signUp.useSuggestion")}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void suggest()}>
                {t("generator.another")}
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="ghost" size="sm" className="self-start" onClick={() => void suggest()}>
            <Sparkles />
            {t("signUp.suggest")}
          </Button>
        )}
      </div>
      <PasswordInput
        label={t("signUp.confirm")}
        name="confirm"
        autoComplete="new-password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        required
      />
      <FormError message={error} />
      <Button type="submit" size="lg" loading={busy} className="mt-1">
        {busy ? t("signUp.busy") : t("action.createAccount")}
      </Button>
      <p className="text-center text-xs text-text-muted">{t("signUp.next")}</p>
    </form>
  );
}
