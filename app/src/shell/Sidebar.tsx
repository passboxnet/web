import type { ItemCategory, VaultHealth } from "@passbox/client";
import {
  Badge,
  Button,
  cn,
  Logo,
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
  Monogram,
  Tooltip,
} from "@passbox/ui";
import {
  Building2,
  ChevronsUpDown,
  Layers,
  ListChecks,
  Lock,
  LogOut,
  type LucideIcon,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  ShieldEllipsis,
  Star,
  Trash2,
  Users,
  Vault as VaultIcon,
  Wand2,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { SignOutDialog } from "../auth/SignOutDialog";
import { shortcut, useI18n } from "../lib/i18n";
import { useIsInstanceAdmin } from "../lib/instance";
import { CATEGORY_META, CREATABLE } from "../lib/items";
import type { ItemFilter, Route } from "../lib/route";
import { awaitingConfirmation, isOrgAdmin } from "../lib/sharing";
import { orgName } from "../sharing/common";
import { useClient, useSnapshot } from "../useClient";
import { useChecklist } from "../views/GettingStarted";
import { NewVaultDialog } from "../views/NewVaultDialog";
import type { SyncState } from "./useSyncStatus";

interface SidebarProps {
  route: Route;
  navigate: (route: Route) => void;
  health: VaultHealth;
  syncState: SyncState;
  onSync: () => void;
  onOpenPalette: () => void;
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

export function Sidebar({ route, navigate, health, syncState, onSync, onOpenPalette }: SidebarProps) {
  const client = useClient();
  const i18n = useI18n();
  const { t } = i18n;
  const { email = "", items, vaults, trash, orgs, sharingWarnings } = useSnapshot();
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

  return (
    <nav
      aria-label={t("shell.mainNavigation")}
      className="flex h-full flex-col border-r border-border bg-surface-raised px-3 pt-3 pb-2"
    >
      <Menu>
        <MenuTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left hover:bg-surface-sunken"
          >
            <Logo withWordmark={false} />
            <span className="min-w-0 flex-1">
              <span className="block text-[0.8125rem] font-semibold">Passbox</span>
              <span className="block truncate text-2xs text-text-muted">{email}</span>
            </span>
            <ChevronsUpDown className="size-4 text-text-muted" aria-hidden="true" />
          </button>
        </MenuTrigger>
        <MenuContent align="start" className="w-60">
          <MenuLabel>
            <span className="flex items-center gap-2">
              <Monogram name={email} size="sm" />
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

      <div className="mt-3 flex gap-2">
        <Menu>
          <MenuTrigger asChild>
            <Button className="flex-1">
              <Plus />
              {t("shell.newItem")}
            </Button>
          </MenuTrigger>
          <MenuContent align="start" className="w-52">
            {CREATABLE.map((category) => {
              const { label, icon: Icon } = CATEGORY_META[category];
              return (
                <MenuItem
                  key={category}
                  icon={<Icon />}
                  onSelect={() =>
                    navigate({
                      view: "items",
                      filter: route.view === "items" ? route.filter : { kind: "all" },
                      create: category,
                    })
                  }
                >
                  {t(label)}
                </MenuItem>
              );
            })}
          </MenuContent>
        </Menu>
        <Tooltip content={t("shell.searchShortcut", { shortcut: shortcut(t, "K") })}>
          <Button variant="secondary" size="icon" aria-label={t("shell.search")} onClick={onOpenPalette}>
            <Search />
          </Button>
        </Tooltip>
      </div>

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
                <Badge tone="warning" aria-label={t("shell.affectedLogins", { count: affected })}>
                  {affected}
                </Badge>
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
                <Badge tone="warning" aria-label={t("sharing.nav.warnings", { count: sharingWarnings.length })}>
                  !
                </Badge>
              ) : waiting > 0 ? (
                <Badge tone="accent" aria-label={t("sharing.nav.waiting", { count: waiting })}>
                  {waiting}
                </Badge>
              ) : undefined
            }
          />
          {checklist.visible && (
            <NavItem
              icon={ListChecks}
              label={t("start.nav")}
              active={route.view === "getting-started"}
              onClick={() => navigate({ view: "getting-started" })}
              badge={
                <span className="text-2xs text-text-muted tabular-nums">
                  {t("start.progressShort", { done: checklist.done, total: checklist.total })}
                </span>
              }
            />
          )}
        </NavGroup>

        <NavGroup title={t("shell.categories")}>
          {CREATABLE.map((category) => {
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
              icon={VaultIcon}
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
                  icon={Users}
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
          <NavItem
            icon={Trash2}
            label={t("term.trash")}
            count={trash.length}
            active={route.view === "trash"}
            onClick={() => navigate({ view: "trash" })}
          />
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

      <div className="mt-2 flex items-center justify-between border-t border-border px-1 pt-2">
        <button
          type="button"
          onClick={onSync}
          className="flex items-center gap-2 rounded-md px-1.5 py-1 text-2xs text-text-muted hover:bg-surface-sunken hover:text-text coarse:py-3"
        >
          <span
            aria-hidden="true"
            className={cn(
              "size-1.5 rounded-full",
              syncState.kind === "error" ? "bg-danger" : syncState.kind === "syncing" ? "bg-warning" : "bg-success",
            )}
          />
          {syncState.kind === "syncing"
            ? t("sync.syncing")
            : syncState.kind === "error"
              ? t("sync.offline")
              : t("sync.synced", { time: i18n.relativeTime(syncState.at) })}
          <RefreshCw className={cn("size-3", syncState.kind === "syncing" && "animate-spin")} aria-hidden="true" />
        </button>
        <Tooltip content={t("shell.lockVault")}>
          <Button variant="ghost" size="icon-sm" aria-label={t("shell.lockVault")} onClick={() => client.lock()}>
            <Lock />
          </Button>
        </Tooltip>
      </div>
      <p className="hidden px-2.5 pt-1 text-2xs text-text-muted lg:block coarse:hidden">
        {t("shell.searchHint", { shortcut: shortcut(t, "K") })}
      </p>

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
    <div className="mb-4">
      {title && (
        <div className="flex h-7 items-center justify-between px-2.5">
          <p className="text-2xs font-semibold tracking-wide text-text-muted uppercase">{title}</p>
          {action}
        </div>
      )}
      <ul className="flex flex-col gap-px">{children}</ul>
    </div>
  );
}

interface NavItemProps {
  icon: LucideIcon;
  label: string;
  /** A fuller name for screen readers, for example with the organization. */
  ariaLabel?: string;
  count?: number;
  badge?: ReactNode;
  active?: boolean;
  onClick: () => void;
}

function NavItem({ icon: Icon, label, ariaLabel, count, badge, active, onClick }: NavItemProps) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        title={ariaLabel}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-[0.8125rem] transition-colors coarse:h-11",
          active
            ? "bg-surface font-medium text-text shadow-card ring-1 ring-border"
            : "text-text-muted hover:bg-surface-sunken hover:text-text",
        )}
      >
        <Icon className={cn("size-4", active ? "text-accent" : "text-text-muted")} aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {badge ?? (count !== undefined && <span className="text-2xs tabular-nums text-text-muted">{count}</span>)}
      </button>
    </li>
  );
}
