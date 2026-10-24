import type { Vault } from "@passbox/client";
import { cn, Logo } from "@passbox/ui";
import { KeyRound, Layers, Lock, type LucideIcon, Star, Vault as VaultIcon, Wand2 } from "lucide-react";

export type Section = { kind: "all" } | { kind: "favorites" } | { kind: "vault"; id: string } | { kind: "generator" };

interface SidebarProps {
  section: Section;
  vaults: Vault[];
  onSelect: (section: Section) => void;
  onLock: () => void;
}

export function Sidebar({ section, vaults, onSelect, onLock }: SidebarProps) {
  const isActive = (s: Section) =>
    s.kind === "vault" ? section.kind === "vault" && section.id === s.id : s.kind === section.kind;

  return (
    <nav
      aria-label="Vault navigation"
      className="flex w-60 shrink-0 flex-col gap-6 border-r border-border bg-surface px-3 py-4 max-md:hidden"
    >
      <Logo className="px-2 text-text" />
      <div className="flex flex-col gap-0.5">
        <NavItem
          icon={Layers}
          label="All items"
          active={isActive({ kind: "all" })}
          onClick={() => onSelect({ kind: "all" })}
        />
        <NavItem
          icon={Star}
          label="Favorites"
          active={isActive({ kind: "favorites" })}
          onClick={() => onSelect({ kind: "favorites" })}
        />
      </div>
      <div className="flex flex-col gap-0.5">
        <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">Vaults</p>
        {vaults.map((vault) => (
          <NavItem
            key={vault.id}
            icon={VaultIcon}
            label={vault.name}
            active={isActive({ kind: "vault", id: vault.id })}
            onClick={() => onSelect({ kind: "vault", id: vault.id })}
          />
        ))}
      </div>
      <div className="flex flex-col gap-0.5">
        <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">Tools</p>
        <NavItem
          icon={Wand2}
          label="Password generator"
          active={isActive({ kind: "generator" })}
          onClick={() => onSelect({ kind: "generator" })}
        />
        <NavItem icon={KeyRound} label="Watchtower" disabled />
      </div>
      <div className="mt-auto">
        <NavItem icon={Lock} label="Lock" onClick={onLock} />
      </div>
    </nav>
  );
}

interface NavItemProps {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

function NavItem({ icon: Icon, label, active, disabled, onClick }: NavItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-9 items-center gap-2.5 rounded-lg px-2 text-left text-sm transition",
        active ? "bg-accent/10 font-medium text-accent" : "text-text-muted hover:bg-surface-raised hover:text-text",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <Icon className="size-4" aria-hidden="true" />
      <span className="truncate">{label}</span>
      {disabled && <span className="ml-auto text-[10px] uppercase">soon</span>}
    </button>
  );
}
