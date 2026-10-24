import type { VaultReport } from "@passbox/api-client";
import type { Org } from "@passbox/client";
import { Badge, Button, Dialog, toast } from "@passbox/ui";
import { Lock, Plus, RefreshCw, Share2, Users, Vault as VaultIcon } from "lucide-react";
import { useState } from "react";
import { useI18n } from "../lib/i18n";
import type { Route } from "../lib/route";
import { vaultRoleKey } from "../lib/sharing";
import { sharingError } from "../sharing/common";
import { NewSharedVaultDialog } from "../sharing/OrgView";
import { exclusive } from "../sharing/usePendingRotations";
import { VaultSharingDialog } from "../sharing/VaultSharingDialog";
import { useClient, useSnapshot } from "../useClient";
import { Cell, Loading, Section, Table, useNames } from "./common";
import type { ReportState } from "./OrgAdminView";

export function VaultsSection({
  org,
  data,
  navigate,
}: {
  org: Org;
  data: ReportState;
  navigate: (route: Route) => void;
}) {
  const client = useClient();
  const i18n = useI18n();
  const { t } = i18n;
  const { sharedVaults } = useSnapshot();
  const names = useNames(org);
  const [sharing, setSharing] = useState<string>();
  const [creating, setCreating] = useState(false);
  const [accessFor, setAccessFor] = useState<VaultReport>();
  const [rotating, setRotating] = useState<string>();
  const { report } = data;

  async function rotate(vaultId: string) {
    setRotating(vaultId);
    try {
      await exclusive(() => client.rotateVaultKey(vaultId));
      toast.success(t("orgAdmin.vaults.rotated", { name: names.vault(vaultId) }));
      data.reload();
    } catch (e) {
      toast.error(sharingError(e, t));
    } finally {
      setRotating(undefined);
    }
  }

  const people = (vaultId: string) =>
    new Set(report?.access.filter((a) => a.vaultId === vaultId).map((a) => a.accountId)).size;

  return (
    <Section
      title={t("orgAdmin.section.vaults")}
      description={t("orgAdmin.vaults.description")}
      actions={
        <Button onClick={() => setCreating(true)}>
          <Plus />
          {t("sharing.vaults.new")}
        </Button>
      }
    >
      {!report ? (
        <Loading error={data.error} onRetry={data.reload} />
      ) : (
        <Table
          label={t("orgAdmin.section.vaults")}
          head={[
            t("orgAdmin.vaults.col.vault"),
            t("orgAdmin.vaults.col.people"),
            t("orgAdmin.vaults.col.managers"),
            t("orgAdmin.vaults.col.items"),
            t("orgAdmin.vaults.col.activity"),
            <span key="actions" className="sr-only">
              {t("orgAdmin.members.col.actions")}
            </span>,
          ]}
        >
          {report.vaults.length === 0 && (
            <tr>
              <Cell colSpan={6} className="text-text-muted">
                {t("sharing.vaults.none")}
              </Cell>
            </tr>
          )}
          {report.vaults.map((vault) => {
            const mine = sharedVaults.find((v) => v.vaultId === vault.vaultId);
            const lastActivity = Math.max(vault.lastWriteAt, vault.lastUsedAt);
            return (
              <tr key={vault.vaultId} data-testid="admin-vault">
                <Cell>
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-sunken text-text-muted">
                      {mine ? (
                        <VaultIcon className="size-4" aria-hidden="true" />
                      ) : (
                        <Lock className="size-4" aria-hidden="true" />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{names.vault(vault.vaultId)}</span>
                      <span className="flex flex-wrap gap-1.5">
                        {mine?.role && (
                          <Badge>{t("orgAdmin.vaults.yourRole", { role: t(vaultRoleKey(mine.role)) })}</Badge>
                        )}
                        {!mine && <Badge>{t("orgAdmin.vaults.noAccess")}</Badge>}
                        {vault.rotationPending && <Badge tone="warning">{t("orgAdmin.vaults.rotationPending")}</Badge>}
                        {vault.unused && <Badge tone="accent">{t("orgAdmin.vaults.unused")}</Badge>}
                        {vault.vaultId === org.defaultVaultId && (
                          <Badge tone="accent">{t("sharing.vaults.familyVault")}</Badge>
                        )}
                      </span>
                    </span>
                  </span>
                </Cell>
                <Cell>
                  <Button size="xs" variant="ghost" onClick={() => setAccessFor(vault)}>
                    <Users />
                    {people(vault.vaultId)}
                  </Button>
                </Cell>
                <Cell className="max-w-[14rem]">
                  {vault.managers.length === 0 ? (
                    <span className="text-xs text-warning-text">{t("orgAdmin.vaults.noManager")}</span>
                  ) : (
                    <span className="block truncate text-xs" title={vault.managers.map(names.member).join(", ")}>
                      {vault.managers.map(names.member).join(", ")}
                    </span>
                  )}
                </Cell>
                <Cell className="tabular-nums">{vault.itemCount}</Cell>
                <Cell className="whitespace-nowrap text-xs text-text-muted">
                  {lastActivity ? (
                    <span title={i18n.dateTime(lastActivity)}>{i18n.relativeTime(lastActivity)}</span>
                  ) : (
                    t("orgAdmin.members.never")
                  )}
                </Cell>
                <Cell className="text-right">
                  <span className="flex items-center justify-end gap-1">
                    {vault.rotationPending && mine?.role === "manage" && mine.hasKey && (
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={rotating === vault.vaultId}
                        onClick={() => void rotate(vault.vaultId)}
                      >
                        <RefreshCw />
                        {t("orgAdmin.vaults.rotate")}
                      </Button>
                    )}
                    {mine && (
                      <Button size="sm" variant="ghost" onClick={() => setSharing(vault.vaultId)}>
                        <Share2 />
                        {mine.role === "manage" ? t("sharing.vaults.share") : t("sharing.vaults.whoHasAccess")}
                      </Button>
                    )}
                    {mine && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => navigate({ view: "items", filter: { kind: "vault", vaultId: vault.vaultId } })}
                      >
                        {t("sharing.remove.openVault")}
                      </Button>
                    )}
                  </span>
                </Cell>
              </tr>
            );
          })}
        </Table>
      )}
      <p className="text-xs text-text-muted">{t("orgAdmin.vaults.zeroKnowledge")}</p>

      <AccessDialog org={org} vault={accessFor} data={data} onOpenChange={(open) => !open && setAccessFor(undefined)} />
      <VaultSharingDialog vaultId={sharing} onOpenChange={(open) => !open && setSharing(undefined)} />
      <NewSharedVaultDialog
        org={org}
        open={creating}
        onOpenChange={setCreating}
        onCreated={(vaultId) => {
          data.reload();
          setSharing(vaultId);
        }}
      />
    </Section>
  );
}

