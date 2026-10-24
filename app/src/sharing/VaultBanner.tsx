import { Button } from "@passbox/ui";
import { Eye, Lock, Users } from "lucide-react";
import { useState } from "react";
import { useI18n } from "../lib/i18n";
import { useAudience } from "./common";
import { VaultSharingDialog } from "./VaultSharingDialog";

/** Under the item list of one vault: who can see it, and whether this account may change it. */
export function VaultBanner({ vaultId }: { vaultId: string }) {
  const { t } = useI18n();
  const audience = useAudience(vaultId);
  const [open, setOpen] = useState(false);

  if (!audience.shared) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-text-muted">
        <Lock className="size-3.5" aria-hidden="true" />
        {t("sharing.audience.onlyYou")}
      </p>
    );
  }
  const role = audience.shared.role;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-xs text-text-muted">
        <Users className="size-3.5 shrink-0 text-accent" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">
          {t("sharing.audience.visibleFor", { audience: audience.label })}
        </span>
        <Button size="xs" variant="ghost" onClick={() => setOpen(true)}>
          {role === "manage" ? t("sharing.vaults.share") : t("sharing.vaults.whoHasAccess")}
        </Button>
      </div>
      {role === "view" && (
        <p className="flex items-start gap-1.5 rounded-md bg-surface-sunken px-2.5 py-1.5 text-xs text-text-muted">
          <Eye className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          {t("sharing.viewOnly.list")}
        </p>
      )}
      <VaultSharingDialog vaultId={open ? vaultId : undefined} onOpenChange={setOpen} />
    </div>
  );
}
