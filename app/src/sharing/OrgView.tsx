import type { OrgInvitationInfo } from "@passbox/api-client";
import type { Org, OrgMember } from "@passbox/client";
import {
  Badge,
  Button,
  ConfirmDialog,
  Dialog,
  Input,
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
  Monogram,
  toast,
} from "@passbox/ui";
import {
  ArrowLeft,
  Ban,
  Hourglass,
  LayoutDashboard,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Share2,
  ShieldCheck,
  UserCheck,
  UserCog,
  UserMinus,
  UserPlus,
  Users,
  Vault as VaultIcon,
  X,
} from "lucide-react";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { FormError } from "../auth/AuthLayout";
import { useI18n } from "../lib/i18n";
import type { Route } from "../lib/route";
import { canManageMember, isOrgAdmin, memberLabel, orgRoleKey, vaultRoleKey } from "../lib/sharing";
import { PolicySummary } from "../orgadmin/PolicyBanner";
import { useClient, useSnapshot } from "../useClient";
import { Page, Panel } from "../views/PageHeader";
import { ConfirmMemberDialog } from "./ConfirmMemberDialog";
import {
  displayVaultName,
  MemberStatusBadge,
  OrgIcon,
  orgName,
  RoleBadge,
  SecurityCode,
  sharingError,
  useAudience,
  useMyAccountId,
} from "./common";
import { GroupsPanel } from "./GroupsPanel";
import { InviteDialog } from "./InviteDialog";
import { RemoveMemberDialog, RoleDialog, SuspendDialog } from "./MemberDialogs";
import { OrgSettingsPanel } from "./OrgSettingsPanel";
import { VaultSharingDialog } from "./VaultSharingDialog";

interface OrgViewProps {
  orgId: string;
  navigate: (route: Route) => void;
}

export function OrgView({ orgId, navigate }: OrgViewProps) {
  const { t } = useI18n();
  const { orgs } = useSnapshot();
  const org = orgs.find((o) => o.id === orgId);
  const [inviting, setInviting] = useState(false);
  const [invitationsRevision, setInvitationsRevision] = useState(0);

  if (!org) {
    return (
      <Page title={t("sharing.title")}>
        <div className="flex flex-col items-start gap-3 text-[0.8125rem] text-text-muted">
          <p>{t("sharing.org.gone")}</p>
          <Button variant="secondary" size="sm" onClick={() => navigate({ view: "sharing" })}>
            <ArrowLeft />
            {t("sharing.title")}
          </Button>
        </div>
      </Page>
    );
  }

  const admin = isOrgAdmin(org);
  const waiting = org.status === "accepted";

  return (
    <Page
      title={orgName(org, t)}
      description={
        <span className="flex flex-wrap items-center gap-2">
          <OrgIcon kind={org.kind} className="text-text-muted" />
          {org.kind === "family" ? t("sharing.kind.family") : t("sharing.kind.team")}
          <span aria-hidden="true">·</span>
          {t("sharing.org.yourRole", { role: t(orgRoleKey(org, org.role)) })}
        </span>
      }
      actions={
        admin && (
          <span className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => navigate({ view: "org-admin", orgId: org.id })}>
              <LayoutDashboard />
              {t("orgAdmin.open")}
            </Button>
            <Button onClick={() => setInviting(true)}>
              <UserPlus />
              {org.kind === "family" ? t("sharing.invite.familyButton") : t("sharing.invite.teamButton")}
            </Button>
          </span>
        )
      }
    >
      <div className="flex flex-col gap-6">
        {waiting ? (
          <WaitingCard org={org} />
        ) : org.status === "suspended" ? (
          <div
            role="status"
            className="flex gap-3 rounded-card border border-danger/30 bg-danger-soft px-5 py-4 text-[0.8125rem]"
          >
            <Ban className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
            <p>{t("sharing.org.suspended")}</p>
          </div>
        ) : null}
        {!org.verified && (
          <div
            role="alert"
            className="rounded-card border border-warning/30 bg-warning-soft px-5 py-4 text-[0.8125rem]"
          >
            {t("sharing.org.unverified")}
          </div>
        )}
        <MembersPanel org={org} navigate={navigate} />
        {admin && <InvitationsPanel org={org} revision={invitationsRevision} onInvite={() => setInviting(true)} />}
        {!waiting && <VaultsPanel org={org} navigate={navigate} />}
        {org.kind === "team" && !waiting && <GroupsPanel org={org} />}
        {!waiting && <PolicySummary org={org} />}
        <OrgSettingsPanel org={org} navigate={navigate} />
      </div>
      <InviteDialog
        org={org}
        open={inviting}
        onOpenChange={setInviting}
        onInvited={() => setInvitationsRevision((r) => r + 1)}
      />
    </Page>
  );
}