function AccessDialog({
  org,
  vault,
  data,
  onOpenChange,
}: {
  org: Org;
  vault: VaultReport | undefined;
  data: ReportState;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useI18n();
  const names = useNames(org);
  const entries = (data.report?.access ?? []).filter((a) => a.vaultId === vault?.vaultId);
  return (
    <Dialog
      open={vault !== undefined}
      onOpenChange={onOpenChange}
      title={t("orgAdmin.vaults.accessTitle", { name: vault ? names.vault(vault.vaultId) : "" })}
      description={t("orgAdmin.vaults.accessText")}
    >
      <ul className="flex flex-col divide-y divide-border">
        {entries.length === 0 && (
          <li className="py-2 text-[0.8125rem] text-text-muted">{t("orgAdmin.vaults.nobody")}</li>
        )}
        {entries.map((entry) => (
          <li key={entry.accountId} className="flex flex-wrap items-center gap-2 py-2 text-[0.8125rem]">
            <span className="min-w-0 flex-1 truncate">{names.member(entry.accountId)}</span>
            <Badge>{t(vaultRoleKey(entry.role))}</Badge>
            {entry.via.map((via) =>
              via === "direct" ? (
                <Badge key={via}>{t("orgAdmin.access.direct")}</Badge>
              ) : (
                <Badge key={via} tone="accent">
                  {t("orgAdmin.access.viaGroup", { group: names.group(via) })}
                </Badge>
              ),
            )}
          </li>
        ))}
      </ul>
    </Dialog>
  );
}
