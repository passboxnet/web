import type { DeviceRequestInfo, TrustedDeviceInfo, TrustedDevicesResponse } from "@passbox/api-client";
import type { TrustedDeviceSecret } from "@passbox/client";
import { Badge, Button, ConfirmDialog, Dialog, Spinner, toast } from "@passbox/ui";
import { Fingerprint, MonitorSmartphone, ShieldCheck, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { FormError } from "../auth/AuthLayout";
import { errorMessage } from "../core";
import { useI18n } from "../lib/i18n";
import { useClient } from "../useClient";
import { Panel } from "../views/PageHeader";
import { localizedDeviceName } from "../views/settings/DevicesPanel";
import { canTrustThisBrowser, forgetTrustedDevice, loadTrustedDevice, saveTrustedDevice } from "./deviceStore";

/**
 * Settings → Trusted devices: unlock with single sign-on instead of the
 * master password (when the organization allows it), and approve new
 * devices after comparing their code.
 */
export function TrustedDevicesPanel() {
  const client = useClient();
  const i18n = useI18n();
  const { t } = i18n;
  const accountId = client.deviceAccount?.accountId;
  const [state, setState] = useState<TrustedDevicesResponse>();
  const [local, setLocal] = useState<TrustedDeviceSecret>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<TrustedDeviceInfo>();
  const [reviewing, setReviewing] = useState<DeviceRequestInfo>();

  const load = useCallback(() => {
    client
      .trustedDevices()
      .then(setState)
      .catch(() => setState(undefined));
    if (accountId) {
      loadTrustedDevice(accountId)
        .then(setLocal)
        .catch(() => setLocal(undefined));
    }
  }, [client, accountId]);

  useEffect(() => {
    load();
    // New devices wait for approval: look again now and then.
    const timer = window.setInterval(load, 10_000);
    return () => window.clearInterval(timer);
  }, [load]);

  if (!state || (!state.allowed && state.devices.length === 0)) return null;
  const thisDevice = local && state.devices.some((d) => d.id === local.deviceId) ? local.deviceId : undefined;

  async function trust() {
    setBusy(true);
    setError(undefined);
    try {
      const secret = await client.trustThisDevice();
      await saveTrustedDevice(secret);
      toast.success(t("sso.devices.trusted"));
      load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove(device: TrustedDeviceInfo) {
    try {
      await client.removeTrustedDevice(device.id);
      if (device.id === thisDevice && accountId) await forgetTrustedDevice(accountId);
      toast.success(t("sso.devices.removed"));
      load();
    } catch (e) {
      toast.error(t("sso.devices.removeFailed"), { description: errorMessage(e) });
    }
  }

  return (
    <Panel id="trusted-devices" title={t("sso.devices.title")} description={t("sso.devices.description")}>
      {state.requests.map((request) => (
        <div
          key={request.id}
          className="flex flex-wrap items-center gap-3 bg-warning-soft px-5 py-3.5 text-[0.8125rem]"
          data-testid="device-request"
        >
          <MonitorSmartphone className="size-4 text-warning" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">
              {t("sso.devices.requestTitle", {
                name: localizedDeviceName(request.deviceName, t) || t("sso.devices.unnamed"),
              })}
            </p>
            <p className="text-xs text-text-muted">
              {t("sso.devices.requestMeta", { time: i18n.relativeTime(request.createdAt), ip: request.ip })}
            </p>
          </div>
          <Button size="sm" onClick={() => setReviewing(request)}>
            <Fingerprint />
            {t("sso.devices.review")}
          </Button>
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-4">
        <div className="min-w-0 max-w-md">
          <p className="flex items-center gap-2 text-[0.8125rem] font-medium">
            {t("sso.devices.thisBrowser")}
            {thisDevice ? (
              <Badge tone="success">{t("sso.devices.isTrusted")}</Badge>
            ) : (
              <Badge>{t("sso.devices.notTrusted")}</Badge>
            )}
          </p>
          <p className="mt-0.5 text-xs text-text-muted">{t("sso.devices.thisBrowserText")}</p>
        </div>
        {!thisDevice && state.allowed && canTrustThisBrowser() && (
          <Button size="sm" variant="secondary" loading={busy} onClick={() => void trust()}>
            <ShieldCheck />
            {t("sso.devices.trust")}
          </Button>
        )}
      </div>
      <FormError message={error} />
      {state.devices.length > 0 && (
        <ul className="divide-y divide-border">
          {state.devices.map((device) => (
            <li key={device.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-[0.8125rem] font-medium">
                  {localizedDeviceName(device.name, t) || t("sso.devices.unnamed")}
                  {device.id === thisDevice && <Badge tone="accent">{t("devices.thisDevice")}</Badge>}
                </p>
                <p className="text-xs text-text-muted">
                  {t("sso.devices.meta", {
                    added: i18n.date(device.createdAt),
                    used: i18n.relativeTime(device.lastUsedAt),
                  })}
                </p>
              </div>
              <Button size="sm" variant="ghost" className="text-danger" onClick={() => setRemoving(device)}>
                <Trash2 />
                {t("sso.devices.remove")}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <ApproveDialog
        request={reviewing}
        ownDeviceId={thisDevice}
        onClose={() => {
          setReviewing(undefined);
          load();
        }}
      />
      <ConfirmDialog
        open={removing !== undefined}
        onOpenChange={(open) => !open && setRemoving(undefined)}
        title={t("sso.devices.removeTitle", { name: removing ? localizedDeviceName(removing.name, t) : "" })}
        description={t("sso.devices.removeText")}
        confirmLabel={t("sso.devices.remove")}
        tone="danger"
        onConfirm={() => removing && void remove(removing)}
      />
    </Panel>
  );
}

/** Compare the code, then approve or deny a new device. */
function ApproveDialog({
  request,
  ownDeviceId,
  onClose,
}: {
  request: DeviceRequestInfo | undefined;
  ownDeviceId: string | undefined;
  onClose: () => void;
}) {
  const client = useClient();
  const { t } = useI18n();
  const [matches, setMatches] = useState(false);
  const [busy, setBusy] = useState<"approve" | "deny">();
  const [error, setError] = useState<string>();
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset when another request opens
  useEffect(() => {
    setMatches(false);
    setError(undefined);
  }, [request?.id]);

  const code = request ? client.approvalCode(request.publicKey) : "";

  async function decide(approve: boolean) {
    if (!request) return;
    setBusy(approve ? "approve" : "deny");
    setError(undefined);
    try {
      if (approve) await client.approveDevice(request, ownDeviceId);
      else await client.denyDevice(request.id);
      toast.success(approve ? t("sso.devices.approved") : t("sso.devices.denied"));
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(undefined);
    }
  }

  return (
    <Dialog
      open={request !== undefined}
      onOpenChange={(open) => !open && onClose()}
      title={t("sso.devices.reviewTitle")}
      description={t("sso.devices.reviewText")}
      footer={
        <>
          <Button variant="secondary" loading={busy === "deny"} onClick={() => void decide(false)}>
            {t("sso.devices.deny")}
          </Button>
          <Button disabled={!matches} loading={busy === "approve"} onClick={() => void decide(true)}>
            {t("sso.devices.approve")}
          </Button>
        </>
      }
    >
      {request ? (
        <div className="flex flex-col gap-4">
          <div className="rounded-card border border-border bg-surface-sunken p-4 text-center">
            <p className="text-xs font-medium tracking-wide text-text-muted uppercase">{t("sso.approval.code")}</p>
            <p className="mt-1.5 font-mono text-xl font-semibold tracking-widest" data-testid="approve-code">
              {code}
            </p>
          </div>
          <label className="flex items-start gap-2.5 text-[0.8125rem]">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-accent"
              checked={matches}
              onChange={(event) => setMatches(event.target.checked)}
            />
            {t("sso.devices.codeMatches")}
          </label>
          <p className="text-xs text-text-muted">{t("sso.devices.reviewWarning")}</p>
          <FormError message={error} />
        </div>
      ) : (
        <Spinner label={t("app.loading")} />
      )}
    </Dialog>
  );
}
