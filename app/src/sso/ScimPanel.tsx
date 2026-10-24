import type { ProvisionedStatus, ScimOverview, ScimTokenCreated } from "@passbox/api-client";
import { Badge, type BadgeTone, Button, ConfirmDialog, Dialog, Input, Spinner, toast } from "@passbox/ui";
import { Copy, Info, KeyRound, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { FormError } from "../auth/AuthLayout";
import { errorMessage } from "../core";
import { copyToClipboard } from "../lib/clipboard";
import { useI18n } from "../lib/i18n";
import { useClient } from "../useClient";
import { Panel } from "../views/PageHeader";

const STATUS_TONE: Record<ProvisionedStatus, BadgeTone> = {
  invited: "neutral",
  not_joined: "neutral",
  pending_confirmation: "warning",
  confirmed: "success",
  suspended: "danger",
  deactivated: "danger",
};

/**
 * SCIM provisioning: the base URL and tokens for the identity provider, and
 * the people and groups it provisioned. Joining members wait for an admin's
 * client to confirm them (verify their key, seal the organization key),
 * which the server cannot do on its own.
 */
export function ScimPanel({ orgId }: { orgId: string }) {
  const client = useClient();
  const i18n = useI18n();
  const { t } = i18n;
  const [overview, setOverview] = useState<ScimOverview>();
  const [error, setError] = useState<string>();
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<ScimTokenCreated>();
  const [revoking, setRevoking] = useState<ScimOverview["tokens"][number]>();
  const [confirming, setConfirming] = useState<string>();

  const load = useCallback(() => {
    setError(undefined);
    client.sso
      .scim(orgId)
      .then(setOverview)
      .catch((e: unknown) => setError(errorMessage(e)));
  }, [client, orgId]);
  useEffect(load, [load]);

  async function revoke(id: string) {
    try {
      await client.sso.revokeScimToken(orgId, id);
      toast.success(t("scim.tokens.revoked"));
      load();
    } catch (e) {
      toast.error(t("scim.tokens.revokeFailed"), { description: errorMessage(e) });
    }
  }

  async function confirm(accountId: string) {
    setConfirming(accountId);
    try {
      await client.confirmMember(orgId, accountId);
      toast.success(t("scim.users.confirmed"));
      load();
    } catch (e) {
      toast.error(t("scim.users.confirmFailed"), { description: errorMessage(e) });
    } finally {
      setConfirming(undefined);
    }
  }

  const pending = overview?.users.filter((u) => u.status === "pending_confirmation") ?? [];

  return (
    <Panel id="scim" title={t("scim.title")} description={t("scim.description")}>
      {error ? (
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-[0.8125rem] text-danger">
          {error}
          <Button size="sm" variant="secondary" onClick={load}>
            {t("action.retry")}
          </Button>
        </div>
      ) : !overview ? (
        <div className="flex justify-center px-5 py-6 text-text-muted">
          <Spinner label={t("app.loading")} />
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-1.5 px-5 py-4 text-[0.8125rem]">
            <span className="font-medium">{t("scim.baseUrl")}</span>
            <span className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-lg bg-surface-sunken px-3 py-2 font-mono text-xs">
                {overview.baseUrl}
              </code>
              <Button
                size="icon"
                variant="secondary"
                aria-label={t("scim.copyBaseUrl")}
                onClick={() => void copyToClipboard(overview.baseUrl, t("scim.baseUrl"))}
              >
                <Copy />
              </Button>
            </span>
            <span className="text-xs text-text-muted">{t("scim.baseUrlHint")}</span>
          </div>

          <div className="px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-[0.8125rem] font-semibold">{t("scim.tokens.title")}</h3>
              <Button size="sm" variant="secondary" onClick={() => setCreating(true)}>
                <Plus />
                {t("scim.tokens.create")}
              </Button>
            </div>
            {overview.tokens.length === 0 ? (
              <p className="mt-2 text-xs text-text-muted">{t("scim.tokens.none")}</p>
            ) : (
              <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
                {overview.tokens.map((token) => {
                  const expired = token.expiresAt < Date.now();
                  const soon = !expired && token.expiresAt - Date.now() < 14 * 24 * 60 * 60 * 1000;
                  return (
                    <li key={token.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-[0.8125rem]">
                      <KeyRound className="size-4 text-text-muted" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2 font-medium">
                          {token.name}
                          {expired && <Badge tone="danger">{t("scim.tokens.expired")}</Badge>}
                          {soon && <Badge tone="warning">{t("scim.tokens.expiresSoon")}</Badge>}
                        </p>
                        <p className="text-xs text-text-muted">
                          {t("scim.tokens.meta", {
                            expires: i18n.date(token.expiresAt),
                            used: token.lastUsedAt ? i18n.relativeTime(token.lastUsedAt) : t("scim.tokens.neverUsed"),
                          })}
                        </p>
                      </div>
                      <Button size="sm" variant="ghost" className="text-danger" onClick={() => setRevoking(token)}>
                        <Trash2 />
                        {t("scim.tokens.revoke")}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="px-5 py-4">
            <h3 className="text-[0.8125rem] font-semibold">{t("scim.users.title")}</h3>
            {pending.length > 0 && (
              <p
                role="note"
                className="mt-3 flex gap-2 rounded-lg bg-warning-soft px-3 py-2.5 text-[0.8125rem]"
                data-testid="scim-pending-note"
              >
                <Info className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
                {t("scim.users.pendingNote", { count: pending.length })}
              </p>
            )}
            {overview.users.length === 0 ? (
              <p className="mt-2 text-xs text-text-muted">{t("scim.users.none")}</p>
            ) : (
              <div className="mt-3 overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-left text-[0.8125rem]">
                  <thead className="bg-surface-sunken text-xs text-text-muted">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-medium">
                        {t("scim.users.person")}
                      </th>
                      <th scope="col" className="px-3 py-2 font-medium">
                        {t("scim.users.status")}
                      </th>
                      <th scope="col" className="px-3 py-2 font-medium">
                        {t("scim.users.groups")}
                      </th>
                      <th scope="col" className="px-3 py-2">
                        <span className="sr-only">{t("scim.users.actions")}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {overview.users.map((user) => (
                      <tr key={user.id}>
                        <td className="px-3 py-2.5">
                          <p className="font-medium">{user.displayName || user.userName}</p>
                          <p className="text-xs break-all text-text-muted">{user.email}</p>
                        </td>
                        <td className="px-3 py-2.5">
                          <Badge tone={STATUS_TONE[user.status]}>{t(`scim.status.${user.status}`)}</Badge>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-text-muted">{user.groups.join(", ") || "—"}</td>
                        <td className="px-3 py-2.5 text-right">
                          {user.status === "pending_confirmation" && user.accountId && (
                            <Button
                              size="sm"
                              loading={confirming === user.accountId}
                              onClick={() => user.accountId && void confirm(user.accountId)}
                            >
                              <ShieldCheck />
                              {t("scim.users.confirm")}
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {overview.groups.length > 0 && (
            <div className="px-5 py-4">
              <h3 className="text-[0.8125rem] font-semibold">{t("scim.groups.title")}</h3>
              <p className="mt-1 text-xs text-text-muted">{t("scim.groups.hint")}</p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {overview.groups.map((group) => (
                  <li key={group.id}>
                    <Badge>{t("scim.groups.item", { name: group.displayName, count: group.members })}</Badge>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
      <CreateTokenDialog
        orgId={orgId}
        open={creating}
        onOpenChange={setCreating}
        onCreated={(token) => {
          setCreating(false);
          setCreated(token);
          load();
        }}
      />
      <Dialog
        open={created !== undefined}
        onOpenChange={(open) => !open && setCreated(undefined)}
        title={t("scim.created.title")}
        description={t("scim.created.text")}
        footer={<Button onClick={() => setCreated(undefined)}>{t("action.done")}</Button>}
      >
        {created && (
          <div className="flex items-center gap-2">
            <code
              className="min-w-0 flex-1 break-all rounded-lg bg-surface-sunken px-3 py-2 font-mono text-xs"
              data-testid="scim-token"
            >
              {created.token}
            </code>
            <Button
              size="icon"
              variant="secondary"
              aria-label={t("scim.created.copy")}
              onClick={() => void copyToClipboard(created.token, t("scim.created.label"))}
            >
              <Copy />
            </Button>
          </div>
        )}
      </Dialog>
      <ConfirmDialog
        open={revoking !== undefined}
        onOpenChange={(open) => !open && setRevoking(undefined)}
        title={t("scim.tokens.revokeTitle", { name: revoking?.name ?? "" })}
        description={t("scim.tokens.revokeText")}
        confirmLabel={t("scim.tokens.revoke")}
        tone="danger"
        onConfirm={() => revoking && void revoke(revoking.id)}
      />
    </Panel>
  );
}

function CreateTokenDialog({
  orgId,
  open,
  onOpenChange,
  onCreated,
}: {
  orgId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (token: ScimTokenCreated) => void;
}) {
  const client = useClient();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(undefined);
    try {
      onCreated(
        await client.sso.createScimToken(orgId, {
          name: String(form.get("name")),
          expiresInDays: Number(form.get("days")) || 365,
        }),
      );
    } catch (e) {
      // A token needs a sign-in in the last 10 minutes ("errors.reauthenticate").
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={t("scim.tokens.create")} size="sm">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Input
          label={t("scim.tokens.name")}
          name="name"
          placeholder="Microsoft Entra ID"
          required
          maxLength={80}
          autoFocus
        />
        <Input
          label={t("scim.tokens.days")}
          name="days"
          type="number"
          min={1}
          max={730}
          defaultValue="365"
          hint={t("scim.tokens.daysHint")}
        />
        <FormError message={error} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            {t("action.cancel")}
          </Button>
          <Button type="submit" loading={busy}>
            {t("scim.tokens.create")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
