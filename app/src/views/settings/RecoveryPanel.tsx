import type { RecoveryStatus } from "@passbox/api-client";
import { DEFAULT_POLICY_RULES, InvalidDeviceCodeError, type Org, type OrgRecoveryInfo } from "@passbox/client";
import { Badge, Button, ConfirmDialog, Dialog, Spinner, Switch, toast } from "@passbox/ui";
import { Building2, KeyRound, ShieldCheck, Smartphone } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { useKit } from "../../auth/KitProvider";
import { errorMessage } from "../../core";
import { useI18n } from "../../lib/i18n";
import { serverUrl } from "../../lib/server";
import { useClient, useSnapshot } from "../../useClient";
import { Panel } from "../PageHeader";
import { localizedDeviceName } from "./DevicesPanel";
import { QrCode, ReauthCancelled, useReauthentication } from "./TwoFactorPanel";

const LINK_POLL_MS = 2_000;

function isAdmin(org: Org): boolean {
  return (org.role === "owner" || org.role === "admin") && org.status === "confirmed";
}

/**
 * Settings → Recovery: the account recovery code, recovery through each
 * organization (opt-in per member) and adding a device by code.
 */
export function RecoveryPanel() {
  const client = useClient();
  const kit = useKit();
  const i18n = useI18n();
  const { t } = i18n;
  const { orgs } = useSnapshot();
  const [status, setStatus] = useState<RecoveryStatus>();
  const [error, setError] = useState<string>();
  const [confirm, setConfirm] = useState<"replace" | "remove">();
  const [busy, setBusy] = useState(false);
  const [addDevice, setAddDevice] = useState(false);
  const reauth = useReauthentication();
  const confirmedOrgs = orgs.filter((o) => o.status === "confirmed" && o.verified);

  const load = useCallback(() => {
    setError(undefined);
    client
      .recoveryStatus()
      .then(setStatus)
      .catch((e: unknown) => setError(errorMessage(e)));
  }, [client]);
  useEffect(load, [load]);

  async function createCode() {
    setBusy(true);
    try {
      const code = await reauth.run(() => client.createRecoveryCode());
      kit.showRecoveryCode(code);
    } catch (e) {
      if (!(e instanceof ReauthCancelled)) toast.error(errorMessage(e));
    } finally {
      setBusy(false);
      load();
    }
  }

  async function removeCode() {
    setBusy(true);
    try {
      await reauth.run(() => client.removeRecoveryCode());
      toast.success(t("recoveryCode.removed"));
    } catch (e) {
      if (!(e instanceof ReauthCancelled)) toast.error(errorMessage(e));
    } finally {
      setBusy(false);
      load();
    }
  }

  const code = status?.recoveryCode;

  return (
    <Panel
      id="recovery"
      icon={<KeyRound />}
      title={t("recovery.panel.title")}
      description={t("recovery.panel.description")}
    >
      {error ? (
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-[0.8125rem] text-danger">
          {error}
          <Button size="sm" variant="secondary" onClick={load}>
            {t("action.retry")}
          </Button>
        </div>
      ) : !status ? (
        <div className="flex justify-center px-5 py-6 text-text-muted">
          <Spinner label={t("app.loading")} />
        </div>
      ) : (
        <Row
          icon={<KeyRound className="size-4 text-accent" aria-hidden="true" />}
          label={t("recoveryCode.title")}
          description={
            code ? t("recoveryCode.active", { date: i18n.date(code.createdAt) }) : t("recoveryCode.inactive")
          }
        >
          {code ? (
            <span className="flex flex-wrap items-center gap-2">
              <Badge tone="success">{t("recoveryCode.badgeActive")}</Badge>
              <Button size="sm" variant="ghost" onClick={() => setConfirm("remove")} disabled={busy}>
                {t("recoveryCode.remove")}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setConfirm("replace")} loading={busy}>
                {t("recoveryCode.replace")}
              </Button>
            </span>
          ) : (
            <Button size="sm" onClick={() => void createCode()} loading={busy}>
              <KeyRound />
              {t("recoveryCode.create")}
            </Button>
          )}
        </Row>
      )}
      {confirmedOrgs.map((org) => (
        <OrgRecoveryRow key={org.id} org={org} onChange={load} />
      ))}
      <Row
        icon={<Smartphone className="size-4 text-accent" aria-hidden="true" />}
        label={t("addDevice.title")}
        description={t("addDevice.description")}
      >
        <Button size="sm" variant="secondary" onClick={() => setAddDevice(true)}>
          {t("addDevice.show")}
        </Button>
      </Row>
      {reauth.dialog}
      <ConfirmDialog
        open={confirm === "replace"}
        onOpenChange={(open) => !open && setConfirm(undefined)}
        title={t("recoveryCode.replaceTitle")}
        description={t("recoveryCode.replaceBody")}
        confirmLabel={t("recoveryCode.replace")}
        onConfirm={() => {
          setConfirm(undefined);
          void createCode();
        }}
      />
      <ConfirmDialog
        open={confirm === "remove"}
        onOpenChange={(open) => !open && setConfirm(undefined)}
        title={t("recoveryCode.removeTitle")}
        description={t("recoveryCode.removeBody")}
        confirmLabel={t("recoveryCode.remove")}
        tone="danger"
        onConfirm={() => {
          setConfirm(undefined);
          void removeCode();
        }}
      />
      <AddDeviceDialog open={addDevice} onOpenChange={setAddDevice} />
    </Panel>
  );
}

