import { ApiError } from "@passbox/api-client";
import type { Org, OrgMember, SharedVault, Vault } from "@passbox/client";
import { Badge, cn } from "@passbox/ui";
import { Building2, House, Lock, Users } from "lucide-react";
import { errorMessage } from "../core";
import type { Translator } from "../lib/i18n";
import { useI18n } from "../lib/i18n";
import { fingerprintGroups, orgRoleKey, sharedWithEveryone, vaultAudience } from "../lib/sharing";
import { vaultName } from "../shell/Sidebar";
import { useClient, useSnapshot } from "../useClient";

type T = Translator["t"];

/** This account's ID. */
export function useMyAccountId(): string | undefined {
  return useClient().deviceAccount?.accountId;
}

/** An organization's name; members waiting for confirmation cannot read it yet. */
export function orgName(org: Pick<Org, "name" | "kind"> | undefined, t: T): string {
  if (org?.name) return org.name;
  return org?.kind === "team" ? t("sharing.kind.team") : t("sharing.kind.family");
}

export function OrgIcon({ kind, className }: { kind: string; className?: string }) {
  const Icon = kind === "team" ? Building2 : House;
  return <Icon className={cn("size-4", className)} aria-hidden="true" />;
}

/** A vault's display name; shared vaults the device cannot open yet get a placeholder. */
export function displayVaultName(vault: Vault | undefined, t: T): string {
  return vault ? vaultName(vault.name, t) || t("term.vault") : t("sharing.vault.unnamed");
}

/** Turns errors of sharing actions into messages that say what to do. */
export function sharingError(error: unknown, t: T): string {
  if (error instanceof ApiError) {
    const message = error.body?.message ?? "";
    if (error.code === "conflict" && /already a member/.test(message)) return t("sharing.error.alreadyMember");
    if (error.code === "conflict" && /current key|key epoch|currentKeyEpoch/i.test(message)) {
      return t("sharing.error.rotated");
    }
    if (error.code === "conflict") return t("sharing.error.conflict");
    if (error.code === "guest_view_only") return t("sharing.error.guestViewOnly");
    if (error.code === "forbidden") return t("sharing.error.forbidden");
    if (error.code === "not_found") return t("sharing.error.notFound");
  }
  if (error instanceof Error && /key changed|KeyChanged/i.test(error.message)) return t("sharing.error.keyChanged");
  if (error instanceof Error && /unverified|not verified/i.test(error.message)) return t("sharing.error.unverified");
  return errorMessage(error);
}

/** A security code (fingerprint) in groups of five digits, easy to read out loud. */
export function SecurityCode({ value, label, compact }: { value: string; label: string; compact?: boolean }) {
  const groups = fingerprintGroups(value);
  return (
    <div data-testid="security-code">
      <span className="sr-only">
        {label}: {groups.join(" ")}
      </span>
      <div
        aria-hidden="true"
        className={cn(
          "grid grid-cols-4 gap-x-3 gap-y-1.5 rounded-lg border border-border bg-surface-raised font-mono tabular-nums",
          compact ? "px-3 py-2 text-[0.8125rem]" : "px-4 py-3 text-[0.9375rem]",
        )}
      >
        {groups.map((group, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: groups can repeat; the position is the identity
          <span key={index} className="tracking-wider">
            {group}
          </span>
        ))}
      </div>
    </div>
  );
}

export function RoleBadge({ org, role }: { org: Pick<Org, "kind">; role: string }) {
  const { t } = useI18n();
  return <Badge tone={role === "owner" || role === "admin" ? "accent" : "neutral"}>{t(orgRoleKey(org, role))}</Badge>;
}

export function MemberStatusBadge({ member }: { member: OrgMember }) {
  const { t } = useI18n();
  if (member.status === "accepted") return <Badge tone="warning">{t("sharing.status.accepted")}</Badge>;
  if (member.status === "suspended") return <Badge tone="danger">{t("sharing.status.suspended")}</Badge>;
  if (member.keyChanged) return <Badge tone="warning">{t("sharing.status.keyChanged")}</Badge>;
  if (!member.verified) return <Badge tone="warning">{t("sharing.status.unverified")}</Badge>;
  return null;
}

/** "Visible to: Doe family (4)" for shared vaults, "Only you" for personal ones. */
export function useAudience(vaultId: string | undefined): {
  shared: SharedVault | undefined;
  org: Org | undefined;
  count: number;
  everyone: boolean;
  label: string;
} {
  const { t } = useI18n();
  const { sharedVaults, orgs } = useSnapshot();
  const shared = sharedVaults.find((v) => v.vaultId === vaultId);
  const org = shared ? orgs.find((o) => o.id === shared.orgId) : undefined;
  if (!shared) return { shared, org, count: 1, everyone: false, label: t("sharing.audience.onlyYou") };
  const audience = vaultAudience(shared, org);
  const everyone = sharedWithEveryone(audience, org);
  const count = audience.size;
  return {
    shared,
    org,
    count,
    everyone,
    label: everyone
      ? t("sharing.audience.everyone", { name: orgName(org, t), count })
      : t("sharing.audience.people", { count }),
  };
}

export function AudienceIcon({ shared, className }: { shared: boolean; className?: string }) {
  const Icon = shared ? Users : Lock;
  return <Icon className={cn("size-3.5", className)} aria-hidden="true" />;
}
