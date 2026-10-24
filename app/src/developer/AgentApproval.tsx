import type { AgentRequest, Item, PassboxClient, Vault } from "@passbox/client";
import { Badge, Button, Dialog, toast } from "@passbox/ui";
import { AlertTriangle, Bot, FileOutput, KeyRound, TerminalSquare } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { errorMessage } from "../core";
import { requestAgentAttention } from "../desktop";
import { useI18n } from "../lib/i18n";
import { itemTitle } from "../lib/items";
import { useClient, useSnapshot } from "../useClient";
import {
  isPrefixPattern,
  refreshAgentRequests,
  startAgentRequestPolling,
  usePendingAgentRequests,
} from "./agentRequests";

/**
 * Polls for agent requests while unlocked and opens the approval dialog for
 * the oldest one. In the desktop app the window comes forward and asks for
 * attention. Mounted once in the app shell.
 */
export function AgentApprovalWatcher() {
  const client = useClient();
  const { t } = useI18n();
  const pending = usePendingAgentRequests();
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const announced = useRef(new Set<string>());

  useEffect(() => startAgentRequestPolling(client), [client]);

  useEffect(() => {
    const fresh = pending.filter((r) => !announced.current.has(r.id));
    if (fresh.length === 0) return;
    for (const request of fresh) announced.current.add(request.id);
    requestAgentAttention().catch((e: unknown) => console.warn("Could not bring the window forward", e));
    if (document.visibilityState === "hidden" && "Notification" in window && Notification.permission === "granted") {
      new Notification(t("agent.notify.title"), { body: t("agent.notify.body"), tag: "passbox-agent" });
    }
  }, [pending, t]);

  const current = pending.find((r) => !dismissed.has(r.id));
  if (!current) return null;
  return (
    <AgentApprovalDialog
      key={current.id}
      request={current}
      onClose={(decided) => {
        if (!decided) setDismissed((d) => new Set(d).add(current.id));
        refreshAgentRequests();
      }}
    />
  );
}

/** Items of a request, looked up in this device's vault. Unknown items are a warning sign. */
function resolveItems(request: AgentRequest, items: Item[], vaults: Vault[]) {
  return request.items.map((ref) => {
    const item = items.find((i) => i.id === ref.itemId && i.vaultId === ref.vaultId);
    const vault = vaults.find((v) => v.id === ref.vaultId);
    return { ref, item, vault };
  });
}

function minutes(ms: number): number {
  return Math.max(1, Math.round(ms / 60000));
}

