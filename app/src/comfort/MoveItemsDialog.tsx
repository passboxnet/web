import { ApiError } from "@passbox/api-client";
import { canMoveBetween, type MoveAudienceMember } from "@passbox/client";
import { Button, cn, Dialog, fieldClassName, toast } from "@passbox/ui";
import { ArrowRightLeft, Info, UserMinus, UserPlus, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { FormError } from "../auth/AuthLayout";
import { useI18n } from "../lib/i18n";
import { itemTitle } from "../lib/items";
import { writableVaults } from "../lib/sharing";
import { displayVaultName, orgName, sharingError } from "../sharing/common";
import { useClient, useSnapshot } from "../useClient";
import { comfortError } from "./errors";

const selectClass = cn(fieldClassName, "h-10 px-2.5 coarse:h-12");

/**
 * "Move to another vault" (B5) for one or more items: pick the target,
 * see who gains and who loses access, then move. Moving re-encrypts the
 * items for the target vault on this device; they keep their history and
 * attachments. The toast offers to move them back.
 */
export function MoveItemsDialog({
  itemIds,
  open,
  onOpenChange,
  onMoved,
  sharedOnly = false,
  title,
  description,
}: {
  itemIds: readonly string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMoved?: (targetVaultId: string) => void;
  /** Only shared vaults (the "Share" flow of a personal item). */
  sharedOnly?: boolean;
  title?: string;
  description?: string;
}) {
  const client = useClient();
  const { t } = useI18n();
  const { vaults, items, orgs, effectivePolicy } = useSnapshot();
  const chosen = items.filter((i) => itemIds.includes(i.id));
  const sources = new Set(chosen.map((i) => i.vaultId));
  const targets = writableVaults(vaults).filter(
    (v) => !(sources.size === 1 && sources.has(v.id)) && (!sharedOnly || v.orgId),
  );
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  // biome-ignore lint/correctness/useExhaustiveDependencies: preselect when the dialog opens
  useEffect(() => {
    if (!open) return;
    setError(undefined);
    setTarget(targets[0]?.id ?? "");
  }, [open]);

  const targetVault = vaults.find((v) => v.id === target);
  const blocked = targetVault
    ? chosen.filter(
        (item) => !canMoveBetween(effectivePolicy, vaults.find((v) => v.id === item.vaultId) ?? {}, targetVault),
      )
    : [];
  // biome-ignore lint/correctness/useExhaustiveDependencies: recompute when the choice or the sharing state changes
  const preview = useMemo(
    () => (target ? client.movePreview(itemIds, target) : undefined),
    [client, itemIds, target, vaults, orgs],
  );
  const targetName = displayVaultName(targetVault, t);
  const label = (m: MoveAudienceMember) => m.email || t("sharing.member");

  async function move() {
    if (!target || blocked.length > 0) return;
    setBusy(true);
    setError(undefined);
    const from = new Map(chosen.map((i) => [i.id, i.vaultId]));
    try {
      const moved = await client.moveItems(itemIds, target);
      const single = chosen.length === 1 && chosen[0] ? itemTitle(chosen[0], t) : undefined;
      toast.success(
        single
          ? t("move.done.one", { name: single, vault: targetName })
          : t("move.done.many", { count: moved.length, vault: targetName }),
        {
          duration: 10_000,
          action: {
            label: t("action.undo"),
            onClick: () => void undo(moved, from),
          },
        },
      );
      onOpenChange(false);
      onMoved?.(target);
    } catch (e) {
      setError(moveError(e));
    } finally {
      setBusy(false);
    }
  }

  async function undo(moved: string[], from: Map<string, string>) {
    try {
      const byVault = new Map<string, string[]>();
      for (const id of moved) {
        const vault = from.get(id);
        if (vault) byVault.set(vault, [...(byVault.get(vault) ?? []), id]);
      }
      for (const [vault, ids] of byVault) await client.moveItems(ids, vault);
      toast.success(t("move.undone"));
    } catch (e) {
      toast.error(t("move.undoFailed"), { description: moveError(e) });
    }
  }

  function moveError(e: unknown): string {
    return e instanceof ApiError ? comfortError(e, t) : sharingError(e, t);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={
        title ??
        (chosen.length === 1 && chosen[0]
          ? t("move.title.one", { name: itemTitle(chosen[0], t) })
          : t("move.title.many", { count: chosen.length }))
      }
      description={description ?? t("move.text")}
      footer={
        targets.length > 0 && (
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {t("action.cancel")}
            </Button>
            <Button onClick={() => void move()} loading={busy} disabled={!target || blocked.length > 0}>
              <ArrowRightLeft />
              {t("move.action", { vault: targetName })}
            </Button>
          </>
        )
      }
    >
      {targets.length === 0 ? (
        <p className="text-[0.8125rem] text-text-muted">{t("move.noTarget")}</p>
      ) : (
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.8125rem] font-medium">{t("move.target")}</span>
            <select
              className={selectClass}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              data-testid="move-target"
            >
              {targets.map((vault) => {
                const org = orgs.find((o) => o.id === vault.orgId);
                return (
                  <option key={vault.id} value={vault.id}>
                    {org
                      ? t("sharing.shareItem.option", { vault: displayVaultName(vault, t), org: orgName(org, t) })
                      : displayVaultName(vault, t)}
                  </option>
                );
              })}
            </select>
          </label>

          {preview && (
            <section
              aria-label={t("move.preview")}
              className="rounded-lg border border-border bg-surface-raised px-4 py-3 text-[0.8125rem]"
              data-testid="move-preview"
            >
              <p className="flex items-center gap-2 font-medium">
                <Users className="size-4 text-accent" aria-hidden="true" />
                {t("move.preview")}
              </p>
              {preview.gain.length === 0 && preview.lose.length === 0 ? (
                <p className="mt-1.5 text-text-muted">{t("move.preview.same")}</p>
              ) : (
                <div className="mt-2 flex flex-col gap-2">
                  {preview.gain.length > 0 && (
                    <div>
                      <p className="flex items-center gap-1.5 text-xs font-medium text-success">
                        <UserPlus className="size-3.5" aria-hidden="true" />
                        {t("move.preview.gain", { count: preview.gain.length })}
                      </p>
                      <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-text-muted">
                        {preview.gain.map((m) => (
                          <li key={m.accountId}>{label(m)}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {preview.lose.length > 0 && (
                    <div>
                      <p className="flex items-center gap-1.5 text-xs font-medium text-danger">
                        <UserMinus className="size-3.5" aria-hidden="true" />
                        {t("move.preview.lose", { count: preview.lose.length })}
                      </p>
                      <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-text-muted">
                        {preview.lose.map((m) => (
                          <li key={m.accountId}>{label(m)}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {blocked.length > 0 && <FormError message={t("move.error.policy")} />}
          <p className="flex gap-2 text-xs text-text-muted">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            {t("move.howItWorks")}
          </p>
          <FormError message={error} />
        </div>
      )}
    </Dialog>
  );
}
