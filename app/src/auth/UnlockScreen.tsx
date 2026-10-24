import { Button, Monogram, PasswordInput } from "@passbox/ui";
import { type FormEvent, useState } from "react";
import { errorMessage, nextFrame } from "../core";
import { useClient, useSnapshot } from "../useClient";
import { AuthLayout, FormError } from "./AuthLayout";

export function UnlockScreen() {
  const client = useClient();
  const { email = "" } = useSnapshot();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = String(new FormData(event.currentTarget).get("password"));
    setBusy(true);
    setError(undefined);
    await nextFrame();
    try {
      await client.unlock(password);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <form onSubmit={submit} className="flex flex-col gap-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Unlock your vault</h1>
          <div className="mt-4 flex items-center gap-3 rounded-lg border border-border bg-surface p-3 shadow-xs">
            <Monogram name={email} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{email}</p>
              <p className="text-xs text-text-muted">Secret Key stored on this device</p>
            </div>
          </div>
        </div>
        <PasswordInput label="Master password" name="password" autoComplete="current-password" autoFocus required />
        <FormError message={error} />
        <Button type="submit" size="lg" loading={busy}>
          {busy ? "Unlocking…" : "Unlock"}
        </Button>
        <button
          type="button"
          onClick={() => client.signOut()}
          className="text-[13px] text-text-muted underline-offset-4 hover:text-text hover:underline"
        >
          Not you? Sign in with a different account
        </button>
      </form>
    </AuthLayout>
  );
}
