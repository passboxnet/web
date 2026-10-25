import type { AgentEventRecord, AgentRequest } from "@passbox/client";
import { Badge, type BadgeTone, Button, ConfirmDialog, EmptyState, Spinner, toast } from "@passbox/ui";
import { Bell, Bot } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { errorMessage } from "../core";
import { useI18n } from "../lib/i18n";
import { itemTitle } from "../lib/items";
import { useClient, useSnapshot } from "../useClient";
import { Panel } from "../views/PageHeader";
import { AgentApprovalDialog } from "./AgentApproval";
import { AgentSetupSnippets } from "./AgentSetupSnippets";
import { refreshAgentRequests, usePendingAgentRequests } from "./agentRequests";

const STATUS_TONE: Record<AgentRequest["status"], BadgeTone> = {
  pending: "warning",
  approved: "success",
  denied: "neutral",
  expired: "neutral",
  revoked: "neutral",
};

const RESULT_TONE: Record<AgentEventRecord["result"], BadgeTone> = {
  ok: "success",
  failed: "warning",
  denied: "neutral",
  expired: "neutral",
  blocked: "danger",
};

export function AgentsSection({ onShowServiceAccounts }: { onShowServiceAccounts: () => void }) {
  const client = useClient();
  const i18n = useI18n();
  const { t } = i18n;
  const { items } = useSnapshot();
  const pending = usePendingAgentRequests();
  const [reviewing, setReviewing] = useState<AgentRequest>();
  const [grants, setGrants] = useState<AgentRequest[]>();
  const [events, setEvents] = useState<AgentEventRecord[]>();
  const [error, setError] = useState<string>();
  const [revoking, setRevoking] = useState<AgentRequest>();
  const [notifications, setNotifications] = useState(() =>
    typeof Notification === "undefined" ? "unsupported" : Notification.permission,
  );

  const load = useCallback(() => {
    Promise.all([client.agentRequests("all"), client.agentEvents(100)])
      .then(([g, e]) => {
        setGrants(g);
        setEvents(e);
        setError(undefined);
      })
      .catch((e: unknown) => setError(errorMessage(e)));
  }, [client]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: reload when requests come and go
  useEffect(load, [load, pending.length]);

  const now = Date.now();
  const title = (id: string) => {
    const item = items.find((i) => i.id === id);
    return item ? itemTitle(item, t) : t("agent.unknownItem");
  };

  return (
    <div className="flex flex-col gap-6">
      <Panel title={t("agent.pending.title")} description={t("agent.pending.description")}>
        {pending.length === 0 ? (
          <p className="px-5 py-4 text-[0.8125rem] text-text-muted" data-testid="agent-pending-empty">
            {t("agent.pending.none")}
          </p>
        ) : (
          pending.map((request) => (
            <div key={request.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div className="min-w-0">
                <p className="text-[0.8125rem] font-medium">
                  {request.clientName || t("agent.unknownClient")}{" "}
                  <span className="font-mono text-text-muted">{request.code}</span>
                </p>
                <p className="truncate text-xs text-text-muted">{request.reason}</p>
              </div>
              <Button size="sm" onClick={() => setReviewing(request)}>
                {t("agent.review")}
              </Button>
            </div>
          ))
        )}
        {notifications === "default" && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-[0.8125rem] text-text-muted">
            <span className="flex items-center gap-2">
              <Bell className="size-4" aria-hidden="true" />
              {t("agent.notify.offer")}
            </span>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                void Notification.requestPermission().then(setNotifications);
              }}
            >
              {t("agent.notify.enable")}
            </Button>
          </div>
        )}
      </Panel>

      <Panel title={t("agent.grants.title")} description={t("agent.grants.description")}>
        {error ? (
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-[0.8125rem] text-text-muted">
            {error}
            <Button size="sm" variant="secondary" onClick={load}>
              {t("action.retry")}
            </Button>
          </div>
        ) : !grants ? (
          <div className="flex justify-center px-5 py-6 text-text-muted">
            <Spinner label={t("app.loading")} />
          </div>
        ) : grants.length === 0 ? (
          <EmptyState
            icon={<Bot />}
            title={t("agent.grants.none")}
            description={t("agent.grants.noneHint")}
            action={
              <Button variant="secondary" onClick={onShowServiceAccounts}>
                {t("agent.grants.setUp")}
              </Button>
            }
          />
        ) : (
          grants.map((grant) => {
            const active = grant.status === "approved" && grant.notAfter > now;
            const status = grant.status === "approved" && !active ? "expired" : grant.status;
            return (
              <div key={grant.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="text-[0.8125rem] font-medium">
                    {grant.clientName || t("agent.unknownClient")}
                    {grant.principalName && <span className="text-text-muted"> · {grant.principalName}</span>}
                  </p>
                  <p className="truncate text-xs text-text-muted">
                    {[
                      grant.items.map((i) => title(i.itemId)).join(", "),
                      grant.commands.join(" · "),
                      i18n.relativeTime(grant.createdAt),
                      active && t("agent.grants.until", { time: i18n.dateTime(grant.notAfter) }),
                      grant.decidedDevice && t("agent.grants.by", { device: grant.decidedDevice }),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <span className="flex items-center gap-2">
                  <Badge tone={STATUS_TONE[status]}>{t(`agent.status.${status}`)}</Badge>
                  {(active || grant.status === "pending") && (
                    <Button size="sm" variant="ghost" onClick={() => setRevoking(grant)}>
                      {t("agent.revoke")}
                    </Button>
                  )}
                </span>
              </div>
            );
          })
        )}
      </Panel>

      <Panel title={t("agent.events.title")} description={t("agent.events.description")}>
        {!events ? null : events.length === 0 ? (
          <p className="px-5 py-4 text-[0.8125rem] text-text-muted">{t("agent.events.none")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {events.map((event) => (
              <li key={event.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="text-[0.8125rem] font-medium">
                    {t(`agent.tool.${event.tool}`)}
                    {event.itemIds.length > 0 && (
                      <span className="text-text-muted"> · {event.itemIds.map(title).join(", ")}</span>
                    )}
                  </p>
                  <p className="truncate text-xs text-text-muted">
                    {[event.clientName, event.target, i18n.relativeTime(event.createdAt)].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <Badge tone={RESULT_TONE[event.result]}>{t(`agent.result.${event.result}`)}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title={t("agent.setup.title")} description={t("agent.setup.description")}>
        <div className="flex flex-col gap-3 px-5 py-4 text-[0.8125rem]">
          <ol className="list-decimal space-y-1 pl-5 text-text-muted">
            <li>{t("agent.setup.step1")}</li>
            <li>{t("agent.setup.step2")}</li>
            <li>{t("agent.setup.step3")}</li>
          </ol>
          <AgentSetupSnippets server={window.location.origin} />
          <p className="text-xs text-text-muted">{t("agent.setup.more")}</p>
        </div>
      </Panel>

      {reviewing && (
        <AgentApprovalDialog
          request={reviewing}
          onClose={() => {
            setReviewing(undefined);
            refreshAgentRequests();
            load();
          }}
        />
      )}
      <ConfirmDialog
        open={revoking !== undefined}
        onOpenChange={(open) => !open && setRevoking(undefined)}
        title={t("agent.revokeTitle")}
        description={t("agent.revokeBody")}
        confirmLabel={t("agent.revoke")}
        tone="danger"
        onConfirm={() => {
          const grant = revoking;
          setRevoking(undefined);
          if (!grant) return;
          client
            .revokeAgentGrant(grant.id)
            .then(() => toast.success(t("agent.revoked")))
            .catch((e: unknown) => toast.error(errorMessage(e)))
            .finally(() => {
              refreshAgentRequests();
              load();
            });
        }}
      />
    </div>
  );
}
