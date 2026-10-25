import { Button } from "@passbox/ui";
import { AlertTriangle, CheckCircle2, Fingerprint, SearchCheck } from "lucide-react";
import { useState } from "react";
import { useI18n } from "../lib/i18n";
import { useClient } from "../useClient";
import { Panel } from "../views/PageHeader";
import { SecurityCode, sharingError } from "./common";

/**
 * "Your security code": the fingerprint of this account's keys. Others compare
 * it when they confirm you; checking it against the key directory shows that
 * the server lists no other key for you.
 */
export function SecurityCodePanel() {
  const client = useClient();
  const { t } = useI18n();
  const [state, setState] = useState<{ kind: "ok" } | { kind: "mismatch" } | { kind: "error"; message: string }>();
  const [busy, setBusy] = useState(false);
  let code: string | undefined;
  try {
    code = client.ownFingerprint();
  } catch {
    code = undefined;
  }

  async function check() {
    setBusy(true);
    try {
      const lookup = await client.verifyOwnKey();
      setState(lookup.fingerprint === code && lookup.status !== "changed" ? { kind: "ok" } : { kind: "mismatch" });
    } catch (e) {
      setState({ kind: "error", message: sharingError(e, t) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel
      icon={<Fingerprint />}
      id="security-code"
      title={t("sharing.securityCode.title")}
      description={t("sharing.securityCode.description")}
    >
      <div className="flex flex-col gap-4 px-5 py-4">
        {code ? (
          <div className="max-w-md">
            <SecurityCode value={code} label={t("sharing.securityCode.yours")} />
          </div>
        ) : (
          <p className="text-[0.8125rem] text-text-muted">{t("sharing.securityCode.missing")}</p>
        )}
        <p className="text-xs text-text-muted">{t("sharing.securityCode.when")}</p>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" variant="secondary" loading={busy} disabled={!code} onClick={() => void check()}>
            <SearchCheck />
            {t("sharing.securityCode.check")}
          </Button>
          {state?.kind === "ok" && (
            <span role="status" className="flex items-center gap-1.5 text-[0.8125rem] text-success-text">
              <CheckCircle2 className="size-4" aria-hidden="true" />
              {t("sharing.securityCode.ok")}
            </span>
          )}
          {state?.kind === "mismatch" && (
            <span role="alert" className="flex items-center gap-1.5 text-[0.8125rem] text-danger">
              <AlertTriangle className="size-4" aria-hidden="true" />
              {t("sharing.securityCode.mismatch")}
            </span>
          )}
          {state?.kind === "error" && (
            <span role="alert" className="text-[0.8125rem] text-danger">
              {state.message}
            </span>
          )}
        </div>
      </div>
    </Panel>
  );
}
