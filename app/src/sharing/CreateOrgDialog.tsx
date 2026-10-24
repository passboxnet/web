import { Button, Dialog, Input, toast } from "@passbox/ui";
import { type FormEvent, useEffect, useState } from "react";
import { FormError } from "../auth/AuthLayout";
import { useI18n } from "../lib/i18n";
import { useClient } from "../useClient";
import { sharingError } from "./common";

interface CreateOrgDialogProps {
  kind: "family" | "team" | undefined;
  onOpenChange: (open: boolean) => void;
  onCreated: (orgId: string) => void;
}

/** "Start a family" (with its family vault) or "Create a team". */
export function CreateOrgDialog({ kind, onOpenChange, onCreated }: CreateOrgDialogProps) {
  const client = useClient();
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const family = kind === "family";

  useEffect(() => {
    if (kind) {
      setName("");
      setError(undefined);
    }
  }, [kind]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(undefined);
    try {
      const id = family
        ? await client.createFamily(trimmed, t("sharing.familyVault"))
        : await client.createTeam(trimmed);
      toast.success(
        family ? t("sharing.create.familyDone", { name: trimmed }) : t("sharing.create.teamDone", { name: trimmed }),
      );
      onOpenChange(false);
      onCreated(id);
    } catch (e) {
      setError(sharingError(e, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={kind !== undefined}
      onOpenChange={onOpenChange}
      title={family ? t("sharing.create.familyTitle") : t("sharing.create.teamTitle")}
      description={family ? t("sharing.create.familyText") : t("sharing.create.teamText")}
      size="sm"
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Input
          label={family ? t("sharing.create.familyName") : t("sharing.create.teamName")}
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          placeholder={family ? t("sharing.create.familyPlaceholder") : t("sharing.create.teamPlaceholder")}
          hint={t("sharing.create.nameHint")}
          autoFocus
        />
        {family && (
          <ul className="flex list-disc flex-col gap-1 pl-5 text-[0.8125rem] text-text-muted">
            <li>{t("sharing.create.familyPoint1")}</li>
            <li>{t("sharing.create.familyPoint2")}</li>
            <li>{t("sharing.create.familyPoint3")}</li>
          </ul>
        )}
        <FormError message={error} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t("action.cancel")}
          </Button>
          <Button type="submit" loading={busy} disabled={!name.trim()}>
            {family ? t("sharing.create.familyAction") : t("sharing.create.teamAction")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
