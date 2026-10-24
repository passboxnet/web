import type { EventToken, Webhook } from "@passbox/api-client";
import type { Org } from "@passbox/client";
import { Badge, Button, ConfirmDialog, Dialog, Input, Switch, toast } from "@passbox/ui";
import { Copy, KeyRound, Plus, Trash2, Webhook as WebhookIcon } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { FormError } from "../auth/AuthLayout";
import { errorMessage } from "../core";
import { copyToClipboard } from "../lib/clipboard";
import { useI18n } from "../lib/i18n";
import { useClient } from "../useClient";
import { Panel } from "../views/PageHeader";
import { Section, useNames } from "./common";

/** SIEM integration (D5): tokens for the events API (pull) and webhooks (push). */
export function IntegrationsSection({ org }: { org: Org }) {
  const client = useClient();
  const i18n = useI18n();
  const { t } = i18n;
  const names = useNames(org);
  const [tokens, setTokens] = useState<EventToken[]>();
  const [hooks, setHooks] = useState<Webhook[]>();
  const [error, setError] = useState<string>();
  const [dialog, setDialog] = useState<"token" | "webhook">();
  const [secret, setSecret] = useState<{ title: string; value: string; hint: string }>();
  const [revoking, setRevoking] = useState<EventToken>();
  const [deleting, setDeleting] = useState<Webhook>();

  const load = useCallback(() => {
    Promise.all([client.orgAdmin.eventTokens(org.id), client.orgAdmin.webhooks(org.id)])
      .then(([nextTokens, nextHooks]) => {
        setTokens(nextTokens);
        setHooks(nextHooks);
        setError(undefined);
      })
      .catch((e: unknown) => setError(errorMessage(e)));
  }, [client, org.id]);
  useEffect(load, [load]);

  const base = typeof window === "undefined" ? "" : window.location.origin;

  async function revoke(token: EventToken) {
    try {
      await client.orgAdmin.revokeEventToken(org.id, token.id);
      toast.success(t("orgAdmin.integrations.tokenRevoked", { name: token.name }));
      load();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  async function remove(hook: Webhook) {
    try {
      await client.orgAdmin.deleteWebhook(org.id, hook.id);
      toast.success(t("orgAdmin.integrations.webhookDeleted"));
      load();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  return (
    <Section title={t("orgAdmin.section.integrations")} description={t("orgAdmin.integrations.description")}>
      {error && <p className="text-[0.8125rem] text-danger">{error}</p>}
      <Panel
        id="event-tokens"
        title={t("orgAdmin.integrations.tokens")}
        description={t("orgAdmin.integrations.tokensText")}
      >
        {tokens?.length === 0 && (
          <p className="px-5 py-4 text-[0.8125rem] text-text-muted">{t("orgAdmin.integrations.noTokens")}</p>
        )}
        {tokens && tokens.length > 0 && (
          <ul className="divide-y divide-border">
            {tokens.map((token) => (
              <li key={token.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <KeyRound className="size-4 text-text-muted" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-[0.8125rem] font-medium break-all">{token.name}</p>
                  <p className="text-xs text-text-muted">
                    {t("orgAdmin.integrations.tokenMeta", {
                      name: names.member(token.createdBy),
                      date: i18n.date(token.createdAt),
                      used: token.lastUsedAt ? i18n.relativeTime(token.lastUsedAt) : t("orgAdmin.members.never"),
                    })}
                  </p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setRevoking(token)}>
                  <Trash2 />
                  {t("orgAdmin.integrations.revoke")}
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-col gap-2 px-5 py-4">
          <Button size="sm" variant="secondary" className="self-start" onClick={() => setDialog("token")}>
            <Plus />
            {t("orgAdmin.integrations.newToken")}
          </Button>
          <p className="text-xs text-text-muted">{t("orgAdmin.integrations.pullHint")}</p>
          <code className="block overflow-x-auto rounded-md bg-surface-sunken px-3 py-2 font-mono text-xs whitespace-pre">
            {`curl -H "Authorization: Bearer pbxe_…" "${base}/api/v1/org-events?after=0"`}
          </code>
        </div>
      </Panel>

      <Panel
        id="webhooks"
        title={t("orgAdmin.integrations.webhooks")}
        description={t("orgAdmin.integrations.webhooksText")}
      >
        {hooks?.length === 0 && (
          <p className="px-5 py-4 text-[0.8125rem] text-text-muted">{t("orgAdmin.integrations.noWebhooks")}</p>
        )}
        {hooks && hooks.length > 0 && (
          <ul className="divide-y divide-border">
            {hooks.map((hook) => (
              <li key={hook.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <WebhookIcon className="size-4 text-text-muted" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-xs break-all">{hook.url}</p>
                  <p className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
                    {hook.failures > 0 ? (
                      <Badge tone="warning">{t("orgAdmin.integrations.failing", { count: hook.failures })}</Badge>
                    ) : hook.lastDeliveryAt ? (
                      <Badge tone="success">
                        {t("orgAdmin.integrations.delivered", { time: i18n.relativeTime(hook.lastDeliveryAt) })}
                      </Badge>
                    ) : (
                      <Badge>{t("orgAdmin.integrations.waiting")}</Badge>
                    )}
                    {t("orgAdmin.integrations.cursor", { seq: hook.cursorSeq })}
                    {hook.lastError && <span className="break-all text-danger">{hook.lastError}</span>}
                  </p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setDeleting(hook)}>
                  <Trash2 />
                  {t("action.delete")}
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-col gap-2 px-5 py-4">
          <Button size="sm" variant="secondary" className="self-start" onClick={() => setDialog("webhook")}>
            <Plus />
            {t("orgAdmin.integrations.newWebhook")}
          </Button>
          <p className="text-xs text-text-muted">{t("orgAdmin.integrations.pushHint")}</p>
        </div>
      </Panel>
      <p className="text-xs text-text-muted">{t("orgAdmin.integrations.docs")}</p>

      <NewTokenDialog
        org={org}
        open={dialog === "token"}
        onOpenChange={(open) => !open && setDialog(undefined)}
        onCreated={(token) => {
          load();
          setSecret({
            title: t("orgAdmin.integrations.tokenCreated"),
            value: token,
            hint: t("orgAdmin.integrations.tokenOnce"),
          });
        }}
      />
      <NewWebhookDialog
        org={org}
        open={dialog === "webhook"}
        onOpenChange={(open) => !open && setDialog(undefined)}
        onCreated={(value) => {
          load();
          setSecret({
            title: t("orgAdmin.integrations.webhookCreated"),
            value,
            hint: t("orgAdmin.integrations.secretOnce"),
          });
        }}
      />
      <Dialog
        open={secret !== undefined}
        onOpenChange={(open) => !open && setSecret(undefined)}
        title={secret?.title ?? ""}
        description={secret?.hint}
        footer={<Button onClick={() => setSecret(undefined)}>{t("action.done")}</Button>}
      >
        <div className="flex items-center gap-2">
          <code
            className="min-w-0 flex-1 rounded-md bg-surface-sunken px-3 py-2 font-mono text-xs break-all"
            data-testid="one-time-secret"
          >
            {secret?.value}
          </code>
          <Button
            size="icon"
            variant="secondary"
            aria-label={t("orgAdmin.integrations.copy")}
            onClick={() => secret && void copyToClipboard(secret.value, t("orgAdmin.integrations.secret"))}
          >
            <Copy />
          </Button>
        </div>
      </Dialog>
      <ConfirmDialog
        open={revoking !== undefined}
        onOpenChange={(open) => !open && setRevoking(undefined)}
        title={t("orgAdmin.integrations.revokeTitle", { name: revoking?.name ?? "" })}
        description={t("orgAdmin.integrations.revokeText")}
        confirmLabel={t("orgAdmin.integrations.revoke")}
        tone="danger"
        onConfirm={() => revoking && void revoke(revoking)}
      />
      <ConfirmDialog
        open={deleting !== undefined}
        onOpenChange={(open) => !open && setDeleting(undefined)}
        title={t("orgAdmin.integrations.deleteTitle")}
        description={t("orgAdmin.integrations.deleteText", { url: deleting?.url ?? "" })}
        confirmLabel={t("action.delete")}
        tone="danger"
        onConfirm={() => deleting && void remove(deleting)}
      />
    </Section>
  );
}

function NewTokenDialog({
  org,
  open,
  onOpenChange,
  onCreated,
}: {
  org: Org;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (token: string) => void;
}) {
  const client = useClient();
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  useEffect(() => {
    if (open) {
      setName("");
      setError(undefined);
    }
  }, [open]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const created = await client.orgAdmin.createEventToken(org.id, name.trim());
      onOpenChange(false);
      onCreated(created.token);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={t("orgAdmin.integrations.newToken")} size="sm">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Input
          label={t("orgAdmin.integrations.tokenName")}
          hint={t("orgAdmin.integrations.tokenNameHint")}
          value={name}
          maxLength={60}
          required
          autoFocus
          onChange={(e) => setName(e.target.value)}
        />
        <FormError message={error} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t("action.cancel")}
          </Button>
          <Button type="submit" loading={busy} disabled={!name.trim()}>
            {t("orgAdmin.integrations.create")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function NewWebhookDialog({
  org,
  open,
  onOpenChange,
  onCreated,
}: {
  org: Org;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (secret: string) => void;
}) {
  const client = useClient();
  const { t } = useI18n();
  const [url, setUrl] = useState("");
  const [fromStart, setFromStart] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  useEffect(() => {
    if (open) {
      setUrl("");
      setFromStart(false);
      setError(undefined);
    }
  }, [open]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const created = await client.orgAdmin.createWebhook(org.id, url.trim(), fromStart);
      onOpenChange(false);
      onCreated(created.secret);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={t("orgAdmin.integrations.newWebhook")} size="md">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Input
          label={t("orgAdmin.integrations.url")}
          hint={t("orgAdmin.integrations.urlHint")}
          value={url}
          type="url"
          required
          autoFocus
          placeholder={t("orgAdmin.integrations.urlPlaceholder")}
          onChange={(e) => setUrl(e.target.value)}
        />
        <Switch
          label={t("orgAdmin.integrations.fromStart")}
          description={t("orgAdmin.integrations.fromStartHint")}
          checked={fromStart}
          onCheckedChange={setFromStart}
        />
        <FormError message={error} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t("action.cancel")}
          </Button>
          <Button type="submit" loading={busy} disabled={!url.trim()}>
            {t("orgAdmin.integrations.create")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
