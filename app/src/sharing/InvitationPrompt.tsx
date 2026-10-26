import type { InvitationPreview } from "@passbox/api-client";
import { Button, Dialog, Spinner, toast } from "@passbox/ui";
import { AlertTriangle, Check, Eye, LifeBuoy } from "lucide-react";
import { useEffect, useState } from "react";
import { FormError } from "../auth/AuthLayout";
import { useI18n } from "../lib/i18n";
import type { Route } from "../lib/route";
import { orgRoleKey, setPendingOrgInvite, useOrgInvite } from "../lib/sharing";
import { useClient, useSnapshot } from "../useClient";
import { sharingError } from "./common";

/**
 * After an invitation link was opened (and the person signed in or created
 * an account), shows who invites them to what and lets them accept.
 */
export function InvitationPrompt({ navigate }: { navigate: (route: Route) => void }) {
  const client = useClient();
  const { t } = useI18n();
  const { email = "" } = useSnapshot();
  const invite = useOrgInvite();
  const [preview, setPreview] = useState<InvitationPreview>();
  const [loadError, setLoadError] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const link = invite?.link;

  useEffect(() => {
    setPreview(undefined);
    setLoadError(undefined);
    setError(undefined);
    if (!link) return;
    let cancelled = false;
    client
      .previewInvitation(link)
      .then((value) => !cancelled && setPreview(value))
      .catch((e: unknown) => !cancelled && setLoadError(sharingError(e, t)));
    return () => {
      cancelled = true;
    };
  }, [client, link, t]);

  if (!invite) return null;
  const dismiss = () => setPendingOrgInvite(undefined);
  const wrongAccount = preview !== undefined && preview.email.toLowerCase() !== email.toLowerCase();
  const family = preview?.orgKind !== "team";
  const inviter = preview?.inviterEmail;

  async function accept() {
    if (!invite) return;
    setBusy(true);
    setError(undefined);
    try {
      const orgId = await client.acceptInvitation(invite.link);
      // Organizations that require recovery: the recovery share is sealed
      // as soon as an admin confirmed the membership (now or at a later
      // unlock); the person agreed to it above.
      client.enrollRequiredOrgRecovery().catch((e: unknown) => console.warn("Could not enroll in recovery yet", e));
      setPendingOrgInvite(undefined);
      toast.success(t("sharing.accept.done"));
      navigate({ view: "org", orgId });
    } catch (e) {
      setError(sharingError(e, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && !busy && dismiss()}
      title={
        preview
          ? inviter
            ? family
              ? t("sharing.accept.titleFamily", { name: inviter })
              : t("sharing.accept.titleTeam", { name: inviter })
            : family
              ? t("sharing.accept.titleFamilyAnon")
              : t("sharing.accept.titleTeamAnon")
          : t("sharing.accept.loading")
      }
    >
      {loadError ? (
        <div className="flex flex-col gap-4">
          <p className="flex gap-2 text-[0.8125rem]">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
            {t("sharing.accept.invalid")}
          </p>
          <div className="flex justify-end">
            <Button onClick={dismiss}>{t("action.close")}</Button>
          </div>
        </div>
      ) : !preview ? (
        <div className="flex justify-center py-6 text-text-muted">
          <Spinner label={t("sharing.accept.loading")} />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-[0.8125rem] text-text-muted">
            {t("sharing.accept.role", { role: t(orgRoleKey({ kind: preview.orgKind }, preview.role)) })}
          </p>
          {wrongAccount ? (
            <div
              role="alert"
              className="flex gap-3 rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-[0.8125rem]"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
              <p>{t("sharing.accept.wrongAccount", { invited: preview.email, current: email })}</p>
            </div>
          ) : (
            <ol className="flex flex-col gap-2 text-[0.8125rem]">
              {[
                t("sharing.accept.step1"),
                t("sharing.accept.step2", { name: inviter ?? t("sharing.accept.someone") }),
                family ? t("sharing.accept.step3Family") : t("sharing.accept.step3Team"),
              ].map((step, index) => (
                <li key={step} className="flex gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
                    {index + 1}
                  </span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          )}
          {!wrongAccount && preview.role === "guest" && (
            <div
              className="flex gap-3 rounded-lg border border-border bg-surface-sunken px-4 py-3 text-[0.8125rem]"
              data-testid="invite-guest-note"
            >
              <Eye className="mt-0.5 size-4 shrink-0 text-text-muted" aria-hidden="true" />
              <p>{t("sharing.accept.guest")}</p>
            </div>
          )}
          {!wrongAccount && preview.recovery && (
            <div
              className="flex gap-3 rounded-lg border border-info/30 bg-accent-soft px-4 py-3 text-[0.8125rem]"
              data-testid="invite-recovery-note"
            >
              <LifeBuoy className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
              <div>
                <p className="font-semibold">
                  {family ? t("sharing.accept.recoveryTitleFamily") : t("sharing.accept.recoveryTitleTeam")}
                </p>
                <p className="mt-1">{t("sharing.accept.recoveryBody")}</p>
              </div>
            </div>
          )}
          <p className="text-xs text-text-muted">{t("sharing.accept.privacy")}</p>
          <FormError message={error} />
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={dismiss} disabled={busy}>
              {wrongAccount ? t("action.close") : t("sharing.accept.later")}
            </Button>
            {!wrongAccount && (
              <Button onClick={() => void accept()} loading={busy}>
                <Check />
                {t("sharing.accept.action")}
              </Button>
            )}
          </div>
        </div>
      )}
    </Dialog>
  );
}