export function OrgRecoveryRow({ org, onChange }: { org: Org; onChange: () => void }) {
  const client = useClient();
  const { t } = useI18n();
  const [info, setInfo] = useState<OrgRecoveryInfo>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<"setup" | "enroll" | "withdraw" | "admin" | "off">();
  const name = org.name ?? t("recovery.org.unnamed");
  const admin = isAdmin(org);
  const guest = org.role === "guest";
  const { policies } = useSnapshot();
  const required = policies.find((p) => p.orgId === org.id)?.rules.requireRecoveryEnrollment ?? false;
  // Families have no policies section: turning recovery off lifts the rule first.
  const lockedByPolicy = required && org.kind === "team";

  async function turnOff() {
    if (required && org.kind !== "team") await client.setOrgPolicy(org.id, DEFAULT_POLICY_RULES);
    await client.turnOffOrgRecovery(org.id);
  }

  const load = useCallback(() => {
    client
      .orgRecovery(org.id)
      .then((next) => {
        setInfo(next);
        setError(undefined);
      })
      .catch((e: unknown) => setError(errorMessage(e)));
  }, [client, org.id]);
  useEffect(load, [load]);

  async function run(action: () => Promise<void>, success: string) {
    setBusy(true);
    try {
      await action();
      toast.success(success);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
      setDialog(undefined);
      load();
      onChange();
    }
  }

  const otherAdmins = org.members.filter(
    (m) =>
      (m.role === "owner" || m.role === "admin") &&
      m.status === "confirmed" &&
      m.verified &&
      !info?.admins.includes(m.accountId),
  );

  return (
    <div className="px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <div className="flex min-w-0 max-w-md gap-3">
          <Building2 className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-[0.8125rem] font-medium">{t("recovery.org.rowTitle", { name })}</p>
            <p className="mt-0.5 text-xs text-text-muted">
              {error
                ? error
                : !info
                  ? t("app.loading")
                  : info.problem
                    ? t("recovery.org.unverified")
                    : guest
                      ? t("recovery.org.guest")
                      : !info.available
                        ? admin
                          ? t("recovery.org.notSetUpAdmin")
                          : t("recovery.org.notSetUp")
                        : info.enrolled
                          ? t("recovery.org.enrolled", { count: info.admins.length })
                          : t("recovery.org.available")}
            </p>
            {info?.available && !guest && required && (
              <p className="mt-1 text-xs text-text-muted">{t("recovery.org.requiredHint")}</p>
            )}
          </div>
        </div>
        {info && !info.problem && (
          <span className="flex flex-wrap items-center gap-2">
            {!info.available && admin && (
              <Button size="sm" variant="secondary" onClick={() => setDialog("setup")} loading={busy}>
                <ShieldCheck />
                {t("recovery.org.setUp")}
              </Button>
            )}
            {info.available && !guest && (
              <Switch
                label={t("recovery.org.allow")}
                checked={info.enrolled}
                disabled={busy || (required && info.enrolled)}
                onCheckedChange={(on) => setDialog(on ? "enroll" : "withdraw")}
              />
            )}
          </span>
        )}
      </div>
      {info?.available && info.canApprove && (
        <div className="mt-3 flex flex-wrap items-center gap-2 pl-7">
          <a
            href="#/recovery-requests"
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border-strong bg-surface px-3 text-[0.8125rem] font-medium shadow-xs hover:bg-surface-raised coarse:h-11"
          >
            {t("recovery.requests.open", { count: info.pendingRequests ?? 0 })}
          </a>
          {otherAdmins.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setDialog("admin")}>
              {t("recovery.org.addAdmin")}
            </Button>
          )}
          {info.enrolledMembers && (
            <span className="text-xs text-text-muted">
              {t("recovery.org.enrolledMembers", { count: info.enrolledMembers.length })}
            </span>
          )}
        </div>
      )}
      {info?.available && admin && (
        <div className="mt-3 pl-7">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setDialog("off")}
            disabled={busy || lockedByPolicy}
            data-testid="recovery-turn-off"
          >
            {t("recovery.org.turnOff")}
          </Button>
          {lockedByPolicy && <p className="mt-1 text-xs text-text-muted">{t("recovery.org.turnOffRequired")}</p>}
        </div>
      )}
      <ConfirmDialog
        open={dialog === "off"}
        onOpenChange={(open) => !open && setDialog(undefined)}
        title={t("recovery.org.turnOffTitle", { name })}
        description={t("recovery.org.turnOffBody")}
        confirmLabel={t("recovery.org.turnOff")}
        tone="danger"
        onConfirm={() => void run(turnOff, t("recovery.org.turnOffDone"))}
      />
      <ConfirmDialog
        open={dialog === "setup"}
        onOpenChange={(open) => !open && setDialog(undefined)}
        title={t("recovery.org.setUpTitle", { name })}
        description={t("recovery.org.setUpBody")}
        confirmLabel={t("recovery.org.setUp")}
        size="md"
        onConfirm={() => void run(() => client.setUpOrgRecovery(org.id), t("recovery.org.setUpDone"))}
      />
      <ConfirmDialog
        open={dialog === "enroll"}
        onOpenChange={(open) => !open && setDialog(undefined)}
        title={t("recovery.org.enrollTitle", { name })}
        description={
          <>
            <span className="block">{t("recovery.org.enrollBody", { name })}</span>
            <span className="mt-2 block font-medium">{t("recovery.org.enrollHonest")}</span>
            {info?.fingerprint && (
              <span className="mt-2 block text-xs text-text-muted">
                {t("recovery.org.fingerprint", { fingerprint: info.fingerprint })}
              </span>
            )}
          </>
        }
        confirmLabel={t("recovery.org.enroll")}
        size="md"
        onConfirm={() => void run(() => client.enrollOrgRecovery(org.id), t("recovery.org.enrollDone"))}
      />
      <ConfirmDialog
        open={dialog === "withdraw"}
        onOpenChange={(open) => !open && setDialog(undefined)}
        title={t("recovery.org.withdrawTitle", { name })}
        description={t("recovery.org.withdrawBody")}
        confirmLabel={t("recovery.org.withdraw")}
        tone="danger"
        onConfirm={() => void run(() => client.withdrawOrgRecovery(org.id), t("recovery.org.withdrawDone"))}
      />
      <Dialog
        open={dialog === "admin"}
        onOpenChange={(open) => !open && setDialog(undefined)}
        title={t("recovery.org.addAdminTitle")}
        description={t("recovery.org.addAdminBody")}
        size="sm"
      >
        <ul className="flex flex-col gap-2">
          {otherAdmins.map((member) => (
            <li key={member.accountId} className="flex items-center justify-between gap-3">
              <span className="min-w-0 text-[0.8125rem] break-all">{member.email ?? member.accountId}</span>
              <Button
                size="sm"
                loading={busy}
                onClick={() =>
                  void run(
                    () => client.addRecoveryAdmin(org.id, member.accountId),
                    t("recovery.org.addAdminDone", { email: member.email ?? member.accountId }),
                  )
                }
              >
                {t("recovery.org.addAdminAction")}
              </Button>
            </li>
          ))}
        </ul>
      </Dialog>
    </div>
  );
}

