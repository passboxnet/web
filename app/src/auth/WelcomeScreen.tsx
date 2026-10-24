import type { InvitationPreview, ServerMeta } from "@passbox/api-client";
import { TwoFactorRequiredError } from "@passbox/client";
import { Button, Input, PasswordInput, SegmentedControl, Switch, toast } from "@passbox/ui";
import { ChevronRight, House, Info, LifeBuoy, Sparkles } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { errorMessage, loadCore, nextFrame } from "../core";
import { PasswordStrength } from "../items/PasswordStrength";
import { SecretKeyFormatError } from "../lib/errors";
import { wasUsedBefore } from "../lib/firstRun";
import { useI18n } from "../lib/i18n";
import { type InviteLink, inviteFromHash, meetsPasswordPolicy, useServerMeta } from "../lib/instance";
import { serverUrl } from "../lib/server";
import { type OrgInviteLink, useOrgInvite } from "../lib/sharing";
import { LinkDeviceLink, PendingRecoveryNotice } from "../recovery/PendingRecoveryNotice";
import { SsoSignInOption } from "../sso/SsoSignIn";
import { useClient } from "../useClient";
import { AuthLayout, FormError } from "./AuthLayout";
import { useKit } from "./KitProvider";
import { linkClass, ServerForm } from "./ServerForm";
import { ForgotPasswordDialog } from "./SignOutDialog";
import { TwoFactorStep } from "./TwoFactorStep";

/** Characters of a Secret Key without dashes: "P1" plus 26. */
const SECRET_KEY_LENGTH = 28;

export function WelcomeScreen() {
  const { t } = useI18n();
  const client = useClient();
  const [invite] = useState<InviteLink | undefined>(() => inviteFromHash());
  // An invitation to a family or team (`/invite/…`), kept for this tab.
  const orgInvite = useOrgInvite();
  const [orgPreview, setOrgPreview] = useState<InvitationPreview | null>();
  const orgLink = orgInvite?.link;
  useEffect(() => {
    setOrgPreview(undefined);
    if (!orgLink) return;
    let cancelled = false;
    client
      .previewInvitation(orgLink)
      .then((preview) => !cancelled && setOrgPreview(preview))
      .catch(() => !cancelled && setOrgPreview(null));
    return () => {
      cancelled = true;
    };
  }, [client, orgLink]);
  // First visit on this device or an invitation: most people are here to create an account.
  const [mode, setMode] = useState<"sign-in" | "sign-up">(() => (invite || !wasUsedBefore() ? "sign-up" : "sign-in"));
  const [choosingServer, setChoosingServer] = useState(false);
  const meta = useServerMeta();
  // Servers that only accept invited accounts hide "Create account" without an invitation.
  const signUpClosed = meta?.registration === "invite_only" && !invite && !orgPreview;
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
      <PendingRecoveryNotice />
      <h1 className="text-2xl font-semibold tracking-tight">
        {mode === "sign-in" ? t("signIn.title") : t("signUp.title")}
      </h1>
      <p className="mt-1.5 text-sm text-text-muted">
        {mode === "sign-in" ? t("signIn.description") : t("signUp.description")}
      </p>
      {orgInvite && orgPreview !== undefined && <OrgInviteNotice preview={orgPreview} />}
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
        {mode === "sign-in" || signUpClosed ? (
          <SignInForm />
        ) : (
          <SignUpForm
            key={orgPreview?.email ?? ""}
            invite={invite}
            orgInvite={orgInvite && orgPreview ? { link: orgInvite, email: orgPreview.email } : undefined}
            meta={meta}
          />
        )}
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
  const [twoFactor, setTwoFactor] = useState(false);
  const [email, setEmail] = useState("");

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
      setBusy(false);
      if (e instanceof TwoFactorRequiredError) {
        setTwoFactor(true);
        return;
      }
      setError(errorMessage(e, "signIn"));
    }
  }

  if (twoFactor) {
    return (
      <TwoFactorStep
        heading="h2"
        onCancel={(message) => {
          setTwoFactor(false);
          setError(message);
        }}
      />
    );
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
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <SsoSignInOption email={email} />
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
      <div className="text-center">
        <LinkDeviceLink />
      </div>
      <ForgotPasswordDialog open={forgotOpen} onOpenChange={setForgotOpen} />
    </form>
  );
}

/** "Anna invited you to a family": shown above sign-in and sign-up while an invitation waits. */
function OrgInviteNotice({ preview }: { preview: InvitationPreview | null }) {
  const { t } = useI18n();
  if (!preview) {
    return (
      <p role="note" className="mt-5 flex gap-2 rounded-lg border border-border bg-surface-sunken p-3 text-[0.8125rem]">
        <Info className="mt-0.5 size-4 shrink-0 text-text-muted" aria-hidden="true" />
        {t("sharing.accept.invalid")}
      </p>
    );
  }
  const family = preview.orgKind !== "team";
  return (
    <div
      role="note"
      className="mt-5 flex gap-3 rounded-lg border border-accent/25 bg-accent-soft p-3 text-[0.8125rem]"
      data-testid="org-invite-notice"
    >
      <House className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
      <div>
        <p className="font-semibold">
          {preview.inviterEmail
            ? family
              ? t("sharing.accept.titleFamily", { name: preview.inviterEmail })
              : t("sharing.accept.titleTeam", { name: preview.inviterEmail })
            : family
              ? t("sharing.accept.titleFamilyAnon")
              : t("sharing.accept.titleTeamAnon")}
        </p>
        <p className="mt-0.5 text-text-muted">{t("sharing.accept.signInFirst", { email: preview.email })}</p>
      </div>
    </div>
  );
}

function SignUpForm({
  invite,
  orgInvite,
  meta,
}: {
  invite: InviteLink | undefined;
  orgInvite: { link: OrgInviteLink; email: string } | undefined;
  meta: ServerMeta | undefined;
}) {
  const client = useClient();
  const kit = useKit();
  const { t, locale } = useI18n();
  const [email, setEmail] = useState(invite?.email || orgInvite?.email || "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [suggestion, setSuggestion] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  // Opt-in: a recovery code for the Emergency Kit (C2).
  const [withRecoveryCode, setWithRecoveryCode] = useState(false);

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
      // An invitation to a family or team also opens invite-only servers, for its own address.
      const orgToken =
        orgInvite && email.trim().toLowerCase() === orgInvite.email.toLowerCase() ? orgInvite.link.token : undefined;
      const inviteToken = invite?.token ?? orgToken;
      const { accountId } = await client.signUp(email, password, {
        locale,
        ...(inviteToken ? { inviteToken } : {}),
      });
      // The invitation is used up; keep it out of the address bar.
      if (invite) window.history.replaceState(null, "", "#/");
      let recoveryCode: string | undefined;
      if (withRecoveryCode) {
        try {
          recoveryCode = await client.createRecoveryCode();
        } catch (e) {
          toast.error(t("recoveryCode.signUpFailed"), { description: errorMessage(e) });
        }
      }
      kit.startOnboarding(accountId, recoveryCode ? { recoveryCode } : {});
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
          invite || orgInvite
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
      <Switch
        label={t("recoveryCode.signUpLabel")}
        description={t("recoveryCode.signUpDescription")}
        checked={withRecoveryCode}
        onCheckedChange={setWithRecoveryCode}
      />
      <FormError message={error} />
      <Button type="submit" size="lg" loading={busy} className="mt-1">
        {busy ? t("signUp.busy") : t("action.createAccount")}
      </Button>
      <p className="text-center text-xs text-text-muted">{t("signUp.next")}</p>
    </form>
  );
}