/** Shown to a member who accepted and waits for an admin to confirm them. */
function WaitingCard({ org }: { org: Org }) {
  const client = useClient();
  const { t } = useI18n();
  const [checking, setChecking] = useState(false);
  const owner = org.members.find((m) => m.role === "owner");
  const ownerName =
    owner?.email ?? (org.kind === "family" ? t("sharing.role.family.owner") : t("sharing.role.team.owner"));
  let own: string | undefined;
  try {
    own = client.ownFingerprint();
  } catch {
    own = undefined;
  }

  async function check() {
    setChecking(true);
    try {
      await client.sync();
    } catch (e) {
      toast.error(sharingError(e, t));
    } finally {
      setChecking(false);
    }
  }

  return (
    <section
      aria-labelledby="waiting-title"
      className="flex flex-col gap-4 rounded-card border border-accent/25 bg-accent-soft px-5 py-5"
    >
      <div className="flex gap-3">
        <Hourglass className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden="true" />
        <div>
          <h2 id="waiting-title" className="text-[0.9375rem] font-semibold">
            {t("sharing.waiting.title")}
          </h2>
          <p className="mt-1 text-[0.8125rem] text-text-muted">{t("sharing.waiting.text", { name: ownerName })}</p>
        </div>
      </div>
      {own && (
        <div className="flex flex-col gap-1.5 sm:max-w-md">
          <p className="text-[0.8125rem] font-medium">{t("sharing.securityCode.yours")}</p>
          <SecurityCode value={own} label={t("sharing.securityCode.yours")} />
          <p className="text-xs text-text-muted">{t("sharing.waiting.compare", { name: ownerName })}</p>
        </div>
      )}
      <Button variant="secondary" size="sm" className="self-start" loading={checking} onClick={() => void check()}>
        <RefreshCw />
        {t("sharing.waiting.check")}
      </Button>
    </section>
  );
}

