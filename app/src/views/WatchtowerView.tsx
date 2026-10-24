import type { Item, VaultHealth } from "@passbox/client";
import { Badge, EmptyState, Monogram } from "@passbox/ui";
import { ChevronRight, Copy, KeyRound, LockOpen, ShieldCheck, Timer, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { itemSubtitle } from "../lib/items";
import type { Route } from "../lib/route";
import { useSnapshot } from "../useClient";
import { Page } from "./PageHeader";

interface WatchtowerViewProps {
  health: VaultHealth;
  navigate: (route: Route) => void;
}

export function WatchtowerView({ health, navigate }: WatchtowerViewProps) {
  const { items } = useSnapshot();
  const byId = new Map(items.map((item) => [item.id, item]));
  const resolve = (ids: string[]) => ids.map((id) => byId.get(id)).filter((item): item is Item => Boolean(item));
  const open = (id: string) => navigate({ view: "items", filter: { kind: "all" }, itemId: id });
  const reusedIds = health.reused.flat();
  const tone = health.score >= 80 ? "success" : health.score >= 50 ? "warning" : "danger";

  return (
    <Page
      title="Watchtower"
      description="Security insights for your logins. The analysis runs on this device; your passwords are never sent anywhere."
    >
      {health.analyzed === 0 ? (
        <div className="rounded-card border border-border bg-surface shadow-card">
          <EmptyState
            icon={<ShieldCheck />}
            title="Nothing to analyze yet"
            description="Add logins with passwords, and Watchtower will point out weak, reused and insecure ones."
          />
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1.2fr)_repeat(3,minmax(0,1fr))]">
            <div className="flex items-center gap-5 rounded-card border border-border bg-surface p-5 shadow-card">
              <ScoreRing score={health.score} tone={tone} />
              <div>
                <p className="text-2xs font-semibold tracking-wide text-text-subtle uppercase">Security score</p>
                <p className="mt-1 text-sm text-text-muted">
                  {health.analyzed} {health.analyzed === 1 ? "login" : "logins"} analyzed
                </p>
              </div>
            </div>
            <Stat icon={<TriangleAlert />} label="Weak" value={health.weak.length} />
            <Stat icon={<Copy />} label="Reused" value={reusedIds.length} />
            <Stat icon={<LockOpen />} label="Unsecured websites" value={health.insecureUrls.length} />
          </div>

          <IssueList
            title="Weak passwords"
            description="Easy to guess. Change them on the website and let Passbox generate a strong one."
            items={resolve(health.weak)}
            onOpen={open}
          />
          <IssueList
            title="Reused passwords"
            description="If one of these sites is breached, attackers can sign in to the others."
            items={resolve(reusedIds)}
            onOpen={open}
            badge={(item) => {
              const group = health.reused.find((ids) => ids.includes(item.id));
              return group ? <Badge tone="warning">Used {group.length}×</Badge> : null;
            }}
          />
          <IssueList
            title="Unsecured websites"
            description="These logins point to http:// addresses, which send data unencrypted."
            items={resolve(health.insecureUrls)}
            onOpen={open}
          />
          <IssueList
            title="Two-factor authentication"
            description="Logins without a one-time password. Enable 2FA on the website where possible and store the code in Passbox."
            items={resolve(health.withoutTotp)}
            onOpen={open}
            icon={<Timer />}
            tone="neutral"
          />
        </div>
      )}
    </Page>
  );
}

function ScoreRing({ score, tone }: { score: number; tone: "success" | "warning" | "danger" }) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const stroke = { success: "stroke-success", warning: "stroke-warning", danger: "stroke-danger" }[tone];
  return (
    <span className="relative inline-flex size-16 items-center justify-center">
      <svg viewBox="0 0 64 64" className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle cx="32" cy="32" r={radius} className="fill-none stroke-border" strokeWidth="6" />
        <circle
          cx="32"
          cy="32"
          r={radius}
          className={`fill-none ${stroke}`}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - score / 100)}
        />
      </svg>
      <span className="text-lg font-semibold tabular-nums">{score}</span>
    </span>
  );
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-card border border-border bg-surface p-5 shadow-card">
      <div className="flex items-center gap-2 text-text-subtle [&_svg]:size-4">
        {icon}
        <p className="text-2xs font-semibold tracking-wide uppercase">{label}</p>
      </div>
      <p className={`mt-2 text-2xl font-semibold tabular-nums ${value > 0 ? "text-text" : "text-success"}`}>{value}</p>
    </div>
  );
}

interface IssueListProps {
  title: string;
  description: string;
  items: Item[];
  onOpen: (id: string) => void;
  badge?: (item: Item) => ReactNode;
  icon?: ReactNode;
  tone?: "warning" | "neutral";
}

function IssueList({ title, description, items, onOpen, badge, icon, tone = "warning" }: IssueListProps) {
  return (
    <section className="rounded-card border border-border bg-surface shadow-card">
      <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            {title}
            <Badge tone={items.length === 0 ? "success" : tone === "warning" ? "warning" : "neutral"}>
              {items.length === 0 ? "All good" : items.length}
            </Badge>
          </h2>
          <p className="mt-0.5 text-[13px] text-text-muted">{description}</p>
        </div>
        <span className="text-text-subtle [&_svg]:size-4">{icon ?? <KeyRound />}</span>
      </header>
      {items.length > 0 && (
        <ul className="divide-y divide-border">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onOpen(item.id)}
                className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-surface-raised"
              >
                <Monogram name={item.data.title} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">{item.data.title || "Untitled"}</span>
                  <span className="block truncate text-xs text-text-muted">{itemSubtitle(item)}</span>
                </span>
                {badge?.(item)}
                <ChevronRight className="size-4 text-text-subtle" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
