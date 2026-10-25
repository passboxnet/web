import type {
  AgentUsage,
  ServiceAccount,
  ServiceAccountEventRecord,
  ServiceAccountPermission,
  ServiceAccountVaultChoice,
  Vault,
} from "@passbox/client";
import {
  Badge,
  type BadgeTone,
  Button,
  ConfirmDialog,
  Dialog,
  EmptyState,
  fieldClassName,
  Input,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  Spinner,
  toast,
} from "@passbox/ui";
import {
  AlertTriangle,
  Copy,
  History,
  KeyRound,
  MoreHorizontal,
  Plus,
  ServerCog,
  ShieldOff,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useId, useState } from "react";
import { errorMessage } from "../core";
import { copyToClipboard } from "../lib/clipboard";
import { useI18n } from "../lib/i18n";
import { useClient, useSnapshot } from "../useClient";
import { Panel } from "../views/PageHeader";

const DAY_MS = 24 * 60 * 60 * 1000;
const EXPIRY_CHOICES = [30, 90, 365, 0] as const;

const STATE_TONE: Record<ServiceAccount["state"], BadgeTone> = {
  active: "success",
  expired: "warning",
  revoked: "neutral",
};

/** Vaults a service account can be given: those this account can read; write needs edit access. */
function grantableVaults(vaults: Vault[]): Vault[] {
  return vaults.filter((v) => !v.orgId || v.role !== undefined);
}

function canWrite(vault: Vault | undefined): boolean {
  return !!vault && (!vault.orgId || vault.role === "edit" || vault.role === "manage");
}

