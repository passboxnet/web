import {
  type FindingKind,
  type Findings,
  fallbackPlan,
  type Plan,
  type Priority,
  SecretGuard,
  securityPlan,
} from "@passbox/ai";
import {
  type FindingKind as ClientFindingKind,
  FIELD,
  fieldValue,
  type Item,
  type SecurityReport,
} from "@passbox/client";
import { hostOf } from "@passbox/client/import";
import { Badge, type BadgeTone, Button } from "@passbox/ui";
import { ListChecks, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { useI18n } from "../lib/i18n";
import { endpointHost } from "./AiPanel";
import { useAiGateway } from "./useAiGateway";

/** Kinds of the client's security report the plan covers. */
const KINDS: Partial<Record<ClientFindingKind, FindingKind>> = {
  breached: "breached",
  reused: "reused",
  weak: "weak",
  insecure_url: "insecure-url",
  missing_two_factor: "no-totp",
};

/**
 * The findings of the security report as metadata: kinds per login and the
 * website host. No password is part of it; dismissed findings are left out.
 */
export function securityFindings(items: readonly Item[], report: SecurityReport): Findings {
  const byItem = new Map<string, { host: string | undefined; kinds: FindingKind[] }>();
  const byId = new Map(items.map((item) => [item.id, item]));
  for (const finding of report.findings) {
    const kind = KINDS[finding.kind];
    if (!kind || finding.dismissed) continue;
    let entry = byItem.get(finding.itemId);
    if (!entry) {
      const item = byId.get(finding.itemId);
      const url = item ? fieldValue(item.data, FIELD.url) : undefined;
      entry = { host: finding.domain ?? (url ? hostOf(url) : undefined), kinds: [] };
      byItem.set(finding.itemId, entry);
    }
    if (!entry.kinds.includes(kind)) entry.kinds.push(kind);
  }
  return { analyzed: report.logins, breachChecked: report.breachChecked, sites: [...byItem.values()] };
}

/** Every secret value of the vault, so no host or text that contains one is sent. */
export function vaultSecrets(items: readonly Item[]): SecretGuard {
  const guard = new SecretGuard();
  for (const item of items) {
    for (const field of item.data.fields) {
      if (field.type === "concealed" || field.type === "totp" || field.id === FIELD.password) guard.add(field.value);
    }
  }
  return guard;
}

const TONE: Record<Priority, BadgeTone> = { critical: "danger", high: "warning", medium: "neutral", low: "neutral" };

/**
 * K4 security copilot: a prioritised plan above the findings. Without AI
 * (the default) it is built by rules and shown with translated texts; with
 * the feature on, a model explains it in plain language from metadata only.
 */
export function SecurityPlan({ items, report }: { items: readonly Item[]; report: SecurityReport }) {
  const { t, locale } = useI18n();
  const { gateway, settings } = useAiGateway();
  const findings = useMemo(() => securityFindings(items, report), [items, report]);
  const rules = useMemo(() => fallbackPlan(findings), [findings]);
  const [aiPlan, setAiPlan] = useState<{ plan: Plan; for: Findings }>();
  const [busy, setBusy] = useState(false);
  const ai = gateway.isEnabled("security-copilot");
  const current = aiPlan && aiPlan.for === findings ? aiPlan.plan : rules;
  if (rules.steps.length === 0) return null;
  const where =
    settings.provider?.location === "on-device" && !settings.provider.endpoint.trim()
      ? t("ai.where.browser")
      : t(`ai.where.${settings.provider?.location ?? "on-device"}`, {
          host: endpointHost(settings.provider?.endpoint ?? "") ?? "–",
        });

  async function explain() {
    setBusy(true);
    try {
      setAiPlan({ plan: await securityPlan(gateway, findings, locale, vaultSecrets(items)), for: findings });
    } finally {
      setBusy(false);
    }
  }

  const failed = aiPlan?.for === findings && current.source === "rules";
  return (
    <section
      aria-labelledby="security-plan-title"
      className="rounded-card border border-border bg-surface p-5 shadow-card"
    >
      <div className="flex flex-wrap items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
          {current.source === "ai" ? (
            <Sparkles className="size-4" aria-hidden="true" />
          ) : (
            <ListChecks className="size-4" aria-hidden="true" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="security-plan-title" className="text-sm font-semibold">
            {t("ai.plan.title")}
          </h2>
          <p className="mt-0.5 text-[0.8125rem] text-text-muted">
            {current.source === "ai" && current.summary ? current.summary : t("ai.plan.description")}
          </p>
        </div>
        {ai && (
          <Button variant="secondary" size="sm" loading={busy} onClick={() => void explain()} data-testid="ai-explain">
            <Sparkles />
            {current.source === "ai" ? t("ai.plan.again") : t("ai.plan.explain")}
          </Button>
        )}
      </div>
      <ol className="mt-4 flex flex-col gap-3">
        {current.steps.map((step, index) => (
          <li key={step.kind} className="flex gap-3">
            <span
              aria-hidden="true"
              className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-xs font-semibold text-text-muted"
            >
              {index + 1}
            </span>
            <div className="min-w-0 flex-1 text-[0.8125rem]">
              <p className="flex flex-wrap items-center gap-2 font-medium">
                {step.title ?? t(`ai.plan.${step.kind}.title`, { count: step.count })}
                <Badge tone={TONE[step.priority]}>{t(`ai.priority.${step.priority}`)}</Badge>
              </p>
              <p className="mt-0.5 text-text-muted">{step.detail ?? t(`ai.plan.${step.kind}.detail`)}</p>
              {step.sites.length > 0 && (
                <p className="mt-0.5 text-xs text-text-muted">
                  {t("ai.plan.startWith", { sites: step.sites.join(", ") })}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-xs text-text-muted" role="status">
        {current.source === "ai"
          ? t("ai.plan.byAi", { where })
          : failed
            ? t("ai.plan.failed")
            : ai
              ? t("ai.plan.byRulesAiReady", { where })
              : t("ai.plan.byRules")}
      </p>
    </section>
  );
}
