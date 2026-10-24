import type { PolicyRules } from "@passbox/api-client";
import { DEFAULT_POLICY_RULES, type Org, type OrgPolicy } from "@passbox/client";
import { Badge, Button, cn, Dialog, fieldClassName, Input, SegmentedControl, Switch, toast } from "@passbox/ui";
import { AlertTriangle, History, PenLine, ShieldCheck } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { FormError } from "../auth/AuthLayout";
import { useI18n } from "../lib/i18n";
import { sharingError } from "../sharing/common";
import { useClient, useSnapshot } from "../useClient";
import { Section, useNames } from "./common";
import type { ReportState } from "./OrgAdminView";
import { describeRules } from "./policyText";

const selectClass = cn(fieldClassName, "h-10 px-2.5 coarse:h-12");
const AUTO_LOCK = [0, 1, 5, 15, 30, 60, 240, 480];

export function PoliciesSection({ org, data }: { org: Org; data: ReportState }) {
  const client = useClient();
  const i18n = useI18n();
  const { t } = i18n;
  const { policies } = useSnapshot();
  const names = useNames(org);
  const policy = policies.find((p) => p.orgId === org.id);
  const saved = policy?.rules ?? DEFAULT_POLICY_RULES;
  const [rules, setRules] = useState<PolicyRules>(saved);
  const [reviewing, setReviewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [historyOpen, setHistoryOpen] = useState(false);
  const savedKey = JSON.stringify(saved);

  // A newer policy from another admin replaces unsaved edits only when there are none.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset when the signed policy changes
  useEffect(() => setRules(saved), [savedKey]);

  const set = (changes: Partial<PolicyRules>) => setRules((current) => ({ ...current, ...changes }));
  const dirty = JSON.stringify(rules) !== savedKey;
  const changes = describeRules(rules, t).filter((line, index) => line !== describeRules(saved, t)[index]);
  const invalid = rules.shareLinks === "restricted" && !(rules.shareLinkMaxDays >= 1 && rules.shareLinkMaxDays <= 365);

  async function publish(next: PolicyRules) {
    setBusy(true);
    setError(undefined);
    try {
      const signed = await client.setOrgPolicy(org.id, next);
      toast.success(t("orgAdmin.policy.published", { version: signed.version }));
      setReviewing(false);
      data.reload();
    } catch (e) {
      setError(sharingError(e, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section
      title={t("orgAdmin.section.policies")}
      description={t("orgAdmin.policy.description")}
      actions={
        <Button variant="secondary" onClick={() => setHistoryOpen(true)} disabled={!policy}>
          <History />
          {t("orgAdmin.policy.history")}
        </Button>
      }
    >
      <PolicyStatus
        policy={policy}
        signer={policy ? names.member(policy.signerId) : ""}
        onResign={() => void publish(saved)}
        busy={busy}
      />

      <form
        className="flex flex-col gap-6"
        onSubmit={(event) => {
          event.preventDefault();
          if (dirty && !invalid) setReviewing(true);
        }}
      >
        <Group title={t("orgAdmin.policy.group.signIn")}>
          <Switch
            label={t("orgAdmin.policy.requireTwoFactor")}
            description={t("orgAdmin.policy.requireTwoFactorHint")}
            checked={rules.requireTwoFactor}
            onCheckedChange={(requireTwoFactor) => set({ requireTwoFactor })}
          />
          <Field label={t("orgAdmin.policy.minScore")} hint={t("orgAdmin.policy.minScoreHint")}>
            <select
              className={selectClass}
              value={rules.minPasswordScore}
              aria-label={t("orgAdmin.policy.minScore")}
              onChange={(e) => set({ minPasswordScore: Number(e.target.value) })}
            >
              <option value={0}>{t("orgAdmin.policy.noRequirement")}</option>
              <option value={2}>{t("strength.2")}</option>
              <option value={3}>{t("strength.3")}</option>
              <option value={4}>{t("strength.4")}</option>
            </select>
          </Field>
          <Field label={t("orgAdmin.policy.autoLock")} hint={t("orgAdmin.policy.autoLockHint")}>
            <select
              className={selectClass}
              value={rules.maxAutoLockMinutes}
              aria-label={t("orgAdmin.policy.autoLock")}
              onChange={(e) => set({ maxAutoLockMinutes: Number(e.target.value) })}
            >
              {AUTO_LOCK.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes === 0 ? t("orgAdmin.policy.noLimit") : t("orgAdmin.policy.minutes", { count: minutes })}
                </option>
              ))}
            </select>
          </Field>
        </Group>

        <Group title={t("orgAdmin.policy.group.data")}>
          <Switch
            label={t("orgAdmin.policy.forbidExport")}
            description={t("orgAdmin.policy.forbidExportHint")}
            checked={rules.forbidExport}
            onCheckedChange={(forbidExport) => set({ forbidExport })}
          />
          <Switch
            label={t("orgAdmin.policy.forbidExternalSharing")}
            description={t("orgAdmin.policy.forbidExternalSharingHint")}
            checked={rules.forbidExternalSharing}
            onCheckedChange={(forbidExternalSharing) => set({ forbidExternalSharing })}
          />
          <Switch
            label={t("orgAdmin.policy.allowPersonalVault")}
            description={t("orgAdmin.policy.allowPersonalVaultHint")}
            checked={rules.allowPersonalVault}
            onCheckedChange={(allowPersonalVault) => set({ allowPersonalVault })}
          />
          <Field label={t("orgAdmin.policy.shareLinks")} hint={t("orgAdmin.policy.shareLinksHint")}>
            <SegmentedControl<PolicyRules["shareLinks"]>
              label={t("orgAdmin.policy.shareLinks")}
              value={rules.shareLinks}
              onChange={(shareLinks) =>
                set(
                  shareLinks === "restricted"
                    ? {
                        shareLinks,
                        shareLinkMaxDays: rules.shareLinkMaxDays || 7,
                        shareLinkMaxViews: rules.shareLinkMaxViews,
                      }
                    : { shareLinks, shareLinkMaxDays: 0, shareLinkMaxViews: 0 },
                )
              }
              options={[
                { value: "allowed", label: t("orgAdmin.policy.shareLinks.allowed") },
                { value: "restricted", label: t("orgAdmin.policy.shareLinks.restricted") },
                { value: "forbidden", label: t("orgAdmin.policy.shareLinks.forbidden") },
              ]}
            />
          </Field>
          {rules.shareLinks === "restricted" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label={t("orgAdmin.policy.maxDays")}
                type="number"
                min={1}
                max={365}
                value={rules.shareLinkMaxDays}
                error={invalid ? t("orgAdmin.policy.maxDaysError") : undefined}
                onChange={(e) => set({ shareLinkMaxDays: Math.trunc(Number(e.target.value)) || 0 })}
              />
              <Input
                label={t("orgAdmin.policy.maxViews")}
                hint={t("orgAdmin.policy.maxViewsHint")}
                type="number"
                min={0}
                value={rules.shareLinkMaxViews}
                onChange={(e) => set({ shareLinkMaxViews: Math.max(0, Math.trunc(Number(e.target.value)) || 0) })}
              />
            </div>
          )}
        </Group>

        <Group title={t("orgAdmin.policy.group.recovery")}>
          <Switch
            label={t("orgAdmin.policy.requireRecovery")}
            description={
              data.report && !data.report.recoverySetUp
                ? t("orgAdmin.policy.requireRecoveryNotSetUp")
                : t("orgAdmin.policy.requireRecoveryHint")
            }
            checked={rules.requireRecoveryEnrollment}
            onCheckedChange={(requireRecoveryEnrollment) => set({ requireRecoveryEnrollment })}
          />
        </Group>

        <Group title={t("orgAdmin.policy.group.audit")}>
          <Switch
            label={t("orgAdmin.policy.reportUsage")}
            description={t("orgAdmin.policy.reportUsageHint")}
            checked={rules.reportItemUsage}
            onCheckedChange={(reportItemUsage) => set({ reportItemUsage })}
          />
        </Group>

        <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-end gap-3 border-t border-border bg-canvas/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
          {dirty && <span className="mr-auto text-[0.8125rem] text-text-muted">{t("orgAdmin.policy.unsaved")}</span>}
          <Button variant="secondary" disabled={!dirty || busy} onClick={() => setRules(saved)}>
            {t("orgAdmin.policy.discard")}
          </Button>
          <Button type="submit" disabled={!dirty || invalid} loading={busy}>
            <PenLine />
            {t("orgAdmin.policy.review")}
          </Button>
        </div>
      </form>

      <div className="flex gap-3 rounded-card border border-border bg-surface px-5 py-4 text-[0.8125rem] shadow-card">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
        <div className="flex flex-col gap-1">
          <p className="font-medium">{t("orgAdmin.policy.howTitle")}</p>
          <p className="text-text-muted">{t("orgAdmin.policy.howText")}</p>
          <p className="text-text-muted">{t("orgAdmin.policy.howLimits")}</p>
        </div>
      </div>

      <Dialog
        open={reviewing}
        onOpenChange={(open) => !busy && setReviewing(open)}
        title={t("orgAdmin.policy.reviewTitle", { version: (policy?.version ?? 0) + 1 })}
        description={t("orgAdmin.policy.reviewText")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setReviewing(false)} disabled={busy}>
              {t("action.cancel")}
            </Button>
            <Button onClick={() => void publish(rules)} loading={busy}>
              <PenLine />
              {t("orgAdmin.policy.publish")}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <ul className="flex list-disc flex-col gap-1 pl-5 text-[0.8125rem]">
            {changes.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <FormError message={error} />
        </div>
      </Dialog>
      <HistoryDialog org={org} open={historyOpen} onOpenChange={setHistoryOpen} />
    </Section>
  );
}

function PolicyStatus({
  policy,
  signer,
  onResign,
  busy,
}: {
  policy: OrgPolicy | undefined;
  signer: string;
  onResign: () => void;
  busy: boolean;
}) {
  const i18n = useI18n();
  const { t } = i18n;
  if (!policy) {
    return (
      <div className="rounded-card border border-border bg-surface px-5 py-4 text-[0.8125rem] text-text-muted shadow-card">
        {t("orgAdmin.policy.none")}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3 rounded-card border border-border bg-surface px-5 py-4 shadow-card">
      <div className="flex flex-wrap items-center gap-2 text-[0.8125rem]">
        <span className="font-medium">{t("orgAdmin.overview.policyVersion", { version: policy.version })}</span>
        {policy.source === "verified" && !policy.needsResign ? (
          <Badge tone="success">{t("orgAdmin.policy.verified")}</Badge>
        ) : (
          <Badge tone="warning">{t("orgAdmin.policy.pinned")}</Badge>
        )}
        <span className="text-text-muted">
          {t("orgAdmin.policy.signedBy", { name: signer, time: i18n.relativeTime(policy.signedAt) })}
        </span>
      </div>
      {policy.needsResign && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-[0.8125rem]">
          <AlertTriangle className="size-4 shrink-0 text-warning" aria-hidden="true" />
          <p className="min-w-0 flex-1">{t("orgAdmin.policy.needsResign")}</p>
          <Button size="sm" onClick={onResign} loading={busy}>
            {t("orgAdmin.policy.resign")}
          </Button>
        </div>
      )}
      {policy.unknownRules.length > 0 && (
        <p className="text-xs text-warning-text">
          {t("orgAdmin.policy.unknownRules", { rules: policy.unknownRules.join(", ") })}
        </p>
      )}
    </div>
  );
}

function HistoryDialog({
  org,
  open,
  onOpenChange,
}: {
  org: Org;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const client = useClient();
  const i18n = useI18n();
  const { t } = i18n;
  const names = useNames(org);
  const [entries, setEntries] = useState<Awaited<ReturnType<typeof client.policyHistory>>>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!open) return;
    setEntries(undefined);
    client
      .policyHistory(org.id)
      .then(setEntries)
      .catch((e: unknown) => setError(sharingError(e, t)));
  }, [client, open, org.id, t]);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("orgAdmin.policy.history")}
      description={t("orgAdmin.policy.historyText")}
      size="lg"
    >
      {error && <p className="text-[0.8125rem] text-danger">{error}</p>}
      {!entries && !error && <p className="text-[0.8125rem] text-text-muted">{t("app.loading")}</p>}
      <ol className="flex flex-col gap-3">
        {entries?.map((entry) =>
          "problem" in entry ? (
            <li key={entry.version} className="rounded-lg border border-border px-4 py-3 text-[0.8125rem]">
              <p className="flex items-center gap-2 font-medium">
                {t("orgAdmin.overview.policyVersion", { version: entry.version })}
                <Badge tone="warning">{t("orgAdmin.policy.historyUnverified")}</Badge>
              </p>
              <p className="mt-1 text-xs text-text-muted">{t("orgAdmin.policy.historyUnverifiedHint")}</p>
            </li>
          ) : (
            <li key={entry.version} className="rounded-lg border border-border px-4 py-3 text-[0.8125rem]">
              <p className="flex flex-wrap items-center gap-2 font-medium">
                {t("orgAdmin.overview.policyVersion", { version: entry.version })}
                <Badge tone="success">{t("orgAdmin.policy.verified")}</Badge>
                <span className="text-xs font-normal text-text-muted">
                  {t("orgAdmin.policy.signedBy", {
                    name: names.member(entry.signerId),
                    time: i18n.dateTime(entry.signedAt),
                  })}
                </span>
              </p>
              <ul className="mt-2 flex list-disc flex-col gap-0.5 pl-5 text-xs text-text-muted">
                {describeRules(entry.rules, t).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </li>
          ),
        )}
      </ol>
    </Dialog>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-5 rounded-card border border-border bg-surface px-5 py-5 shadow-card">
      <legend className="float-left mb-0 text-sm font-semibold">{title}</legend>
      {children}
    </fieldset>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex max-w-md flex-col gap-1.5">
      <span className="text-[0.8125rem] font-medium">{label}</span>
      {children}
      {hint && <span className="text-xs text-text-muted">{hint}</span>}
    </div>
  );
}
