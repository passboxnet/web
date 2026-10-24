import { Button } from "@passbox/ui";
import { Building2, Smartphone } from "lucide-react";
import { linkClass } from "../auth/ServerForm";
import { useI18n } from "../lib/i18n";
import { useClient } from "../useClient";
import { useRecoveryFlow } from "./RecoveryFlow";

/** On the sign-in and unlock screens: a recovery request this device is waiting for. */
export function PendingRecoveryNotice() {
  const client = useClient();
  const flow = useRecoveryFlow();
  const { t } = useI18n();
  if (!client.pendingOrgRecovery) return null;
  return (
    <div
      role="status"
      className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-accent/30 bg-accent-soft px-3 py-2.5 text-[0.8125rem]"
    >
      <Building2 className="size-4 shrink-0 text-accent" aria-hidden="true" />
      <p className="min-w-0 flex-1">{t("recovery.org.pendingNotice")}</p>
      <Button size="sm" onClick={() => flow.start("org")}>
        {t("forgot.org.view")}
      </Button>
    </div>
  );
}

/** "Sign in with another device": a code shown on a device that is already signed in. */
export function LinkDeviceLink() {
  const flow = useRecoveryFlow();
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={() => flow.start("linkDevice")}
      className={`inline-flex items-center gap-1.5 ${linkClass}`}
    >
      <Smartphone className="size-3.5" aria-hidden="true" />
      {t("linkDevice.link")}
    </button>
  );
}
