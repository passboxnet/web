import type { EmergencyContact } from "@passbox/client";
import type { Translate } from "@passbox/i18n";
import { Badge, Button, ConfirmDialog, Dialog, Input, Spinner, toast } from "@passbox/ui";
import { Clock, HeartHandshake, LifeBuoy, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { FormError } from "../../auth/AuthLayout";
import { errorMessage } from "../../core";
import { useI18n } from "../../lib/i18n";
import { vaultName } from "../../shell/Sidebar";
import { useClient, useSnapshot } from "../../useClient";
import { Panel } from "../PageHeader";

const DAY_MS = 24 * 60 * 60 * 1000;
export const WAIT_CHOICES = [1, 2, 3, 7, 14, 30];
export const DEFAULT_WAIT_DAYS = 7;

/** Whole days (rounded up) until `at`, at least 0. */
export function daysUntil(at: number, now = Date.now()): number {
  return Math.max(0, Math.ceil((at - now) / DAY_MS));
}

/**
 * Settings → Emergency access: trusted people who can read chosen
 * vaults after a waiting period, and people who trust this account.
 */
export function EmergencyPanel() {
  const client = useClient();
  const { t } = useI18n();
  const [contacts, setContacts] = useState<{ granted: EmergencyContact[]; received: EmergencyContact[] }>();
  const [error, setError] = useState<string>();
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => {
    client
      .emergencyContacts()
      .then((next) => {
        setContacts(next);
        setError(undefined);
      })
      .catch((e: unknown) => setError(errorMessage(e)));
  }, [client]);
  useEffect(load, [load]);

  return (
    <Panel
      id="emergency"
      icon={<HeartHandshake />}
      title={t("emergency.title")}
      description={t("emergency.description")}
    >
      {error ? (
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-[0.8125rem] text-danger">
          {error}
          <Button size="sm" variant="secondary" onClick={load}>
            {t("action.retry")}
          </Button>
        </div>
      ) : !contacts ? (
        <div className="flex justify-center px-5 py-6 text-text-muted">
          <Spinner label={t("app.loading")} />
        </div>
      ) : (
        <>
          <div className="px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
              <div className="min-w-0 max-w-md">
                <p className="text-[0.8125rem] font-medium">{t("emergency.myContacts")}</p>
                <p className="mt-0.5 text-xs text-text-muted">{t("emergency.myContactsHint")}</p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
                <UserPlus />
                {t("emergency.add")}
              </Button>
            </div>
            {contacts.granted.length > 0 ? (
              <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
                {contacts.granted.map((contact) => (
                  <GrantedRow key={contact.id} contact={contact} onChange={load} />
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-xs text-text-muted">{t("emergency.none")}</p>
            )}
          </div>
          {contacts.received.length > 0 && (
            <div className="px-5 py-4">
              <p className="text-[0.8125rem] font-medium">{t("emergency.trustMe")}</p>
              <p className="mt-0.5 text-xs text-text-muted">{t("emergency.trustMeHint")}</p>
              <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
                {contacts.received.map((contact) => (
                  <ReceivedRow key={contact.id} contact={contact} onChange={load} />
                ))}
              </ul>
            </div>
          )}
          <p className="flex gap-2 px-5 py-3 text-xs text-text-muted">
            <LifeBuoy className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            {t("emergency.footnote")}
          </p>
        </>
      )}
      <AddContactDialog
        open={adding}
        onOpenChange={setAdding}
        onAdded={() => {
          setAdding(false);
          load();
        }}
      />
    </Panel>
  );
}

function statusBadge(contact: EmergencyContact, t: Translate) {
  if (contact.status === "invited") return <Badge>{t("emergency.status.invited")}</Badge>;
  if (contact.status === "accepted") return <Badge tone="warning">{t("emergency.status.accepted")}</Badge>;
  if (contact.released) return <Badge tone="danger">{t("emergency.status.released")}</Badge>;
  if (contact.requestedAt > 0) return <Badge tone="warning">{t("emergency.status.requested")}</Badge>;
  return <Badge tone="success">{t("emergency.status.active")}</Badge>;
}

function GrantedRow({ contact, onChange }: { contact: EmergencyContact; onChange: () => void }) {
  const client = useClient();
  const i18n = useI18n();
  const { t } = i18n;
  const [dialog, setDialog] = useState<"confirm" | "remove" | "approve" | "deny">();
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    try {
      await action();
      toast.success(success);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
      setDialog(undefined);
      onChange();
    }
  }

  const requested = contact.requestedAt > 0;
  return (
    <li className="flex flex-col gap-2 px-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[0.8125rem] font-medium break-all">{contact.granteeEmail}</p>
          <p className="text-xs text-text-muted">
            {t("emergency.grantedMeta", { days: contact.waitDays, vaults: contact.vaultIds.length })}
          </p>
        </div>
        <span className="flex flex-wrap items-center gap-2">
          {statusBadge(contact, t)}
          {contact.status === "accepted" && (
            <Button size="sm" onClick={() => setDialog("confirm")} loading={busy}>
              <ShieldCheck />
              {t("emergency.confirm")}
            </Button>
          )}
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={t("emergency.remove")}
            title={t("emergency.remove")}
            onClick={() => setDialog("remove")}
          >
            <Trash2 />
          </Button>
        </span>
      </div>
      {contact.status === "invited" && <p className="text-xs text-text-muted">{t("emergency.invitedHint")}</p>}
      {requested && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-warning-soft px-3 py-2 text-[0.8125rem]"
        >
          <span className="flex items-start gap-2">
            <Clock className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
            {contact.released
              ? t("emergency.releasedGrantor", { date: i18n.dateTime(contact.releaseAt) })
              : t("emergency.requestedGrantor", {
                  date: i18n.dateTime(contact.releaseAt),
                  days: daysUntil(contact.releaseAt),
                })}
          </span>
          <span className="flex gap-2">
            {!contact.released && (
              <Button size="sm" variant="secondary" onClick={() => setDialog("approve")}>
                {t("emergency.approveNow")}
              </Button>
            )}
            <Button size="sm" variant="danger" onClick={() => setDialog("deny")}>
              {contact.released ? t("emergency.endAccess") : t("emergency.deny")}
            </Button>
          </span>
        </div>
      )}
      <ConfirmVaultsDialog
        open={dialog === "confirm"}
        contact={contact}
        onOpenChange={(open) => !open && setDialog(undefined)}
        onDone={() => {
          setDialog(undefined);
          onChange();
        }}
      />
      <ConfirmDialog
        open={dialog === "remove"}
        onOpenChange={(open) => !open && setDialog(undefined)}
        title={t("emergency.removeTitle")}
        description={t("emergency.removeBody", { email: contact.granteeEmail })}
        confirmLabel={t("emergency.remove")}
        tone="danger"
        onConfirm={() => void run(() => client.removeEmergencyContact(contact.id), t("emergency.removed"))}
      />
      <ConfirmDialog
        open={dialog === "approve"}
        onOpenChange={(open) => !open && setDialog(undefined)}
        title={t("emergency.approveTitle")}
        description={t("emergency.approveBody", { email: contact.granteeEmail })}
        confirmLabel={t("emergency.approveNow")}
        onConfirm={() => void run(() => client.approveEmergencyAccess(contact.id), t("emergency.approved"))}
      />
      <ConfirmDialog
        open={dialog === "deny"}
        onOpenChange={(open) => !open && setDialog(undefined)}
        title={contact.released ? t("emergency.endTitle") : t("emergency.denyTitle")}
        description={contact.released ? t("emergency.endBody") : t("emergency.denyBody")}
        confirmLabel={contact.released ? t("emergency.endAccess") : t("emergency.deny")}
        tone="danger"
        onConfirm={() => void run(() => client.denyEmergencyAccess(contact.id), t("emergency.denied"))}
      />
    </li>
  );
}

function ReceivedRow({ contact, onChange }: { contact: EmergencyContact; onChange: () => void }) {
  const client = useClient();
  const i18n = useI18n();
  const { t } = i18n;
  const [dialog, setDialog] = useState<"request" | "leave">();
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    try {
      await action();
      toast.success(success);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
      setDialog(undefined);
      onChange();
    }
  }

  return (
    <li className="flex flex-col gap-2 px-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[0.8125rem] font-medium break-all">{contact.grantorEmail}</p>
          <p className="text-xs text-text-muted">{t("emergency.receivedMeta", { days: contact.waitDays })}</p>
        </div>
        <span className="flex flex-wrap items-center gap-2">
          {contact.status === "invited" && (
            <>
              <Button size="sm" variant="ghost" onClick={() => setDialog("leave")}>
                {t("emergency.decline")}
              </Button>
              <Button
                size="sm"
                loading={busy}
                onClick={() => void run(() => client.acceptEmergencyInvitation(contact.id), t("emergency.accepted"))}
              >
                {t("emergency.accept")}
              </Button>
            </>
          )}
          {contact.status === "accepted" && <Badge>{t("emergency.status.waitingForGrantor")}</Badge>}
          {contact.status === "confirmed" && contact.requestedAt === 0 && (
            <Button size="sm" variant="secondary" onClick={() => setDialog("request")}>
              <HeartHandshake />
              {t("emergency.request")}
            </Button>
          )}
          {contact.status === "confirmed" && contact.released && (
            <a
              href={`#/emergency/${encodeURIComponent(contact.id)}`}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-accent px-3 text-[0.8125rem] font-medium text-accent-contrast shadow-lip hover:bg-accent-hover coarse:h-11"
            >
              {t("emergency.open")}
            </a>
          )}
        </span>
      </div>
      {contact.status === "confirmed" && contact.requestedAt > 0 && !contact.released && (
        <div role="status" className="flex items-start gap-2 rounded-lg bg-accent-soft px-3 py-2 text-[0.8125rem]">
          <Clock className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
          {t("emergency.countdown", { days: daysUntil(contact.releaseAt), date: i18n.dateTime(contact.releaseAt) })}
        </div>
      )}
      {contact.deniedAt > 0 && contact.requestedAt === 0 && (
        <p className="text-xs text-text-muted">{t("emergency.wasDenied", { date: i18n.date(contact.deniedAt) })}</p>
      )}
      <ConfirmDialog
        open={dialog === "request"}
        onOpenChange={(open) => !open && setDialog(undefined)}
        title={t("emergency.requestTitle")}
        description={t("emergency.requestBody", { email: contact.grantorEmail, days: contact.waitDays })}
        confirmLabel={t("emergency.request")}
        onConfirm={() => void run(() => client.requestEmergencyAccess(contact.id), t("emergency.requested"))}
      />
      <ConfirmDialog
        open={dialog === "leave"}
        onOpenChange={(open) => !open && setDialog(undefined)}
        title={t("emergency.declineTitle")}
        description={t("emergency.declineBody", { email: contact.grantorEmail })}
        confirmLabel={t("emergency.decline")}
        tone="danger"
        onConfirm={() => void run(() => client.removeEmergencyContact(contact.id), t("emergency.declined"))}
      />
    </li>
  );
}

