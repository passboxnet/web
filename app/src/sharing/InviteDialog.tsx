import type { CloudBilling } from "@passbox/api-client";
import type { Invitation, Org } from "@passbox/client";
import { Button, Dialog, Input } from "@passbox/ui";
import { Check, Copy, CreditCard, Info, LockKeyhole, Send, Users } from "lucide-react";
import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { FormError } from "../auth/AuthLayout";
import { cloudBilling, familyMemberCount, formatPrice, isActiveStatus, isBusinessOrg, planFor } from "../lib/billing";
import { copyToClipboard } from "../lib/clipboard";
import { useI18n } from "../lib/i18n";
import { useIsInstanceAdmin, useServerMeta } from "../lib/instance";
import { formatRoute } from "../lib/route";
import { serverUrl } from "../lib/server";
import { type AssignableOrgRole, assignableRoles } from "../lib/sharing";
import { useClient } from "../useClient";
import { orgName, sharingError } from "./common";
import { OrgRoleChoice } from "./RoleChoice";

/** Whether the server sends mail; only instance admins can ask. `undefined` when unknown. */
function useMailConfigured(): boolean | undefined {
  const client = useClient();
  const isAdmin = useIsInstanceAdmin(client);
  const [configured, setConfigured] = useState<boolean>();
  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    client.admin
      .adminSettings()
      .then((settings) => !cancelled && setConfigured(settings.mail.configured))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [client, isAdmin]);
  return configured;
}

/** The subscription of a Business organization on the hosted service; `undefined` elsewhere or while loading. */
function useBusinessBilling(org: Org, enabled: boolean): CloudBilling | undefined {
  const client = useClient();
  const [billing, setBilling] = useState<CloudBilling>();
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    client
      .cloudBilling(org.id)
      .then((next) => !cancelled && setBilling(next))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [client, org.id, enabled]);
  return enabled ? billing : undefined;
}

