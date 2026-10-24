import { Button, ConfirmDialog } from "@passbox/ui";
import { AlertTriangle } from "lucide-react";
import { useI18n } from "../lib/i18n";
import { secretKeyPrefix, setKitPending } from "../lib/kit";
import { useClient } from "../useClient";
import { useKit } from "./KitProvider";

/**
 * Every way of removing the account from this device goes through this
 * dialog: signing out deletes the only local copy of the Secret Key.
 */
export function SignOutDialog({
  open,
  onOpenChange,
  variant = "signOut",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** "otherAccount" for "Use a different account…" on the unlock screen. */
  variant?: "signOut" | "otherAccount";
}) {
  const client = useClient();
  const kit = useKit();
  const { t } = useI18n();
  const secretKey = client.deviceAccount?.secretKey ?? "";

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={variant === "otherAccount" ? t("signOut.otherAccountTitle") : t("signOut.title")}
      description={
        <>
          {t("signOut.body", { prefix: secretKeyPrefix(secretKey) })}
          {kit.pending && (
            <span className="mt-3 flex items-start gap-2 rounded-lg bg-danger-soft px-3 py-2 text-danger">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {t("signOut.pending")}
            </span>
          )}
        </>
      }
      confirmLabel={t("signOut.confirm")}
      tone="danger"
      size="md"
      extraActions={
        <Button
          variant="ghost"
          className="mr-auto"
          onClick={() => {
            onOpenChange(false);
            kit.requestKit();
          }}
        >
          {t("signOut.showKit")}
        </Button>
      }
      onConfirm={() => {
        setKitPending(undefined);
        client.signOut();
      }}
    />
  );
}

/** "Forgot master password?" now lives with the recovery flows. */
export { ForgotPasswordDialog } from "../recovery/ForgotPasswordDialog";
