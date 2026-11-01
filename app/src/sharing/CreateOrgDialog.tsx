import type { BillingInterval } from "@passbox/api-client";
import { Button, Dialog, Input, SegmentedControl, toast } from "@passbox/ui";
import { CreditCard, LifeBuoy } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { FormError } from "../auth/AuthLayout";
import { cloudBilling, planFor, planIntervals, planPrice } from "../lib/billing";
import { useI18n } from "../lib/i18n";
import { useServerMeta } from "../lib/instance";
import { useClient } from "../useClient";
import { sharingError } from "./common";

interface CreateOrgDialogProps {
  kind: "family" | "team" | undefined;
  onOpenChange: (open: boolean) => void;
  /** `interval` is set for a Business organization on the hosted service: the owner activates it next. */
  onCreated: (orgId: string, business?: { interval: BillingInterval }) => void;
}

/**
 * "Start a family" (with its family vault) or "Create a team". On the hosted
 * service a team is a Business organization: the dialog shows its prices
 * (from the server's plans) and the owner activates it right after.
 */
export function CreateOrgDialog({ kind, onOpenChange, onCreated }: CreateOrgDialogProps) {
  const client = useClient();
  const i18n = useI18n();
  const { t } = i18n;
  const cloud = cloudBilling(useServerMeta());
  const intervals = planIntervals(cloud);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [interval, setBillingInterval] = useState<BillingInterval>("month");
  const family = kind === "family";
  const business = kind === "team" && cloud !== undefined;
  const plan = planFor(cloud, interval) ?? (intervals[0] ? planFor(cloud, intervals[0]) : undefined);

  useEffect(() => {
    if (kind) {
      setName("");
      setError(undefined);
      setBillingInterval("month");
    }
  }, [kind]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(undefined);
    try {
      const id = family
        ? await client.createFamily(trimmed, t("sharing.familyVault"))
        : await client.createTeam(trimmed);
      toast.success(
        family
          ? t("sharing.create.familyDone", { name: trimmed })
          : business
            ? t("sharing.create.businessDone", { name: trimmed })
            : t("sharing.create.teamDone", { name: trimmed }),
      );
      onOpenChange(false);
      if (business && plan) onCreated(id, { interval: plan.interval });
      else onCreated(id);
    } catch (e) {
      setError(sharingError(e, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={kind !== undefined}
      onOpenChange={onOpenChange}
      title={
        family
          ? t("sharing.create.familyTitle")
          : business
            ? t("sharing.create.businessTitle")
            : t("sharing.create.teamTitle")
      }
      description={
        family
          ? t("sharing.create.familyText")
          : business
            ? t("sharing.create.businessText")
            : t("sharing.create.teamText")
      }
      size="sm"
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Input
          label={family ? t("sharing.create.familyName") : t("sharing.create.teamName")}
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          placeholder={family ? t("sharing.create.familyPlaceholder") : t("sharing.create.teamPlaceholder")}
          hint={t("sharing.create.nameHint")}
          autoFocus
        />
        {business && (
          <div
            className="flex flex-col gap-3 rounded-lg border border-border bg-surface-raised p-3"
            data-testid="create-org-business"
          >
            {intervals.length > 1 && (
              <SegmentedControl<BillingInterval>
                label={t("sharing.create.interval")}
                value={interval}
                onChange={setBillingInterval}
                options={intervals.map((value) => ({ value, label: t(`sharing.create.interval.${value}`) }))}
              />
            )}
            {plan && (
              <p className="flex items-center gap-2 text-[0.8125rem] font-semibold">
                <CreditCard className="size-4 shrink-0 text-accent" aria-hidden="true" />
                {planPrice(plan, t, i18n.locale)}
              </p>
            )}
            <p className="text-xs text-text-muted">{t("sharing.create.businessNext")}</p>
          </div>
        )}
        {family && (
          <ul className="flex list-disc flex-col gap-1 pl-5 text-[0.8125rem] text-text-muted">
            <li>{t("sharing.create.familyPoint1")}</li>
            <li>{t("sharing.create.familyPoint2")}</li>
            <li>{t("sharing.create.familyPoint3")}</li>
          </ul>
        )}
        <p
          className="flex gap-2 rounded-lg border border-border bg-surface-sunken p-3 text-[0.8125rem]"
          data-testid="create-org-recovery"
        >
          <LifeBuoy className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
          <span>{family ? t("sharing.create.recoveryFamily") : t("sharing.create.recoveryTeam")}</span>
        </p>
        <FormError message={error} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t("action.cancel")}
          </Button>
          <Button type="submit" loading={busy} disabled={!name.trim()}>
            {family
              ? t("sharing.create.familyAction")
              : business
                ? t("sharing.create.businessAction")
                : t("sharing.create.teamAction")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
