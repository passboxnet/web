import { CliLoginExpiredError, type CliLoginRequestInfo, CliLoginVerificationError } from "@passbox/client";
import { AlertCard, Button, EmptyState, Spinner } from "@passbox/ui";
import { CheckCircle2, Clock, Globe, ShieldAlert, ShieldX, Terminal, XCircle } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { errorMessage } from "../core";
import { useI18n } from "../lib/i18n";
import type { Route } from "../lib/route";
import { useClient } from "../useClient";
import { Page, Panel } from "../views/PageHeader";
import { clearPendingCliLogin, pendingCliLogin } from "./pending";

type State =
  | { kind: "loading" }
  | { kind: "request"; info: CliLoginRequestInfo }
  | { kind: "approved" }
  | { kind: "denied" }
  | { kind: "expired" }
  | { kind: "mismatch" }
  | { kind: "error"; message: string };

function failure(e: unknown): State {
  if (e instanceof CliLoginExpiredError) return { kind: "expired" };
  if (e instanceof CliLoginVerificationError) return { kind: "mismatch" };
  return { kind: "error", message: errorMessage(e) };
}

/**
 * "Sign in pbx on <device>?": a sign-in request of `pbx login`, opened from
 * the link the terminal printed. The browser checks the request against the
 * link's secret (a server that swapped the key or renamed the device is
 * caught), shows where it came from and asks. Approving sends the email and
 * the Secret Key sealed to that device; the master password never leaves.
 */
export function CliLoginView({ requestId, navigate }: { requestId: string; navigate: (route: Route) => void }) {
  const client = useClient();
  const i18n = useI18n();
  const { t } = i18n;
  const [state, setState] = useState<State>({ kind: "loading" });
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState<"approve" | "deny">();

  useEffect(() => {
    document.title = t("cliLogin.pageTitle");
    const secret = pendingCliLogin(requestId);
    if (!secret) {
      setState({ kind: "mismatch" });
      return;
    }
    let stopped = false;
    client
      .cliLoginRequest(requestId, secret)
      .then((info) => !stopped && setState({ kind: "request", info }))
      .catch((e: unknown) => !stopped && setState(failure(e)));
    return () => {
      stopped = true;
    };
  }, [client, requestId, t]);

  // An expired request cannot be approved any more; say so instead of failing on click.
  useEffect(() => {
    if (state.kind !== "request") return;
    const timer = setTimeout(() => setState({ kind: "expired" }), Math.max(0, state.info.expiresAt - Date.now()));
    return () => clearTimeout(timer);
  }, [state]);

  async function answer(approve: boolean) {
    const secret = pendingCliLogin(requestId);
    if (!secret) {
      setState({ kind: "mismatch" });
      return;
    }
    setBusy(approve ? "approve" : "deny");
    try {
      if (approve) await client.approveCliLogin(requestId, secret);
      else await client.denyCliLogin(requestId);
      clearPendingCliLogin();
      setState({ kind: approve ? "approved" : "denied" });
    } catch (e) {
      const next = failure(e);
      if (next.kind !== "error") clearPendingCliLogin();
      setState(next);
    } finally {
      setBusy(undefined);
    }
  }

  const done = (
    <Button variant="secondary" onClick={() => navigate({ view: "items", filter: { kind: "all" } })}>
      {t("cliLogin.done")}
    </Button>
  );

  let body: ReactNode;
  switch (state.kind) {
    case "loading":
      body = (
        <div className="flex justify-center py-16">
          <Spinner label={t("cliLogin.loading")} />
        </div>
      );
      break;
    case "approved":
      body = (
        <EmptyState
          icon={<CheckCircle2 />}
          title={t("cliLogin.approvedTitle")}
          description={t("cliLogin.approvedBody")}
          action={done}
        />
      );
      break;
    case "denied":
      body = (
        <EmptyState
          icon={<XCircle />}
          title={t("cliLogin.deniedTitle")}
          description={t("cliLogin.deniedBody")}
          action={done}
        />
      );
      break;
    case "expired":
      body = (
        <EmptyState
          icon={<Clock />}
          title={t("cliLogin.expiredTitle")}
          description={t("cliLogin.expiredBody")}
          action={done}
        />
      );
      break;
    case "mismatch":
      body = (
        <EmptyState
          icon={<ShieldX />}
          title={t("cliLogin.mismatchTitle")}
          description={t("cliLogin.mismatchBody")}
          action={done}
        />
      );
      break;
    case "error":
      body = (
        <AlertCard
          tone="danger"
          title={state.message}
          action={
            <Button variant="secondary" size="sm" onClick={() => window.location.reload()}>
              {t("action.retry")}
            </Button>
          }
        />
      );
      break;
    case "request": {
      const { info } = state;
      const title = info.deviceName ? t("cliLogin.title", { device: info.deviceName }) : t("cliLogin.titleUnnamed");
      body = (
        <Panel title={title} description={t("cliLogin.description")} icon={<Terminal />}>
          <div className="flex flex-col gap-5 px-5 py-5" data-testid="cli-login-request">
            <dl className="grid gap-3 text-[0.8125rem] sm:grid-cols-3">
              <Detail icon={<Terminal />} label={t("cliLogin.device")}>
                <span className="font-semibold break-all" data-testid="cli-login-device">
                  {info.deviceName || "?"}
                </span>
              </Detail>
              <Detail icon={<Globe />} label={t("cliLogin.ip")}>
                <span className="font-mono font-semibold break-all" data-testid="cli-login-ip">
                  {info.ip}
                </span>
              </Detail>
              <Detail icon={<Clock />} label={t("cliLogin.time")}>
                <span className="font-semibold">{i18n.dateTime(info.createdAt)}</span>
              </Detail>
            </dl>
            <AlertCard
              tone="warning"
              icon={<ShieldAlert />}
              title={t("cliLogin.warning")}
              description={t("cliLogin.onlyYou")}
            />
            <div className="flex flex-col gap-3">
              <p className="text-body font-semibold text-text">{t("cliLogin.question")}</p>
              <label className="flex items-start gap-2 text-[0.8125rem] font-medium">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 accent-accent"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  data-testid="cli-login-confirm"
                />
                {t("cliLogin.confirm")}
              </label>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => void answer(true)}
                  disabled={!confirmed || busy !== undefined}
                  loading={busy === "approve"}
                >
                  {busy === "approve" ? t("cliLogin.approving") : t("cliLogin.approve")}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => void answer(false)}
                  disabled={busy !== undefined}
                  loading={busy === "deny"}
                >
                  {t("cliLogin.deny")}
                </Button>
              </div>
            </div>
            <p className="text-xs text-text-muted">
              {t("cliLogin.expires", { time: i18n.dateTime(info.expiresAt) })} · {t("cliLogin.privacy")}
            </p>
          </div>
        </Panel>
      );
      break;
    }
  }

  return <Page title={t("cliLogin.pageTitle")}>{body}</Page>;
}

function Detail({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-[10px] border border-hairline bg-surface-raised px-3 py-2.5">
      <dt className="flex items-center gap-1.5 text-text-muted [&_svg]:size-3.5">
        {icon}
        {label}
      </dt>
      <dd>{children}</dd>
    </div>
  );
}
