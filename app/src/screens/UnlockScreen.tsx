import { Button, Input } from "@passbox/ui";
import { type FormEvent, useState } from "react";
import { AuthLayout, errorMessage, FormError } from "../components/AuthLayout";
import { nextFrame } from "../core";
import { useClient, useSnapshot } from "../useClient";

export function UnlockScreen() {
  const client = useClient();
  const { email } = useSnapshot();
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
          <h1 className="text-xl font-semibold">Unlock your vault</h1>
          <p className="mt-1 text-sm text-text-muted">{email}</p>
        </div>
        <Input
          label="Master password"
          name="password"
          type="password"
          autoComplete="current-password"
          autoFocus
          required
        />
        <FormError message={error} />
        <Button type="submit" size="lg" disabled={busy}>
          {busy ? "Unlocking…" : "Unlock"}
        </Button>
        <button
          type="button"
          onClick={() => client.signOut()}
          className="text-sm text-text-muted underline-offset-2 hover:text-text hover:underline"
        >
          Use a different account
        </button>
      </form>
    </AuthLayout>
  );
}
