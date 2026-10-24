import type { Org, OrgMember } from "@passbox/client";
import { Button, Dialog, toast } from "@passbox/ui";
import { AlertTriangle, KeyRound, Vault as VaultIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { FormError } from "../auth/AuthLayout";
import { useI18n } from "../lib/i18n";
import type { Route } from "../lib/route";
import { type AssignableOrgRole, assignableRoles, memberLabel, orgRoleKey, vaultAudience } from "../lib/sharing";
import { useClient, useSnapshot } from "../useClient";
import { displayVaultName, sharingError } from "./common";
import { OrgRoleChoice } from "./RoleChoice";
import { exclusive } from "./usePendingRotations";

interface MemberDialogProps {
  org: Org;
  member: OrgMember | undefined;
  onOpenChange: (open: boolean) => void;
}

export function RoleDialog({ org, member, onOpenChange }: MemberDialogProps) {
  const client = useClient();
  const { t } = useI18n();
  const [role, setRole] = useState<AssignableOrgRole>("member");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const name = memberLabel(member, t("sharing.member"));
  const accountId = member?.accountId;
  const current = member?.role;

  useEffect(() => {
    if (!accountId) return;
    setRole(current === "admin" || current === "guest" ? current : "member");
    setError(undefined);
  }, [accountId, current]);

  async function save() {
    if (!member) return;
    setBusy(true);
    setError(undefined);
    try {
      await client.setMemberRole(org.id, member.accountId, role);
      toast.success(t("sharing.role.changed", { name, role: t(orgRoleKey(org, role)) }));
      onOpenChange(false);
    } catch (e) {
      setError(sharingError(e, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={member !== undefined}
      onOpenChange={onOpenChange}
      title={t("sharing.role.title", { name })}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t("action.cancel")}
          </Button>
          <Button onClick={() => void save()} loading={busy} disabled={role === member?.role}>
            {t("action.save")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <OrgRoleChoice org={org} roles={assignableRoles(org)} value={role} onChange={setRole} />
        <FormError message={error} />
      </div>
    </Dialog>
  );
}

export function SuspendDialog({ org, member, onOpenChange }: MemberDialogProps) {
  const client = useClient();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const name = memberLabel(member, t("sharing.member"));
  const suspended = member?.status === "suspended";

  async function run() {
    if (!member) return;
    setBusy(true);
    setError(undefined);
    try {
      if (suspended) await client.reactivateMember(org.id, member.accountId);
      else await client.suspendMember(org.id, member.accountId);
      toast.success(suspended ? t("sharing.suspend.reactivated", { name }) : t("sharing.suspend.done", { name }));
      onOpenChange(false);
    } catch (e) {
      setError(sharingError(e, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={member !== undefined}
      onOpenChange={onOpenChange}
      title={suspended ? t("sharing.suspend.reactivateTitle", { name }) : t("sharing.suspend.title", { name })}
      description={suspended ? t("sharing.suspend.reactivateText", { name }) : t("sharing.suspend.text", { name })}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t("action.cancel")}
          </Button>
          <Button variant={suspended ? "primary" : "danger"} onClick={() => void run()} loading={busy}>
            {suspended ? t("sharing.suspend.reactivate") : t("sharing.suspend.action")}
          </Button>
        </>
      }
    >
      <FormError message={error} />
    </Dialog>
  );
}

/**
 * Removing is the cryptographic step: the member's access ends on the server
 * at once and every key they had is replaced. What they saw before, they may
 * have kept, so the dialog ends with what to change.
 */
export function RemoveMemberDialog({
  org,
  member,
  onOpenChange,
  navigate,
}: MemberDialogProps & { navigate: (route: Route) => void }) {
  const client = useClient();
  const { t } = useI18n();
  const { sharedVaults, vaults, items } = useSnapshot();
  const [phase, setPhase] = useState<"ask" | "busy" | "done">("ask");
  const [error, setError] = useState<string>();
  const [affected, setAffected] = useState<string[]>([]);
  const name = memberLabel(member, t("sharing.member"));
  const accountId = member?.accountId;

  // The vaults the member could open, fixed when the dialog opens.
  // biome-ignore lint/correctness/useExhaustiveDependencies: computed once per member
  useEffect(() => {
    if (!accountId) return;
    setPhase("ask");
    setError(undefined);
    setAffected(
      sharedVaults.filter((v) => v.orgId === org.id && vaultAudience(v, org).has(accountId)).map((v) => v.vaultId),
    );
  }, [accountId]);

  async function remove() {
    if (!member) return;
    setPhase("busy");
    setError(undefined);
    try {
      await exclusive(() => client.removeMember(org.id, member.accountId));
      setPhase("done");
    } catch (e) {
      setError(sharingError(e, t));
      setPhase("ask");
    }
  }

  const vaultList = (
    <ul className="flex flex-col gap-1.5">
      {affected.map((vaultId) => {
        const vault = vaults.find((v) => v.id === vaultId);
        const count = items.filter((i) => i.vaultId === vaultId).length;
        return (
          <li key={vaultId} className="flex items-center gap-2 text-[0.8125rem]">
            <VaultIcon className="size-4 text-text-muted" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">{displayVaultName(vault, t)}</span>
            <span className="text-xs text-text-muted">{t("sharing.remove.itemCount", { count })}</span>
            {phase === "done" && (
              <Button
                size="xs"
                variant="secondary"
                onClick={() => {
                  onOpenChange(false);
                  navigate({ view: "items", filter: { kind: "vault", vaultId } });
                }}
              >
                {t("sharing.remove.openVault")}
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );

  if (phase === "done") {
    return (
      <Dialog
        open={member !== undefined}
        onOpenChange={onOpenChange}
        title={t("sharing.remove.doneTitle", { name })}
        description={t("sharing.remove.doneText", { name })}
        footer={<Button onClick={() => onOpenChange(false)}>{t("action.done")}</Button>}
      >
        <div className="flex flex-col gap-3">
          <div className="flex gap-3 rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-[0.8125rem]">
            <KeyRound className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
            <p>{t("sharing.remove.changePasswords", { name })}</p>
          </div>
          {affected.length > 0 && vaultList}
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={member !== undefined}
      onOpenChange={(open) => phase !== "busy" && onOpenChange(open)}
      title={t("sharing.remove.title", { name })}
      description={t("sharing.remove.text", { name })}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={phase === "busy"}>
            {t("action.cancel")}
          </Button>
          <Button variant="danger" onClick={() => void remove()} loading={phase === "busy"}>
            {phase === "busy" ? t("sharing.remove.busy") : t("sharing.remove.action")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex gap-3 rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-[0.8125rem]">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
          <p>{t("sharing.remove.consequence", { name })}</p>
        </div>
        {affected.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-[0.8125rem] font-medium">{t("sharing.remove.vaults", { name })}</p>
            {vaultList}
          </div>
        )}
        <p className="text-xs text-text-muted">{t("sharing.remove.rotation")}</p>
        <FormError message={error} />
      </div>
    </Dialog>
  );
}
