import type { KeyLookup, Org, OrgMember } from "@passbox/client";
import { Button, Dialog, Spinner, toast } from "@passbox/ui";
import { AlertTriangle, Phone, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { FormError } from "../auth/AuthLayout";
import { useI18n } from "../lib/i18n";
import { memberLabel } from "../lib/sharing";
import { useClient } from "../useClient";
import { SecurityCode, sharingError } from "./common";

interface ConfirmMemberDialogProps {
  org: Org;
  member: OrgMember | undefined;
  onOpenChange: (open: boolean) => void;
}

/**
 * Confirms a member who accepted: Passbox looks their key up in the key
 * directory first. Comparing the two security codes out of band is optional
 * but shown side by side, because it is what removes the trust in the server.
 */
export function ConfirmMemberDialog({ org, member, onOpenChange }: ConfirmMemberDialogProps) {
  const client = useClient();
  const { t } = useI18n();
  const [lookup, setLookup] = useState<KeyLookup>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const own = safe(() => client.ownFingerprint());
  const name = memberLabel(member, t("sharing.member"));

  const accountId = member?.accountId;
  useEffect(() => {
    setLookup(undefined);
    setError(undefined);
    if (!accountId) return;
    let cancelled = false;
    client
      .lookupKey(accountId)
      .then((result) => !cancelled && setLookup(result))
      .catch((e: unknown) => !cancelled && setError(sharingError(e, t)));
    return () => {
      cancelled = true;
    };
  }, [client, accountId, t]);

  function acceptChange() {
    if (!member) return;
    try {
      const fingerprint = client.acceptKeyChange(member.accountId);
      setLookup((current) => current && { ...current, status: "unchanged", fingerprint });
    } catch (e) {
      setError(sharingError(e, t));
    }
  }

  async function confirm() {
    if (!member) return;
    setBusy(true);
    setError(undefined);
    try {
      await client.confirmMember(org.id, member.accountId);
      toast.success(
        org.kind === "family" && org.defaultVaultId
          ? t("sharing.confirm.doneFamily", { name })
          : t("sharing.confirm.done", { name }),
      );
      onOpenChange(false);
    } catch (e) {
      setError(sharingError(e, t));
    } finally {
      setBusy(false);
    }
  }

  const changed = lookup?.status === "changed";

  return (
    <Dialog
      open={member !== undefined}
      onOpenChange={onOpenChange}
      title={t("sharing.confirm.title", { name })}
      description={t("sharing.confirm.text", { name })}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t("action.cancel")}
          </Button>
          <Button onClick={() => void confirm()} loading={busy} disabled={!lookup || changed}>
            <ShieldCheck />
            {t("sharing.confirm.action")}
          </Button>
        </>
      }
    >
      {!lookup && !error ? (
        <div className="flex items-center gap-2 py-6 text-[0.8125rem] text-text-muted">
          <Spinner />
          {t("sharing.confirm.looking")}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {lookup && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <p className="text-[0.8125rem] font-medium break-all">{t("sharing.confirm.theirCode", { name })}</p>
                <SecurityCode value={lookup.fingerprint} label={t("sharing.confirm.theirCode", { name })} />
              </div>
              {own && (
                <div className="flex flex-col gap-1.5">
                  <p className="text-[0.8125rem] font-medium">{t("sharing.securityCode.yours")}</p>
                  <SecurityCode value={own} label={t("sharing.securityCode.yours")} />
                </div>
              )}
            </div>
          )}
          {changed && lookup?.previousFingerprint && (
            <div
              role="alert"
              className="flex flex-col gap-2 rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-[0.8125rem]"
            >
              <p className="flex items-start gap-2 font-medium">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
                {t("sharing.confirm.changed", { name })}
              </p>
              <Button size="sm" variant="secondary" className="self-start" onClick={acceptChange}>
                {t("sharing.keyChange.accept")}
              </Button>
            </div>
          )}
          <div className="flex gap-3 rounded-lg border border-border bg-surface-raised px-4 py-3 text-[0.8125rem]">
            <Phone className="mt-0.5 size-4 shrink-0 text-text-muted" aria-hidden="true" />
            <div>
              <p className="font-medium">{t("sharing.confirm.compareTitle")}</p>
              <p className="mt-0.5 text-text-muted">{t("sharing.confirm.compareText", { name })}</p>
            </div>
          </div>
          {org.kind === "family" && org.defaultVaultId && (
            <p className="text-[0.8125rem] text-text-muted">{t("sharing.confirm.familyVault", { name })}</p>
          )}
          <FormError message={error} />
        </div>
      )}
    </Dialog>
  );
}

function safe<T>(fn: () => T): T | undefined {
  try {
    return fn();
  } catch {
    return undefined;
  }
}
