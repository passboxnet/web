import type { ServerMeta } from "@passbox/api-client";
import { GridFrame, Logo, Panel } from "@passbox/ui";
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

/**
 * The brand moment: sign-up, sign-in, unlock and recovery sit in a bezelled
 * panel on the signature backdrop (deep Marina with a Sky glow, with grain).
 * Wide screens show the dark brand half with the dotted grid frame next to
 * the form; the form half follows the theme.
 */
export function AuthLayout({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="relative isolate flex min-h-full flex-col overflow-x-hidden bg-backdrop">
      <div aria-hidden="true" className="grain pointer-events-none absolute inset-0 -z-10" />
      <InsecurePageBanner />
      <header className="flex items-center justify-between px-5 pt-5 sm:px-10 sm:pt-7">
        <Logo className="text-white" />
        <a
          href={LINKS.design}
          target="_blank"
          rel="noreferrer noopener"
          className="hidden rounded-full px-3 py-1.5 text-label text-white/80 ring-1 ring-white/20 transition-colors hover:bg-white/10 hover:text-white sm:inline-flex"
        >
          {t("landing.moreSecurity")}
        </a>
      </header>
      <main className="flex flex-1 items-center justify-center px-3 py-6 sm:px-6 sm:py-10">
        <Panel bezel className="w-full max-w-[60rem]">
          <div className="grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
            <aside
              data-theme="dark"
              className="relative hidden flex-col justify-between overflow-hidden bg-canvas py-10 text-text lg:flex"
            >
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 opacity-90"
                style={{
                  background:
                    "radial-gradient(70% 55% at 15% 0%, color-mix(in oklch, var(--color-sky) 34%, transparent), transparent 70%), radial-gradient(60% 45% at 100% 100%, color-mix(in oklch, var(--color-solar) 12%, transparent), transparent 70%)",
                }}
              />
              <GridFrame edges="both" className="py-10">
                <div className="px-6">
                  <p className="text-overline text-accent uppercase">{t("landing.eyebrow")}</p>
                  <h2 className="mt-3 text-title text-balance text-text">{t("landing.headline")}</h2>
                  <ul className="mt-8 flex flex-col gap-5">
                    {POINTS.map(({ icon: Icon, title, text }) => (
                      <li key={title} className="flex gap-3.5">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-surface-raised text-accent shadow-highlight ring-1 ring-hairline">
                          <Icon className="size-4" aria-hidden="true" />
                        </span>
                        <span>
                          <span className="block text-label text-text">{t(title)}</span>
                          <span className="mt-0.5 block text-body-sm text-text-muted">{t(text)}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </GridFrame>
              <p className="relative mt-8 flex items-center gap-2 px-10 text-caption text-text-subtle">
                <ServerCog className="size-3.5" aria-hidden="true" />
                {t("landing.footer")}
              </p>
            </aside>
            <div className="flex flex-col bg-surface px-5 py-8 sm:px-10 sm:py-10">
              <div className="mx-auto w-full max-w-[25rem]">
                {children}
                <ServerStatus />
              </div>
            </div>
          </div>
        </Panel>
      </main>
    </div>
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
      className="rounded-control border border-danger/25 bg-danger-soft px-3.5 py-2.5 text-body text-danger"
    >
      {message}
    </p>
  );
}