function MembersPanel({ org, navigate }: { org: Org; navigate: (route: Route) => void }) {
  const { t } = useI18n();
  const me = useMyAccountId();
  const admin = isOrgAdmin(org);
  const [confirming, setConfirming] = useState<string>();
  const [roleFor, setRoleFor] = useState<OrgMember>();
  const [suspending, setSuspending] = useState<OrgMember>();
  const [removing, setRemoving] = useState<OrgMember>();
  const [showingCode, setShowingCode] = useState<OrgMember>();

  // Members waiting for confirmation first, then by role.
  const order = ["owner", "admin", "member", "guest"];
  const members = [...org.members].sort(
    (a, b) =>
      Number(b.status === "accepted") - Number(a.status === "accepted") ||
      order.indexOf(a.role) - order.indexOf(b.role) ||
      (a.email ?? "").localeCompare(b.email ?? ""),
  );

  return (
    <Panel
      id="members"
      title={t("sharing.members.title")}
      description={org.role === "guest" || org.status !== "confirmed" ? t("sharing.members.limited") : undefined}
    >
      <ul className="divide-y divide-border" aria-label={t("sharing.members.title")}>
        {members.map((member) => {
          const label = memberLabel(member, t("sharing.member"));
          const self = member.accountId === me;
          const manageable = canManageMember(org, member, me);
          const canConfirm = admin && member.status === "accepted" && (member.role !== "admin" || org.role === "owner");
          return (
            <li key={member.accountId} className="flex flex-wrap items-center gap-3 px-5 py-3" data-testid="org-member">
              <Monogram name={label} size="md" />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-[0.8125rem] font-medium break-all">
                  {self ? t("sharing.you", { name: label }) : label}
                  <RoleBadge org={org} role={member.role} />
                  <MemberStatusBadge member={member} />
                </p>
                {member.status === "accepted" && (
                  <p className="text-xs text-text-muted">
                    {admin ? t("sharing.members.acceptedAdmin") : t("sharing.members.accepted")}
                  </p>
                )}
                {member.status === "confirmed" && member.verified && !member.keyChanged && (
                  <p className="flex items-center gap-1 text-xs text-text-muted">
                    <ShieldCheck className="size-3.5 text-success" aria-hidden="true" />
                    {t("sharing.members.verified")}
                  </p>
                )}
              </div>
              {canConfirm && (
                <Button size="sm" onClick={() => setConfirming(member.accountId)}>
                  <UserCheck />
                  {t("sharing.confirm.button")}
                </Button>
              )}
              {(manageable || member.fingerprint) && !self && (
                <Menu>
                  <MenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label={t("sharing.members.more", { name: label })}>
                      <MoreHorizontal />
                    </Button>
                  </MenuTrigger>
                  <MenuContent>
                    {member.fingerprint && member.status !== "accepted" && (
                      <MenuItem icon={<ShieldCheck />} onSelect={() => setShowingCode(member)}>
                        {t("sharing.members.showCode")}
                      </MenuItem>
                    )}
                    {manageable && member.status !== "accepted" && (
                      <MenuItem icon={<UserCog />} onSelect={() => setRoleFor(member)}>
                        {t("sharing.role.change")}
                      </MenuItem>
                    )}
                    {manageable && member.status !== "accepted" && (
                      <MenuItem icon={<Ban />} onSelect={() => setSuspending(member)}>
                        {member.status === "suspended" ? t("sharing.suspend.reactivate") : t("sharing.suspend.action")}
                      </MenuItem>
                    )}
                    {manageable && (
                      <>
                        <MenuSeparator />
                        <MenuItem icon={<UserMinus />} tone="danger" onSelect={() => setRemoving(member)}>
                          {t("sharing.remove.menu")}
                        </MenuItem>
                      </>
                    )}
                  </MenuContent>
                </Menu>
              )}
            </li>
          );
        })}
      </ul>
      <ConfirmMemberDialog
        org={org}
        member={org.members.find((m) => m.accountId === confirming)}
        onOpenChange={(open) => !open && setConfirming(undefined)}
      />
      <RoleDialog org={org} member={roleFor} onOpenChange={(open) => !open && setRoleFor(undefined)} />
      <SuspendDialog org={org} member={suspending} onOpenChange={(open) => !open && setSuspending(undefined)} />
      <RemoveMemberDialog
        org={org}
        member={removing}
        onOpenChange={(open) => !open && setRemoving(undefined)}
        navigate={navigate}
      />
      <MemberCodeDialog member={showingCode} onOpenChange={(open) => !open && setShowingCode(undefined)} />
    </Panel>
  );
}

function MemberCodeDialog({
  member,
  onOpenChange,
}: {
  member: OrgMember | undefined;
  onOpenChange: (open: boolean) => void;
}) {
  const client = useClient();
  const { t } = useI18n();
  const name = memberLabel(member, t("sharing.member"));
  let own: string | undefined;
  try {
    own = client.ownFingerprint();
  } catch {
    own = undefined;
  }
  return (
    <Dialog
      open={member !== undefined}
      onOpenChange={onOpenChange}
      title={t("sharing.members.codeTitle", { name })}
      description={t("sharing.members.codeText", { name })}
      size="lg"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {member?.fingerprint && (
          <div className="flex flex-col gap-1.5">
            <p className="text-[0.8125rem] font-medium break-all">{t("sharing.confirm.theirCode", { name })}</p>
            <SecurityCode value={member.fingerprint} label={t("sharing.confirm.theirCode", { name })} />
          </div>
        )}
        {own && (
          <div className="flex flex-col gap-1.5">
            <p className="text-[0.8125rem] font-medium">{t("sharing.securityCode.yours")}</p>
            <SecurityCode value={own} label={t("sharing.securityCode.yours")} />
          </div>
        )}
      </div>
    </Dialog>
  );
}

