import { Button, cn } from "@passbox/ui";
import { BrandIcon } from "@passbox/ui/brand-icon";
import { CheckCircle2, Circle, ExternalLink, X } from "lucide-react";
import type { ReactNode } from "react";
import { useKit } from "../auth/KitProvider";
import { useI18n } from "../lib/i18n";
import { IMPORT_HASH, LINKS } from "../lib/links";
import { setChecklist, usePreferences } from "../lib/preferences";
import type { Route } from "../lib/route";
import { useSnapshot } from "../useClient";
import { Page } from "./PageHeader";

interface Step {
  id: string;
  title: string;
  text: string;
  done: boolean;
  action?: ReactNode;
  /** Platforms the step is for, by bundled icon. */
  platforms?: Array<{ icon: string; name: string }>;
}

/** Progress of the first-run checklist, for the sidebar entry. */
export function useChecklist() {
  const steps = useSteps(() => undefined);
  const { checklist } = usePreferences();
  const done = steps.filter((s) => s.done).length;
  return { visible: !checklist.dismissed && done < steps.length, done, total: steps.length };
}

function useSteps(navigate: (route: Route) => void): Step[] {
  const { t } = useI18n();
  const kit = useKit();
  const { items, trash } = useSnapshot();
  const { checklist } = usePreferences();
  const markDone = (step: "extension" | "phone" | "import") => (
    <Button size="xs" variant="ghost" onClick={() => setChecklist({ [step]: true })}>
      {t("start.markDone")}
    </Button>
  );
  const link = (href: string, label: string, external = false) => (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noreferrer noopener" } : {})}
      className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border-strong bg-surface px-2 text-xs font-medium shadow-xs hover:bg-surface-raised coarse:h-11"
    >
      {label}
      {external && <ExternalLink className="size-3" aria-hidden="true" />}
    </a>
  );
  return [
    { id: "account", title: t("start.account.title"), text: t("start.account.text"), done: true },
    {
      id: "kit",
      title: t("start.kit.title"),
      text: t("start.kit.text"),
      done: !kit.pending,
      action: (
        <Button size="xs" onClick={kit.requestKit}>
          {t("kit.reminder.action")}
        </Button>
      ),
    },
    {
      id: "extension",
      title: t("start.extension.title"),
      text: t("start.extension.text"),
      done: checklist.extension,
      platforms: [
        { icon: "chrome", name: "Google Chrome" },
        { icon: "edge", name: "Microsoft Edge" },
        { icon: "brave", name: "Brave" },
      ],
      action: (
        <>
          {link(LINKS.extension, t("start.extension.action"), true)}
          {markDone("extension")}
        </>
      ),
    },
    {
      id: "import",
      title: t("start.import.title"),
      text: t("start.import.text"),
      done: checklist.import || items.length + trash.length > 0,
      action: (
        <>
          {link(IMPORT_HASH, t("start.import.action"))}
          <Button
            size="xs"
            variant="ghost"
            onClick={() => navigate({ view: "items", filter: { kind: "all" }, create: "login" })}
          >
            {t("start.import.manual")}
          </Button>
        </>
      ),
    },
    {
      id: "phone",
      title: t("start.phone.title"),
      text: t("start.phone.text"),
      done: checklist.phone,
      platforms: [
        { icon: "app-store", name: "iPhone (App Store)" },
        { icon: "google-play", name: "Android (Google Play)" },
      ],
      action: markDone("phone"),
    },
    {
      id: "security",
      title: t("start.security.title"),
      text: t("start.security.text"),
      done: checklist.securityCheck,
      action: (
        <Button size="xs" variant="secondary" onClick={() => navigate({ view: "watchtower" })}>
          {t("start.security.action")}
        </Button>
      ),
    },
  ];
}

/** The first-run checklist (business P1-1), shown instead of a bare empty vault. */
export function GettingStartedCard({
  navigate,
  compact = false,
}: {
  navigate: (route: Route) => void;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const steps = useSteps(navigate);
  const { checklist } = usePreferences();
  const done = steps.filter((s) => s.done).length;
  if (checklist.dismissed) return null;
  return (
    <section
      aria-labelledby="getting-started"
      className="rounded-card border border-border bg-surface text-left shadow-card"
    >
      <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h2 id="getting-started" className="text-sm font-semibold">
            {t("start.title")}
          </h2>
          <p className="mt-0.5 text-xs text-text-muted">{t("start.progress", { done, total: steps.length })}</p>
          <div
            className="mt-2 h-1.5 w-40 overflow-hidden rounded-full bg-surface-sunken"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={steps.length}
            aria-valuenow={done}
            aria-label={t("start.progress", { done, total: steps.length })}
          >
            <div className="h-full rounded-full bg-success" style={{ width: `${(100 * done) / steps.length}%` }} />
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("start.dismiss")}
          onClick={() => setChecklist({ dismissed: true })}
        >
          <X />
        </Button>
      </header>
      <ol className="divide-y divide-border">
        {steps.map((step) => (
          <li key={step.id} className={cn("flex gap-3 px-4", compact ? "py-2.5" : "py-3.5")}>
            {step.done ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
            ) : (
              <Circle className="mt-0.5 size-4 shrink-0 text-text-muted" aria-hidden="true" />
            )}
            <div className="min-w-0 flex-1">
              <p className={cn("text-[0.8125rem] font-medium", step.done && "text-text-muted line-through")}>
                {step.title}
                <span className="sr-only">{step.done ? t("start.doneSr") : t("start.openSr")}</span>
              </p>
              {!step.done && (
                <>
                  <p className="mt-0.5 text-xs text-text-muted">{step.text}</p>
                  {step.platforms && (
                    <p className="mt-1.5 flex items-center gap-1">
                      {step.platforms.map((platform) => (
                        <BrandIcon
                          key={platform.icon}
                          service={platform.icon}
                          name={platform.name}
                          size="sm"
                          className="!size-5 !rounded-md"
                        />
                      ))}
                    </p>
                  )}
                  {step.action && <div className="mt-2 flex flex-wrap gap-2">{step.action}</div>}
                </>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function GettingStartedView({ navigate }: { navigate: (route: Route) => void }) {
  const { t } = useI18n();
  const { checklist } = usePreferences();
  return (
    <Page title={t("start.title")} description={t("start.description")}>
      <div className="max-w-2xl">
        {checklist.dismissed ? (
          <Button variant="secondary" onClick={() => setChecklist({ dismissed: false })}>
            {t("start.show")}
          </Button>
        ) : (
          <GettingStartedCard navigate={navigate} />
        )}
      </div>
    </Page>
  );
}
