import type { ServerMeta } from "@passbox/api-client";
import { Badge, Logo } from "@passbox/ui";
import { EyeOff, Laptop, ServerCog, ShieldAlert, Sparkles } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { useI18n } from "../lib/i18n";
import { LINKS } from "../lib/links";
import { isInsecurePage, serverApi, serverLabel, serverUrl } from "../lib/server";

const POINTS = [
  { icon: EyeOff, title: "landing.point1.title", text: "landing.point1.text" },
  { icon: Sparkles, title: "landing.point2.title", text: "landing.point2.text" },
  { icon: Laptop, title: "landing.point3.title", text: "landing.point3.text" },
];

export function AuthLayout({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="flex min-h-full flex-col">
      <InsecurePageBanner />
      <div className="grid flex-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
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
            <h2 className="text-3xl font-semibold tracking-tight text-balance">{t("landing.headline")}</h2>
            <ul className="mt-10 flex flex-col gap-6">
              {POINTS.map(({ icon: Icon, title, text }) => (
                <li key={title} className="flex gap-4">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">{t(title)}</span>
                    <span className="mt-0.5 block text-sm text-white/75">{t(text)}</span>
                  </span>
                </li>
              ))}
            </ul>
            <a
              href={LINKS.design}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-8 inline-block text-sm text-white/80 underline underline-offset-4 hover:text-white"
            >
              {t("landing.moreSecurity")}
            </a>
          </div>
          <p className="relative flex items-center gap-2 text-xs text-white/70">
            <ServerCog className="size-3.5" aria-hidden="true" />
            {t("landing.footer")}
          </p>
        </aside>
        <main className="flex flex-col items-center justify-center px-4 py-10 sm:px-6">
          <div className="w-full max-w-[25rem]">
            <div className="mb-8 flex items-center gap-2 lg:mb-6">
              <Logo className="text-text lg:hidden" />
              <PreviewBadge />
            </div>
            {children}
            <ServerStatus />
          </div>
        </main>
      </div>
    </div>
  );
}

/** "Preview" badge with the honest notice that Passbox is not audited yet. */
export function PreviewBadge() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <span className="relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="rounded-md focus-visible:outline-2 focus-visible:outline-accent"
      >
        <Badge tone="warning">{t("notice.previewBadge")}</Badge>
      </button>
      {open && (
        <span
          role="note"
          className="absolute top-7 left-0 z-10 w-72 rounded-lg border border-border bg-surface p-3 text-xs text-text shadow-overlay"
        >
          {t("notice.preview")}
        </span>
      )}
    </span>
  );
}

/** Shown when the page itself came over plain http from another computer (S12). */
export function InsecurePageBanner() {
  const { t } = useI18n();
  if (!isInsecurePage()) return null;
  return (
    <div role="alert" className="flex items-start gap-3 bg-danger px-4 py-3 text-sm text-white">
      <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p>
        <strong className="font-semibold">{t("insecure.title")}</strong> {t("insecure.body")}
      </p>
    </div>
  );
}

type State = { kind: "checking" } | { kind: "online"; meta: ServerMeta } | { kind: "offline" } | { kind: "none" };

function ServerStatus() {
  const { t } = useI18n();
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
      ? t("server.status.none")
      : state.kind === "checking"
        ? t("server.status.checking", { server })
        : state.kind === "online"
          ? t("server.status.online", { server, version: state.meta.version })
          : t("server.status.offline", { server });
  const dot = state.kind === "online" ? "bg-success" : state.kind === "offline" ? "bg-danger" : "bg-warning";
  return (
    <p className="mt-10 flex items-center gap-2 text-xs text-text-muted" role="status">
      <span className={`size-1.5 rounded-full ${dot}`} aria-hidden="true" />
      {text}
    </p>
  );
}

export function FormError({ message }: { message: string | undefined }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-lg border border-danger/20 bg-danger-soft px-3 py-2.5 text-[0.8125rem] text-danger"
    >
      {message}
    </p>
  );
}
