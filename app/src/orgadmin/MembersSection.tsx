import type { MemberReport, OrgInvitationInfo } from "@passbox/api-client";
import type { Org, OrgMember } from "@passbox/client";
import {
  Badge,
  Button,
  ConfirmDialog,
  Input,
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
  Monogram,
  SegmentedControl,
  toast,
} from "@passbox/ui";
import { Ban, Check, Minus, MoreHorizontal, Search, UserCheck, UserCog, UserMinus, UserPlus, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "../lib/i18n";
import type { Route } from "../lib/route";
import { canManageMember, memberLabel, orgRoleKey } from "../lib/sharing";
import { ConfirmMemberDialog } from "../sharing/ConfirmMemberDialog";
import { MemberStatusBadge, RoleBadge, sharingError, useMyAccountId } from "../sharing/common";
import { InviteDialog } from "../sharing/InviteDialog";
import { RoleDialog, SuspendDialog } from "../sharing/MemberDialogs";
import { useClient } from "../useClient";
import { Cell, Loading, Section, Table } from "./common";
import { OffboardDialog } from "./OffboardDialog";
import type { ReportState } from "./OrgAdminView";

type Filter = "all" | "waiting" | "noTwoFactor" | "suspended";

export function MembersSection({
  org,
  data,
  navigate,
}: {
  org: Org;
  data: ReportState;
  navigate: (route: Route) => void;
}) {
  const i18n = useI18n();
  const { t } = i18n;
  const me = useMyAccountId();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [inviting, setInviting] = useState(false);
  const [invitationsRevision, setInvitationsRevision] = useState(0);
  const [confirming, setConfirming] = useState<OrgMember>();
  const [roleFor, setRoleFor] = useState<OrgMember>();
  const [suspending, setSuspending] = useState<OrgMember>();
  const [offboarding, setOffboarding] = useState<OrgMember>();
  const reports = useMemo(
    () => new Map((data.report?.members ?? []).map((m) => [m.accountId, m] as const)),
    [data.report],
  );

  const order = ["owner", "admin", "member", "guest"];
  const members = [...org.members]
    .filter((m) => {
      const report = reports.get(m.accountId);
      if (filter === "waiting" && m.status !== "accepted") return false;
      if (filter === "suspended" && m.status !== "suspended") return false;
      if (filter === "noTwoFactor" && (m.status !== "confirmed" || report?.twoFactor !== false)) return false;
      const text = query.trim().toLowerCase();
      return !text || (m.email ?? m.accountId).toLowerCase().includes(text);
    })
    .sort(
      (a, b) =>
        Number(b.status === "accepted") - Number(a.status === "accepted") ||
        order.indexOf(a.role) - order.indexOf(b.role) ||
        i18n.compare(a.email ?? "", b.email ?? ""),
    );

  return (
    <Section
      title={t("orgAdmin.section.members")}
      description={t("orgAdmin.members.description")}
      actions={
        <Button onClick={() => setInviting(true)}>
          <UserPlus />
          {t("orgAdmin.members.invite")}
        </Button>
      }
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-full max-w-xs">
          <Input
            label={t("orgAdmin.members.search")}
            hideLabel
            placeholder={t("orgAdmin.members.search")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            leading={<Search className="size-4" aria-hidden="true" />}
          />
        </div>
        <SegmentedControl<Filter>
          label={t("orgAdmin.members.filter")}
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: t("orgAdmin.members.filter.all") },
            { value: "waiting", label: t("orgAdmin.members.filter.waiting") },
            { value: "noTwoFactor", label: t("orgAdmin.members.filter.noTwoFactor") },
            { value: "suspended", label: t("orgAdmin.members.filter.suspended") },
          ]}
        />
      </div>

      {!data.report && <Loading error={data.error} onRetry={data.reload} />}
      <Table
        label={t("orgAdmin.section.members")}
        head={[
          t("orgAdmin.members.col.member"),
          t("orgAdmin.members.col.role"),
          t("orgAdmin.members.col.twoFactor"),
          t("orgAdmin.members.col.recovery"),
          t("orgAdmin.members.col.lastSignIn"),
          t("orgAdmin.members.col.score"),
          <span key="actions" className="sr-only">
            {t("orgAdmin.members.col.actions")}
          </span>,
        ]}
      >
        {members.length === 0 && (
          <tr>
            <Cell colSpan={7} className="text-text-muted">
              {t("orgAdmin.members.none")}
            </Cell>
          </tr>
        )}
        {members.map((member) => (
          <MemberRow
            key={member.accountId}
            org={org}
            member={member}
            report={reports.get(member.accountId)}
            self={member.accountId === me}
            onConfirm={() => setConfirming(member)}
            onRole={() => setRoleFor(member)}
            onSuspend={() => setSuspending(member)}
            onOffboard={() => setOffboarding(member)}
          />
        ))}
      </Table>

      <InvitationsList org={org} revision={invitationsRevision} />

      <InviteDialog
        org={org}
        open={inviting}
        onOpenChange={setInviting}
        onInvited={() => setInvitationsRevision((r) => r + 1)}
      />
      <ConfirmMemberDialog
        org={org}
        member={confirming}
        onOpenChange={(open) => {
          if (!open) {
            setConfirming(undefined);
            data.reload();
          }
        }}
      />
      <RoleDialog org={org} member={roleFor} onOpenChange={(open) => !open && setRoleFor(undefined)} />
      <SuspendDialog org={org} member={suspending} onOpenChange={(open) => !open && setSuspending(undefined)} />
      <OffboardDialog
        org={org}
        member={offboarding}
        report={data.report}
        navigate={navigate}
        onOpenChange={(open) => {
          if (!open) {
            setOffboarding(undefined);
            data.reload();
          }
        }}
      />
    </Section>
  );
}

