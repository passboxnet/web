import { type AgentRequest, agentRevealAllowed, type Item, type PassboxClient, type Vault } from "@passbox/client";
import { Badge, Button, Dialog, toast } from "@passbox/ui";
import { AlertTriangle, Bot, Eye, FileOutput, KeyRound, TerminalSquare } from "lucide-react";
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
  const { items, vaults, effectivePolicy } = useSnapshot();
  const [busy, setBusy] = useState<"approve" | "deny">();
  // passbox_reveal: off unless the person ticks it for this grant.
  const [allowReveal, setAllowReveal] = useState(false);
  const asksReveal = request.actions.includes("reveal");
  const [error, setError] = useState<string>();
  const [now, setNow] = useState(() => Date.now());
  const resolved = resolveItems(request, items, vaults);
  const unknown = resolved.filter((r) => !r.item);
  const expired = request.expiresAt <= now;
  // An organization's policy can forbid reveals for its vaults (`allowAgentReveal`).
  const revealForbidden = asksReveal && resolved.some((r) => !agentRevealAllowed(effectivePolicy, r.vault ?? {}));
  // A request that only asks to reveal is pointless to approve without the tick.
  const onlyReveal = asksReveal && request.actions.every((a) => a === "reveal");

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // An item the agent saved a moment ago is not on this device yet: sync once.
  const missing = unknown.length > 0;
  const [synced, setSynced] = useState(false);
  useEffect(() => {
    if (!missing || synced) return;
    setSynced(true);
    client.sync().catch((e: unknown) => console.warn("Could not sync before showing the agent request", e));
  }, [client, missing, synced]);

  async function decide(approved: boolean) {
    setBusy(approved ? "approve" : "deny");
    setError(undefined);
    try {
      await decideAgentRequest(client, request, approved, approved && allowReveal && !revealForbidden);
      toast.success(approved ? t("agent.approved", { code: request.code }) : t("agent.denied"));
      onClose(true);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(undefined);
    }
  }

  const who = asksReveal
    ? request.principalKind === "service"
      ? t("agent.who.serviceReveal", { name: request.principalName ?? request.principalId })
      : t("agent.who.sessionReveal")
    : request.principalKind === "service"
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
            disabled={!!busy || expired || unknown.length > 0 || (onlyReveal && (!allowReveal || revealForbidden))}
            data-testid="agent-approve"
          >
            {t("agent.approve")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5 text-sm" data-testid="agent-approval">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-info/30 bg-accent-soft px-4 py-3">
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

        {asksReveal && (
          <section
            aria-labelledby="agent-reveal"
            className="flex flex-col gap-3 rounded-lg border border-danger/40 bg-danger-soft p-4"
            data-testid="agent-reveal"
          >
            <h3 id="agent-reveal" className="flex items-center gap-2 text-[0.8125rem] font-semibold text-danger">
              <Eye className="size-4" aria-hidden="true" />
              {t("agent.reveal.title")}
            </h3>
            <p className="text-[0.8125rem]">{t("agent.reveal.warning")}</p>
            {revealForbidden ? (
              <p className="flex gap-2 text-[0.8125rem] font-medium" role="note">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
                {t("agent.reveal.forbidden")}
              </p>
            ) : (
              <label className="flex items-start gap-2 text-[0.8125rem] font-medium">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 accent-danger"
                  checked={allowReveal}
                  onChange={(e) => setAllowReveal(e.target.checked)}
                  data-testid="agent-allow-reveal"
                />
                {t("agent.reveal.allow")}
              </label>
            )}
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

        {!onlyReveal && (
          <p className="flex gap-2 rounded-lg bg-warning-soft p-3 text-[0.8125rem]">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
            {t("agent.warning")}
          </p>
        )}

        {error && (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}

async function decideAgentRequest(client: PassboxClient, request: AgentRequest, approved: boolean, reveal: boolean) {
  await client.decideAgentRequest(request, approved, 0, reveal);
}
