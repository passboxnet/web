import type { Item } from "@passbox/client";
import { Button, cn, Dialog, fieldClassName, toast } from "@passbox/ui";
import { ArrowRight, Info, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { FormError } from "../auth/AuthLayout";
import { useI18n } from "../lib/i18n";
import { itemTitle } from "../lib/items";
import type { Route } from "../lib/route";
import { memberLabel, vaultAudience } from "../lib/sharing";
import { useClient, useSnapshot } from "../useClient";
import { displayVaultName, orgName, sharingError, useAudience } from "./common";

const selectClass = cn(fieldClassName, "h-10 px-2.5 coarse:h-12");

/**
 * "Share" on a personal item. Passbox shares whole vaults, so sharing an item
 * means putting it into a shared vault: a copy goes there (without earlier
 * passwords) and the original goes to the trash, restorable for 30 days.
 * The dialog first shows who will be able to see it.
 */
export function ShareItemDialog({
  item,
  open,
  onOpenChange,
  navigate,
}: {
  item: Item;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  navigate: (route: Route) => void;
}) {
  const client = useClient();
  const { t } = useI18n();
  const { vaults, sharedVaults, orgs } = useSnapshot();
  const targets = vaults.filter((v) => v.orgId && (v.role === "edit" || v.role === "manage"));
  const [target, setTarget] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const audience = useAudience(target || undefined);

  // biome-ignore lint/correctness/useExhaustiveDependencies: preselect when the dialog opens
  useEffect(() => {
    if (!open) return;
    setError(undefined);
    const familyVault = orgs.find((o) => o.kind === "family" && o.defaultVaultId)?.defaultVaultId;
    setTarget(targets.find((v) => v.id === familyVault)?.id ?? targets[0]?.id ?? "");
  }, [open]);

  const shared = sharedVaults.find((v) => v.vaultId === target);
  const org = orgs.find((o) => o.id === shared?.orgId);
  const people = shared ? [...vaultAudience(shared, org)] : [];
  const targetName = displayVaultName(
    vaults.find((v) => v.id === target),
    t,
  );

  async function move() {
    if (!target) return;
    setBusy(true);
    setError(undefined);
    try {
      const { passwordHistory: _history, ...data } = item.data;
      const id = await client.createItem(target, data);
      await client.trashItem(item.id);
      toast.success(t("sharing.shareItem.done", { name: itemTitle(item, t), vault: targetName }), {
        description: t("sharing.shareItem.doneHint"),
      });
      onOpenChange(false);
      navigate({ view: "items", filter: { kind: "vault", vaultId: target }, itemId: id });
    } catch (e) {
      setError(sharingError(e, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("sharing.shareItem.title", { name: itemTitle(item, t) })}
      description={t("sharing.shareItem.text")}
    >
      {targets.length === 0 ? (
        <div className="flex flex-col gap-4">
          <p className="text-[0.8125rem] text-text-muted">
            {orgs.length === 0 ? t("sharing.shareItem.noOrg") : t("sharing.shareItem.noVault")}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              {t("action.cancel")}
            </Button>
            <Button
              onClick={() => {
                onOpenChange(false);
                navigate(orgs[0] ? { view: "org", orgId: orgs[0].id } : { view: "sharing" });
              }}
            >
              {orgs.length === 0 ? t("sharing.shareItem.startOrg") : t("sharing.shareItem.openOrg")}
              <ArrowRight />
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.8125rem] font-medium">{t("sharing.shareItem.target")}</span>
            <select className={selectClass} value={target} onChange={(e) => setTarget(e.target.value)}>
              {targets.map((vault) => {
                const vaultOrg = orgs.find((o) => o.id === vault.orgId);
                return (
                  <option key={vault.id} value={vault.id}>
                    {t("sharing.shareItem.option", { vault: displayVaultName(vault, t), org: orgName(vaultOrg, t) })}
                  </option>
                );
              })}
            </select>
          </label>
          {shared && (
            <div className="rounded-lg border border-border bg-surface-raised px-4 py-3 text-[0.8125rem]">
              <p className="flex items-center gap-2 font-medium">
                <Users className="size-4 text-accent" aria-hidden="true" />
                {t("sharing.audience.visibleFor", { audience: audience.label })}
              </p>
              <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-text-muted">
                {people.map((id) => (
                  <li key={id}>
                    {memberLabel(
                      org?.members.find((m) => m.accountId === id),
                      t("sharing.member"),
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="flex gap-2 text-xs text-text-muted">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            {t("sharing.shareItem.howItWorks")}
          </p>
          <FormError message={error} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              {t("action.cancel")}
            </Button>
            <Button onClick={() => void move()} loading={busy} disabled={!target}>
              {t("sharing.shareItem.action", { vault: targetName })}
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
