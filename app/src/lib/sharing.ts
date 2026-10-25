/**
 * Helpers for families, teams and shared vaults: who may do what, who can
 * see a vault, invitation links and sharing warnings. Verification happens in
 * the core; this file only interprets the verified state for the UI.
 */
import {
  type Org,
  type OrgMember,
  parseInvitationLink,
  type SharedVault,
  type SharingWarning,
  type Vault,
  type VaultRole,
} from "@passbox/client";
import { useSyncExternalStore } from "react";

export type AssignableOrgRole = "admin" | "member" | "guest";
export const ASSIGNABLE_ROLES: AssignableOrgRole[] = ["admin", "member", "guest"];
export const VAULT_ROLES: VaultRole[] = ["view", "edit", "manage"];

/** Owners and admins (confirmed) administer an organization. */
export function isOrgAdmin(org: Org): boolean {
  return (org.role === "owner" || org.role === "admin") && org.status === "confirmed";
}

/**
 * Whether this account is a guest of the vault's organization (B8): guests
 * open, copy and fill items of the vaults shared with them and change
 * nothing (no items, vaults, share links, attachments or invitations). The
 * server enforces it (403 `guest_view_only`); the UI hides what it refuses.
 */
export function isGuestVault(vault: Pick<Vault, "orgId"> | undefined, orgs: Pick<Org, "id" | "role">[]): boolean {
  return !!vault?.orgId && orgs.some((o) => o.id === vault.orgId && o.role === "guest");
}

/** Whether `me` may change `member` (role, suspend, remove). Only the owner manages admins. */
export function canManageMember(org: Org, member: OrgMember, me: string | undefined): boolean {
  if (!isOrgAdmin(org) || member.accountId === me || member.role === "owner") return false;
  if (member.role === "admin") return org.role === "owner";
  return true;
}

/** Roles `org`'s current account may give to someone (only the owner appoints admins). */
export function assignableRoles(org: Org): AssignableOrgRole[] {
  return org.role === "owner" ? ASSIGNABLE_ROLES : ASSIGNABLE_ROLES.filter((role) => role !== "admin");
}

/** Message key for a role, with family wording ("Organizer") where it fits. */
export function orgRoleKey(org: Pick<Org, "kind">, role: string): string {
  const known = ["owner", "admin", "member", "guest"].includes(role) ? role : "member";
  return `sharing.role.${org.kind === "family" ? "family" : "team"}.${known}`;
}

export function vaultRoleKey(role: string | null | undefined): string {
  return `sharing.vaultRole.${role === "view" || role === "manage" ? role : "edit"}`;
}

/** A member's address, or a short form of the account ID when the server does not show it. */
export function memberLabel(member: Pick<OrgMember, "email" | "accountId"> | undefined, fallback: string): string {
  if (!member) return fallback;
  return member.email || `${fallback} ${member.accountId.slice(0, 6)}`;
}

/** Members waiting for an admin to confirm them. */
export function awaitingConfirmation(org: Org): OrgMember[] {
  return org.members.filter((m) => m.status === "accepted");
}

/** Accounts that can open a shared vault: direct members plus members of groups it is shared with. */
export function vaultAudience(vault: SharedVault, org: Org | undefined): Set<string> {
  const accounts = new Set<string>();
  for (const member of vault.members) {
    if (member.principalType === "group") {
      const group = org?.groups.find((g) => g.id === member.principalId);
      for (const id of group?.members ?? []) accounts.add(id);
    } else {
      accounts.add(member.principalId);
    }
  }
  return accounts;
}

/** Whether every confirmed member of the organization can see the vault ("Family (4)"). */
export function sharedWithEveryone(audience: Set<string>, org: Org | undefined): boolean {
  if (!org) return false;
  const confirmed = org.members.filter((m) => m.status === "confirmed");
  return confirmed.length > 0 && confirmed.every((m) => audience.has(m.accountId));
}

/** Vaults this account may write to (personal ones and shared ones with edit or manage). */
export function writableVaults(vaults: Vault[]): Vault[] {
  return vaults.filter((v) => !v.orgId || v.role === "edit" || v.role === "manage");
}

