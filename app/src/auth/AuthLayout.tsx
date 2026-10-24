import type { ServerMeta } from "@passbox/api-client";
import { Logo } from "@passbox/ui";
import { Fingerprint, KeyRound, ServerCog, ShieldCheck } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { serverApi, serverLabel, serverUrl } from "../lib/server";

const POINTS = [
  {
    icon: ShieldCheck,
    title: "End-to-end encrypted",
    text: "Everything is encrypted on this device before it is sent. The server only stores ciphertext.",
  },
  {
    icon: KeyRound,
    title: "Two secrets, not one",
    text: "Your master password and a 128-bit Secret Key protect your account together.",
  },
  {
    icon: Fingerprint,
    title: "Zero-knowledge sign-in",
    text: "OPAQUE proves you know your password without ever revealing it to the server.",
  },
];

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-full lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden overflow-hidden bg-brand-950 text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(60% 50% at 20% 10%, oklch(0.45 0.2 262 / 0.6), transparent), radial-gradient(50% 40% at 90% 90%, oklch(0.45 0.18 300 / 0.35), transparent)",
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        <Logo className="relative text-white" />
        <div className="relative max-w-md">
          <h2 className="text-3xl font-semibold tracking-tight text-balance">
            Your secrets, encrypted before they leave this device.
          </h2>
          <ul className="mt-10 flex flex-col gap-6">
            {POINTS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{title}</span>
                  <span className="mt-0.5 block text-sm text-white/70">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative flex items-center gap-2 text-xs text-white/60">
          <ServerCog className="size-3.5" aria-hidden="true" />
          Open source under the MIT License · Self-hostable
        </p>
      </aside>
      <main className="flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-[400px]">
          <Logo className="mb-10 text-text lg:hidden" />
          {children}
          <ServerStatus />
        </div>
      </main>
    </div>
  );
}

type State = { kind: "checking" } | { kind: "online"; meta: ServerMeta } | { kind: "offline" } | { kind: "none" };

function ServerStatus() {
  const [state, setState] = useState<State>(serverUrl() ? { kind: "checking" } : { kind: "none" });

  useEffect(() => {
    if (!serverUrl()) return;
    serverApi()
      .meta()
      .then((meta) => setState({ kind: "online", meta }))
      .catch(() => setState({ kind: "offline" }));
  }, []);

  const server = serverLabel();
  const text =
    state.kind === "none"
      ? "No server selected"
      : state.kind === "checking"
        ? `Connecting to ${server}…`
        : state.kind === "online"
          ? `${server} · v${state.meta.version}`
          : `${server} · not reachable`;
  const dot = state.kind === "online" ? "bg-success" : state.kind === "offline" ? "bg-danger" : "bg-warning";
  return (
    <p className="mt-10 flex items-center gap-2 text-xs text-text-subtle" role="status">
      <span className={`size-1.5 rounded-full ${dot}`} aria-hidden="true" />
      {text}
    </p>
  );
}

export function FormError({ message }: { message: string | undefined }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg border border-danger/20 bg-danger-soft px-3 py-2.5 text-[13px] text-danger">
      {message}
    </p>
  );
}
