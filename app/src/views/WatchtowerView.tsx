import type { CategorySummary, Finding, FindingKind, FixAction, Item, SecurityReport, Severity } from "@passbox/client";
import { Badge, type BadgeTone, Button, cn, EmptyState, toast } from "@passbox/ui";
import { BrandIcon } from "@passbox/ui/brand-icon";
import { ArrowLeft, ChevronRight, ExternalLink, EyeOff, RotateCcw, ShieldCheck } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { SecurityPlan } from "../ai/SecurityPlan";
import { ChangePasswordDialog } from "../items/ChangePasswordDialog";
import { ItemIcon } from "../items/ItemIcon";
import { describeError } from "../lib/errors";
import { useI18n } from "../lib/i18n";
import { itemSubtitle, itemTitle } from "../lib/items";
import type { Route } from "../lib/route";
import { useSecuritySettings } from "../lib/securitySettings";
import { useClient, useSnapshot } from "../useClient";
import { DecryptionErrors } from "./DecryptionErrors";
import { Page } from "./PageHeader";
import { Attribution, BreachFacts, breachedSiteText, NotificationPermission } from "./security/BreachedSites";
import { SecuritySettingsPanel } from "./security/SecuritySettingsPanel";

interface WatchtowerViewProps {
  navigate: (route: Route) => void;
}

const SEVERITY_TONE: Record<Severity, BadgeTone> = {
  critical: "danger",
  high: "danger",
  medium: "warning",
  low: "neutral",
  info: "neutral",
};

/** Fixes that change the password in place; the others open the item. */
const PASSWORD_FIXES = new Set<FixAction>(["change_password"]);

/** The security check dashboard: score, fix-first list, categories with drill-down, dismissed findings. */
export function WatchtowerView({ navigate }: WatchtowerViewProps) {
  const client = useClient();
  const snapshot = useSnapshot();
  const i18n = useI18n();
  const { t } = i18n;
  const settings = useSecuritySettings();
  const [selected, setSelected] = useState<FindingKind>();
  const [changing, setChanging] = useState<Item>();
  const [checking, setChecking] = useState<{ done: number; total: number }>();
  const [breachError, setBreachError] = useState<string>();
  const [checkedAt, setCheckedAt] = useState<number>();

  // biome-ignore lint/correctness/useExhaustiveDependencies: the snapshot changes when items, breach results or monitoring results change.
  const report = useMemo(() => client.securityReport(settings), [client, snapshot, settings]);
  const byId = useMemo(() => new Map(snapshot.items.map((item) => [item.id, item])), [snapshot.items]);
  const open = (id: string) => navigate({ view: "items", filter: { kind: "all" }, itemId: id });

  function fix(finding: { itemId: string; fix: FixAction }, docs?: string) {
    const item = byId.get(finding.itemId);
    if (!item) return;
    if (PASSWORD_FIXES.has(finding.fix) && item.data.category === "login") {
      setChanging(item);
      return;
    }
    if (docs) window.open(docs, "_blank", "noopener,noreferrer");
    open(item.id);
  }

  async function dismiss(finding: Finding, dismissed: boolean) {
    try {
      await client.dismissFinding(finding.itemId, finding.kind, dismissed);
      if (dismissed) {
        toast(t("security.dismissed.toast"), {
          action: {
            label: t("action.undo"),
            onClick: () => void client.dismissFinding(finding.itemId, finding.kind, false),
          },
        });
      }
    } catch (error) {
      toast.error(describeError(error, t));
    }
  }

  async function runBreachCheck() {
    setBreachError(undefined);
    client.breachMode = settings.breachMode;
    try {
      await client.checkBreachedItems(undefined, (done, total) => setChecking({ done, total }));
      setCheckedAt(Date.now());
    } catch {
      setBreachError(
        settings.breachMode === "server" ? t("security.breach.failedServer") : t("security.breach.failed"),
      );
    } finally {
      setChecking(undefined);
    }
  }

  const category = selected ? report.categories.find((c) => c.kind === selected) : undefined;

  return (
    <Page title={t("term.watchtower")} description={t("security.description")}>
      <DecryptionErrors />
      {report.items === 0 ? (
        <div className="rounded-card border border-border bg-surface shadow-card">
          <EmptyState icon={<ShieldCheck />} title={t("security.none.title")} description={t("security.none.text")} />
        </div>
      ) : category ? (
        <CategoryDetail
          category={category}
          report={report}
          byId={byId}
          onBack={() => setSelected(undefined)}
          onOpen={open}
          onFix={fix}
          onDismiss={dismiss}
        />
      ) : (
        <div className="flex flex-col gap-6">
          <ScoreCard
            report={report}
            breach={
              <BreachCheck
                checked={report.breachChecked || client.breachCheckDone}
                checkedAt={checkedAt}
                progress={checking}
                error={breachError}
                onRun={() => void runBreachCheck()}
              />
            }
          />
          <SecurityPlan items={snapshot.items} report={report} />
          <FixFirst report={report} byId={byId} onOpen={open} onFix={fix} />
          <CategoryGrid report={report} onSelect={setSelected} />
          <DismissedList report={report} byId={byId} onRestore={(f) => void dismiss(f, false)} />
          <SecuritySettingsPanel />
        </div>
      )}
      {changing && (
        <ChangePasswordDialog item={changing} open onOpenChange={(isOpen) => !isOpen && setChanging(undefined)} />
      )}
    </Page>
  );
}

