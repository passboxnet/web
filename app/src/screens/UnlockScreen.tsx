import { createClient, type ServerMeta } from "@passbox/api-client";
import { Button, Input, Logo } from "@passbox/ui";
import { type FormEvent, useEffect, useState } from "react";

const api = createClient();

type ServerState = { kind: "checking" } | { kind: "online"; meta: ServerMeta } | { kind: "offline" };

export function UnlockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [server, setServer] = useState<ServerState>({ kind: "checking" });

  useEffect(() => {
    api
      .meta()
      .then((meta) => setServer({ kind: "online", meta }))
      .catch(() => setServer({ kind: "offline" }));
  }, []);

  function submit(event: FormEvent) {
    event.preventDefault();
    onUnlock();
  }

  return (
    <main className="flex min-h-full items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo className="text-text" />
        </div>
        <form
          onSubmit={submit}
          className="flex flex-col gap-5 rounded-card border border-border bg-surface p-6 shadow-sm"
        >
          <div>
            <h1 className="text-xl font-semibold">Unlock your vault</h1>
            <p className="mt-1 text-sm text-text-muted">
              Your data is encrypted on this device. The server only ever sees ciphertext.
            </p>
          </div>
          <Input label="Email" type="email" autoComplete="username" placeholder="you@example.com" />
          <Input label="Master password" type="password" autoComplete="current-password" />
          <Input
            label="Secret Key"
            placeholder="P1-XXXXX-XXXXX-XXXXX-XXXXX-XXXXXX"
            autoComplete="off"
            spellCheck={false}
            hint="Only needed the first time you sign in on a new device. You'll find it in your Emergency Kit."
          />
          <Button type="submit" size="lg">
            Unlock
          </Button>
          <p className="rounded-lg bg-surface-raised px-3 py-2 text-xs text-text-muted">
            Preview build: accounts are not implemented yet. Unlock opens a vault with sample data.
          </p>
        </form>
        <ServerStatus state={server} />
      </div>
    </main>
  );
}

function ServerStatus({ state }: { state: ServerState }) {
  const text =
    state.kind === "checking"
      ? "Checking server…"
      : state.kind === "online"
        ? `Connected to Passbox server ${state.meta.version}`
        : "Server not reachable";
  const dot = state.kind === "online" ? "bg-success" : state.kind === "offline" ? "bg-danger" : "bg-warning";
  return (
    <p className="mt-4 flex items-center justify-center gap-2 text-xs text-text-muted" role="status">
      <span className={`size-2 rounded-full ${dot}`} aria-hidden="true" />
      {text}
    </p>
  );
}