/** Shows a code (and QR code) for signing in on a new device, then approves it. */
function AddDeviceDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const client = useClient();
  const i18n = useI18n();
  const { t } = i18n;
  const [link, setLink] = useState<{ id: string; code: string; expiresAt: number }>();
  const [claim, setClaim] = useState<{ deviceName?: string; ip?: string }>();
  const [state, setState] = useState<"loading" | "waiting" | "claimed" | "done" | "error">("loading");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  // An approved link must stay until the new device picked up its data.
  const approved = useRef(false);

  useEffect(() => {
    if (!open) return;
    let stopped = false;
    let linkId: string | undefined;
    approved.current = false;
    setState("loading");
    setClaim(undefined);
    setError(undefined);
    client
      .startDeviceLink()
      .then((started) => {
        if (stopped) {
          void client.cancelDeviceLink(started.id);
          return;
        }
        linkId = started.id;
        setLink(started);
        setState("waiting");
      })
      .catch((e: unknown) => {
        setError(errorMessage(e));
        setState("error");
      });
    const timer = setInterval(() => {
      if (!linkId) return;
      client
        .deviceLinkStatus(linkId)
        .then((next) => {
          if (stopped || next.status !== "claimed") return;
          setClaim({
            ...(next.deviceName ? { deviceName: next.deviceName } : {}),
            ...(next.ip ? { ip: next.ip } : {}),
          });
          setState((current) => (current === "waiting" ? "claimed" : current));
        })
        .catch((e: unknown) => {
          if (stopped) return;
          setError(e instanceof InvalidDeviceCodeError ? t("addDevice.expired") : errorMessage(e));
          setState("error");
          linkId = undefined;
        });
    }, LINK_POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
      if (linkId && !approved.current) void client.cancelDeviceLink(linkId);
    };
  }, [open, client, t]);

  async function approve() {
    if (!link) return;
    setBusy(true);
    try {
      approved.current = true;
      await client.approveDeviceLink(link.id);
      setState("done");
    } catch (e) {
      approved.current = false;
      setError(e instanceof InvalidDeviceCodeError ? t("addDevice.mismatch") : errorMessage(e));
      setState("error");
    } finally {
      setBusy(false);
    }
  }

  const qrText = link
    ? `passbox-link:v1?server=${encodeURIComponent(serverUrl() ?? window.location.origin)}&code=${link.code}`
    : "";

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("addDevice.title")}
      description={state === "waiting" || state === "loading" ? t("addDevice.dialogDescription") : undefined}
      size="md"
      footer={
        state === "claimed" ? (
          <>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              {t("addDevice.deny")}
            </Button>
            <Button onClick={() => void approve()} loading={busy}>
              {t("addDevice.approve")}
            </Button>
          </>
        ) : (
          <Button variant={state === "done" ? "primary" : "secondary"} onClick={() => onOpenChange(false)}>
            {state === "done" ? t("action.done") : t("action.close")}
          </Button>
        )
      }
    >
      {state === "loading" && (
        <div className="flex justify-center py-6">
          <Spinner label={t("app.loading")} />
        </div>
      )}
      {state === "waiting" && link && (
        <div className="flex flex-col items-center gap-4 text-center">
          <QrCode text={qrText} label={t("addDevice.qrLabel")} />
          <div>
            <p className="text-xs font-medium tracking-wider text-text-muted uppercase">{t("addDevice.codeLabel")}</p>
            <p className="mt-1 font-mono text-2xl font-semibold tracking-widest" data-testid="device-code">
              {link.code}
            </p>
          </div>
          <ol className="flex list-decimal flex-col gap-1 pl-5 text-left text-[0.8125rem] text-text-muted">
            <li>{t("addDevice.step1")}</li>
            <li>{t("addDevice.step2")}</li>
            <li>{t("addDevice.step3")}</li>
          </ol>
          <p className="text-xs text-text-muted">
            {t("addDevice.validUntil", { time: i18n.dateTime(link.expiresAt) })} · {t("addDevice.privacy")}
          </p>
        </div>
      )}
      {state === "claimed" && (
        <div className="flex flex-col gap-3 text-sm">
          <p className="font-semibold">{t("addDevice.claimedTitle")}</p>
          <p className="rounded-lg border border-border bg-surface-sunken p-3">
            <span className="font-medium">
              {(claim?.deviceName && localizedDeviceName(claim.deviceName, t)) || t("addDevice.unknownDevice")}
            </span>
            {claim?.ip && <span className="text-text-muted"> · {t("devices.ip", { ip: claim.ip })}</span>}
          </p>
          <p className="text-text-muted">{t("addDevice.claimedBody")}</p>
        </div>
      )}
      {state === "done" && (
        <p className="text-sm" role="status">
          {t("addDevice.done")}
        </p>
      )}
      {state === "error" && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}
    </Dialog>
  );
}

function Row({
  icon,
  label,
  description,
  children,
}: {
  icon?: ReactNode;
  label: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-4">
      <div className="flex min-w-0 max-w-md gap-3">
        {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
        <div className="min-w-0">
          <p className="text-[0.8125rem] font-medium">{label}</p>
          {description && <p className="mt-0.5 text-xs text-text-muted">{description}</p>}
        </div>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
