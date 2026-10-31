import type { Org, RecoveryRequest } from "@passbox/client";
import { Badge, Button, ConfirmDialog, Dialog, EmptyState, Spinner, toast } from "@passbox/ui";
import { AlertTriangle, Phone, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { errorMessage } from "../core";
import { useI18n } from "../lib/i18n";
import { useClient, useSnapshot } from "../useClient";
import { Page, Panel } from "./PageHeader";
import { localizedDeviceName } from "./settings/DevicesPanel";

/**
 * Pending account recovery requests for the organizations where this
 * account holds the recovery key. Approving needs an out-of-band
 * identity check and the comparison of the request code.
 */
export function RecoveryRequestsView() {
  const { t } = useI18n();
  const { orgs } = useSnapshot();
  const admin = orgs.filter((o) => (o.role === "owner" || o.role === "admin") && o.status === "confirmed");
  return (
    <Page title={t("recovery.requests.title")} description={t("recovery.requests.description")}>
      <div className="flex flex-col gap-6">
        {admin.length === 0 ? (
          <EmptyState
            icon={<ShieldCheck />}
            title={t("recovery.requests.noOrgs")}
            description={t("recovery.requests.noOrgsHint")}
          />
        ) : (
          admin.map((org) => <OrgRequests key={org.id} org={org} />)
        )}
      </div>
    </Page>
  );
}

export function OrgRequests({ org }: { org: Org }) {
  const client = useClient();
  const i18n = useI18n();
  const { t } = i18n;
  const [requests, setRequests] = useState<RecoveryRequest[]>();
  const [error, setError] = useState<string>();
  const [approving, setApproving] = useState<RecoveryRequest>();
  const [denying, setDenying] = useState<RecoveryRequest>();

  const load = useCallback(() => {
    client
      .recoveryRequests(org.id)
      .then((next) => {
        setRequests(next);
        setError(undefined);
      })
      .catch((e: unknown) => setError(errorMessage(e)));
  }, [client, org.id]);
  useEffect(load, [load]);

  return (
    <Panel title={org.name ?? t("recovery.org.unnamed")} description={t("recovery.requests.orgDescription")}>
      {error ? (
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-[0.8125rem] text-text-muted">
          {error}
          <Button size="sm" variant="secondary" onClick={load}>
            {t("action.retry")}
          </Button>
        </div>
      ) : !requests ? (
        <div className="flex justify-center px-5 py-6 text-text-muted">
          <Spinner label={t("app.loading")} />
        </div>
      ) : requests.length === 0 ? (
        <p className="px-5 py-4 text-[0.8125rem] text-text-muted">{t("recovery.requests.none")}</p>
      ) : (
        requests.map((request) => (
          <div key={request.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div className="min-w-0">
              <p className="text-[0.8125rem] font-medium break-all">{request.email}</p>
              <p className="text-xs text-text-muted">
                {[
                  localizedDeviceName(request.deviceName, t),
                  request.ip && t("devices.ip", { ip: request.ip }),
                  i18n.relativeTime(request.createdAt),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <span className="flex flex-wrap items-center gap-2">
              <Badge tone="warning">{t("recovery.requests.pending")}</Badge>
              <Button size="sm" variant="ghost" onClick={() => setDenying(request)}>
                {t("recovery.requests.deny")}
              </Button>
              <Button size="sm" onClick={() => setApproving(request)}>
                {t("recovery.requests.review")}
              </Button>
            </span>
          </div>
        ))
      )}
      {approving && (
        <ApproveDialog
          org={org}
          request={approving}
          onClose={() => {
            setApproving(undefined);
            load();
          }}
        />
      )}
      <ConfirmDialog
        open={denying !== undefined}
        onOpenChange={(open) => !open && setDenying(undefined)}
        title={t("recovery.requests.denyTitle")}
        description={t("recovery.requests.denyBody", { email: denying?.email ?? "" })}
        confirmLabel={t("recovery.requests.deny")}
        tone="danger"
        onConfirm={() => {
          const request = denying;
          setDenying(undefined);
          if (!request) return;
          client
            .denyRecoveryRequest(org.id, request.id)
            .then(() => toast.success(t("recovery.requests.denied")))
            .catch((e: unknown) => toast.error(errorMessage(e)))
            .finally(load);
        }}
      />
    </Panel>
  );
}

function ApproveDialog({ org, request, onClose }: { org: Org; request: RecoveryRequest; onClose: () => void }) {
  const client = useClient();
  const { t } = useI18n();
  const [identity, setIdentity] = useState(false);
  const [codeMatches, setCodeMatches] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function approve() {
    setBusy(true);
    setError(undefined);
    try {
      await client.approveRecoveryRequest(org.id, request);
      toast.success(t("recovery.requests.approved", { email: request.email }), {
        description: t("recovery.requests.approvedHint"),
      });
      onClose();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t("recovery.requests.approveTitle", { email: request.email })}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("action.cancel")}
          </Button>
          <Button onClick={() => void approve()} loading={busy} disabled={!identity || !codeMatches}>
            {t("recovery.requests.approve")}
          </Button>
        </>
      }
    >
      <ol className="flex flex-col gap-4 text-sm">
        <li>
          <p className="flex items-center gap-2 font-semibold">
            <Phone className="size-4 text-accent" aria-hidden="true" />
            {t("recovery.requests.step1Title")}
          </p>
          <p className="mt-1 text-[0.8125rem] text-text-muted">{t("recovery.requests.step1Body")}</p>
          <label className="mt-2 flex items-start gap-2 text-[0.8125rem] coarse:min-h-11">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-control"
              checked={identity}
              onChange={(e) => setIdentity(e.target.checked)}
            />
            {t("recovery.requests.identityConfirmed", { email: request.email })}
          </label>
        </li>
        <li>
          <p className="font-semibold">{t("recovery.requests.step2Title")}</p>
          <p className="mt-1 text-[0.8125rem] text-text-muted">{t("recovery.requests.step2Body")}</p>
          <p
            className="mt-2 rounded-lg border border-info/30 bg-accent-soft px-3 py-2 text-center font-mono text-xl font-semibold tracking-wider tabular-nums"
            data-testid="approve-request-code"
          >
            {request.requestCode}
          </p>
          <label className="mt-2 flex items-start gap-2 text-[0.8125rem] coarse:min-h-11">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-control"
              checked={codeMatches}
              onChange={(e) => setCodeMatches(e.target.checked)}
            />
            {t("recovery.requests.codeConfirmed")}
          </label>
        </li>
        <li className="flex gap-2 rounded-lg bg-warning-soft p-3 text-[0.8125rem]">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
          {t("recovery.requests.honest")}
        </li>
      </ol>
      {error && (
        <p className="mt-3 text-sm text-danger" role="alert">
          {error}
        </p>
      )}
    </Dialog>
  );
}