// --- Score ---------------------------------------------------------------------------

function ScoreRing({ score, rating }: { score: number; rating: SecurityReport["rating"] }) {
  const { t } = useI18n();
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const tone =
    rating === "excellent" || rating === "good" ? "text-success" : rating === "fair" ? "text-warning" : "text-danger";
  return (
    <div
      role="img"
      aria-label={t("security.score.label", { score, rating: t(`security.rating.${rating}`) })}
      className="relative size-32 shrink-0"
    >
      <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden="true">
        <circle cx="60" cy="60" r={radius} className="fill-none stroke-surface-sunken" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          className={cn("fill-none stroke-current transition-[stroke-dashoffset] duration-700", tone)}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - score / 100)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center" aria-hidden="true">
        <span className="text-3xl font-semibold tabular-nums tracking-tight">{score}</span>
        <span className="text-xs text-text-muted">{t("security.score.of100")}</span>
      </div>
    </div>
  );
}

function ScoreCard({ report, breach }: { report: SecurityReport; breach: ReactNode }) {
  const { t } = useI18n();
  const open = report.categories.filter((c) => c.count > 0 && c.severity !== "info");
  const costs = report.categories.filter((c) => c.points > 0).sort((a, b) => b.points - a.points);
  const problems = new Set(report.fixFirst.map((p) => p.itemId)).size;
  return (
    <section
      aria-labelledby="score-title"
      className="rounded-card border border-border bg-surface p-5 shadow-card sm:p-6"
    >
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <ScoreRing score={report.score} rating={report.rating} />
        <div className="min-w-0 flex-1">
          <h2 id="score-title" className="text-lg font-semibold tracking-tight">
            {t(`security.rating.${report.rating}`)}
          </h2>
          <p className="mt-1 text-[0.8125rem] text-text-muted">
            {open.length === 0
              ? t("security.allGood")
              : t("security.summaryCategories", { count: open.length, items: report.scored })}
          </p>
          {costs.length > 0 && (
            <div className="mt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                {t("security.score.why")}
              </h3>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {costs.slice(0, 6).map((c) => (
                  <li key={c.kind}>
                    <Badge tone={SEVERITY_TONE[c.severity]}>
                      {t("security.score.cost", { points: c.points, category: t(`security.kind.${c.kind}.title`) })}
                    </Badge>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-text-muted">{t("security.score.explain", { count: problems })}</p>
            </div>
          )}
        </div>
      </div>
      <div className="mt-5 border-t border-border pt-5">{breach}</div>
    </section>
  );
}

// --- Breach check --------------------------------------------------------------------

function BreachCheck({
  checked,
  checkedAt,
  progress,
  error,
  onRun,
}: {
  checked: boolean;
  checkedAt: number | undefined;
  progress: { done: number; total: number } | undefined;
  error: string | undefined;
  onRun: () => void;
}) {
  const i18n = useI18n();
  const { t } = i18n;
  const { breachMode } = useSecuritySettings();
  return (
    <div className="flex flex-wrap items-start gap-4">
      <BrandIcon service="hibp" size="lg" decorative />
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold">{t("security.breach.title")}</h3>
        <p className="mt-1 text-[0.8125rem] text-text-muted">
          {t("security.breach.consent")}{" "}
          {breachMode === "direct" ? t("security.breach.routeDirect") : t("security.breach.routeServer")}
        </p>
        {checked && (
          <p className="mt-1 text-xs text-text-muted">
            {checkedAt
              ? t("security.breach.checked", { time: i18n.relativeTime(checkedAt) })
              : t("security.breach.checkedSession")}
          </p>
        )}
        {error && (
          <p role="alert" className="mt-2 text-[0.8125rem] text-danger">
            {error}
          </p>
        )}
      </div>
      <Button variant={checked ? "secondary" : "primary"} onClick={onRun} loading={progress !== undefined}>
        {progress
          ? t("security.breach.progress", { done: progress.done, total: progress.total })
          : checked
            ? t("security.breach.again")
            : t("security.breach.start")}
      </Button>
    </div>
  );
}

// --- Fix first -----------------------------------------------------------------------

function ItemCell({ item, children }: { item: Item; children?: ReactNode }) {
  const { t } = useI18n();
  return (
    <>
      <ItemIcon item={item} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.8125rem] font-medium">{itemTitle(item, t)}</span>
        <span className="block truncate text-xs text-text-muted">{itemSubtitle(item, t)}</span>
        {children}
      </span>
    </>
  );
}

function FixFirst({
  report,
  byId,
  onOpen,
  onFix,
}: {
  report: SecurityReport;
  byId: Map<string, Item>;
  onOpen: (id: string) => void;
  onFix: (finding: { itemId: string; fix: FixAction }, docs?: string) => void;
}) {
  const { t } = useI18n();
  const entries = report.fixFirst.flatMap((p) => {
    const item = byId.get(p.itemId);
    return item ? [{ priority: p, item }] : [];
  });
  if (entries.length === 0) return null;
  return (
    <section aria-labelledby="fix-first-title" className="rounded-card border border-border bg-surface shadow-card">
      <header className="border-b border-border px-5 py-4">
        <h2 id="fix-first-title" className="text-sm font-semibold">
          {t("security.fixFirst.title")}
        </h2>
        <p className="mt-0.5 text-[0.8125rem] text-text-muted">{t("security.fixFirst.text")}</p>
      </header>
      <ol className="divide-y divide-border">
        {entries.map(({ priority, item }, index) => {
          const docs = report.findings.find(
            (f) => f.itemId === item.id && f.kind === priority.kinds[0],
          )?.documentationUrl;
          return (
            <li key={item.id} className="flex items-center gap-2 pr-3 hover:bg-surface-raised sm:pr-5">
              <button
                type="button"
                onClick={() => onOpen(item.id)}
                className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-5 text-left coarse:py-4"
              >
                <span className="w-5 shrink-0 text-xs font-semibold tabular-nums text-text-muted">{index + 1}</span>
                <ItemCell item={item}>
                  <span className="mt-1 flex flex-wrap gap-1">
                    {priority.kinds.slice(0, 3).map((kind) => (
                      <Badge
                        key={kind}
                        tone={SEVERITY_TONE[report.findings.find((f) => f.kind === kind)?.severity ?? "low"]}
                      >
                        {t(`security.kind.${kind}.short`)}
                      </Badge>
                    ))}
                  </span>
                </ItemCell>
                <span className="hidden shrink-0 text-xs font-medium text-success sm:block">
                  {t("security.fixFirst.points", { points: priority.points })}
                </span>
              </button>
              <Button size="sm" variant="secondary" onClick={() => onFix({ itemId: item.id, fix: priority.fix }, docs)}>
                {t(`security.fix.${priority.fix}`)}
              </Button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

// --- Categories ----------------------------------------------------------------------

function CategoryGrid({ report, onSelect }: { report: SecurityReport; onSelect: (kind: FindingKind) => void }) {
  const { t } = useI18n();
  const shown = report.categories.filter((c) => c.checked || c.kind === "breached");
  const sorted = [...shown].sort((a, b) => Number(b.count > 0) - Number(a.count > 0));
  return (
    <section aria-labelledby="categories-title">
      <h2 id="categories-title" className="mb-3 text-sm font-semibold">
        {t("security.categories.title")}
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((c) => (
          <li key={c.kind}>
            <CategoryCard category={c} onSelect={() => onSelect(c.kind)} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function CategoryCard({ category, onSelect }: { category: CategorySummary; onSelect: () => void }) {
  const { t } = useI18n();
  const clear = category.count === 0;
  const unchecked = !category.checked;
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={clear && category.dismissed === 0}
      aria-label={t("security.categories.open", {
        category: t(`security.kind.${category.kind}.title`),
        count: category.count,
      })}
      className={cn(
        "flex h-full w-full flex-col gap-2 rounded-card border border-border bg-surface p-4 text-left shadow-card transition",
        "enabled:hover:border-border-strong enabled:hover:bg-surface-raised disabled:cursor-default",
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="text-[0.8125rem] font-semibold">{t(`security.kind.${category.kind}.title`)}</span>
        {unchecked ? (
          <Badge tone="neutral">{t("security.categories.notChecked")}</Badge>
        ) : clear ? (
          <Badge tone="success">{t("security.none.badge")}</Badge>
        ) : (
          <Badge tone={SEVERITY_TONE[category.severity]}>{category.count}</Badge>
        )}
      </span>
      <span className="line-clamp-2 text-xs text-text-muted">{t(`security.kind.${category.kind}.summary`)}</span>
      <span className="mt-auto flex items-center justify-between text-xs text-text-muted">
        <span>{t(`security.severity.${category.severity}`)}</span>
        {!(clear && category.dismissed === 0) && <ChevronRight className="size-3.5" aria-hidden="true" />}
      </span>
    </button>
  );
}

// --- Drill-down ----------------------------------------------------------------------

function FindingDetail({ finding, byId }: { finding: Finding; byId: Map<string, Item> }) {
  const i18n = useI18n();
  const { t } = i18n;
  const names = (ids: string[]) =>
    ids
      .map((id) => byId.get(id))
      .filter((item): item is Item => Boolean(item))
      .map((item) => itemTitle(item, t))
      .join(", ");
  const parts: string[] = [];
  switch (finding.kind) {
    case "breached":
      parts.push(t("security.breachedTimes", { count: finding.breachCount ?? 0 }));
      break;
    case "reused":
      parts.push(t("security.detail.reusedWith", { items: names(finding.related) }));
      break;
    case "similar":
      parts.push(
        finding.similarToPrevious && finding.related.length === 0
          ? t("security.detail.similarPrevious")
          : t("security.detail.similarTo", { items: names(finding.related) }),
      );
      break;
    case "weak":
      parts.push(t(`strength.${finding.strength ?? 0}`));
      break;
    case "old":
      parts.push(t("security.detail.age", { days: finding.ageDays ?? 0 }));
      break;
    case "lookalike":
      parts.push(
        finding.lookalikeOf
          ? t("security.detail.lookalike", { domain: finding.domain ?? "", target: finding.lookalikeOf })
          : t("security.detail.mixedScript", { domain: finding.domain ?? "" }),
      );
      break;
    case "expired":
      parts.push(t("security.detail.expired", { date: finding.expires ?? "" }));
      break;
    case "expiring":
      parts.push(t("security.detail.expiring", { days: finding.daysLeft ?? 0, date: finding.expires ?? "" }));
      break;
    case "duplicate":
      parts.push(t("security.detail.duplicateOf", { items: names(finding.related) }));
      break;
    case "exposed_email":
      parts.push(
        t("security.detail.exposed", { email: finding.email ?? "", breaches: (finding.breaches ?? []).join(", ") }),
      );
      break;
    case "breached_site":
      parts.push(breachedSiteText(i18n, finding, (finding.breaches ?? []).join(", ") || (finding.domain ?? "")));
      break;
    case "missing_two_factor":
    case "passkey_available":
    case "insecure_url":
      if (finding.domain) parts.push(finding.domain);
      break;
    default:
      break;
  }
  return parts.length > 0 ? <span className="mt-0.5 block text-xs text-text-muted">{parts.join(" · ")}</span> : null;
}

/** Where a finding's data comes from (bundled icons, see `@passbox/brand-icons`). */
const DATA_SOURCES: Partial<Record<FindingKind, { icon: string; name: string }>> = {
  breached: { icon: "hibp", name: "Have I Been Pwned" },
  exposed_email: { icon: "hibp", name: "Have I Been Pwned" },
  breached_site: { icon: "hibp", name: "Have I Been Pwned" },
  missing_two_factor: { icon: "2fa-directory", name: "2FA Directory (2fa.directory)" },
  passkey_available: { icon: "2fa-directory", name: "Passkeys Directory (passkeys.2fa.directory)" },
};

function CategoryDetail({
  category,
  report,
  byId,
  onBack,
  onOpen,
  onFix,
  onDismiss,
}: {
  category: CategorySummary;
  report: SecurityReport;
  byId: Map<string, Item>;
  onBack: () => void;
  onOpen: (id: string) => void;
  onFix: (finding: { itemId: string; fix: FixAction }, docs?: string) => void;
  onDismiss: (finding: Finding, dismissed: boolean) => void;
}) {
  const { t } = useI18n();
  const findings = report.findings.filter((f) => f.kind === category.kind);
  const active = findings.filter((f) => !f.dismissed);
  const dismissed = findings.filter((f) => f.dismissed);
  const row = (finding: Finding) => {
    const item = byId.get(finding.itemId);
    if (!item) return null;
    return (
      <li key={finding.itemId} className="flex flex-wrap items-center gap-2 py-1 pr-3 hover:bg-surface-raised sm:pr-5">
        <button
          type="button"
          onClick={() => onOpen(item.id)}
          className="flex min-w-0 flex-1 basis-60 items-center gap-3 py-2.5 pl-5 text-left"
        >
          <ItemCell item={item}>
            <FindingDetail finding={finding} byId={byId} />
          </ItemCell>
        </button>
        <span className="flex shrink-0 items-center gap-1 pl-5 sm:pl-0">
          {finding.documentationUrl && (
            <a
              href={finding.documentationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-accent hover:underline"
            >
              {finding.kind === "breached_site" ? t("security.breachedSite.openSite") : t("security.howTo")}
              <ExternalLink className="size-3" aria-hidden="true" />
              <span className="sr-only">{t("security.opensNewTab")}</span>
            </a>
          )}
          {finding.dismissed ? (
            <Button size="sm" variant="ghost" onClick={() => onDismiss(finding, false)}>
              <RotateCcw className="size-3.5" aria-hidden="true" />
              {t("security.dismissed.restore")}
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onDismiss(finding, true)}
                aria-label={t("security.dismiss.label", { item: itemTitle(item, t) })}
              >
                <EyeOff className="size-3.5" aria-hidden="true" />
                {t("security.dismiss.action")}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => onFix(finding, finding.documentationUrl)}>
                {t(`security.fix.${finding.fix}`)}
              </Button>
            </>
          )}
        </span>
      </li>
    );
  };
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="size-4" aria-hidden="true" />
          {t("security.back")}
        </Button>
      </div>
      <section aria-labelledby="category-title" className="rounded-card border border-border bg-surface shadow-card">
        <header className="border-b border-border px-5 py-4">
          <h2 id="category-title" className="flex flex-wrap items-center gap-2 text-base font-semibold">
            {t(`security.kind.${category.kind}.title`)}
            <Badge tone={SEVERITY_TONE[category.severity]}>{t(`security.severity.${category.severity}`)}</Badge>
          </h2>
          <p className="mt-1 text-[0.8125rem] text-text-muted">{t(`security.kind.${category.kind}.text`)}</p>
          {category.kind === "breached_site" ? (
            <Attribution className="mt-2" />
          ) : (
            DATA_SOURCES[category.kind] && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-text-muted">
                <BrandIcon service={DATA_SOURCES[category.kind]?.icon ?? ""} size="sm" decorative />
                {t("security.dataSource", { name: DATA_SOURCES[category.kind]?.name ?? "" })}
              </p>
            )
          )}
          <p className="mt-2 text-[0.8125rem]">
            <span className="font-medium">{t("security.whatToDo")}</span> {t(`security.kind.${category.kind}.fix`)}
          </p>
        </header>
        {active.length === 0 ? (
          <p className="px-5 py-4 text-[0.8125rem] text-text-muted">{t("security.categories.allDismissed")}</p>
        ) : (
          <ul className="divide-y divide-border">{active.map(row)}</ul>
        )}
        {category.kind === "breached_site" && (
          <div className="border-t border-border px-5 py-3">
            <NotificationPermission />
          </div>
        )}
      </section>
      {category.kind === "breached_site" && <BreachFacts report={report} />}
      {dismissed.length > 0 && (
        <section
          aria-labelledby="category-dismissed"
          className="rounded-card border border-border bg-surface shadow-card"
        >
          <h3 id="category-dismissed" className="border-b border-border px-5 py-3 text-[0.8125rem] font-semibold">
            {t("security.dismissed.title", { count: dismissed.length })}
          </h3>
          <ul className="divide-y divide-border">{dismissed.map(row)}</ul>
        </section>
      )}
    </div>
  );
}

// --- Dismissed -----------------------------------------------------------------------

function DismissedList({
  report,
  byId,
  onRestore,
}: {
  report: SecurityReport;
  byId: Map<string, Item>;
  onRestore: (finding: Finding) => void;
}) {
  const { t } = useI18n();
  const dismissed = report.findings.filter((f) => f.dismissed && byId.has(f.itemId));
  if (dismissed.length === 0) return null;
  return (
    <details className="group rounded-card border border-border bg-surface shadow-card">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 coarse:py-5">
        <EyeOff className="size-4 text-text-muted" aria-hidden="true" />
        <span className="flex-1 text-sm font-semibold">
          {t("security.dismissed.title", { count: dismissed.length })}
        </span>
        <ChevronRight className="size-4 text-text-muted transition-transform group-open:rotate-90" aria-hidden="true" />
      </summary>
      <ul className="divide-y divide-border border-t border-border">
        {dismissed.map((finding) => {
          const item = byId.get(finding.itemId) as Item;
          return (
            <li key={`${finding.itemId}-${finding.kind}`} className="flex items-center gap-3 px-5 py-2.5">
              <ItemCell item={item}>
                <span className="block text-xs text-text-muted">{t(`security.kind.${finding.kind}.title`)}</span>
              </ItemCell>
              <Button size="sm" variant="ghost" onClick={() => onRestore(finding)}>
                <RotateCcw className="size-3.5" aria-hidden="true" />
                {t("security.dismissed.restore")}
              </Button>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
