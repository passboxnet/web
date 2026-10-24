import type { ItemCategory, VaultHealth } from "@passbox/client";
import {
  Badge,
  Button,
  cn,
  Kbd,
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
  ChevronsUpDown,
  Layers,
  Lock,
  LogOut,
  type LucideIcon,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Star,
  Vault as VaultIcon,
  Wand2,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { CATEGORY_META, CREATABLE, relativeTime } from "../lib/items";
import type { ItemFilter, Route } from "../lib/route";
import { useClient, useSnapshot } from "../useClient";
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

export function Sidebar({ route, navigate, health, syncState, onSync, onOpenPalette }: SidebarProps) {
  const client = useClient();
  const { email = "", items, vaults } = useSnapshot();
  const [newVaultOpen, setNewVaultOpen] = useState(false);
  const issues = health.weak.length + health.reused.flat().length + health.insecureUrls.length;
  const goItems = (filter: ItemFilter) => navigate({ view: "items", filter });

  const countCategory = (category: ItemCategory) => items.filter((i) => i.data.category === category).length;

  return (
    <nav aria-label="Main" className="flex h-full flex-col border-r border-border bg-surface-raised px-3 pt-3 pb-2">
      <Menu>
        <MenuTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left hover:bg-surface-sunken"
          >
            <Logo withWordmark={false} />
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-semibold">Passbox</span>
              <span className="block truncate text-2xs text-text-muted">{email}</span>
            </span>
            <ChevronsUpDown className="size-4 text-text-subtle" aria-hidden="true" />
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
            Settings
          </MenuItem>
          <MenuItem icon={<Lock />} onSelect={() => client.lock()}>
            Lock vault
          </MenuItem>
          <MenuSeparator />
          <MenuItem icon={<LogOut />} tone="danger" onSelect={() => client.signOut()}>
            Sign out of this device
          </MenuItem>
        </MenuContent>
      </Menu>

      <div className="mt-3 flex gap-2">
        <Menu>
          <MenuTrigger asChild>
            <Button className="flex-1">
              <Plus />
              New item
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
                  {label}
                </MenuItem>
              );
            })}
          </MenuContent>
        </Menu>
        <Tooltip content={<span>Search and commands · ⌘K</span>}>
          <Button variant="secondary" size="icon" aria-label="Search and commands" onClick={onOpenPalette}>
            <Search />
          </Button>
        </Tooltip>
      </div>

      <div className="-mx-1 mt-4 flex-1 overflow-y-auto px-1">
        <NavGroup>
          <NavItem
            icon={Layers}
            label="All items"
            count={items.length}
            active={sameFilter(route, { kind: "all" })}
            onClick={() => goItems({ kind: "all" })}
          />
          <NavItem
            icon={Star}
            label="Favorites"
            count={items.filter((i) => i.data.favorite).length}
            active={sameFilter(route, { kind: "favorites" })}
            onClick={() => goItems({ kind: "favorites" })}
          />
          <NavItem
            icon={ShieldCheck}
            label="Watchtower"
            active={route.view === "watchtower"}
            onClick={() => navigate({ view: "watchtower" })}
            badge={issues > 0 ? <Badge tone="warning">{issues}</Badge> : undefined}
          />
        </NavGroup>

        <NavGroup title="Categories">
          {CREATABLE.map((category) => {
            const { plural, icon } = CATEGORY_META[category];
            return (
              <NavItem
                key={category}
                icon={icon}
                label={plural}
                count={countCategory(category)}
                active={sameFilter(route, { kind: "category", category })}
                onClick={() => goItems({ kind: "category", category })}
              />
            );
          })}
        </NavGroup>

        <NavGroup
          title="Vaults"
          action={
            <Tooltip content="New vault">
              <Button variant="ghost" size="icon-sm" aria-label="New vault" onClick={() => setNewVaultOpen(true)}>
                <Plus />
              </Button>
            </Tooltip>
          }
        >
          {vaults.map((vault) => (
            <NavItem
              key={vault.id}
              icon={VaultIcon}
              label={vault.name}
              count={items.filter((i) => i.vaultId === vault.id).length}
              active={sameFilter(route, { kind: "vault", vaultId: vault.id })}
              onClick={() => goItems({ kind: "vault", vaultId: vault.id })}
            />
          ))}
        </NavGroup>

        <NavGroup title="Tools">
          <NavItem
            icon={Wand2}
            label="Password generator"
            active={route.view === "generator"}
            onClick={() => navigate({ view: "generator" })}
          />
          <NavItem
            icon={Settings}
            label="Settings"
            active={route.view === "settings"}
            onClick={() => navigate({ view: "settings" })}
          />
        </NavGroup>
      </div>

      <div className="mt-2 flex items-center justify-between border-t border-border px-1 pt-2">
        <button
          type="button"
          onClick={onSync}
          className="flex items-center gap-2 rounded-md px-1.5 py-1 text-2xs text-text-muted hover:bg-surface-sunken hover:text-text"
        >
          <span
            aria-hidden="true"
            className={cn(
              "size-1.5 rounded-full",
              syncState.kind === "error" ? "bg-danger" : syncState.kind === "syncing" ? "bg-warning" : "bg-success",
            )}
          />
          {syncState.kind === "syncing"
            ? "Syncing…"
            : syncState.kind === "error"
              ? "Offline · retry"
              : `Synced ${relativeTime(syncState.at)}`}
          <RefreshCw className={cn("size-3", syncState.kind === "syncing" && "animate-spin")} aria-hidden="true" />
        </button>
        <Tooltip content="Lock vault">
          <Button variant="ghost" size="icon-sm" aria-label="Lock vault" onClick={() => client.lock()}>
            <Lock />
          </Button>
        </Tooltip>
      </div>
      <p className="hidden px-2.5 pt-1 text-2xs text-text-subtle lg:block">
        <Kbd>⌘</Kbd> <Kbd>K</Kbd> to search
      </p>

      <NewVaultDialog
        open={newVaultOpen}
        onOpenChange={setNewVaultOpen}
        onCreated={(vaultId) => goItems({ kind: "vault", vaultId })}
      />
    </nav>
  );
}

function NavGroup({ title, action, children }: { title?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="mb-4">
      {title && (
        <div className="flex h-7 items-center justify-between px-2.5">
          <p className="text-2xs font-semibold tracking-wide text-text-subtle uppercase">{title}</p>
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
  count?: number;
  badge?: ReactNode;
  active?: boolean;
  onClick: () => void;
}

function NavItem({ icon: Icon, label, count, badge, active, onClick }: NavItemProps) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-[13px] transition-colors",
          active
            ? "bg-surface font-medium text-text shadow-card ring-1 ring-border"
            : "text-text-muted hover:bg-surface-sunken hover:text-text",
        )}
      >
        <Icon className={cn("size-4", active ? "text-accent" : "text-text-subtle")} aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {badge ?? (count !== undefined && <span className="text-2xs tabular-nums text-text-subtle">{count}</span>)}
      </button>
    </li>
  );
}
