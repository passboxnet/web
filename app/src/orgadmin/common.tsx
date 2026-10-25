import type { OrgReport } from "@passbox/api-client";
import type { Org } from "@passbox/client";
import { AlertCard, Button, cn, Spinner, StatTile } from "@passbox/ui";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { errorMessage } from "../core";
import { useI18n } from "../lib/i18n";
import { memberLabel } from "../lib/sharing";
import { displayVaultName } from "../sharing/common";
import { useClient, useSnapshot } from "../useClient";
import { ConsoleHeader } from "../views/admin/console";

/** Loads the organization's report (members, vaults, access); reloads on demand and when the roster changes. */
export function useOrgReport(org: Org): {
  report: OrgReport | undefined;
  error: string | undefined;
  reload: () => void;
} {
  const client = useClient();
  const [report, setReport] = useState<OrgReport>();
  const [error, setError] = useState<string>();
  const [revision, setRevision] = useState(0);
  const { sharedVaults } = useSnapshot();
  // Membership and vault changes show up in the snapshot first.
  const signature = `${org.members.map((m) => `${m.accountId}:${m.role}:${m.status}`).join(",")}|${sharedVaults
    .filter((v) => v.orgId === org.id)
    .map((v) => `${v.vaultId}:${v.keyEpoch}:${v.manifestVersion}`)
    .join(",")}`;

  // biome-ignore lint/correctness/useExhaustiveDependencies: reload when the roster, vaults or revision change
  useEffect(() => {
    let cancelled = false;
    client.orgAdmin
      .reports(org.id)
      .then((next) => {
        if (cancelled) return;
        setReport(next);
        setError(undefined);
      })
      .catch((e: unknown) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [client, org.id, signature, revision]);

  return { report, error, reload: useCallback(() => setRevision((r) => r + 1), []) };
}

/** Names for account, group and vault IDs, from what this device can decrypt. */
export function useNames(org: Org): {
  member: (accountId: string) => string;
  group: (groupId: string) => string;
  vault: (vaultId: string) => string;
} {
  const { t } = useI18n();
  const { vaults } = useSnapshot();
  return {
    member: (accountId) =>
      memberLabel(
        org.members.find((m) => m.accountId === accountId) ?? { accountId, email: null },
        t("orgAdmin.unknownMember"),
      ),
    group: (groupId) => org.groups.find((g) => g.id === groupId)?.name ?? t("orgAdmin.unknownGroup"),
    vault: (vaultId) => {
      const vault = vaults.find((v) => v.id === vaultId);
      return vault ? displayVaultName(vault, t) : t("orgAdmin.vaultWithoutAccess", { id: vaultId.slice(-6) });
    },
  };
}

/** A section of the console with a heading and optional actions. */
export function Section({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col gap-6">
      <ConsoleHeader eyebrow={t("orgAdmin.title")} title={title} description={description} actions={actions} />
      {children}
    </div>
  );
}

const STAT_TONE = { neutral: "neutral", good: "success", warn: "warning", bad: "danger" } as const;

/** A big number with a label (`StatTile`), for the overview. */
export function Stat({
  label,
  value,
  hint,
  tone = "neutral",
  icon,
  onClick,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "neutral" | "good" | "warn" | "bad";
  icon?: ReactNode;
  onClick?: () => void;
}) {
  // Words ("Version 2") get a smaller size than numbers so they fit the tile.
  const wordy = typeof value === "string" && !/^[\d\s/–.,%]+$/.test(value);
  return (
    <StatTile
      value={wordy ? <span className="text-[1.75rem] leading-10">{value}</span> : value}
      label={label}
      detail={hint}
      tone={STAT_TONE[tone]}
      icon={icon}
      interactive={onClick !== undefined}
      onClick={onClick}
      className="min-w-0"
    />
  );
}

/** A bar for a share of 0–1 with its percentage. */
export function Meter({ value, label }: { value: number; label: string }) {
  const percent = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div className="flex items-center gap-2" role="img" aria-label={`${label}: ${percent} %`}>
      <span className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-sunken">
        <span
          className={cn(
            "block h-full rounded-full",
            percent >= 90 ? "bg-success" : percent >= 60 ? "bg-warning" : "bg-danger",
          )}
          style={{ width: `${percent}%` }}
        />
      </span>
      <span className="text-xs text-text-muted tabular-nums">{`${percent} %`}</span>
    </div>
  );
}

/** Loading and error states for data the console fetches. */
export function Loading({ error, onRetry }: { error: string | undefined; onRetry?: () => void }) {
  const { t } = useI18n();
  if (error) {
    return (
      <AlertCard
        tone="danger"
        title={error}
        action={
          onRetry && (
            <Button size="sm" variant="secondary" onClick={onRetry}>
              {t("action.retry")}
            </Button>
          )
        }
      />
    );
  }
  return (
    <div className="flex justify-center py-10 text-text-muted">
      <Spinner label={t("app.loading")} />
    </div>
  );
}

/** A table that scrolls sideways on small screens instead of squeezing its columns. */
export function Table({ label, head, children }: { label: string; head: ReactNode[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-card border border-hairline bg-surface shadow-card">
      <table className="w-full min-w-[40rem] border-collapse text-left text-[0.8125rem]" aria-label={label}>
        <thead className="bg-surface-raised/60">
          <tr className="border-b border-hairline text-xs text-text-subtle">
            {head.map((cell, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed columns
              <th key={index} scope="col" className="px-4 py-2.5 font-medium whitespace-nowrap">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline [&>tr]:transition-colors [&>tr:hover]:bg-surface-raised/50">
          {children}
        </tbody>
      </table>
    </div>
  );
}

export function Cell({ children, className, colSpan }: { children?: ReactNode; className?: string; colSpan?: number }) {
  return (
    <td colSpan={colSpan} className={cn("px-4 py-3 align-middle", className)}>
      {children}
    </td>
  );
}
