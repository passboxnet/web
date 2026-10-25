import type { Invite, InviteCreated, RegistrationMode } from "@passbox/api-client";
import { Badge, Button, ConfirmDialog, Input, Monogram, toast } from "@passbox/ui";
import { Copy, Send, X } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { FormError } from "../../auth/AuthLayout";
import { errorMessage } from "../../core";
import { copyToClipboard } from "../../lib/clipboard";
import { useI18n } from "../../lib/i18n";
import { serverUrl } from "../../lib/server";
import { useClient } from "../../useClient";
import { ConsolePanel } from "./console";

const STATUS_TONE = { pending: "accent", used: "success", expired: "neutral" } as const;

/** Invitations to create an account, needed when registration is not open. */
export function InvitesPanel({ registration, onChange }: { registration: RegistrationMode; onChange: () => void }) {
  const client = useClient();
  const i18n = useI18n();
  const { t } = i18n;
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [created, setCreated] = useState<InviteCreated>();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [revoking, setRevoking] = useState<Invite>();

  const load = useCallback(() => {
    client.admin
      .adminInvites()
      .then(setInvites)
      .catch((e: unknown) => setError(errorMessage(e)));
  }, [client]);

  useEffect(load, [load]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(undefined);
    setBusy(true);
    try {
      const invite = await client.admin.createInvite({
        email,
        locale: i18n.locale,
        linkBase: serverUrl() ?? window.location.origin,
      });
      setCreated(invite);
      setEmail("");
      toast.success(
        invite.mailConfigured ? t("admin.invites.sent", { email: invite.email }) : t("admin.invites.created"),
      );
      load();
      onChange();
    } catch (e) {
      setError(errorMessage(e, "signUp"));
    } finally {
      setBusy(false);
    }
  }

  async function revoke(invite: Invite) {
    try {
      await client.admin.revokeInvite(invite.id);
      toast.success(t("admin.invites.revoked", { email: invite.email }));
      if (created?.id === invite.id) setCreated(undefined);
      load();
      onChange();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  return (
    <ConsolePanel
      id="invites"
      icon={<Send />}
      title={t("admin.invites.title")}
      description={registration === "open" ? t("admin.invites.descriptionOpen") : t("admin.invites.description")}
    >
      <form onSubmit={submit} className="flex flex-wrap items-end gap-3 px-5 py-4">
        <div className="min-w-56 flex-1">
          <Input
            label={t("admin.invites.email")}
            type="email"
            value={email}
            required
            placeholder={t("field.emailPlaceholder")}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <Button type="submit" loading={busy}>
          <Send />
          {t("admin.invites.invite")}
        </Button>
        <div className="basis-full">
          <FormError message={error} />
        </div>
      </form>
      {created?.link && (
        <div className="flex flex-col gap-2 bg-accent-soft/60 px-5 py-4 text-[0.8125rem]">
          <p>
            {created.mailConfigured
              ? t("admin.invites.linkSent", { email: created.email })
              : t("admin.invites.linkManual", { email: created.email })}
          </p>
          <div className="flex items-center gap-2">
            <code
              className="min-w-0 flex-1 truncate rounded-lg border border-hairline bg-surface px-2.5 py-1.5 font-mono text-xs"
              data-testid="invite-link"
            >
              {created.link}
            </code>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void copyToClipboard(created.link ?? "", t("admin.invites.link"))}
            >
              <Copy />
              {t("action.copy")}
            </Button>
          </div>
        </div>
      )}
      {invites.length > 0 && (
        <ul className="divide-y divide-hairline">
          {invites.map((invite) => (
            <li key={invite.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <Monogram name={invite.email} size="md" />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-[0.8125rem] font-medium break-all">
                  {invite.email}
                  <Badge tone={STATUS_TONE[invite.status]}>{t(`admin.invites.status.${invite.status}`)}</Badge>
                </p>
                <p className="text-xs text-text-muted">
                  {t("admin.invites.meta", {
                    by: invite.invitedBy,
                    time: i18n.relativeTime(invite.createdAt),
                    expires: i18n.dateTime(invite.expiresAt),
                  })}
                </p>
              </div>
              {invite.status === "pending" && (
                <Button size="sm" variant="ghost" onClick={() => setRevoking(invite)}>
                  <X />
                  {t("admin.invites.revoke")}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={revoking !== undefined}
        onOpenChange={(open) => !open && setRevoking(undefined)}
        title={t("admin.invites.revokeTitle", { email: revoking?.email ?? "" })}
        description={t("admin.invites.revokeText")}
        confirmLabel={t("admin.invites.revoke")}
        tone="danger"
        onConfirm={() => revoking && void revoke(revoking)}
      />
    </ConsolePanel>
  );
}
