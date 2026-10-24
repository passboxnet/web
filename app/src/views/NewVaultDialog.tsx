import { Button, Dialog, Input, toast } from "@passbox/ui";
import { type FormEvent, useState } from "react";
import { errorMessage } from "../core";
import { useClient } from "../useClient";

interface NewVaultDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (vaultId: string) => void;
}

export function NewVaultDialog({ open, onOpenChange, onCreated }: NewVaultDialogProps) {
  const client = useClient();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      const id = await client.createVault(name.trim());
      toast.success(`Vault "${name.trim()}" created`);
      setName("");
      onOpenChange(false);
      onCreated(id);
    } catch (error) {
      toast.error("The vault could not be created", { description: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="New vault"
      description="Vaults keep items separate, for example for work and personal use. Each vault has its own key."
      size="sm"
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Work" autoFocus />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" loading={busy} disabled={!name.trim()}>
            Create vault
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
