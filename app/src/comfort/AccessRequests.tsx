import type { AccessRequestRecord } from "@passbox/api-client";
import type { VaultRole } from "@passbox/client";
import { Badge, Button, EmptyState, Spinner, toast } from "@passbox/ui";
import { ArrowLeft, Check, Copy, DoorOpen, Hourglass, Lock, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { FormError } from "../auth/AuthLayout";
import { copyToClipboard } from "../lib/clipboard";
import { useI18n } from "../lib/i18n";
import { formatRoute, type Route } from "../lib/route";
import { vaultRoleKey } from "../lib/sharing";
import { orgName } from "../sharing/common";
import { useClient, useSnapshot } from "../useClient";
import { comfortError } from "./errors";

const ROLES: VaultRole[] = ["view", "edit", "manage"];
const selectClass =
  "h-9 rounded-lg border border-border-strong bg-surface px-2 text-[0.8125rem] shadow-xs focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/20 coarse:h-11";

/** The link colleagues open to ask for access to a vault. */
export function vaultLink(vaultId: string): string {
  return `${window.location.origin}${window.location.pathname}${formatRoute({
    view: "items",
    filter: { kind: "vault", vaultId },
  })}`;
}

type VaultState =
  | { status: "loading" }
  | { status: "unknown" }
  | { status: "ready"; orgId: string; hasAccess: boolean; request: AccessRequestRecord | null };

/**
 * Shown for a vault link this account cannot open (B9): ask the vault's
 * managers for access, see the answer, or withdraw the request. Only
 * members of the vault's organization learn that the vault exists.
 */
export function RequestAccessView({ vaultId, navigate }: { vaultId: string; navigate: (route: Route) => void }) {
  const client = useClient();
  const i18n = useI18n();
  const { t } = i18n;
  const { orgs, vaults } = useSnapshot();
  const [state, setState] = useState<VaultState>({ status: "loading" });
  const [role, setRole] = useState<VaultRole>("view");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const hasVault = vaults.some((v) => v.id === vaultId);

  const load = useCallback(() => {
    client
      .vaultAccessRequest(vaultId)
      .then((s) => setState({ status: "ready", ...s }))
      .catch(() => setState({ status: "unknown" }));
  }, [client, vaultId]);
  useEffect(load, [load]);

  // Access granted meanwhile: sync and show the vault.
  useEffect(() => {
    if (state.status === "ready" && state.hasAccess && !hasVault) void client.sync().catch(() => undefined);
  }, [client, state, hasVault]);

  async function request() {
    setBusy(true);
    setError(undefined);
    try {
      await client.requestVaultAccess(vaultId, role);
      toast.success(t("accessRequest.sent"));
      load();
    } catch (e) {
      setError(comfortError(e, t));
    } finally {
      setBusy(false);
    }
  }

  async function cancel(id: string) {
    setBusy(true);
    try {
      await client.cancelAccessRequest(id);
      toast.success(t("accessRequest.cancelled"));
      load();
    } catch (e) {
      setError(comfortError(e, t));
    } finally {
      setBusy(false);
    }
  }

  const back = (
    <Button variant="secondary" onClick={() => navigate({ view: "items", filter: { kind: "all" } })}>
      <ArrowLeft />
      {t("accessRequest.back")}
    </Button>
  );

  if (state.status === "loading") {
    return (
      <section className="flex flex-1 items-center justify-center bg-canvas">
        <Spinner label={t("app.loading")} />
      </section>
    );
  }
  if (state.status === "unknown") {
    return (
      <section className="flex flex-1 items-center justify-center bg-canvas p-6">
        <EmptyState
          icon={<Lock />}
          title={t("accessRequest.unknown.title")}
          description={t("accessRequest.unknown.text")}
          action={back}
        />
      </section>
    );
  }
  const org = orgs.find((o) => o.id === state.orgId);
  const pending = state.request?.status === "pending" ? state.request : undefined;
  const decided = state.request && state.request.status !== "pending" ? state.request : undefined;

  return (
    <section className="flex flex-1 items-center justify-center bg-canvas p-6" data-testid="request-access">
      <div className="w-full max-w-md rounded-card border border-border bg-surface p-6 shadow-card">
        <div className="flex items-start gap-3">
          <DoorOpen className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden="true" />
          <div>
            <h2 className="text-lg font-semibold">{t("accessRequest.title")}</h2>
            <p className="mt-1 text-[0.8125rem] text-text-muted">{t("accessRequest.text", { org: orgName(org, t) })}</p>
          </div>
        </div>
        {state.hasAccess ? (
          <p className="mt-4 text-[0.8125rem]">{t("accessRequest.granted")}</p>
        ) : pending ? (
          <div className="mt-4 flex flex-col gap-3">
            <p className="flex items-center gap-2 text-[0.8125rem]">
              <Hourglass className="size-4 text-warning" aria-hidden="true" />
              {t("accessRequest.pending", {
                role: t(vaultRoleKey(pending.role)),
                date: i18n.date(pending.createdAt),
              })}
            </p>
            <Button variant="secondary" onClick={() => void cancel(pending.id)} loading={busy}>
              {t("accessRequest.cancel")}
            </Button>
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            {decided?.status === "denied" && (
              <p className="text-[0.8125rem] text-text-muted">
                {t("accessRequest.denied", { date: i18n.date(decided.decidedAt) })}
              </p>
            )}
            <label className="flex items-center justify-between gap-3 text-[0.8125rem]">
              <span className="font-medium">{t("accessRequest.role")}</span>
              <select className={selectClass} value={role} onChange={(e) => setRole(e.target.value as VaultRole)}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {t(vaultRoleKey(r))}
                  </option>
                ))}
              </select>
            </label>
            <FormError message={error} />
            <Button onClick={() => void request()} loading={busy} data-testid="request-access-send">
              {t("accessRequest.send")}
            </Button>
            <p className="text-xs text-text-muted">{t("accessRequest.hint")}</p>
          </div>
        )}
        <div className="mt-5 border-t border-border pt-4">{back}</div>
      </div>
    </section>
  );
}

