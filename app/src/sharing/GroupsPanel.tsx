import type { Org, OrgGroup } from "@passbox/client";
import {
  Badge,
  Button,
  ConfirmDialog,
  Dialog,
  Input,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  Monogram,
  toast,
} from "@passbox/ui";
import { MoreHorizontal, Pencil, Plus, Trash2, UserMinus, UserPlus, Users } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { FormError } from "../auth/AuthLayout";
import { useI18n } from "../lib/i18n";
import { isOrgAdmin, memberLabel } from "../lib/sharing";
import { useClient } from "../useClient";
import { Panel } from "../views/PageHeader";
import { sharingError, useMyAccountId } from "./common";
import { exclusive } from "./usePendingRotations";

/** Groups of a team: share a vault once with "Sales" instead of with every person. */
export function GroupsPanel({ org }: { org: Org }) {
  const client = useClient();
  const { t } = useI18n();
  const admin = isOrgAdmin(org);
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<OrgGroup>();
  const [editing, setEditing] = useState<string>();
  const [deleting, setDeleting] = useState<OrgGroup>();
  const groupName = (group: OrgGroup) => group.name ?? t("sharing.group.unnamed");

  async function remove(group: OrgGroup) {
    try {
      await client.deleteGroup(org.id, group.id);
      toast.success(t("sharing.group.deleted", { name: groupName(group) }));
    } catch (e) {
      toast.error(t("sharing.group.deleteFailed"), { description: sharingError(e, t) });
    }
  }

  return (
    <Panel id="groups" title={t("sharing.group.title")} description={t("sharing.group.description")}>
      {org.groups.length === 0 ? (
        <p className="px-5 py-4 text-[0.8125rem] text-text-muted">{t("sharing.group.none")}</p>
      ) : (
        <ul className="divide-y divide-border">
          {org.groups.map((group) => (
            <li key={group.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <span className="flex size-9 items-center justify-center rounded-full bg-accent-soft text-accent">
                <Users className="size-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2 text-[0.8125rem] font-medium">
                  {groupName(group)}
                  {!group.verified && <Badge tone="warning">{t("sharing.status.unverified")}</Badge>}
                </span>
                <span className="block text-xs text-text-muted">
                  {t("sharing.group.memberCount", { count: group.members.length })}
                </span>
              </span>
              {admin && (
                <>
                  <Button size="sm" variant="secondary" onClick={() => setEditing(group.id)}>
                    {t("sharing.group.members")}
                  </Button>
                  <Menu>
                    <MenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t("sharing.group.more", { name: groupName(group) })}
                      >
                        <MoreHorizontal />
                      </Button>
                    </MenuTrigger>
                    <MenuContent>
                      <MenuItem icon={<Pencil />} onSelect={() => setRenaming(group)}>
                        {t("sharing.group.rename")}
                      </MenuItem>
                      <MenuItem icon={<Trash2 />} tone="danger" onSelect={() => setDeleting(group)}>
                        {t("sharing.group.delete")}
                      </MenuItem>
                    </MenuContent>
                  </Menu>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {admin && (
        <div className="px-5 py-3">
          <Button size="sm" variant="secondary" onClick={() => setCreating(true)}>
            <Plus />
            {t("sharing.group.new")}
          </Button>
        </div>
      )}

      <CreateGroupDialog org={org} open={creating} onOpenChange={setCreating} />
      <RenameGroupDialog org={org} group={renaming} onOpenChange={(open) => !open && setRenaming(undefined)} />
      <GroupMembersDialog
        org={org}
        group={org.groups.find((g) => g.id === editing)}
        onOpenChange={(open) => !open && setEditing(undefined)}
      />
      <ConfirmDialog
        open={deleting !== undefined}
        onOpenChange={(open) => !open && setDeleting(undefined)}
        title={t("sharing.group.deleteTitle", { name: deleting ? groupName(deleting) : "" })}
        description={t("sharing.group.deleteText")}
        confirmLabel={t("sharing.group.delete")}
        tone="danger"
        onConfirm={() => deleting && void remove(deleting)}
      />
    </Panel>
  );
}

function CreateGroupDialog({
  org,
  open,
  onOpenChange,
}: {
  org: Org;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const client = useClient();
  const { t } = useI18n();
  const me = useMyAccountId();
  const [name, setName] = useState("");
  const [members, setMembers] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const people = org.members.filter((m) => m.status === "confirmed" && m.accountId !== me);

  useEffect(() => {
    if (!open) return;
    setName("");
    setMembers([]);
    setError(undefined);
  }, [open]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(undefined);
    try {
      await client.createGroup(org.id, name.trim(), members);
      toast.success(t("sharing.group.created", { name: name.trim() }));
      onOpenChange(false);
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
      title={t("sharing.group.new")}
      description={t("sharing.group.newText")}
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Input
          label={t("sharing.group.name")}
          value={name}
          maxLength={80}
          placeholder={t("sharing.group.namePlaceholder")}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1.5 text-[0.8125rem] font-medium">{t("sharing.group.members")}</legend>
          <p className="mb-1 text-xs text-text-muted">{t("sharing.group.youAreMember")}</p>
          {people.map((person) => (
            <label
              key={person.accountId}
              className="flex items-center gap-2.5 rounded-md px-1 py-1.5 text-[0.8125rem] coarse:py-3"
            >
              <input
                type="checkbox"
                className="size-4 accent-control"
                checked={members.includes(person.accountId)}
                onChange={(e) =>
                  setMembers((current) =>
                    e.target.checked ? [...current, person.accountId] : current.filter((id) => id !== person.accountId),
                  )
                }
              />
              {memberLabel(person, t("sharing.member"))}
            </label>
          ))}
        </fieldset>
        <FormError message={error} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t("action.cancel")}
          </Button>
          <Button type="submit" loading={busy} disabled={!name.trim()}>
            {t("sharing.group.create")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function RenameGroupDialog({
  org,
  group,
  onOpenChange,
}: {
  org: Org;
  group: OrgGroup | undefined;
  onOpenChange: (open: boolean) => void;
}) {
  const client = useClient();
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    setName(group?.name ?? "");
    setError(undefined);
  }, [group]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!group || !name.trim()) return;
    setBusy(true);
    try {
      await client.renameGroup(org.id, group.id, name.trim());
      toast.success(t("sharing.group.renamed"));
      onOpenChange(false);
    } catch (e) {
      setError(sharingError(e, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={group !== undefined} onOpenChange={onOpenChange} title={t("sharing.group.rename")} size="sm">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Input
          label={t("sharing.group.name")}
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

/** Adding is one sealing of the group key; removing replaces the group key and the keys of its vaults. */
function GroupMembersDialog({
  org,
  group,
  onOpenChange,
}: {
  org: Org;
  group: OrgGroup | undefined;
  onOpenChange: (open: boolean) => void;
}) {
  const client = useClient();
  const { t } = useI18n();
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();
  const people = org.members.filter((m) => m.status === "confirmed");

  async function toggle(accountId: string, inGroup: boolean, label: string) {
    if (!group) return;
    setBusy(accountId);
    setError(undefined);
    try {
      if (inGroup) await exclusive(() => client.removeGroupMember(org.id, group.id, accountId));
      else await client.addGroupMember(org.id, group.id, accountId);
      toast.success(
        inGroup ? t("sharing.group.memberRemoved", { name: label }) : t("sharing.group.memberAdded", { name: label }),
      );
    } catch (e) {
      setError(sharingError(e, t));
    } finally {
      setBusy(undefined);
    }
  }

  return (
    <Dialog
      open={group !== undefined}
      onOpenChange={onOpenChange}
      title={t("sharing.group.membersTitle", { name: group?.name ?? t("sharing.group.unnamed") })}
      description={group?.isMember ? t("sharing.group.membersText") : t("sharing.group.notMember")}
    >
      <div className="flex flex-col gap-3">
        <ul className="divide-y divide-border rounded-lg border border-border">
          {people.map((person) => {
            const inGroup = group?.members.includes(person.accountId) ?? false;
            const label = memberLabel(person, t("sharing.member"));
            return (
              <li key={person.accountId} className="flex items-center gap-3 px-3 py-2">
                <Monogram name={label} size="sm" />
                <span className="min-w-0 flex-1 truncate text-[0.8125rem]">{label}</span>
                {inGroup && <Badge tone="accent">{t("sharing.group.inGroup")}</Badge>}
                <Button
                  size="xs"
                  variant={inGroup ? "ghost" : "secondary"}
                  disabled={!group?.isMember || (busy !== undefined && busy !== person.accountId)}
                  loading={busy === person.accountId}
                  onClick={() => void toggle(person.accountId, inGroup, label)}
                >
                  {inGroup ? <UserMinus /> : <UserPlus />}
                  {inGroup ? t("sharing.group.removeMember") : t("sharing.group.addMember")}
                </Button>
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-text-muted">{t("sharing.group.removeHint")}</p>
        <FormError message={error} />
      </div>
    </Dialog>
  );
}