function Hint({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-border bg-surface-raised px-3 py-2.5 text-[0.8125rem]">
      <span className="mt-0.5 shrink-0 text-accent [&>svg]:size-4" aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

interface InviteDialogProps {
  org: Org;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInvited: () => void;
}

export function InviteDialog({ org, open, onOpenChange, onInvited }: InviteDialogProps) {
  const client = useClient();
  const i18n = useI18n();
  const { t } = i18n;
  const mailConfigured = useMailConfigured();
  const meta = useServerMeta();
  const cloud = cloudBilling(meta);
  const business = isBusinessOrg(org, cloud);
  const billing = useBusinessBilling(org, open && business);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AssignableOrgRole>("member");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [created, setCreated] = useState<{ invitation: Invitation; email: string }>();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEmail("");
    setRole("member");
    setError(undefined);
    setCreated(undefined);
    setCopied(false);
  }, [open]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const address = email.trim();
    if (!address) return;
    if (org.members.some((m) => m.email?.toLowerCase() === address.toLowerCase())) {
      setError(t("sharing.error.alreadyMember"));
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const invitation = await client.invite(org.id, address, role, serverUrl() ?? window.location.origin);
      setCreated({ invitation, email: address });
      onInvited();
    } catch (e) {
      setError(sharingError(e, t));
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!created) return;
    await copyToClipboard(created.invitation.link, t("sharing.invite.link"));
    setCopied(true);
  }

  const name = orgName(org, t);

  // What adding someone means here: the hosted service bills Business
  // members (not guests), and families have a member limit.
  const guest = role === "guest";
  const locked = !!org.lock;
  const needsActivation = business && billing !== undefined && !isActiveStatus(billing.status);
  const interval = billing?.interval ?? "month";
  const plan = planFor(cloud, interval);
  const familyLimit = org.kind === "family" ? meta?.familyMemberLimit : undefined;
  const familyCount = familyMemberCount(org);
  const familyFull = familyLimit !== undefined && familyCount >= familyLimit;
  const blocked = locked || (!guest && (needsActivation || familyFull));
  const hint = locked ? (
    <Hint icon={<LockKeyhole />}>{t("errors.orgReadOnly")}</Hint>
  ) : needsActivation && !guest ? (
    <Hint icon={<Info />}>
      <p>{t("sharing.invite.activateFirst")}</p>
      <Button
        className="mt-2"
        size="sm"
        onClick={() => {
          onOpenChange(false);
          window.location.hash = formatRoute({ view: "org-admin", orgId: org.id, section: "billing" });
        }}
      >
        {t("sharing.invite.activateAction")}
      </Button>
    </Hint>
  ) : business && !guest && plan ? (
    <Hint icon={<CreditCard />}>
      {t(`sharing.invite.businessCost.${interval}`, {
        price: formatPrice(plan.amountCents, plan.currency, i18n.locale),
      })}
    </Hint>
  ) : familyLimit !== undefined ? (
    <Hint icon={<Users />}>
      <p data-testid="family-member-count">
        {t("sharing.invite.familyCount", { count: familyCount, limit: familyLimit })}
      </p>
      {familyFull && !guest && (
        <p className="mt-1 text-text-muted">{t("sharing.invite.familyFull", { limit: familyLimit })}</p>
      )}
    </Hint>
  ) : undefined;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={created ? t("sharing.invite.doneTitle") : t("sharing.invite.title", { name })}
      description={
        created
          ? mailConfigured === true
            ? t("sharing.invite.mailSent", { email: created.email })
            : mailConfigured === false
              ? t("sharing.invite.mailOff", { email: created.email })
              : t("sharing.invite.mailMaybe", { email: created.email })
          : org.kind === "family"
            ? t("sharing.invite.familyText")
            : t("sharing.invite.teamText")
      }
    >
      {created ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-[0.8125rem] font-medium">{t("sharing.invite.link")}</span>
            <div className="flex items-center gap-2">
              <code
                className="min-w-0 flex-1 truncate rounded-md border border-border bg-surface-raised px-2.5 py-2 font-mono text-xs"
                data-testid="org-invite-link"
                title={created.invitation.link}
              >
                {created.invitation.link}
              </code>
              <Button onClick={() => void copy()}>
                {copied ? <Check /> : <Copy />}
                {copied ? t("sharing.invite.copied") : t("sharing.invite.copy")}
              </Button>
            </div>
            <p className="text-xs text-text-muted">
              {t("sharing.invite.linkHint", {
                email: created.email,
                date: i18n.date(created.invitation.expiresAt),
              })}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-surface-raised px-4 py-3 text-[0.8125rem]">
            <p className="font-medium">{t("sharing.invite.nextTitle")}</p>
            <ol className="mt-1.5 list-decimal pl-5 text-text-muted">
              <li>{t("sharing.invite.next1", { email: created.email })}</li>
              <li>{t("sharing.invite.next2", { email: created.email })}</li>
              <li>
                {org.kind === "family"
                  ? t("sharing.invite.next3Family", { email: created.email })
                  : t("sharing.invite.next3Team", { email: created.email })}
              </li>
            </ol>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setCreated(undefined);
                setEmail("");
                setCopied(false);
              }}
            >
              {t("sharing.invite.another")}
            </Button>
            <Button onClick={() => onOpenChange(false)}>{t("action.done")}</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Input
            label={t("field.email")}
            type="email"
            value={email}
            required
            autoFocus
            placeholder={t("field.emailPlaceholder")}
            onChange={(e) => setEmail(e.target.value)}
          />
          <OrgRoleChoice org={org} roles={assignableRoles(org)} value={role} onChange={setRole} />
          {hint}
          <FormError message={error} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              {t("action.cancel")}
            </Button>
            <Button type="submit" loading={busy} disabled={!email.trim() || blocked}>
              <Send />
              {t("sharing.invite.action")}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
