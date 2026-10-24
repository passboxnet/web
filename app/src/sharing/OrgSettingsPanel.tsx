import type { Org } from "@passbox/client";
import { Button, Dialog, Input, toast } from "@passbox/ui";
import { KeyRound, LogOut, Pencil, Trash2 } from "lucide-react";
import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { FormError } from "../auth/AuthLayout";
import { useI18n } from "../lib/i18n";
import type { Route } from "../lib/route";
import { isOrgAdmin } from "../lib/sharing";
import { useClient } from "../useClient";
import { Panel } from "../views/PageHeader";
import { orgName, sharingError } from "./common";

export function OrgSettingsPanel({ org, navigate }: { org: Org; navigate: (route: Route) => void }) {
  const { t } = useI18n();
  const [dialog, setDialog] = useState<"rename" | "leave" | "delete">();
  const owner = org.role === "owner";
  const close = (open: boolean) => !open && setDialog(undefined);

  return (
    <Panel id="org-settings" title={t("sharing.settings.title")}>
      {isOrgAdmin(org) && org.kind === "team" && (
        <Row label={t("sso.settings.title")} description={t("sso.settings.entryText")}>
          <Button size="sm" variant="secondary" onClick={() => navigate({ view: "org-sso", orgId: org.id })}>
            <KeyRound />
            {t("sso.settings.open")}
          </Button>
        </Row>
      )}
      {isOrgAdmin(org) && (
        <Row label={t("sharing.settings.rename")} description={t("sharing.settings.renameText")}>
          <Button size="sm" variant="secondary" onClick={() => setDialog("rename")}>
            <Pencil />
            {t("sharing.settings.rename")}
          </Button>
        </Row>
      )}
      {!owner && (
        <Row label={t("sharing.settings.leave")} description={t("sharing.settings.leaveText")}>
          <Button size="sm" variant="secondary" onClick={() => setDialog("leave")}>
            <LogOut />
            {t("sharing.settings.leave")}
          </Button>
        </Row>
      )}
      {owner && (
        <Row
          label={org.kind === "family" ? t("sharing.settings.deleteFamily") : t("sharing.settings.deleteTeam")}
          description={t("sharing.settings.deleteText")}
        >
          <Button size="sm" variant="danger" onClick={() => setDialog("delete")}>
            <Trash2 />
            {t("action.delete")}
          </Button>
        </Row>
      )}
      <RenameOrgDialog org={org} open={dialog === "rename"} onOpenChange={close} />
      <LeaveOrgDialog org={org} open={dialog === "leave"} onOpenChange={close} navigate={navigate} />
      <DeleteOrgDialog org={org} open={dialog === "delete"} onOpenChange={close} navigate={navigate} />
    </Panel>
  );
}

function Row({ label, description, children }: { label: string; description: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-4">
      <div className="min-w-0 max-w-md">
        <p className="text-[0.8125rem] font-medium">{label}</p>
        <p className="mt-0.5 text-xs text-text-muted">{description}</p>
      </div>
      {children}
    </div>
  );
}

interface OrgDialogProps {
  org: Org;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function RenameOrgDialog({ org, open, onOpenChange }: OrgDialogProps) {
  const client = useClient();
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (open) {
      setName(org.name ?? "");
      setError(undefined);
    }
  }, [open, org.name]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await client.renameOrg(org.id, name.trim());
      toast.success(t("sharing.settings.renamed"));
      onOpenChange(false);
    } catch (e) {
      setError(sharingError(e, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={t("sharing.settings.rename")} size="sm">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Input
          label={t("sharing.settings.name")}
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <FormError message={error} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t("action.cancel")}
          </Button>
          <Button type="submit" loading={busy} disabled={!name.trim()}>
            {t("action.save")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function LeaveOrgDialog({ org, open, onOpenChange, navigate }: OrgDialogProps & { navigate: (route: Route) => void }) {
  const client = useClient();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const name = orgName(org, t);

  async function leave() {
    setBusy(true);
    setError(undefined);
    try {
      await client.leaveOrg(org.id);
      toast.success(t("sharing.settings.left", { name }));
      onOpenChange(false);
      navigate({ view: "sharing" });
    } catch (e) {
      setError(sharingError(e, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("sharing.settings.leaveTitle", { name })}
      description={t("sharing.settings.leaveConfirm", { name })}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t("action.cancel")}
          </Button>
          <Button variant="danger" loading={busy} onClick={() => void leave()}>
            {t("sharing.settings.leave")}
          </Button>
        </>
      }
    >
      <FormError message={error} />
    </Dialog>
  );
}

/** Deleting removes every shared vault of the organization for everyone; the owner types the name to confirm. */
function DeleteOrgDialog({ org, open, onOpenChange, navigate }: OrgDialogProps & { navigate: (route: Route) => void }) {
  const client = useClient();
  const { t } = useI18n();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const name = orgName(org, t);

  useEffect(() => {
    if (open) {
      setTyped("");
      setError(undefined);
    }
  }, [open]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (typed.trim() !== name) return;
    setBusy(true);
    setError(undefined);
    try {
      await client.deleteOrg(org.id);
      toast.success(t("sharing.settings.deleted", { name }));
      onOpenChange(false);
      navigate({ view: "sharing" });
    } catch (e) {
      setError(sharingError(e, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("sharing.settings.deleteTitle", { name })}
      description={t("sharing.settings.deleteConfirm", { name })}
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Input
          label={t("sharing.settings.typeName", { name })}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
        <FormError message={error} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t("action.cancel")}
          </Button>
          <Button type="submit" variant="danger" loading={busy} disabled={typed.trim() !== name}>
            <Trash2 />
            {t("sharing.settings.deleteAction")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