function AddContactDialog({
  open,
  onOpenChange,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: () => void;
}) {
  const client = useClient();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [days, setDays] = useState(DEFAULT_WAIT_DAYS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await client.addEmergencyContact(email, days);
      toast.success(t("emergency.added", { email }), { description: t("emergency.addedHint") });
      setEmail("");
      setDays(DEFAULT_WAIT_DAYS);
      onAdded();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("emergency.addTitle")}
      description={t("emergency.addDescription")}
      size="md"
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Input
          label={t("emergency.emailLabel")}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
          hint={t("emergency.emailHint")}
        />
        <label className="flex flex-col gap-1.5 text-[0.8125rem] font-medium">
          {t("emergency.waitLabel")}
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="h-9 rounded-lg border border-border-strong bg-surface px-2.5 text-sm shadow-xs coarse:h-11"
          >
            {WAIT_CHOICES.map((choice) => (
              <option key={choice} value={choice}>
                {t("emergency.waitDays", { days: choice })}
              </option>
            ))}
          </select>
          <span className="text-xs font-normal text-text-muted">{t("emergency.waitHint")}</span>
        </label>
        <div className="rounded-lg border border-border bg-surface-sunken p-3 text-[0.8125rem] text-text-muted">
          <p className="font-medium text-text">{t("emergency.scopeTitle")}</p>
          <p className="mt-0.5">{t("emergency.scopeBody")}</p>
        </div>
        <FormError message={error} />
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t("action.cancel")}
          </Button>
          <Button type="submit" loading={busy}>
            {t("emergency.addSubmit")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/** After the contact accepted: choose the vaults, check the fingerprint and seal. */
function ConfirmVaultsDialog({
  open,
  contact,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  contact: EmergencyContact;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const client = useClient();
  const { t } = useI18n();
  const { vaults } = useSnapshot();
  const personal = vaults.filter((v) => !v.orgId);
  const [chosen, setChosen] = useState<string[]>(() => personal.map((v) => v.id));
  const [fingerprint, setFingerprint] = useState<string>();
  const [changed, setChanged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!open || !contact.granteeId) return;
    setError(undefined);
    client
      .lookupKey(contact.granteeId)
      .then((lookup) => {
        setFingerprint(lookup.fingerprint);
        setChanged(lookup.status === "changed");
      })
      .catch((e: unknown) => setError(errorMessage(e)));
  }, [open, client, contact.granteeId]);

  async function submit() {
    if (chosen.length === 0) {
      setError(t("emergency.chooseOne"));
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      if (changed && contact.granteeId) client.acceptKeyChange(contact.granteeId);
      await client.confirmEmergencyContact(contact.id, chosen);
      toast.success(t("emergency.confirmed", { email: contact.granteeEmail }));
      onDone();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("emergency.confirmTitle", { email: contact.granteeEmail })}
      description={t("emergency.confirmDescription", { days: contact.waitDays })}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t("action.cancel")}
          </Button>
          <Button onClick={() => void submit()} loading={busy} disabled={!fingerprint}>
            {t("emergency.confirmSubmit")}
          </Button>
        </>
      }
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-[0.8125rem] font-medium">{t("emergency.vaultsLabel")}</legend>
        {personal.map((vault) => (
          <label key={vault.id} className="flex items-center gap-2 text-sm coarse:min-h-11">
            <input
              type="checkbox"
              className="size-4 accent-control"
              checked={chosen.includes(vault.id)}
              onChange={(e) =>
                setChosen((current) =>
                  e.target.checked ? [...current, vault.id] : current.filter((id) => id !== vault.id),
                )
              }
            />
            {vaultName(vault.name, t)}
          </label>
        ))}
        <p className="text-xs text-text-muted">{t("emergency.vaultsHint")}</p>
      </fieldset>
      <div className="mt-4 rounded-lg border border-border bg-surface-sunken p-3">
        <p className="text-[0.8125rem] font-medium">{t("emergency.fingerprintTitle")}</p>
        {fingerprint ? (
          <p className="mt-1 font-mono text-xs leading-relaxed break-words" data-testid="grantee-fingerprint">
            {fingerprint}
          </p>
        ) : (
          !error && <Spinner label={t("app.loading")} />
        )}
        <p className="mt-1 text-xs text-text-muted">{t("emergency.fingerprintHint")}</p>
        {changed && <p className="mt-2 text-xs font-medium text-danger">{t("emergency.keyChanged")}</p>}
      </div>
      <FormError message={error} />
    </Dialog>
  );
}
