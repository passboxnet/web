import type { PrincipalType, SharedVaultMember, VaultRole } from "@passbox/client";
import { Badge, Button, cn, Dialog, Monogram, Tooltip, toast } from "@passbox/ui";
import { AlertTriangle, RefreshCw, UserPlus, Users, X } from "lucide-react";
import { useEffect, useState } from "react";
import { FormError } from "../auth/AuthLayout";
import { useI18n } from "../lib/i18n";
import { memberLabel, VAULT_ROLES, vaultRoleKey } from "../lib/sharing";
import { useClient, useSnapshot } from "../useClient";
import { displayVaultName, orgName, sharingError, useMyAccountId } from "./common";
import { ViewRoleNote } from "./RoleChoice";
import { exclusive } from "./usePendingRotations";

const selectClass =
  "h-8 rounded-lg border border-border-strong bg-surface px-2.5 text-[0.8125rem] text-text shadow-xs focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/20 disabled:opacity-70 coarse:h-11";

interface VaultSharingDialogProps {
  vaultId: string | undefined;
  onOpenChange: (open: boolean) => void;
}

/** Who can open a shared vault, with which role; managers add, change and remove. */
export function VaultSharingDialog({ vaultId, onOpenChange }: VaultSharingDialogProps) {
  const client = useClient();
  const { t } = useI18n();
  const { sharedVaults, vaults, orgs } = useSnapshot();
  const me = useMyAccountId();
  const shared = sharedVaults.find((v) => v.vaultId === vaultId);
  const org = orgs.find((o) => o.id === shared?.orgId);
  const vault = vaults.find((v) => v.id === vaultId);
  const canManage = shared?.role === "manage";
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();
  const [removing, setRemoving] = useState<SharedVaultMember>();
  const [adding, setAdding] = useState("");
  const [addRole, setAddRole] = useState<VaultRole>("edit");

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset when another vault opens
  useEffect(() => {
    setError(undefined);
    setRemoving(undefined);
    setAdding("");
    setAddRole("edit");
  }, [vaultId]);

  if (!shared || !org) {
    return <Dialog open={vaultId !== undefined} onOpenChange={onOpenChange} title={t("sharing.vaultDialog.unknown")} />;
  }

  const name = displayVaultName(vault, t);
  const principalName = (member: Pick<SharedVaultMember, "principalType" | "principalId">) => {
    if (member.principalType === "group") {
      const group = org.groups.find((g) => g.id === member.principalId);
      return group?.name ?? t("sharing.group.unnamed");
    }
    const person = org.members.find((m) => m.accountId === member.principalId);
    const label = memberLabel(person, t("sharing.member"));
    return member.principalId === me ? t("sharing.you", { name: label }) : label;
  };

  const present = new Set(shared.members.map((m) => `${m.principalType}:${m.principalId}`));
  const candidates: { key: string; type: PrincipalType; id: string; label: string }[] = [
    ...org.groups
      .filter((g) => !present.has(`group:${g.id}`))
      .map((g) => ({
        key: `group:${g.id}`,
        type: "group" as const,
        id: g.id,
        label: t("sharing.vaultDialog.groupOption", {
          name: g.name ?? t("sharing.group.unnamed"),
          count: g.members.length,
        }),
      })),
    ...org.members
      .filter((m) => m.status === "confirmed" && !present.has(`account:${m.accountId}`))
      .map((m) => ({
        key: `account:${m.accountId}`,
        type: "account" as const,
        id: m.accountId,
        label: memberLabel(m, t("sharing.member")),
      })),
  ];
  const waiting = org.members.filter((m) => m.status === "accepted");

  async function run(key: string, action: () => Promise<void>, done: string) {
    setBusy(key);
    setError(undefined);
    try {
      await action();
      toast.success(done);
      return true;
    } catch (e) {
      setError(sharingError(e, t));
      return false;
    } finally {
      setBusy(undefined);
    }
  }

  async function add() {
    const candidate = candidates.find((c) => c.key === adding);
    if (!candidate || !vaultId) return;
    const ok = await run(
      "add",
      () => client.shareVault(vaultId, candidate.type, candidate.id, addRole),
      t("sharing.vaultDialog.added", { name: candidate.label, vault: name }),
    );
    if (ok) setAdding("");
  }

  async function changeRole(member: SharedVaultMember, role: VaultRole) {
    if (!vaultId) return;
    await run(
      `role:${member.principalId}`,
      () => client.shareVault(vaultId, member.principalType as PrincipalType, member.principalId, role),
      t("sharing.vaultDialog.roleChanged", { name: principalName(member), role: t(vaultRoleKey(role)) }),
    );
  }

  async function remove(member: SharedVaultMember) {
    if (!vaultId) return;
    const ok = await run(
      `remove:${member.principalId}`,
      () => exclusive(() => client.unshareVault(vaultId, member.principalType as PrincipalType, member.principalId)),
      t("sharing.vaultDialog.removed", { name: principalName(member), vault: name }),
    );
    if (ok) setRemoving(undefined);
  }

  async function rotate() {
    if (!vaultId) return;
    await run(
      "rotate",
      () => exclusive(() => client.rotateVaultKey(vaultId)),
      t("sharing.rotation.done", { vault: name }),
    );
  }

  if (removing) {
    const who = principalName(removing);
    return (
      <Dialog
        open
        onOpenChange={(open) => !busy && !open && setRemoving(undefined)}
        title={t("sharing.vaultDialog.removeTitle", { name: who, vault: name })}
        description={t("sharing.vaultDialog.removeText", { name: who, vault: name })}
        size="sm"
        footer={
          <>
            <Button variant="secondary" disabled={busy !== undefined} onClick={() => setRemoving(undefined)}>
              {t("action.cancel")}
            </Button>
            <Button variant="danger" loading={busy !== undefined} onClick={() => void remove(removing)}>
              {busy ? t("sharing.remove.busy") : t("sharing.vaultDialog.removeAction")}
            </Button>
          </>
        }
      >
        <FormError message={error} />
      </Dialog>
    );
  }

  return (
    <Dialog
      open={vaultId !== undefined}
      onOpenChange={onOpenChange}
      title={t("sharing.vaultDialog.title", { vault: name })}
      description={t("sharing.vaultDialog.text", { org: orgName(org, t) })}
      size="lg"
    >
      <div className="flex flex-col gap-4">
        {shared.rotationPending && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-[0.8125rem]">
            <AlertTriangle className="size-4 shrink-0 text-warning" aria-hidden="true" />
            <p className="min-w-0 flex-1">
              {canManage ? t("sharing.rotation.pendingManager") : t("sharing.rotation.pendingMember")}
            </p>
            {canManage && (
              <Button size="sm" variant="secondary" loading={busy === "rotate"} onClick={() => void rotate()}>
                <RefreshCw />
                {t("sharing.rotation.action")}
              </Button>
            )}
          </div>
        )}

        <ul
          className="divide-y divide-border rounded-lg border border-border"
          aria-label={t("sharing.vaultDialog.members")}
        >
          {shared.members.map((member) => {
            const group = member.principalType === "group";
            const label = principalName(member);
            const self = member.principalId === me;
            return (
              <li
                key={`${member.principalType}:${member.principalId}`}
                className="flex flex-wrap items-center gap-3 px-3 py-2.5"
              >
                {group ? (
                  <span className="flex size-8 items-center justify-center rounded-full bg-accent-soft text-accent">
                    <Users className="size-4" aria-hidden="true" />
                  </span>
                ) : (
                  <Monogram name={label} size="sm" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.8125rem] font-medium">{label}</span>
                  {group && (
                    <span className="block text-xs text-text-muted">
                      {t("sharing.group.memberCount", {
                        count: org.groups.find((g) => g.id === member.principalId)?.members.length ?? 0,
                      })}
                    </span>
                  )}
                </span>
                {canManage && !self ? (
                  <>
                    <select
                      className={selectClass}
                      aria-label={t("sharing.vaultDialog.roleFor", { name: label })}
                      value={member.role}
                      disabled={busy !== undefined}
                      onChange={(e) => void changeRole(member, e.target.value as VaultRole)}
                    >
                      {VAULT_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {t(vaultRoleKey(role))}
                        </option>
                      ))}
                    </select>
                    <Tooltip content={t("sharing.vaultDialog.remove", { name: label })}>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t("sharing.vaultDialog.remove", { name: label })}
                        disabled={busy !== undefined}
                        onClick={() => setRemoving(member)}
                      >
                        <X />
                      </Button>
                    </Tooltip>
                  </>
                ) : (
                  <Badge>{t(vaultRoleKey(member.role))}</Badge>
                )}
              </li>
            );
          })}
        </ul>

        {canManage ? (
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface-raised p-3">
            <p className="text-[0.8125rem] font-medium">{t("sharing.vaultDialog.addTitle")}</p>
            {candidates.length === 0 ? (
              <p className="text-[0.8125rem] text-text-muted">{t("sharing.vaultDialog.nobodyLeft")}</p>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className={cn(selectClass, "min-w-48 flex-1")}
                  aria-label={t("sharing.vaultDialog.person")}
                  value={adding}
                  onChange={(e) => setAdding(e.target.value)}
                >
                  <option value="">{t("sharing.vaultDialog.choose")}</option>
                  {candidates.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <select
                  className={selectClass}
                  aria-label={t("sharing.vaultRoleLabel")}
                  value={addRole}
                  onChange={(e) => setAddRole(e.target.value as VaultRole)}
                >
                  {VAULT_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {t(vaultRoleKey(role))}
                    </option>
                  ))}
                </select>
                <Button size="sm" disabled={!adding} loading={busy === "add"} onClick={() => void add()}>
                  <UserPlus />
                  {t("sharing.vaultDialog.add")}
                </Button>
              </div>
            )}
            {waiting.length > 0 && (
              <p className="text-xs text-text-muted">{t("sharing.vaultDialog.waiting", { count: waiting.length })}</p>
            )}
          </div>
        ) : (
          <p className="text-[0.8125rem] text-text-muted">{t("sharing.vaultDialog.onlyManagers")}</p>
        )}

        <dl className="grid gap-x-4 gap-y-1.5 text-xs sm:grid-cols-[auto_1fr]">
          {VAULT_ROLES.map((role) => (
            <div key={role} className="contents">
              <dt className="font-medium">{t(vaultRoleKey(role))}</dt>
              <dd className="text-text-muted">{t(`${vaultRoleKey(role)}.description`)}</dd>
            </div>
          ))}
        </dl>
        <ViewRoleNote />
        <FormError message={error} />
      </div>
    </Dialog>
  );
}
