import { Kbd, Monogram } from "@passbox/ui";
import * as RadixDialog from "@radix-ui/react-dialog";
import { Command } from "cmdk";
import { Lock, Moon, Search, Settings, ShieldCheck, Sun, Wand2 } from "lucide-react";
import type { ReactNode } from "react";
import { CATEGORY_META, CREATABLE, itemSubtitle } from "../lib/items";
import { getPreferences, setPreferences } from "../lib/preferences";
import type { Route } from "../lib/route";
import { useClient, useSnapshot } from "../useClient";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  navigate: (route: Route) => void;
}

export function CommandPalette({ open, onOpenChange, navigate }: CommandPaletteProps) {
  const client = useClient();
  const { items } = useSnapshot();

  const run = (action: () => void) => () => {
    onOpenChange(false);
    action();
  };
  const dark =
    document.documentElement.getAttribute("data-theme") === "dark" ||
    (getPreferences().theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 animate-fade-in bg-black/40 backdrop-blur-[2px]" />
        <RadixDialog.Content className="fixed top-[12vh] left-1/2 z-50 w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 animate-scale-in overflow-hidden rounded-card border border-border bg-surface shadow-overlay focus:outline-none">
          <RadixDialog.Title className="sr-only">Search and commands</RadixDialog.Title>
          <RadixDialog.Description className="sr-only">Search items or run a command</RadixDialog.Description>
          <Command label="Search and commands" loop>
            <div className="flex items-center gap-3 border-b border-border px-4">
              <Search className="size-4 text-text-subtle" aria-hidden="true" />
              <Command.Input
                autoFocus
                placeholder="Search items or type a command…"
                className="h-12 flex-1 bg-transparent text-[15px] text-text outline-none placeholder:text-text-subtle"
              />
              <Kbd>Esc</Kbd>
            </div>
            <Command.List className="max-h-[min(60vh,420px)] overflow-y-auto p-2">
              <Command.Empty className="px-3 py-8 text-center text-sm text-text-muted">No results.</Command.Empty>
              {items.length > 0 && (
                <Command.Group heading="Items" className={groupClass}>
                  {items.map((item) => (
                    <PaletteItem
                      key={item.id}
                      value={`${item.data.title} ${itemSubtitle(item)} ${item.id}`}
                      onSelect={run(() => navigate({ view: "items", filter: { kind: "all" }, itemId: item.id }))}
                      icon={<Monogram name={item.data.title} size="sm" />}
                      hint={CATEGORY_META[item.data.category].label}
                    >
                      <span className="truncate">{item.data.title || "Untitled"}</span>
                      <span className="truncate text-text-subtle">{itemSubtitle(item)}</span>
                    </PaletteItem>
                  ))}
                </Command.Group>
              )}
              <Command.Group heading="Create" className={groupClass}>
                {CREATABLE.map((category) => {
                  const { label, icon: Icon } = CATEGORY_META[category];
                  return (
                    <PaletteItem
                      key={category}
                      value={`new ${label}`}
                      onSelect={run(() => navigate({ view: "items", filter: { kind: "all" }, create: category }))}
                      icon={<Icon className="size-4" />}
                    >
                      New {label.toLowerCase()}
                    </PaletteItem>
                  );
                })}
              </Command.Group>
              <Command.Group heading="Go to" className={groupClass}>
                <PaletteItem
                  value="watchtower security"
                  onSelect={run(() => navigate({ view: "watchtower" }))}
                  icon={<ShieldCheck className="size-4" />}
                >
                  Watchtower
                </PaletteItem>
                <PaletteItem
                  value="password generator"
                  onSelect={run(() => navigate({ view: "generator" }))}
                  icon={<Wand2 className="size-4" />}
                >
                  Password generator
                </PaletteItem>
                <PaletteItem
                  value="settings preferences"
                  onSelect={run(() => navigate({ view: "settings" }))}
                  icon={<Settings className="size-4" />}
                >
                  Settings
                </PaletteItem>
              </Command.Group>
              <Command.Group heading="Actions" className={groupClass}>
                <PaletteItem
                  value="toggle theme dark light appearance"
                  onSelect={run(() => setPreferences({ theme: dark ? "light" : "dark" }))}
                  icon={dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
                >
                  Switch to {dark ? "light" : "dark"} theme
                </PaletteItem>
                <PaletteItem value="lock vault" onSelect={run(() => client.lock())} icon={<Lock className="size-4" />}>
                  Lock vault
                </PaletteItem>
              </Command.Group>
            </Command.List>
          </Command>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

const groupClass =
  "[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-2xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-text-subtle [&_[cmdk-group-heading]]:uppercase";

interface PaletteItemProps {
  value: string;
  onSelect: () => void;
  icon: ReactNode;
  hint?: string;
  children: ReactNode;
}

function PaletteItem({ value, onSelect, icon, hint, children }: PaletteItemProps) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className="flex h-10 cursor-default items-center gap-3 rounded-md px-2 text-[13px] text-text data-[selected=true]:bg-surface-sunken"
    >
      <span className="flex size-6 items-center justify-center text-text-muted">{icon}</span>
      <span className="flex min-w-0 flex-1 items-baseline gap-2">{children}</span>
      {hint && <span className="text-2xs text-text-subtle">{hint}</span>}
    </Command.Item>
  );
}
