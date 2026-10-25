import type { OrgReport } from "@passbox/api-client";
import type { Org, OrgMember } from "@passbox/client";
import { Badge, Button, cn, Dialog, fieldClassName } from "@passbox/ui";
import { AlertTriangle, KeyRound, LogOut, Vault as VaultIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { FormError } from "../auth/AuthLayout";
import { useI18n } from "../lib/i18n";
import type { Route } from "../lib/route";
import { memberLabel, vaultRoleKey } from "../lib/sharing";
import { sharingError } from "../sharing/common";
import { exclusive } from "../sharing/usePendingRotations";
import { useClient, useSnapshot } from "../useClient";
import { useNames } from "./common";

/**
 * Offboarding (D4): hand over vaults only the member manages, sign the
 * member out everywhere, then remove them, which ends their access on the
 * server at once and rotates the keys of every vault this device manages.
 */
export function OffboardDialog({
  org,
  member,
  report,
  navigate,
  onOpenChange,
}: {
  org: Org;
  member: OrgMember | undefined;
  report: OrgReport | undefined;
  navigate: (route: Route) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const client = useClient();
  const { t } = useI18n();
  const { sharedVaults } = useSnapshot();
  const names = useNames(org);
  const [phase, setPhase] = useState<"ask" | "busy" | "done">("ask");
  const [error, setError] = useState<string>();
  const [endSessions, setEndSessions] = useState(true);
  const [successors, setSuccessors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<string[]>([]);
  const name = memberLabel(member, t("sharing.member"));
  const accountId = member?.accountId;
  const team = org.kind === "team";

  useEffect(() => {
    if (!accountId) return;
    setPhase("ask");
    setError(undefined);
    setEndSessions(team);
    setSuccessors({});
    setPending([]);
  }, [accountId, team]);

  const access = useMemo(() => (report?.access ?? []).filter((a) => a.accountId === accountId), [report, accountId]);
  const groups = report?.members.find((m) => m.accountId === accountId)?.groups ?? [];
  // Vaults where the member is the only manager: without a handover nobody can change who has access.
  const soleManager = (report?.vaults ?? []).filter((v) => v.managers.length === 1 && v.managers[0] === accountId);
  const candidates = org.members.filter(
    (m) => m.accountId !== accountId && m.status === "confirmed" && m.verified && m.role !== "guest",
  );

  async function offboard() {
    if (!member) return;
    setPhase("busy");
    setError(undefined);
    try {
      const handovers = Object.entries(successors)
        .filter(([, successorId]) => successorId)
        .map(([vaultId, successorId]) => ({ vaultId, successorId }));
      const result = await exclusive(() =>
        client.offboardMember(org.id, member.accountId, { handovers, endSessions: team && endSessions }),
      );
      setPending(result.pendingRotation);
      setPhase("done");
    } catch (e) {
      setError(sharingError(e, t));
      setPhase("ask");
    }
  }

  if (phase === "done") {
    return (
      <Dialog
        open={member !== undefined}
        onOpenChange={onOpenChange}
        title={t("orgAdmin.offboard.doneTitle", { name })}
        description={t("orgAdmin.offboard.doneText", { name })}
        footer={<Button onClick={() => onOpenChange(false)}>{t("action.done")}</Button>}
      >
        <div className="flex flex-col gap-3">
          <div className="flex gap-3 rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-[0.8125rem]">
            <KeyRound className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
            <p>{t("sharing.remove.changePasswords", { name })}</p>
          </div>
          {pending.length > 0 && (
            <div className="flex flex-col gap-2 text-[0.8125rem]">
              <p>{t("orgAdmin.offboard.pending", { count: pending.length })}</p>
              <ul className="flex flex-col gap-1">
                {pending.map((vaultId) => (
                  <li key={vaultId} className="flex items-center gap-2">
                    <VaultIcon className="size-4 text-text-muted" aria-hidden="true" />
                    {names.vault(vaultId)}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {access.length > 0 && (
            <Button
              size="sm"
              variant="secondary"
              className="self-start"
              onClick={() => {
                onOpenChange(false);
                navigate({ view: "org-admin", orgId: org.id, section: "vaults" });
              }}
            >
              {t("orgAdmin.offboard.openVaults")}
            </Button>
          )}
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={member !== undefined}
      onOpenChange={(open) => phase !== "busy" && onOpenChange(open)}
      title={t("orgAdmin.offboard.title", { name })}
      description={t("orgAdmin.offboard.text", { name })}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={phase === "busy"}>
            {t("action.cancel")}
          </Button>
          <Button variant="danger" onClick={() => void offboard()} loading={phase === "busy"}>
            {phase === "busy" ? t("orgAdmin.offboard.busy") : t("orgAdmin.offboard.action", { name })}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <section className="flex flex-col gap-2">
          <h3 className="text-[0.8125rem] font-semibold">{t("orgAdmin.offboard.accessTitle")}</h3>
          {access.length === 0 && groups.length === 0 ? (
            <p className="text-[0.8125rem] text-text-muted">{t("orgAdmin.offboard.noAccess", { name })}</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {access.map((entry) => (
                <li key={entry.vaultId} className="flex flex-wrap items-center gap-2 text-[0.8125rem]">
                  <VaultIcon className="size-4 text-text-muted" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{names.vault(entry.vaultId)}</span>
                  <Badge>{t(vaultRoleKey(entry.role))}</Badge>
                  {entry.via
                    .filter((via) => via !== "direct")
                    .map((groupId) => (
                      <Badge key={groupId} tone="accent">
                        {t("orgAdmin.access.viaGroup", { group: names.group(groupId) })}
                      </Badge>
                    ))}
                </li>
              ))}
              {groups.map((groupId) => (
                <li key={groupId} className="text-xs text-text-muted">
                  {t("orgAdmin.offboard.group", { group: names.group(groupId) })}
                </li>
              ))}
            </ul>
          )}
        </section>

        {soleManager.length > 0 && (
          <section className="flex flex-col gap-2">
            <h3 className="text-[0.8125rem] font-semibold">{t("orgAdmin.offboard.handoverTitle")}</h3>
            <p className="text-xs text-text-muted">{t("orgAdmin.offboard.handoverText", { name })}</p>
            <ul className="flex flex-col gap-3">
              {soleManager.map((vault) => {
                const mine = sharedVaults.find((v) => v.vaultId === vault.vaultId);
                const canHandOver = Boolean(mine?.hasKey && mine.verified);
                return (
                  <li
                    key={vault.vaultId}
                    className="flex flex-col gap-1.5 rounded-control border border-hairline px-3 py-2.5"
                  >
                    <span className="flex items-center gap-2 text-[0.8125rem] font-medium">
                      <VaultIcon className="size-4 text-text-muted" aria-hidden="true" />
                      {names.vault(vault.vaultId)}
                    </span>
                    {canHandOver ? (
                      <label className="flex flex-col gap-1 text-xs text-text-muted">
                        {t("orgAdmin.offboard.successor")}
                        <select
                          className={cn(fieldClassName, "h-9 px-2 text-[0.8125rem] text-text coarse:h-11")}
                          value={successors[vault.vaultId] ?? ""}
                          onChange={(e) => setSuccessors({ ...successors, [vault.vaultId]: e.target.value })}
                        >
                          <option value="">{t("orgAdmin.offboard.noSuccessor")}</option>
                          {candidates.map((c) => (
                            <option key={c.accountId} value={c.accountId}>
                              {memberLabel(c, t("sharing.member"))}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <p className="flex gap-2 text-xs text-warning-text">
                        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                        {t("orgAdmin.offboard.cannotHandOver", { name })}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {team && (
          <label className="flex items-start gap-3 rounded-control border border-hairline px-3 py-2.5 text-[0.8125rem]">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-[var(--color-accent)]"
              checked={endSessions}
              onChange={(e) => setEndSessions(e.target.checked)}
            />
            <span>
              <span className="flex items-center gap-1.5 font-medium">
                <LogOut className="size-3.5" aria-hidden="true" />
                {t("orgAdmin.offboard.endSessions", { name })}
              </span>
              <span className="mt-0.5 block text-xs text-text-muted">{t("orgAdmin.offboard.endSessionsHint")}</span>
            </span>
          </label>
        )}

        <div className="flex gap-3 rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-[0.8125rem]">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
          <p>{t("orgAdmin.offboard.consequence", { name })}</p>
        </div>
        <FormError message={error} />
      </div>
    </Dialog>
  );
}
