import { Button, Dialog, Input, toast } from "@passbox/ui";
import { type FormEvent, useState } from "react";
import { errorMessage } from "../core";
import { useI18n } from "../lib/i18n";
import { useClient, useSnapshot } from "../useClient";

interface NewVaultDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (vaultId: string) => void;
}

export function NewVaultDialog({ open, onOpenChange, onCreated }: NewVaultDialogProps) {
  const client = useClient();
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  // Policy D2: an organization can turn personal vaults off.
  const blocked = !useSnapshot().effectivePolicy.allowPersonalVault;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      const id = await client.createVault(name.trim());
      toast.success(t("vault.created", { name: name.trim() }));
      setName("");
      onOpenChange(false);
      onCreated(id);
    } catch (error) {
      toast.error(t("vault.createFailed"), { description: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("vault.new")}
      description={t("vault.dialog.description")}
      size="sm"
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Input
          label={t("vault.name")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("vault.namePlaceholder")}
          autoFocus
        />
        {blocked && (
          <p role="status" className="rounded-lg border border-warning/30 bg-warning-soft px-3 py-2 text-[0.8125rem]">
            {t("orgAdmin.error.personalVault")}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t("action.cancel")}
          </Button>
          <Button type="submit" loading={busy} disabled={!name.trim() || blocked}>
            {t("vault.create")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