export function ServiceAccountsSection() {
  const client = useClient();
  const i18n = useI18n();
  const { t } = i18n;
  const { vaults } = useSnapshot();
  const [accounts, setAccounts] = useState<ServiceAccount[]>();
  const [error, setError] = useState<string>();
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<{ name: string; token: string }>();
  const [managing, setManaging] = useState<ServiceAccount>();
  const [history, setHistory] = useState<ServiceAccount>();
  const [revoking, setRevoking] = useState<ServiceAccount>();
  const [deleting, setDeleting] = useState<ServiceAccount>();
  const [usage, setUsage] = useState<AgentUsage>();

  const load = useCallback(() => {
    client
      .serviceAccounts()
      .then((next) => {
        setAccounts(next);
        setError(undefined);
      })
      .catch((e: unknown) => setError(errorMessage(e)));
    // Fair use: agents and service accounts are free and never count as
    // members; older servers have no limit endpoint.
    client
      .agentLimit()
      .then(setUsage)
      .catch(() => setUsage(undefined));
  }, [client]);
  const limitReached = !!usage && usage.allowed > 0 && usage.used >= usage.allowed;
  useEffect(load, [load]);

  const vaultName = (id: string) => vaults.find((v) => v.id === id)?.name ?? t("serviceAccount.unknownVault");

  return (
    <div className="flex flex-col gap-6">
      <Panel title={t("serviceAccount.title")} description={t("serviceAccount.description")}>
        <div className="flex flex-wrap items-center justify-end gap-3 px-5 py-3">
          {usage && (
            <p className="mr-auto text-xs text-text-muted" data-testid="agent-usage">
              {usage.allowed === 0
                ? t("developer.limit.unlimited")
                : usage.pool === "organization"
                  ? t("developer.limit.organization", {
                      used: usage.used,
                      allowed: usage.allowed,
                      perMember: usage.limitPerMember,
                    })
                  : t("developer.limit.personal", { used: usage.used, allowed: usage.allowed })}
            </p>
          )}
          <Button size="sm" onClick={() => setCreating(true)} disabled={limitReached} data-testid="sa-new">
            <Plus />
            {t("serviceAccount.new")}
          </Button>
        </div>
        {limitReached && (
          <p role="note" className="mx-5 mb-3 rounded-md bg-warning-soft px-3 py-2 text-[0.8125rem]">
            {t("developer.limit.reached")}
          </p>
        )}
        {error ? (
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-[0.8125rem] text-text-muted">
            {error}
            <Button size="sm" variant="secondary" onClick={load}>
              {t("action.retry")}
            </Button>
          </div>
        ) : !accounts ? (
          <div className="flex justify-center px-5 py-6 text-text-muted">
            <Spinner label={t("app.loading")} />
          </div>
        ) : accounts.length === 0 ? (
          <EmptyState
            icon={<ServerCog />}
            title={t("serviceAccount.none")}
            description={t("serviceAccount.noneHint")}
          />
        ) : (
          accounts.map((account) => {
            const outdated = account.grants.some((g) => g.keyEpoch < g.currentKeyEpoch);
            return (
              <div
                key={account.id}
                className="flex flex-wrap items-start justify-between gap-3 px-5 py-4"
                data-testid="sa-row"
              >
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-[0.8125rem] font-medium">
                    {account.name}
                    <Badge tone={STATE_TONE[account.state]}>{t(`serviceAccount.state.${account.state}`)}</Badge>
                    {outdated && account.state === "active" && (
                      <Badge tone="warning">{t("serviceAccount.renewNeeded")}</Badge>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-text-muted">
                    {account.grants.length === 0
                      ? t("serviceAccount.noVaults")
                      : account.grants
                          .map((g) =>
                            t(g.permission === "write" ? "serviceAccount.grant.write" : "serviceAccount.grant.read", {
                              vault: vaultName(g.vaultId),
                            }),
                          )
                          .join(" · ")}
                  </p>
                  <p className="mt-0.5 text-xs text-text-muted">
                    {[
                      account.lastUsedAt
                        ? t("serviceAccount.lastUsed", { time: i18n.relativeTime(account.lastUsedAt) })
                        : t("serviceAccount.neverUsed"),
                      account.revokedAt
                        ? t("serviceAccount.revokedAt", { date: i18n.date(account.revokedAt) })
                        : account.expiresAt
                          ? t(account.state === "expired" ? "serviceAccount.expiredAt" : "serviceAccount.expiresAt", {
                              date: i18n.date(account.expiresAt),
                            })
                          : t("serviceAccount.noExpiry"),
                    ].join(" · ")}
                  </p>
                </div>
                <Menu>
                  <MenuTrigger asChild>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={t("serviceAccount.actions", { name: account.name })}
                    >
                      <MoreHorizontal />
                    </Button>
                  </MenuTrigger>
                  <MenuContent align="end">
                    {account.state !== "revoked" && (
                      <MenuItem icon={<KeyRound />} onSelect={() => setManaging(account)}>
                        {t("serviceAccount.manage")}
                      </MenuItem>
                    )}
                    <MenuItem icon={<History />} onSelect={() => setHistory(account)}>
                      {t("serviceAccount.activity")}
                    </MenuItem>
                    {account.state !== "revoked" && (
                      <MenuItem icon={<ShieldOff />} onSelect={() => setRevoking(account)}>
                        {t("serviceAccount.revoke")}
                      </MenuItem>
                    )}
                    <MenuItem icon={<Trash2 />} onSelect={() => setDeleting(account)} tone="danger">
                      {t("serviceAccount.delete")}
                    </MenuItem>
                  </MenuContent>
                </Menu>
              </div>
            );
          })
        )}
      </Panel>

      <p className="flex gap-2 text-xs text-text-muted">
        <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
        {t("serviceAccount.honest")}
      </p>

      {creating && (
        <CreateDialog
          vaults={grantableVaults(vaults)}
          onClose={() => setCreating(false)}
          onCreated={(name, token) => {
            setCreating(false);
            setCreated({ name, token });
            load();
          }}
        />
      )}
      {created && <TokenDialog name={created.name} token={created.token} onClose={() => setCreated(undefined)} />}
      {managing && (
        <ManageDialog
          account={managing}
          vaults={grantableVaults(vaults)}
          onClose={() => {
            setManaging(undefined);
            load();
          }}
        />
      )}
      {history && <HistoryDialog account={history} onClose={() => setHistory(undefined)} />}
      <ConfirmDialog
        open={revoking !== undefined}
        onOpenChange={(open) => !open && setRevoking(undefined)}
        title={t("serviceAccount.revokeTitle", { name: revoking?.name ?? "" })}
        description={t("serviceAccount.revokeBody")}
        confirmLabel={t("serviceAccount.revoke")}
        tone="danger"
        onConfirm={() => {
          const account = revoking;
          setRevoking(undefined);
          if (!account) return;
          client
            .revokeServiceAccount(account.id)
            .then(() => toast.success(t("serviceAccount.revoked", { name: account.name })))
            .catch((e: unknown) => toast.error(errorMessage(e)))
            .finally(load);
        }}
      />
      <ConfirmDialog
        open={deleting !== undefined}
        onOpenChange={(open) => !open && setDeleting(undefined)}
        title={t("serviceAccount.deleteTitle", { name: deleting?.name ?? "" })}
        description={t("serviceAccount.deleteBody")}
        confirmLabel={t("serviceAccount.delete")}
        tone="danger"
        onConfirm={() => {
          const account = deleting;
          setDeleting(undefined);
          if (!account) return;
          client
            .deleteServiceAccount(account.id)
            .then(() => toast.success(t("serviceAccount.deleted", { name: account.name })))
            .catch((e: unknown) => toast.error(errorMessage(e)))
            .finally(load);
        }}
      />
    </div>
  );
}

type Choice = ServiceAccountPermission | "none";

function PermissionSelect({
  vault,
  value,
  onChange,
}: {
  vault: Vault;
  value: Choice;
  onChange: (value: Choice) => void;
}) {
  const { t } = useI18n();
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <label htmlFor={id} className="min-w-0 truncate text-[0.8125rem] font-medium">
        {vault.name}
      </label>
      <select
        id={id}
        className={`${fieldClassName} h-9 w-auto px-2`}
        value={value}
        onChange={(e) => onChange(e.target.value as Choice)}
      >
        <option value="none">{t("serviceAccount.permission.none")}</option>
        <option value="read">{t("serviceAccount.permission.read")}</option>
        <option value="write" disabled={!canWrite(vault)}>
          {t("serviceAccount.permission.write")}
        </option>
      </select>
    </div>
  );
}

function CreateDialog({
  vaults,
  onClose,
  onCreated,
}: {
  vaults: Vault[];
  onClose: () => void;
  onCreated: (name: string, token: string) => void;
}) {
  const client = useClient();
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [expiry, setExpiry] = useState<(typeof EXPIRY_CHOICES)[number]>(90);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const expiryId = useId();
  const selected: ServiceAccountVaultChoice[] = Object.entries(choices)
    .filter((entry): entry is [string, ServiceAccountPermission] => entry[1] !== "none")
    .map(([vaultId, permission]) => ({ vaultId, permission }));

  async function create() {
    setBusy(true);
    setError(undefined);
    try {
      const expiresAt = expiry === 0 ? 0 : Date.now() + expiry * DAY_MS;
      const { token } = await client.createServiceAccount(name.trim(), selected, expiresAt);
      onCreated(name.trim(), token);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t("serviceAccount.createTitle")}
      description={t("serviceAccount.createDescription")}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("action.cancel")}
          </Button>
          <Button
            onClick={() => void create()}
            loading={busy}
            disabled={!name.trim() || selected.length === 0}
            data-testid="sa-create"
          >
            {t("serviceAccount.create")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Input
          label={t("serviceAccount.name")}
          hint={t("serviceAccount.nameHint")}
          value={name}
          maxLength={100}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <fieldset>
          <legend className="text-[0.8125rem] font-medium">{t("serviceAccount.vaults")}</legend>
          <p className="text-xs text-text-muted">{t("serviceAccount.vaultsHint")}</p>
          <div className="mt-1 divide-y divide-border">
            {vaults.map((vault) => (
              <PermissionSelect
                key={vault.id}
                vault={vault}
                value={choices[vault.id] ?? "none"}
                onChange={(value) => setChoices((c) => ({ ...c, [vault.id]: value }))}
              />
            ))}
          </div>
        </fieldset>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={expiryId} className="text-[0.8125rem] font-medium">
            {t("serviceAccount.expiry")}
          </label>
          <select
            id={expiryId}
            className={`${fieldClassName} h-9 px-2`}
            value={expiry}
            onChange={(e) => setExpiry(Number(e.target.value) as (typeof EXPIRY_CHOICES)[number])}
          >
            {EXPIRY_CHOICES.map((days) => (
              <option key={days} value={days}>
                {days === 0 ? t("serviceAccount.expiryNever") : t("serviceAccount.expiryDays", { days })}
              </option>
            ))}
          </select>
          {expiry === 0 && <p className="text-xs text-warning-text">{t("serviceAccount.expiryNeverHint")}</p>}
        </div>
        {error && (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}

function TokenDialog({ name, token, onClose }: { name: string; token: string; onClose: () => void }) {
  const { t } = useI18n();
  const [stored, setStored] = useState(false);
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && stored && onClose()}
      title={t("serviceAccount.tokenTitle", { name })}
      description={t("serviceAccount.tokenDescription")}
      size="md"
      footer={
        <Button onClick={onClose} disabled={!stored}>
          {t("action.done")}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-stretch gap-2">
          <code
            className="min-w-0 flex-1 rounded-md bg-surface-sunken px-3 py-2 font-mono text-xs break-all"
            data-testid="sa-token"
          >
            {token}
          </code>
          <Button variant="secondary" onClick={() => void copyToClipboard(token, t("serviceAccount.token"))}>
            <Copy />
            {t("action.copy")}
          </Button>
        </div>
        <pre className="overflow-x-auto rounded-md bg-surface-sunken px-3 py-2 font-mono text-xs">
          {`export PASSBOX_SERVER=${window.location.origin}
export PASSBOX_SERVICE_ACCOUNT_TOKEN=…
pbx read pbx://<vault>/<item>/<field>`}
        </pre>
        <p className="flex gap-2 rounded-lg bg-warning-soft p-3 text-[0.8125rem]">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
          {t("serviceAccount.tokenWarning")}
        </p>
        <label className="flex items-start gap-2 text-[0.8125rem] coarse:min-h-11">
          <input
            type="checkbox"
            className="mt-0.5 size-4 accent-accent"
            checked={stored}
            onChange={(e) => setStored(e.target.checked)}
            data-testid="sa-token-stored"
          />
          {t("serviceAccount.tokenStored")}
        </label>
      </div>
    </Dialog>
  );
}

function ManageDialog({ account, vaults, onClose }: { account: ServiceAccount; vaults: Vault[]; onClose: () => void }) {
  const client = useClient();
  const { t } = useI18n();
  const [current, setCurrent] = useState(account);
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();

  async function change(vaultId: string, choice: Choice) {
    setBusy(vaultId);
    setError(undefined);
    try {
      if (choice === "none") {
        await client.removeServiceAccountVault(current.id, vaultId);
        setCurrent((c) => ({ ...c, grants: c.grants.filter((g) => g.vaultId !== vaultId) }));
      } else {
        setCurrent(await client.grantServiceAccount(current, vaultId, choice));
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(undefined);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t("serviceAccount.manageTitle", { name: account.name })}
      description={t("serviceAccount.manageDescription")}
      size="md"
      footer={<Button onClick={onClose}>{t("action.done")}</Button>}
    >
      <div className="divide-y divide-border">
        {vaults.map((vault) => {
          const grant = current.grants.find((g) => g.vaultId === vault.id);
          const outdated = grant && grant.keyEpoch < grant.currentKeyEpoch;
          return (
            <div key={vault.id} className="py-1">
              <PermissionSelect
                vault={vault}
                value={grant?.permission ?? "none"}
                onChange={(value) => void change(vault.id, value)}
              />
              {outdated && (
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 text-xs text-warning-text">
                  {t("serviceAccount.renewHint")}
                  <Button
                    size="xs"
                    variant="secondary"
                    loading={busy === vault.id}
                    onClick={() => void change(vault.id, grant.permission)}
                  >
                    {t("serviceAccount.renew")}
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {error && (
        <p className="mt-3 text-sm text-danger" role="alert">
          {error}
        </p>
      )}
    </Dialog>
  );
}

function HistoryDialog({ account, onClose }: { account: ServiceAccount; onClose: () => void }) {
  const client = useClient();
  const i18n = useI18n();
  const { t } = i18n;
  const [events, setEvents] = useState<ServiceAccountEventRecord[]>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    client
      .serviceAccountEvents(account.id)
      .then(setEvents)
      .catch((e: unknown) => setError(errorMessage(e)));
  }, [client, account.id]);
  const known = new Set([
    "created",
    "read",
    "item_written",
    "item_deleted",
    "access_granted",
    "access_removed",
    "updated",
    "revoked",
  ]);
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t("serviceAccount.activityTitle", { name: account.name })}
      size="md"
      footer={<Button onClick={onClose}>{t("action.close")}</Button>}
    >
      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : !events ? (
        <div className="flex justify-center py-4 text-text-muted">
          <Spinner label={t("app.loading")} />
        </div>
      ) : events.length === 0 ? (
        <p className="text-[0.8125rem] text-text-muted">{t("serviceAccount.noActivity")}</p>
      ) : (
        <ul className="divide-y divide-border">
          {events.map((event) => (
            <li key={event.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-[0.8125rem]">
              <span>{t(`serviceAccount.event.${known.has(event.kind) ? event.kind : "other"}`)}</span>
              <span className="text-xs text-text-muted">
                {[event.ip, i18n.dateTime(event.createdAt)].filter(Boolean).join(" · ")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}
