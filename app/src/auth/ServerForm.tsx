import { Button, Input } from "@passbox/ui";
import { Server } from "lucide-react";
import { type FormEvent, useState } from "react";
import { canUseOwnOrigin, changeServer, parseServerUrl, serverApi, serverLabel, storedServerUrl } from "../lib/server";
import { FormError } from "./AuthLayout";

/** Chooses the Passbox server. Only shown while signed out; saving reloads the app. */
export function ServerForm({ onCancel }: { onCancel?: (() => void) | undefined }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const stored = storedServerUrl();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    let url: string;
    try {
      url = parseServerUrl(String(new FormData(event.currentTarget).get("server")));
    } catch (e) {
      setError((e as Error).message);
      return;
    }
    setBusy(true);
    try {
      const meta = await serverApi(url).meta();
      if (meta.name !== "passbox") throw new Error("not a Passbox server");
    } catch {
      setError(`No Passbox server answered at ${serverLabel(url)}. Check the address and your connection.`);
      setBusy(false);
      return;
    }
    changeServer(url);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {onCancel ? "Use a different server" : "Connect to your server"}
        </h1>
        <p className="mt-1.5 text-sm text-text-muted">
          Enter the address of the Passbox server that stores your vault. It only ever receives encrypted data.
        </p>
      </div>
      <Input
        label="Server address"
        name="server"
        type="text"
        inputMode="url"
        autoComplete="url"
        spellCheck={false}
        placeholder="https://passbox.example.com"
        defaultValue={stored ?? ""}
        leading={<Server />}
        autoFocus
        required
      />
      <FormError message={error} />
      <Button type="submit" size="lg" loading={busy}>
        {busy ? "Checking the server…" : "Connect"}
      </Button>
      {(onCancel || (canUseOwnOrigin && stored)) && (
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-2">
          {onCancel && (
            <button type="button" onClick={onCancel} className={linkClass}>
              Cancel
            </button>
          )}
          {canUseOwnOrigin && stored && (
            <button type="button" onClick={() => changeServer(undefined)} className={linkClass}>
              Use {window.location.host} instead
            </button>
          )}
        </div>
      )}
    </form>
  );
}

export const linkClass = "text-[13px] text-text-muted underline-offset-4 hover:text-text hover:underline";
