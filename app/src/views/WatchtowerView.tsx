import { breachCount, FIELD, fieldValue, type Item, type VaultHealth } from "@passbox/client";
import { Badge, Button, cn, EmptyState, Monogram } from "@passbox/ui";
import { ChevronRight, Copy, LockOpen, Search, ShieldCheck, Timer, TriangleAlert } from "lucide-react";
import { type ReactNode, useState } from "react";
import { SecurityPlan } from "../ai/SecurityPlan";
import { ChangePasswordDialog } from "../items/ChangePasswordDialog";
import { useI18n } from "../lib/i18n";
import { itemSubtitle, itemTitle } from "../lib/items";
import type { Route } from "../lib/route";
import { useSnapshot } from "../useClient";
import { DecryptionErrors } from "./DecryptionErrors";
import { Page } from "./PageHeader";

interface WatchtowerViewProps {
  health: VaultHealth;
  navigate: (route: Route) => void;
}

/** Results of the last breach check in this session (item ID → times seen in breaches). Memory only. */
let breachResults: { at: number; counts: Map<string, number> } | undefined;

export function WatchtowerView({ health, navigate }: WatchtowerViewProps) {
  const { items } = useSnapshot();
  const { t } = useI18n();
  const [breaches, setBreaches] = useState(breachResults);
  const [changing, setChanging] = useState<Item>();
  const byId = new Map(items.map((item) => [item.id, item]));
  const resolve = (ids: string[]) => ids.map((id) => byId.get(id)).filter((item): item is Item => Boolean(item));
  const open = (id: string) => navigate({ view: "items", filter: { kind: "all" }, itemId: id });
  const reusedIds = health.reused.flat();
  const breachedIds = breaches ? [...breaches.counts.entries()].filter(([, n]) => n > 0).map(([id]) => id) : [];
  const unsafe = new Set([...health.weak, ...reusedIds, ...health.insecureUrls, ...breachedIds]);
  const analyzedIds = items
    .filter((item) => item.data.category === "login" && fieldValue(item.data, FIELD.password))
    .map((item) => item.id);
  const secure = analyzedIds.filter((id) => !unsafe.has(id)).length;
  const ratio = health.analyzed === 0 ? 1 : secure / health.analyzed;
  const tone = ratio >= 0.8 ? "success" : ratio >= 0.5 ? "warning" : "danger";
  const fix = (item: Item) => setChanging(item);

  return (
    <Page title={t("term.watchtower")} description={t("security.description")}>
      <DecryptionErrors />
      {health.analyzed === 0 ? (
        <div className="rounded-card border border-border bg-surface shadow-card">
          <EmptyState icon={<ShieldCheck />} title={t("security.none.title")} description={t("security.none.text")} />
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <section className="rounded-card border border-border bg-surface p-5 shadow-card">
            <p className="text-lg font-semibold tracking-tight">
              {t("security.summary", { secure, total: health.analyzed })}
            </p>
            <div
              className="mt-3 h-2.5 overflow-hidden rounded-full bg-surface-sunken"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={health.analyzed}
              aria-valuenow={secure}
              aria-label={t("security.summary", { secure, total: health.analyzed })}
            >
              <div
                className={cn(
                  "h-full rounded-full",
                  tone === "success" ? "bg-success" : tone === "warning" ? "bg-warning" : "bg-danger",
                )}
                style={{ width: `${Math.max(4, ratio * 100)}%` }}
              />
            </div>
            <p className="mt-3 text-[0.8125rem] text-text-muted">
              {unsafe.size === 0 ? t("security.allGood") : t("security.toImprove", { count: unsafe.size })}
            </p>
            <p className="mt-1 text-xs text-text-muted">{breaches ? t("security.scopeBreach") : t("security.scope")}</p>
          </section>

          <SecurityPlan items={items} health={health} breaches={breaches?.counts} />

          {unsafe.size > 0 && (
            <p className="-mb-3 text-[0.8125rem] font-semibold text-text-muted">{t("security.priority")}</p>
          )}
          <IssueList
            icon={<Copy />}
            title={t("security.reused.title")}
            description={t("security.reused.text")}
            items={resolve(reusedIds)}
            onOpen={open}
            onFix={fix}
            badge={(item) => {
              const group = health.reused.find((ids) => ids.includes(item.id));
              return group ? <Badge tone="warning">{t("security.usedTimes", { count: group.length })}</Badge> : null;
            }}
          />
          {breaches && (
            <IssueList
              icon={<Search />}
              title={t("security.breached.title")}
              description={t("security.breached.text")}
              items={resolve(breachedIds)}
              onOpen={open}
              onFix={fix}
              badge={(item) => (
                <Badge tone="danger">{t("security.breachedTimes", { count: breaches.counts.get(item.id) ?? 0 })}</Badge>
              )}
            />
          )}
          <IssueList
            icon={<TriangleAlert />}
            title={t("security.weak.title")}
            description={t("security.weak.text")}
            items={resolve(health.weak)}
            onOpen={open}
            onFix={fix}
          />
          <IssueList
            icon={<LockOpen />}
            title={t("security.insecure.title")}
            description={t("security.insecure.text")}
            items={resolve(health.insecureUrls)}
            onOpen={open}
          />

          <BreachCheck
            items={resolve(analyzedIds)}
            checkedAt={breaches?.at}
            onDone={(result) => {
              breachResults = result;
              setBreaches(result);
            }}
          />

          <details className="group rounded-card border border-border bg-surface shadow-card">
            <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 coarse:py-5">
              <Timer className="size-4 text-text-muted" aria-hidden="true" />
              <span className="flex-1 text-sm font-semibold">{t("security.more")}</span>
              <ChevronRight
                className="size-4 text-text-muted transition-transform group-open:rotate-90"
                aria-hidden="true"
              />
            </summary>
            <div className="border-t border-border">
              <IssueList
                embedded
                title={t("security.totp.title")}
                description={t("security.totp.text")}
                items={resolve(health.withoutTotp)}
                onOpen={open}
                tone="neutral"
              />
            </div>
          </details>
        </div>
      )}
      {changing && (
        <ChangePasswordDialog item={changing} open onOpenChange={(isOpen) => !isOpen && setChanging(undefined)} />
      )}
    </Page>
  );
}