/**
 * Pending requests for a vault, for its managers (in the vault's sharing
 * dialog): approve shares the vault with the requested role (signed here),
 * deny tells the requester. Plus the link to send to colleagues.
 */
export function VaultAccessRequests({ vaultId }: { vaultId: string }) {
  const client = useClient();
  const i18n = useI18n();
  const { t } = i18n;
  const [requests, setRequests] = useState<AccessRequestRecord[]>([]);
  const [roles, setRoles] = useState<Record<string, VaultRole>>({});
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();

  const load = useCallback(() => {
    client
      .accessRequests()
      .then(({ incoming }) => setRequests(incoming.filter((r) => r.vaultId === vaultId)))
      .catch(() => setRequests([]));
  }, [client, vaultId]);
  useEffect(load, [load]);

  async function decide(request: AccessRequestRecord, approve: boolean) {
    setBusy(request.id);
    setError(undefined);
    try {
      if (approve) {
        await client.approveAccessRequest(request, roles[request.id] ?? request.role);
        toast.success(t("accessRequest.approved", { name: request.email }));
      } else {
        await client.denyAccessRequest(request.id);
        toast.success(t("accessRequest.deniedToast", { name: request.email }));
      }
      load();
    } catch (e) {
      setError(comfortError(e, t));
    } finally {
      setBusy(undefined);
    }
  }

  return (
    <section aria-label={t("accessRequest.incoming")} className="flex flex-col gap-2" data-testid="access-requests">
      {requests.length > 0 && (
        <>
          <h3 className="flex items-center gap-2 text-[0.8125rem] font-semibold">
            {t("accessRequest.incoming")}
            <Badge tone="accent">{requests.length}</Badge>
          </h3>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {requests.map((request) => (
              <li key={request.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.8125rem] font-medium">{request.email}</p>
                  <p className="text-xs text-text-muted">
                    {t("accessRequest.asked", { date: i18n.relativeTime(request.createdAt) })}
                  </p>
                </div>
                <select
                  aria-label={t("accessRequest.roleFor", { name: request.email })}
                  className={selectClass}
                  value={roles[request.id] ?? request.role}
                  onChange={(e) => setRoles((r) => ({ ...r, [request.id]: e.target.value as VaultRole }))}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {t(vaultRoleKey(r))}
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  onClick={() => void decide(request, true)}
                  loading={busy === request.id}
                  aria-label={t("accessRequest.approveFor", { name: request.email })}
                >
                  <Check />
                  {t("accessRequest.approve")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void decide(request, false)}
                  disabled={busy === request.id}
                  aria-label={t("accessRequest.denyFor", { name: request.email })}
                >
                  <X />
                  {t("accessRequest.deny")}
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}
      <FormError message={error} />
      <Button
        variant="ghost"
        size="xs"
        className="self-start text-accent"
        onClick={() => void copyToClipboard(vaultLink(vaultId), t("accessRequest.linkLabel"))}
      >
        <Copy />
        {t("accessRequest.copyLink")}
      </Button>
    </section>
  );
}