function YesNo({ value, yes, no }: { value: boolean | undefined; yes: string; no: string }) {
  if (value === undefined) return <Minus className="size-4 text-text-subtle" aria-label="–" />;
  return value ? (
    <span className="inline-flex items-center gap-1 text-success-text">
      <Check className="size-4" aria-hidden="true" />
      <span className="sr-only">{yes}</span>
    </span>
  ) : (
    <Badge tone="warning">{no}</Badge>
  );
}

function MemberRow({
  org,
  member,
  report,
  self,
  onConfirm,
  onRole,
  onSuspend,
  onOffboard,
}: {
  org: Org;
  member: OrgMember;
  report: MemberReport | undefined;
  self: boolean;
  onConfirm: () => void;
  onRole: () => void;
  onSuspend: () => void;
  onOffboard: () => void;
}) {
  const i18n = useI18n();
  const { t } = i18n;
  const me = useMyAccountId();
  const label = memberLabel(member, t("sharing.member"));
  const manageable = canManageMember(org, member, me);
  const canConfirm = member.status === "accepted" && (member.role !== "admin" || org.role === "owner");
  const confirmed = member.status !== "accepted";

  return (
    <tr data-testid="admin-member">
      <Cell>
        <span className="flex min-w-0 items-center gap-3">
          <Monogram name={label} size="sm" />
          <span className="min-w-0">
            <span className="block truncate font-medium" title={label}>
              {self ? t("sharing.you", { name: label }) : label}
            </span>
            <span className="flex flex-wrap items-center gap-1.5">
              <MemberStatusBadge member={member} />
              {report?.joinedAt ? (
                <span className="text-xs text-text-muted">
                  {t("orgAdmin.members.joined", { date: i18n.date(report.joinedAt) })}
                </span>
              ) : null}
            </span>
          </span>
        </span>
      </Cell>
      <Cell>
        <RoleBadge org={org} role={member.role} />
      </Cell>
      <Cell>
        {confirmed ? (
          <YesNo value={report?.twoFactor} yes={t("orgAdmin.members.twoFactorOn")} no={t("orgAdmin.members.off")} />
        ) : null}
      </Cell>
      <Cell>
        {confirmed ? (
          <YesNo
            value={report?.recoveryEnrolled}
            yes={t("orgAdmin.members.enrolled")}
            no={t("orgAdmin.members.notEnrolled")}
          />
        ) : null}
      </Cell>
      <Cell className="whitespace-nowrap text-text-muted">
        {report?.lastSignInAt ? (
          <span title={i18n.dateTime(report.lastSignInAt)}>{i18n.relativeTime(report.lastSignInAt)}</span>
        ) : (
          t("orgAdmin.members.never")
        )}
      </Cell>
      <Cell className="tabular-nums">
        {report?.security ? (
          <span title={t("orgAdmin.members.scoreTitle", { time: i18n.relativeTime(report.security.reportedAt) })}>
            {report.security.score}
          </span>
        ) : (
          <span className="text-text-subtle">–</span>
        )}
      </Cell>
      <Cell className="text-right">
        <span className="flex items-center justify-end gap-1">
          {canConfirm && (
            <Button size="sm" onClick={onConfirm}>
              <UserCheck />
              {t("sharing.confirm.button")}
            </Button>
          )}
          {manageable && (
            <Menu>
              <MenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={t("sharing.members.more", { name: label })}>
                  <MoreHorizontal />
                </Button>
              </MenuTrigger>
              <MenuContent>
                {confirmed && (
                  <MenuItem icon={<UserCog />} onSelect={onRole}>
                    {t("sharing.role.change")}
                  </MenuItem>
                )}
                {confirmed && (
                  <MenuItem icon={<Ban />} onSelect={onSuspend}>
                    {member.status === "suspended" ? t("sharing.suspend.reactivate") : t("sharing.suspend.action")}
                  </MenuItem>
                )}
                <MenuSeparator />
                <MenuItem icon={<UserMinus />} tone="danger" onSelect={onOffboard}>
                  {t("orgAdmin.offboard.menu")}
                </MenuItem>
              </MenuContent>
            </Menu>
          )}
        </span>
      </Cell>
    </tr>
  );
}

function InvitationsList({ org, revision }: { org: Org; revision: number }) {
  const client = useClient();
  const i18n = useI18n();
  const { t } = i18n;
  const [invitations, setInvitations] = useState<OrgInvitationInfo[]>();
  const [error, setError] = useState<string>();
  const [revoking, setRevoking] = useState<OrgInvitationInfo>();
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

  if (!error && (!invitations || invitations.length === 0)) return null;
  return (
    <section aria-labelledby="pending-invitations" className="flex flex-col gap-3">
      <h2 id="pending-invitations" className="text-sm font-semibold">
        {t("sharing.invitations.title")}
      </h2>
      {error && <p className="text-[0.8125rem] text-danger">{error}</p>}
      {invitations && invitations.length > 0 && (
        <ul className="divide-y divide-border rounded-card border border-border bg-surface shadow-card">
          {invitations.map((invitation) => (
            <li key={invitation.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <Monogram name={invitation.email} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-[0.8125rem] font-medium break-all">
                  {invitation.email}
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
    </section>
  );
}