/** Opt-in check against Have I Been Pwned with k-anonymity (only a hash prefix leaves the device). */
function BreachCheck({
  items,
  checkedAt,
  onDone,
}: {
  items: Item[];
  checkedAt: number | undefined;
  onDone: (result: { at: number; counts: Map<string, number> }) => void;
}) {
  const i18n = useI18n();
  const { t } = i18n;
  const [progress, setProgress] = useState<{ done: number; total: number }>();
  const [error, setError] = useState<string>();

  async function run() {
    setError(undefined);
    const byPassword = new Map<string, string[]>();
    for (const item of items) {
      const password = fieldValue(item.data, FIELD.password);
      if (password) byPassword.set(password, [...(byPassword.get(password) ?? []), item.id]);
    }
    const counts = new Map<string, number>();
    let done = 0;
    setProgress({ done, total: byPassword.size });
    try {
      for (const [password, ids] of byPassword) {
        const count = await breachCount(password);
        for (const id of ids) counts.set(id, count);
        done++;
        setProgress({ done, total: byPassword.size });
      }
      onDone({ at: Date.now(), counts });
    } catch {
      setError(t("security.breach.failed"));
    } finally {
      setProgress(undefined);
    }
  }

  return (
    <section className="rounded-card border border-border bg-surface p-5 shadow-card">
      <div className="flex flex-wrap items-start gap-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-sunken text-text-muted">
          <Search className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">{t("security.breach.title")}</h2>
          <p className="mt-1 text-[0.8125rem] text-text-muted">{t("security.breach.consent")}</p>
          {checkedAt && (
            <p className="mt-1 text-xs text-text-muted">
              {t("security.breach.checked", { time: i18n.relativeTime(checkedAt) })}
            </p>
          )}
          {error && (
            <p role="alert" className="mt-2 text-[0.8125rem] text-danger">
              {error}
            </p>
          )}
        </div>
        <Button variant="secondary" onClick={() => void run()} loading={progress !== undefined}>
          {progress
            ? t("security.breach.progress", { done: progress.done, total: progress.total })
            : checkedAt
              ? t("security.breach.again")
              : t("security.breach.start")}
        </Button>
      </div>
    </section>
  );
}

interface IssueListProps {
  title: string;
  description: string;
  items: Item[];
  onOpen: (id: string) => void;
  onFix?: (item: Item) => void;
  badge?: (item: Item) => ReactNode;
  icon?: ReactNode;
  tone?: "warning" | "neutral";
  embedded?: boolean;
}

function IssueList({
  title,
  description,
  items,
  onOpen,
  onFix,
  badge,
  icon,
  tone = "warning",
  embedded,
}: IssueListProps) {
  const { t } = useI18n();
  return (
    <section className={embedded ? undefined : "rounded-card border border-border bg-surface shadow-card"}>
      <header className="flex items-start gap-3 border-b border-border px-5 py-4">
        {/* Decorative: it marks the kind of problem and is not a button. */}
        {icon && (
          <span
            aria-hidden="true"
            className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-surface-sunken text-text-muted [&_svg]:size-3.5"
          >
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h2 className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            {title}
            <Badge tone={items.length === 0 ? "success" : tone === "warning" ? "warning" : "neutral"}>
              {items.length === 0 ? t("security.none.badge") : items.length}
            </Badge>
          </h2>
          <p className="mt-0.5 text-[0.8125rem] text-text-muted">{description}</p>
        </div>
      </header>
      {items.length > 0 && (
        <ul className="divide-y divide-border">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-2 pr-3 hover:bg-surface-raised sm:pr-5">
              <button
                type="button"
                onClick={() => onOpen(item.id)}
                className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-5 text-left coarse:py-4"
              >
                <Monogram name={item.data.title} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.8125rem] font-medium">{itemTitle(item, t)}</span>
                  <span className="block truncate text-xs text-text-muted">{itemSubtitle(item, t)}</span>
                </span>
                {badge?.(item)}
              </button>
              {onFix && (
                <Button size="sm" variant="secondary" onClick={() => onFix(item)}>
                  {t("change.action")}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
