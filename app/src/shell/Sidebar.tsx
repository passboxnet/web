import type { ItemCategory, VaultHealth } from "@passbox/client";
import {
  Avatar,
  Badge,
  Button,
  cn,
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
  sidebarItemClassName,
  type TagColor,
  Tooltip,
  tagDotClassName,
} from "@passbox/ui";
import {
  Archive,
  Building2,
  ChevronsUpDown,
  Code2,
  Layers,
  ListChecks,
  Lock,
  LogOut,
  type LucideIcon,
  Plus,
  RefreshCw,
  Settings,
  ShieldCheck,
  ShieldEllipsis,
  Star,
  Trash2,
  Users,
  Wand2,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { SignOutDialog } from "../auth/SignOutDialog";
import { usePendingAgentRequests } from "../developer/agentRequests";
import { useI18n } from "../lib/i18n";
import { useIsInstanceAdmin } from "../lib/instance";
import { ALWAYS_LISTED, CATEGORY_META, CREATABLE } from "../lib/items";
import type { ItemFilter, Route } from "../lib/route";
import { awaitingConfirmation, isOrgAdmin } from "../lib/sharing";
import { vaultColor } from "../lib/vaultColor";
import { orgName } from "../sharing/common";
import { useClient, useSnapshot } from "../useClient";
import { useChecklist } from "../views/GettingStarted";
import { NewVaultDialog } from "../views/NewVaultDialog";
import { NewItemMenu } from "./NewItemMenu";
import type { SyncState } from "./useSyncStatus";

interface SidebarProps {
  route: Route;
  navigate: (route: Route) => void;
  health: VaultHealth;
  syncState: SyncState;
  onSync: () => void;
}

function sameFilter(route: Route, filter: ItemFilter): boolean {
  if (route.view !== "items") return false;
  const current = route.filter;
  if (current.kind !== filter.kind) return false;
  if (current.kind === "category" && filter.kind === "category") return current.category === filter.category;
  if (current.kind === "vault" && filter.kind === "vault") return current.vaultId === filter.vaultId;
  return true;
}

/** Logins with at least one problem; one login counts once, however many problems it has. */
export function affectedLogins(health: VaultHealth): number {
  return new Set([...health.weak, ...health.reused.flat(), ...health.insecureUrls]).size;
}

/**
 * The vault sidebar (desktop window and web): the account card, the main
 * sections with counts, categories, vaults with colored dots, tools, and the
 * full-width "Neuer Eintrag" pill at the bottom.
 */
export function Sidebar({ route, navigate, health, syncState, onSync }: SidebarProps) {
  const client = useClient();
  const i18n = useI18n();
  const { t } = i18n;
  const { email = "", items, vaults, trash, archive, orgs, sharingWarnings } = useSnapshot();
  const checklist = useChecklist();
  const isAdmin = useIsInstanceAdmin(client);
  const [newVaultOpen, setNewVaultOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const affected = affectedLogins(health);
  const goItems = (filter: ItemFilter) => navigate({ view: "items", filter });

  const countCategory = (category: ItemCategory) => items.filter((i) => i.data.category === category).length;
  const personalVaults = vaults.filter((v) => !v.orgId);
  // Admins see how many people wait for them; everyone sees sharing problems.
  const waiting = orgs.reduce((sum, org) => sum + (isOrgAdmin(org) ? awaitingConfirmation(org).length : 0), 0);
  const sharingActive = route.view === "sharing" || route.view === "org";
  const adminOrgs = orgs.filter(isOrgAdmin);
  const caption = orgs[0] ? orgName(orgs[0], t) : t("shell.account.personal");

  return (
    <nav
      aria-label={t("shell.mainNavigation")}
      className="flex h-full flex-col border-r border-hairline bg-surface/70 px-3 pt-3 pb-3 backdrop-blur-2xl"
    >
      <Menu>
        <MenuTrigger asChild>
          <button
            type="button"
            aria-label={t("shell.accountMenu", { email })}
            className="flex w-full items-center gap-3 rounded-control p-2 text-left transition-colors hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus"
          >
            <Avatar name={email} tone="signature" size="lg" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-label text-text" title={email}>
                {email}
              </span>
              <span className="block truncate text-caption text-text-muted">{caption}</span>
            </span>
            <ChevronsUpDown className="size-4 shrink-0 text-text-subtle" aria-hidden="true" />
          </button>
        </MenuTrigger>
        <MenuContent align="start" className="w-64">
          <MenuLabel>
            <span className="flex items-center gap-2">
              <Avatar name={email} size="xs" tone="signature" />
              <span className="truncate">{email}</span>
            </span>
          </MenuLabel>
          <MenuSeparator />
          <MenuItem icon={<Settings />} onSelect={() => navigate({ view: "settings" })}>
            {t("term.settings")}
          </MenuItem>
          <MenuItem icon={<Lock />} onSelect={() => client.lock()}>
            {t("shell.lockVault")}
          </MenuItem>
          <MenuSeparator />
          <MenuItem icon={<LogOut />} tone="danger" onSelect={() => setSignOutOpen(true)}>
            {t("shell.signOutDevice")}
          </MenuItem>
        </MenuContent>
      </Menu>

      <div className="-mx-1 mt-4 flex-1 overflow-y-auto px-1">
        <NavGroup>
          <NavItem
            icon={Layers}
            label={t("term.allItems")}
            count={items.length}
            active={sameFilter(route, { kind: "all" })}
            onClick={() => goItems({ kind: "all" })}
          />
          <NavItem
            icon={Star}
            label={t("term.favorites")}
            count={items.filter((i) => i.data.favorite).length}
            active={sameFilter(route, { kind: "favorites" })}
            onClick={() => goItems({ kind: "favorites" })}
          />
          <NavItem
            icon={ShieldCheck}
            label={t("term.watchtower")}
            active={route.view === "watchtower"}
            onClick={() => navigate({ view: "watchtower" })}
            badge={
              affected > 0 ? (
                <CountBadge tone="warning" label={t("shell.affectedLogins", { count: affected })}>
                  {affected}
                </CountBadge>
              ) : undefined
            }
          />
          <NavItem
            icon={Users}
            label={t("sharing.nav")}
            active={sharingActive}
            onClick={() => navigate({ view: "sharing" })}
            badge={
              sharingWarnings.length > 0 ? (
                <CountBadge tone="warning" label={t("sharing.nav.warnings", { count: sharingWarnings.length })}>
                  !
                </CountBadge>
              ) : waiting > 0 ? (
                <CountBadge tone="accent" label={t("sharing.nav.waiting", { count: waiting })}>
                  {waiting}
                </CountBadge>
              ) : undefined
            }
          />
          <NavItem
            icon={Trash2}
            label={t("term.trash")}
            count={trash.length}
            active={route.view === "trash"}
            onClick={() => navigate({ view: "trash" })}
          />
          {checklist.visible && (
            <NavItem
              icon={ListChecks}
              label={t("start.nav")}
              active={route.view === "getting-started"}
              onClick={() => navigate({ view: "getting-started" })}
              badge={
                <span className="text-caption text-text-subtle tabular-nums">
                  {t("start.progressShort", { done: checklist.done, total: checklist.total })}
                </span>
              }
            />
          )}
        </NavGroup>

        <NavGroup title={t("shell.categories")}>
          {CREATABLE.filter(
            (category) =>
              ALWAYS_LISTED.includes(category) ||
              countCategory(category) > 0 ||
              sameFilter(route, { kind: "category", category }),
          ).map((category) => {
            const { plural, icon } = CATEGORY_META[category];
            return (
              <NavItem
                key={category}
                icon={icon}
                label={t(plural)}
                count={countCategory(category)}
                active={sameFilter(route, { kind: "category", category })}
                onClick={() => goItems({ kind: "category", category })}
              />
            );
          })}
        </NavGroup>

        <NavGroup
          title={t("term.vaults")}
          action={
            <Tooltip content={t("vault.new")}>
              <Button variant="ghost" size="icon-sm" aria-label={t("vault.new")} onClick={() => setNewVaultOpen(true)}>
                <Plus />
              </Button>
            </Tooltip>
          }
        >
          {personalVaults.map((vault) => (
            <NavItem
              key={vault.id}
              dot={vaultColor(vault)}
              label={vaultName(vault.name, t)}
              count={items.filter((i) => i.vaultId === vault.id).length}
              active={sameFilter(route, { kind: "vault", vaultId: vault.id })}
              onClick={() => goItems({ kind: "vault", vaultId: vault.id })}
            />
          ))}
        </NavGroup>

        {orgs.map((org) => {
          const orgVaults = vaults.filter((v) => v.orgId === org.id);
          if (orgVaults.length === 0) return null;
          return (
            <NavGroup key={org.id} title={orgName(org, t)}>
              {orgVaults.map((vault) => (
                <NavItem
                  key={vault.id}
                  dot={vaultColor(vault)}
                  label={vaultName(vault.name, t)}
                  ariaLabel={t("sharing.nav.sharedVault", { vault: vaultName(vault.name, t), org: orgName(org, t) })}
                  count={items.filter((i) => i.vaultId === vault.id).length}
                  active={sameFilter(route, { kind: "vault", vaultId: vault.id })}
                  onClick={() => goItems({ kind: "vault", vaultId: vault.id })}
                />
              ))}
            </NavGroup>
          );
        })}

        <NavGroup title={t("shell.tools")}>
          <NavItem
            icon={Wand2}
            label={t("term.generator")}
            active={route.view === "generator"}
            onClick={() => navigate({ view: "generator" })}
          />
          {archive.length > 0 || route.view === "archive" ? (
            <NavItem
              icon={Archive}
              label={t("archive.title")}
              count={archive.length}
              active={route.view === "archive"}
              onClick={() => navigate({ view: "archive" })}
            />
          ) : null}
          <DeveloperNavItem active={route.view === "developer"} onClick={() => navigate({ view: "developer" })} />
          <NavItem
            icon={Settings}
            label={t("term.settings")}
            active={route.view === "settings"}
            onClick={() => navigate({ view: "settings" })}
          />
          {isAdmin && (
            <NavItem
              icon={ShieldEllipsis}
              label={t("admin.title")}
              active={route.view === "admin"}
              onClick={() => navigate({ view: "admin" })}
            />
          )}
          {adminOrgs.length > 0 && (
            <NavItem
              icon={Building2}
              label={t("orgAdmin.title")}
              active={route.view === "org-admin"}
              onClick={() => {
                // The organization on screen, else the first one this account administers.
                const current = route.view === "org" ? adminOrgs.find((o) => o.id === route.orgId) : undefined;
                navigate({ view: "org-admin", orgId: (current ?? adminOrgs[0])?.id ?? "" });
              }}
            />
          )}
        </NavGroup>
      </div>

      <div className="mt-2 flex items-center justify-between gap-1 border-t border-hairline px-1 pt-2">
        <button
          type="button"
          onClick={onSync}
          className="flex min-w-0 items-center gap-2 rounded-lg px-1.5 py-1 text-caption text-text-subtle transition-colors hover:bg-surface-raised hover:text-text coarse:py-3"
        >
          <span
            aria-hidden="true"
            className={cn(
              "size-1.5 shrink-0 rounded-full",
              syncState.kind === "error" ? "bg-danger" : syncState.kind === "syncing" ? "bg-warning" : "bg-success",
            )}
          />
          <span className="truncate">
            {syncState.kind === "syncing"
              ? t("sync.syncing")
              : syncState.kind === "error"
                ? t("sync.offline")
                : t("sync.synced", { time: i18n.relativeTime(syncState.at) })}
          </span>
          <RefreshCw
            className={cn("size-3 shrink-0", syncState.kind === "syncing" && "animate-spin")}
            aria-hidden="true"
          />
        </button>
        <Tooltip content={t("shell.lockVault")}>
          <Button variant="ghost" size="icon-sm" aria-label={t("shell.lockVault")} onClick={() => client.lock()}>
            <Lock />
          </Button>
        </Tooltip>
      </div>

      <NewItemMenu
        side="top"
        onCreate={(category) =>
          navigate({
            view: "items",
            filter: route.view === "items" ? route.filter : { kind: "all" },
            create: category,
          })
        }
      >
        <Button shape="pill" size="lg" className="mt-2 w-full">
          {t("shell.newItem")}
          <Plus />
        </Button>
      </NewItemMenu>

      <NewVaultDialog
        open={newVaultOpen}
        onOpenChange={setNewVaultOpen}
        onCreated={(vaultId) => goItems({ kind: "vault", vaultId })}
      />
      <SignOutDialog open={signOutOpen} onOpenChange={setSignOutOpen} />
    </nav>
  );
}

/** The default vault is called "Private" on the server; show it in the user's language. */
export function vaultName(name: string, t: (key: string) => string): string {
  return name === "Private" ? t("vault.private") : name;
}

function NavGroup({ title, action, children }: { title?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="mb-5">
      {title && (
        <div className="flex h-7 items-center justify-between pr-1 pl-3">
          <p className="truncate text-overline text-text-subtle uppercase">{title}</p>
          {action}
        </div>
      )}
      <ul className="flex flex-col gap-0.5">{children}</ul>
    </div>
  );
}

function CountBadge({ tone, label, children }: { tone: "warning" | "accent"; label: string; children: ReactNode }) {
  return (
    <Badge tone={tone} variant="solid" aria-label={label} className="min-w-5 justify-center px-1.5">
      {children}
    </Badge>
  );
}

interface NavItemProps {
  icon?: LucideIcon;
  /** A colored dot instead of an icon (vaults). */
  dot?: TagColor;
  label: string;
  /** A fuller name for screen readers, for example with the organization. */
  ariaLabel?: string;
  count?: number;
  badge?: ReactNode;
  active?: boolean;
  onClick: () => void;
}

function NavItem({ icon: Icon, dot, label, ariaLabel, count, badge, active = false, onClick }: NavItemProps) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        title={ariaLabel}
        aria-current={active ? "page" : undefined}
        className={sidebarItemClassName({ active, className: active ? "shadow-highlight" : undefined })}
      >
        {Icon && <Icon className={active ? "text-accent" : "text-text-subtle"} aria-hidden="true" />}
        {dot && (
          <span aria-hidden="true" className="flex size-4 shrink-0 items-center justify-center">
            <span className={cn("size-2 rounded-full", tagDotClassName[dot])} />
          </span>
        )}
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {badge ?? (count !== undefined && <span className="text-caption text-text-subtle tabular-nums">{count}</span>)}
      </button>
    </li>
  );
}

/** Developer tools; shows how many AI agent requests wait for an answer. */
function DeveloperNavItem({ active, onClick }: { active: boolean; onClick: () => void }) {
  const { t } = useI18n();
  const pending = usePendingAgentRequests().length;
  return (
    <NavItem
      icon={Code2}
      label={t("developer.title")}
      {...(pending > 0 ? { ariaLabel: t("developer.navPending", { count: pending }), count: pending } : {})}
      active={active}
      onClick={onClick}
    />
  );
}
