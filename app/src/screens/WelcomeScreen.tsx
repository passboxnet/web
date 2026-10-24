import { Button, cn, Input } from "@passbox/ui";
import { type FormEvent, useState } from "react";
import { AuthLayout, errorMessage, FormError } from "../components/AuthLayout";
import { nextFrame } from "../core";
import { useClient } from "../useClient";

const MIN_PASSWORD_LENGTH = 10;

export function WelcomeScreen({ onSignedUp }: { onSignedUp: (secretKey: string) => void }) {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  return (
    <AuthLayout>
      <div className="mb-6 grid grid-cols-2 rounded-lg bg-surface-raised p-1 text-sm" role="tablist">
        {(["sign-in", "sign-up"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={cn(
              "h-9 rounded-md font-medium transition",
              mode === m ? "bg-surface text-text shadow-sm" : "text-text-muted hover:text-text",
            )}
          >
            {m === "sign-in" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>
      {mode === "sign-in" ? <SignInForm /> : <SignUpForm onSignedUp={onSignedUp} />}
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
      <p className="text-sm text-text-muted">Sign in on this device with your Emergency Kit at hand.</p>
      <Input label="Email" name="email" type="email" autoComplete="username" required />
      <Input label="Master password" name="password" type="password" autoComplete="current-password" required />
      <Input
        label="Secret Key"
        name="secretKey"
        placeholder="P1-XXXXX-XXXXX-XXXXX-XXXXX-XXXXXX"
        autoComplete="off"
        spellCheck={false}
        required
        hint="Printed in your Emergency Kit. You only need it once per device."
      />
      <FormError message={error} />
      <Button type="submit" size="lg" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}

function SignUpForm({ onSignedUp }: { onSignedUp: (secretKey: string) => void }) {
  const client = useClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password"));
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters for your master password.`);
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
      <p className="text-sm text-text-muted">
        Your master password never leaves this device. If you forget it, nobody can recover your data, not even us.
      </p>
      <Input label="Email" name="email" type="email" autoComplete="username" required />
      <Input
        label="Master password"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={MIN_PASSWORD_LENGTH}
        required
        hint="A long passphrase of four or more random words works well."
      />
      <Input label="Confirm master password" name="confirm" type="password" autoComplete="new-password" required />
      <FormError message={error} />
      <Button type="submit" size="lg" disabled={busy}>
        {busy ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