export function AgentApprovalDialog({
  request,
  onClose,
}: {
  request: AgentRequest;
  /** `decided` is false when the dialog was closed without an answer. */
  onClose: (decided: boolean) => void;
}) {
  const client = useClient();
  const { t } = useI18n();
  const { items, vaults } = useSnapshot();
  const [busy, setBusy] = useState<"approve" | "deny">();
  const [error, setError] = useState<string>();
  const [now, setNow] = useState(() => Date.now());
  const resolved = resolveItems(request, items, vaults);
  const unknown = resolved.filter((r) => !r.item);
  const expired = request.expiresAt <= now;

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  async function decide(approved: boolean) {
    setBusy(approved ? "approve" : "deny");
    setError(undefined);
    try {
      await decideAgentRequest(client, request, approved);
      toast.success(approved ? t("agent.approved", { code: request.code }) : t("agent.denied"));
      onClose(true);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(undefined);
    }
  }

  const who =
    request.principalKind === "service"
      ? t("agent.who.service", { name: request.principalName ?? request.principalId })
      : t("agent.who.session");
  const duration =
    request.maxUses === 1 ? t("agent.duration.once") : t("agent.duration.minutes", { minutes: minutes(request.ttlMs) });
  const remaining = Math.max(0, Math.round((request.expiresAt - now) / 1000));

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose(false)}
      title={t("agent.title", { client: request.clientName || t("agent.unknownClient") })}
      description={who}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={() => void decide(false)} loading={busy === "deny"} disabled={!!busy}>
            {t("agent.deny")}
          </Button>
          <Button
            onClick={() => void decide(true)}
            loading={busy === "approve"}
            disabled={!!busy || expired || unknown.length > 0}
            data-testid="agent-approve"
          >
            {t("agent.approve")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5 text-sm" data-testid="agent-approval">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-accent/30 bg-accent-soft px-4 py-3">
          <div>
            <p className="text-[0.8125rem] font-medium">{t("agent.code.title")}</p>
            <p className="text-xs text-text-muted">{t("agent.code.hint")}</p>
          </div>
          <p className="font-mono text-2xl font-semibold tracking-wider tabular-nums" data-testid="agent-code">
            {request.code}
          </p>
        </div>

        <section aria-labelledby="agent-items">
          <h3 id="agent-items" className="mb-2 flex items-center gap-2 text-[0.8125rem] font-semibold">
            <KeyRound className="size-4 text-text-muted" aria-hidden="true" />
            {t("agent.items", { count: resolved.length })}
          </h3>
          <ul className="flex flex-col gap-1">
            {resolved.map(({ ref, item, vault }) => (
              <li
                key={ref.itemId}
                className="flex items-center justify-between gap-3 rounded-md bg-surface-sunken px-3 py-2"
              >
                <span className="min-w-0 truncate font-medium">
                  {item ? itemTitle(item, t) : t("agent.unknownItem")}
                </span>
                <span className="shrink-0 text-xs text-text-muted">{vault?.name ?? ref.vaultId}</span>
              </li>
            ))}
          </ul>
          {unknown.length > 0 && (
            <p className="mt-2 flex gap-2 text-[0.8125rem] text-danger" role="alert">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {t("agent.unknownItems")}
            </p>
          )}
        </section>

        {request.actions.includes("run") && (
          <section aria-labelledby="agent-commands">
            <h3 id="agent-commands" className="mb-2 flex items-center gap-2 text-[0.8125rem] font-semibold">
              <TerminalSquare className="size-4 text-text-muted" aria-hidden="true" />
              {t("agent.commands")}
            </h3>
            <ul className="flex flex-col gap-1">
              {request.commands.map((command) => (
                <li key={command}>
                  <code className="block overflow-x-auto rounded-md bg-surface-sunken px-3 py-2 font-mono text-[0.8125rem] whitespace-pre-wrap break-all">
                    {command}
                  </code>
                  {isPrefixPattern(command) && <p className="mt-1 text-xs text-text-muted">{t("agent.prefixHint")}</p>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {request.actions.includes("inject") && (
          <section aria-labelledby="agent-paths">
            <h3 id="agent-paths" className="mb-2 flex items-center gap-2 text-[0.8125rem] font-semibold">
              <FileOutput className="size-4 text-text-muted" aria-hidden="true" />
              {t("agent.paths")}
            </h3>
            <ul className="flex flex-col gap-1">
              {request.paths.map((path) => (
                <li key={path}>
                  <code className="block rounded-md bg-surface-sunken px-3 py-2 font-mono text-[0.8125rem] break-all">
                    {path}
                  </code>
                </li>
              ))}
            </ul>
            <p className="mt-1 text-xs text-text-muted">{t("agent.pathsHint")}</p>
          </section>
        )}

        <section aria-labelledby="agent-reason">
          <h3 id="agent-reason" className="mb-1 flex items-center gap-2 text-[0.8125rem] font-semibold">
            <Bot className="size-4 text-text-muted" aria-hidden="true" />
            {t("agent.reason")}
          </h3>
          <blockquote className="border-l-2 border-border-strong pl-3 text-[0.8125rem] whitespace-pre-wrap break-words text-text-muted">
            {request.reason}
          </blockquote>
        </section>

        <div className="flex flex-wrap items-center gap-2 text-[0.8125rem]">
          <Badge tone="neutral">{duration}</Badge>
          {request.maxUses > 1 && <Badge tone="neutral">{t("agent.uses", { count: request.maxUses })}</Badge>}
          <span className="text-xs text-text-muted" aria-live="off">
            {expired ? t("agent.expired") : t("agent.expiresIn", { seconds: remaining })}
          </span>
        </div>

        <p className="flex gap-2 rounded-lg bg-warning-soft p-3 text-[0.8125rem]">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
          {t("agent.warning")}
        </p>

        {error && (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}

async function decideAgentRequest(client: PassboxClient, request: AgentRequest, approved: boolean) {
  await client.decideAgentRequest(request, approved);
}
