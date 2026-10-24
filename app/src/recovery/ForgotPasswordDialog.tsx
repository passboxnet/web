import { Button, Dialog } from "@passbox/ui";
import { Building2, KeyRound, type LucideIcon, Smartphone, UserPlus, Users } from "lucide-react";
import type { ReactNode } from "react";
import { useI18n } from "../lib/i18n";
import { useClient, useSnapshot } from "../useClient";
import { useRecoveryFlow } from "./RecoveryFlow";

/**
 * The honest answer to "I forgot my master password": nobody can reset it,
 * but the account can be recovered with the recovery code from the
 * Emergency Kit or through the organization (if the member opted in). What
 * this device knows about the account's options decides what is offered.
 */
export function ForgotPasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const client = useClient();
  const flow = useRecoveryFlow();
  const { status } = useSnapshot();
  const { t } = useI18n();
  const options = client.recoveryOptions;
  const pending = client.pendingOrgRecovery;
  const unlocked = status === "unlocked";

  function go(screen: "code" | "org") {
    onOpenChange(false);
    flow.start(screen);
  }

  if (unlocked) {
    return (
      <Dialog
        open={open}
        onOpenChange={onOpenChange}
        title={t("forgot.unlockedTitle")}
        description={t("forgot.unlockedBody")}
        footer={
          <>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              {t("forgot.close")}
            </Button>
            <Button
              onClick={() => {
                onOpenChange(false);
                window.location.hash = "#/settings/recovery";
              }}
            >
              {t("forgot.setUp")}
            </Button>
          </>
        }
      />
    );
  }

  const codeKnownMissing = options !== undefined && !options.recoveryCode;
  const orgKnownMissing = options !== undefined && options.orgs.length === 0 && !pending;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("forgot.title")}
      description={t("forgot.intro")}
      size="md"
      footer={<Button onClick={() => onOpenChange(false)}>{t("forgot.close")}</Button>}
    >
      <ul className="flex flex-col gap-3">
        <Option
          icon={KeyRound}
          title={t("forgot.code.title")}
          body={codeKnownMissing ? t("forgot.code.missing") : t("forgot.code.body")}
          action={
            <Button size="sm" variant={codeKnownMissing ? "ghost" : "primary"} onClick={() => go("code")}>
              {t("forgot.code.action")}
            </Button>
          }
        />
        <Option
          icon={Building2}
          title={t("forgot.org.title")}
          body={pending ? t("forgot.org.pending") : orgKnownMissing ? t("forgot.org.missing") : t("forgot.org.body")}
          action={
            orgKnownMissing ? undefined : (
              <Button size="sm" variant="secondary" onClick={() => go("org")}>
                {pending ? t("forgot.org.view") : t("forgot.org.action")}
              </Button>
            )
          }
        />
        <Option icon={Smartphone} title={t("forgot.device.title")} body={t("forgot.step1")} />
        <Option icon={Users} title={t("forgot.emergency.title")} body={t("forgot.emergency.body")} />
        <Option icon={UserPlus} title={t("forgot.newAccount.title")} body={t("forgot.step4")} />
      </ul>
    </Dialog>
  );
}

function Option({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <li className="flex gap-3 rounded-lg border border-border p-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-text-muted">{body}</p>
        {action && <div className="mt-2">{action}</div>}
      </div>
    </li>
  );
}
