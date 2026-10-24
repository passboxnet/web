import { Button, Input, PasswordInput, SegmentedControl, StrengthMeter } from "@passbox/ui";
import { type FormEvent, useState } from "react";
import { errorMessage, nextFrame } from "../core";
import { serverUrl } from "../lib/server";
import { useClient } from "../useClient";
import { AuthLayout, FormError } from "./AuthLayout";
import { linkClass, ServerForm } from "./ServerForm";

const MIN_PASSWORD_LENGTH = 10;

export function WelcomeScreen({ onSignedUp }: { onSignedUp: (secretKey: string) => void }) {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
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
        {mode === "sign-in" ? "Sign in to Passbox" : "Create your account"}
      </h1>
      <p className="mt-1.5 text-sm text-text-muted">
        {mode === "sign-in"
          ? "Use your Emergency Kit to sign in on this device."
          : "Set up an end-to-end encrypted vault in less than a minute."}
      </p>
      <SegmentedControl
        className="mt-6 w-full"
        label="Choose"
        value={mode}
        onChange={setMode}
        options={[
          { value: "sign-in", label: "Sign in" },
          { value: "sign-up", label: "Create account" },
        ]}
      />
      <div className="mt-6">{mode === "sign-in" ? <SignInForm /> : <SignUpForm onSignedUp={onSignedUp} />}</div>
      <button type="button" onClick={() => setChoosingServer(true)} className={`mt-6 ${linkClass}`}>
        Use a different server
      </button>
    </AuthLayout>
  );
}

function SignInForm() {
  const client = useClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(undefined);
    await nextFrame();
    try {
      await client.signIn(String(form.get("email")), String(form.get("password")), String(form.get("secretKey")));
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Input label="Email" name="email" type="email" autoComplete="username" placeholder="you@company.com" required />
      <PasswordInput label="Master password" name="password" autoComplete="current-password" required />
      <Input
        label="Secret Key"
        name="secretKey"
        placeholder="P1-XXXXX-XXXXX-XXXXX-XXXXX-XXXXXX"
        autoComplete="off"
        spellCheck={false}
        className="font-mono uppercase placeholder:normal-case"
        required
        hint="From your Emergency Kit. Needed once per device."
      />
      <FormError message={error} />
      <Button type="submit" size="lg" loading={busy} className="mt-1">
        {busy ? "Deriving keys on this device…" : "Sign in"}
      </Button>
    </form>
  );
}

function SignUpForm({ onSignedUp }: { onSignedUp: (secretKey: string) => void }) {
  const client = useClient();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const strength = client.estimateStrength(password);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters for your master password.`);
      return;
    }
    if (!client.estimateStrength(password, [String(form.get("email"))]).acceptableMasterPassword) {
      setError("This master password is too easy to guess. Try a passphrase of four or more random words.");
      return;
    }
    if (password !== form.get("confirm")) {
      setError("The passwords do not match.");
      return;
    }
    setBusy(true);
    setError(undefined);
    await nextFrame();
    try {
      const { secretKey } = await client.signUp(String(form.get("email")), password);
      onSignedUp(secretKey);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Input label="Email" name="email" type="email" autoComplete="username" placeholder="you@company.com" required />
      <div className="flex flex-col gap-2">
        <PasswordInput
          label="Master password"
          name="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={MIN_PASSWORD_LENGTH}
          required
          hint="The only password you need to remember. Nobody can reset it, not even us."
        />
        {password && <StrengthMeter score={strength.score} label={strength.label} />}
      </div>
      <PasswordInput label="Confirm master password" name="confirm" autoComplete="new-password" required />
      <FormError message={error} />
      <Button type="submit" size="lg" loading={busy} className="mt-1">
        {busy ? "Creating your encrypted vault…" : "Create account"}
      </Button>
      <p className="text-center text-xs text-text-subtle">
        Next, you will save your Emergency Kit with your Secret Key.
      </p>
    </form>
  );
}