/** The vault new items go to by default: the personal "Private" vault, else the first writable one. */
export function defaultVault(vaults: Vault[]): Vault | undefined {
  const personal = vaults.filter((v) => !v.orgId);
  return personal.find((v) => v.name === "Private") ?? personal[0] ?? writableVaults(vaults)[0];
}

/** Splits a fingerprint ("12345 67890 …") into its groups of digits. */
export function fingerprintGroups(fingerprint: string): string[] {
  return fingerprint.split(/\s+/).filter(Boolean);
}

export type WarningCategory = "keyChanged" | "ownKey" | "integrity" | "mismatch";

/** How the UI explains a warning: a changed key the user can check, or data Passbox refused. */
export function warningCategory(warning: Pick<SharingWarning, "kind">): WarningCategory {
  switch (warning.kind) {
    case "key_changed":
      return "keyChanged";
    case "own_key_changed":
      return "ownKey";
    case "role_mismatch":
    case "membership_mismatch":
      return "mismatch";
    default:
      return "integrity";
  }
}

/** Warnings worth a banner, most important first; duplicates (same kind and subject) once. */
export function bannerWarnings(warnings: SharingWarning[]): SharingWarning[] {
  const order: WarningCategory[] = ["ownKey", "keyChanged", "integrity", "mismatch"];
  const seen = new Set<string>();
  return warnings
    .filter((w) => {
      const key = `${w.kind}:${w.subjectId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => order.indexOf(warningCategory(a)) - order.indexOf(warningCategory(b)));
}

// --- Invitation links ------------------------------------------------------------
//
// The server mails `{public url}/invite/{token}#org={root}`. It serves the web
// app for that path; the app keeps the link for this tab (sessionStorage) and
// returns to `#/`, so it survives sign-up, the Emergency Kit and a reload.
// Instance invitations (`#/?invite=`) are a different thing and keep working.

const ORG_INVITE_KEY = "passbox.orgInvite";
const TOKEN = /^[A-Za-z0-9_-]{16,128}$/;
const ROOT = /^[A-Za-z0-9_-]{1,128}$/;

export interface OrgInviteLink {
  token: string;
  orgRoot: string | undefined;
  /** The link in the form `PassboxClient.acceptInvitation` takes. */
  link: string;
}

/** Reads an invitation link (or a pasted one); `undefined` if it is not one. */
export function parseOrgInvite(input: string): OrgInviteLink | undefined {
  const text = input.trim();
  if (!text.includes("/invite/")) return undefined;
  const { token, orgRoot } = parseInvitationLink(text);
  if (!TOKEN.test(token) || (orgRoot !== undefined && !ROOT.test(orgRoot))) return undefined;
  return { token, orgRoot, link: `/invite/${token}${orgRoot ? `#org=${orgRoot}` : ""}` };
}

/** An invitation in the address (`/invite/{token}#org=…`). */
export function orgInviteFromLocation(pathname: string, hash: string): OrgInviteLink | undefined {
  if (!/^\/invite\/[^/]+\/?$/.test(pathname)) return undefined;
  return parseOrgInvite(`${pathname}${hash}`);
}

const listeners = new Set<() => void>();

function storage(): Storage | undefined {
  try {
    return window.sessionStorage;
  } catch {
    return undefined;
  }
}

/**
 * Keeps an invitation from the address bar and replaces the address with the
 * app's start page. Call once before rendering.
 */
export function captureOrgInvite(location: Location = window.location, history: History = window.history) {
  const invite = orgInviteFromLocation(location.pathname, location.hash);
  if (!invite) return;
  storage()?.setItem(ORG_INVITE_KEY, invite.link);
  history.replaceState(null, "", "/#/");
}

export function pendingOrgInvite(): OrgInviteLink | undefined {
  const link = storage()?.getItem(ORG_INVITE_KEY);
  return link ? parseOrgInvite(link) : undefined;
}

export function setPendingOrgInvite(invite: OrgInviteLink | undefined) {
  if (invite) storage()?.setItem(ORG_INVITE_KEY, invite.link);
  else storage()?.removeItem(ORG_INVITE_KEY);
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The invitation waiting for this tab, as a link string (stable for React). */
export function useOrgInvite(): OrgInviteLink | undefined {
  const link = useSyncExternalStore(subscribe, () => storage()?.getItem(ORG_INVITE_KEY) ?? null);
  return link ? parseOrgInvite(link) : undefined;
}