function InvitationsPanel({ org, revision, onInvite }: { org: Org; revision: number; onInvite: () => void }) {
  const client = useClient();
  const i18n = useI18n();
  const { t } = i18n;
  const [invitations, setInvitations] = useState<OrgInvitationInfo[]>();
  const [error, setError] = useState<string>();
  const [revoking, setRevoking] = useState<OrgInvitationInfo>();
  // Accepted invitations show up as members; reload when the roster changes.
  const memberCount = org.members.length;

  const load = useCallback(() => {
    client
      .invitations(org.id)
      .then((list) => {
        setInvitations(list.filter((i) => i.status === "pending" && i.expiresAt > Date.now()));
        setError(undefined);
      })
      .catch((e: unknown) => setError(sharingError(e, t)));
  }, [client, org.id, t]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reload after invitations and roster changes
  useEffect(load, [load, revision, memberCount]);

  async function revoke(invitation: OrgInvitationInfo) {
    try {
      await client.revokeInvitation(org.id, invitation.id);
      toast.success(t("sharing.invitations.revoked", { email: invitation.email }));
      load();
    } catch (e) {
      toast.error(sharingError(e, t));
    }
  }

  return (
    <Panel id="invitations" title={t("sharing.invitations.title")} description={t("sharing.invitations.description")}>
      {error && <p className="px-5 py-3 text-[0.8125rem] text-danger">{error}</p>}
      {invitations && invitations.length === 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-[0.8125rem] text-text-muted">
          {t("sharing.invitations.none")}
          <Button size="sm" variant="secondary" onClick={onInvite}>
            <Plus />
            {t("sharing.invite.short")}
          </Button>
        </div>
      )}
      {invitations && invitations.length > 0 && (
        <ul className="divide-y divide-border">
          {invitations.map((invitation) => (
            <li
              key={invitation.id}
              className="flex flex-wrap items-center gap-3 px-5 py-3"
              data-testid="org-invitation"
            >
              <Monogram name={invitation.email} size="md" />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-[0.8125rem] font-medium break-all">
                  {invitation.email}
                  <Badge tone="accent">{t("sharing.status.invited")}</Badge>
                  <Badge>{t(orgRoleKey(org, invitation.role))}</Badge>
                </p>
                <p className="text-xs text-text-muted">
                  {t("sharing.invitations.meta", {
                    time: i18n.relativeTime(invitation.createdAt),
                    date: i18n.date(invitation.expiresAt),
                  })}
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setRevoking(invitation)}>
                <X />
                {t("sharing.invitations.revoke")}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={revoking !== undefined}
        onOpenChange={(open) => !open && setRevoking(undefined)}
        title={t("sharing.invitations.revokeTitle", { email: revoking?.email ?? "" })}
        description={t("sharing.invitations.revokeText")}
        confirmLabel={t("sharing.invitations.revoke")}
        tone="danger"
        onConfirm={() => revoking && void revoke(revoking)}
      />
    </Panel>
  );
}

function VaultsPanel({ org, navigate }: { org: Org; navigate: (route: Route) => void }) {
  const { t } = useI18n();
  const { vaults, items, sharedVaults } = useSnapshot();
  const [sharing, setSharing] = useState<string>();
  const [creating, setCreating] = useState(false);
  const orgVaults = sharedVaults.filter((v) => v.orgId === org.id);

  return (
    <Panel id="vaults" title={t("sharing.vaults.title")} description={t("sharing.vaults.description")}>
      {orgVaults.length === 0 ? (
        <p className="px-5 py-4 text-[0.8125rem] text-text-muted">{t("sharing.vaults.none")}</p>
      ) : (
        <ul className="divide-y divide-border">
          {orgVaults.map((shared) => (
            <VaultRow
              key={shared.vaultId}
              vaultId={shared.vaultId}
              name={displayVaultName(
                vaults.find((v) => v.id === shared.vaultId),
                t,
              )}
              isFamilyVault={shared.vaultId === org.defaultVaultId}
              count={items.filter((i) => i.vaultId === shared.vaultId).length}
              role={shared.role ?? undefined}
              onOpen={() => navigate({ view: "items", filter: { kind: "vault", vaultId: shared.vaultId } })}
              onShare={() => setSharing(shared.vaultId)}
            />
          ))}
        </ul>
      )}
      {isOrgAdmin(org) && (
        <div className="px-5 py-3">
          <Button size="sm" variant="secondary" onClick={() => setCreating(true)}>
            <Plus />
            {t("sharing.vaults.new")}
          </Button>
        </div>
      )}
      <VaultSharingDialog vaultId={sharing} onOpenChange={(open) => !open && setSharing(undefined)} />
      <NewSharedVaultDialog
        org={org}
        open={creating}
        onOpenChange={setCreating}
        onCreated={(vaultId) => setSharing(vaultId)}
      />
    </Panel>
  );
}

function VaultRow({
  vaultId,
  name,
  isFamilyVault,
  count,
  role,
  onOpen,
  onShare,
}: {
  vaultId: string;
  name: string;
  isFamilyVault: boolean;
  count: number;
  role: string | undefined;
  onOpen: () => void;
  onShare: () => void;
}) {
  const { t } = useI18n();
  const audience = useAudience(vaultId);
  return (
    <li className="flex flex-wrap items-center gap-3 px-5 py-3">
      <span className="flex size-9 items-center justify-center rounded-lg bg-surface-sunken text-text-muted">
        <VaultIcon className="size-4" aria-hidden="true" />
      </span>
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <span className="flex flex-wrap items-center gap-2 text-[0.8125rem] font-medium hover:text-accent">
          {name}
          {isFamilyVault && name !== t("sharing.familyVault") && (
            <Badge tone="accent">{t("sharing.vaults.familyVault")}</Badge>
          )}
          {role && <Badge>{t(vaultRoleKey(role))}</Badge>}
        </span>
        <span className="flex items-center gap-1 text-xs text-text-muted">
          <Users className="size-3.5" aria-hidden="true" />
          {t("sharing.vaults.meta", { audience: audience.label, count })}
        </span>
      </button>
      <Button size="sm" variant="secondary" onClick={onShare}>
        <Share2 />
        {role === "manage" ? t("sharing.vaults.share") : t("sharing.vaults.whoHasAccess")}
      </Button>
    </li>
  );
}

export function NewSharedVaultDialog({
  org,
  open,
  onOpenChange,
  onCreated,
}: {
  org: Org;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (vaultId: string) => void;
}) {
  const client = useClient();
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (open) {
      setName("");
      setError(undefined);
    }
  }, [open]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      const id = await client.createSharedVault(org.id, name.trim());
      toast.success(t("sharing.vaults.created", { name: name.trim() }));
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
      open={open}
      onOpenChange={onOpenChange}
      title={t("sharing.vaults.new")}
      description={t("sharing.vaults.newText", { name: orgName(org, t) })}
      size="sm"
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Input
          label={t("vault.name")}
          value={name}
          maxLength={80}
          placeholder={
            org.kind === "family" ? t("sharing.vaults.placeholderFamily") : t("sharing.vaults.placeholderTeam")
          }
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <FormError message={error} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t("action.cancel")}
          </Button>
          <Button type="submit" loading={busy} disabled={!name.trim()}>
            {t("vault.create")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
