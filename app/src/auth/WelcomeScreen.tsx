import { Button, Input, PasswordInput, SegmentedControl } from "@passbox/ui";
import { ChevronRight, Sparkles } from "lucide-react";
import { type FormEvent, useState } from "react";
import { errorMessage, loadCore, nextFrame } from "../core";
import { PasswordStrength } from "../items/PasswordStrength";
import { SecretKeyFormatError } from "../lib/errors";
import { wasUsedBefore } from "../lib/firstRun";
import { useI18n } from "../lib/i18n";
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
  // First visit on this device: most people are here to create an account.
  const [mode, setMode] = useState<"sign-in" | "sign-up">(() => (wasUsedBefore() ? "sign-in" : "sign-up"));
  const [choosingServer, setChoosingServer] = useState(false);

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
      <div className="mt-6">{mode === "sign-in" ? <SignInForm /> : <SignUpForm />}</div>
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

function SignUpForm() {
  const client = useClient();
  const kit = useKit();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
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
    if (!client.estimateStrength(password, [email]).acceptableMasterPassword) {
      setError(t("signUp.tooWeak"));
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
      const { accountId } = await client.signUp(email, password);
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
