import { FIELD, fieldValue, type Item } from "@passbox/client";
import { Kbd } from "@passbox/ui";
import * as RadixDialog from "@radix-ui/react-dialog";
import { Command } from "cmdk";
import { Lock, Moon, Search, Settings, ShieldCheck, Sun, Trash2, Wand2 } from "lucide-react";
import { type KeyboardEvent, type ReactNode, useState } from "react";
import { ItemIcon } from "../items/ItemIcon";
import { copyToClipboard } from "../lib/clipboard";
import { modifierKey, useI18n } from "../lib/i18n";
import { CATEGORY_META, CREATABLE, itemSubtitle, itemTitle, safeHref, searchText } from "../lib/items";
import { getPreferences, setPreferences } from "../lib/preferences";
import type { Route } from "../lib/route";
import { matchScore } from "../lib/search";
import { useClient, useSnapshot } from "../useClient";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  navigate: (route: Route) => void;
}

const ITEM_PREFIX = "item:";

/** Typo-tolerant ranking for cmdk (0 hides an entry). */
function filter(value: string, search: string, keywords?: string[]): number {
  return matchScore(search, [value.startsWith(ITEM_PREFIX) ? "" : value, ...(keywords ?? [])].join(" ")) / 3;
}

export function CommandPalette({ open, onOpenChange, navigate }: CommandPaletteProps) {
  const client = useClient();
  const { items } = useSnapshot();
  const { t } = useI18n();
  const [selected, setSelected] = useState("");
  const mod = modifierKey(t);

  const close = () => onOpenChange(false);
  const run = (action: () => void) => () => {
    close();
    action();
  };
  const dark =
    document.documentElement.getAttribute("data-theme") === "dark" ||
    (getPreferences().theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  const openItem = (item: Item) => navigate({ view: "items", filter: { kind: "all" }, itemId: item.id });
  const selectedItem = selected.startsWith(ITEM_PREFIX)
    ? items.find((item) => item.id === selected.slice(ITEM_PREFIX.length))
    : undefined;

  /** Enter copies the password (the most common reason to search), or opens items without one. */
  function primary(item: Item) {
    const password = fieldValue(item.data, FIELD.password);
    close();
    if (password) void copyToClipboard(password, t("field.password"));
    else openItem(item);
  }

  function onKeyDown(event: KeyboardEvent) {
    if (!selectedItem || !(event.metaKey || event.ctrlKey)) return;
    const key = event.key.toLowerCase();
    const username = fieldValue(selectedItem.data, FIELD.username);
    const url = fieldValue(selectedItem.data, FIELD.url);
    if (key === "enter") {
      event.preventDefault();
      close();
      openItem(selectedItem);
    } else if (key === "c" && username && !window.getSelection()?.toString()) {
      event.preventDefault();
      close();
      void copyToClipboard(username, t("field.username"));
    } else if (key === "o" && url && safeHref(url)) {
      event.preventDefault();
      close();
      window.open(safeHref(url), "_blank", "noopener");
    }
  }

  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-(--pb-z-scrim) animate-fade-in bg-scrim backdrop-blur-[3px]" />
        <RadixDialog.Content className="fixed top-[12vh] left-1/2 z-(--pb-z-modal) w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 animate-scale-in overflow-hidden rounded-panel border border-hairline bg-surface-overlay shadow-overlay focus:outline-none">
          <RadixDialog.Title className="sr-only">{t("shell.search")}</RadixDialog.Title>
          <RadixDialog.Description className="sr-only">{t("palette.description")}</RadixDialog.Description>
          <Command
            label={t("shell.search")}
            loop
            filter={filter}
            value={selected}
            onValueChange={setSelected}
            onKeyDown={onKeyDown}
          >
            <div className="flex items-center gap-3 border-b border-hairline px-5">
              <Search className="size-4 text-text-muted" aria-hidden="true" />
              <Command.Input
                autoFocus
                placeholder={t("palette.placeholder")}
                className="h-14 flex-1 bg-transparent text-body-lg text-text outline-none placeholder:text-text-subtle"
              />
              <Kbd>Esc</Kbd>
            </div>
            <Command.List className="max-h-[min(60vh,420px)] overflow-y-auto p-2">
              <Command.Empty className="px-3 py-8 text-center text-sm text-text-muted">
                {t("palette.empty")}
              </Command.Empty>
              {items.length > 0 && (
                <Command.Group heading={t("palette.items")} className={groupClass}>
                  {items.map((item) => (
                    <PaletteItem
                      key={item.id}
                      value={`${ITEM_PREFIX}${item.id}`}
                      keywords={[searchText(item)]}
                      onSelect={() => primary(item)}
                      icon={<ItemIcon item={item} size="sm" />}
                      hint={t(CATEGORY_META[item.data.category].label)}
                    >
                      <span className="truncate">{itemTitle(item, t)}</span>
                      <span className="truncate text-text-muted">{itemSubtitle(item, t)}</span>
                    </PaletteItem>
                  ))}
                </Command.Group>
              )}
              <Command.Group heading={t("palette.create")} className={groupClass}>
                {CREATABLE.map((category) => {
                  const { label, icon: Icon } = CATEGORY_META[category];
                  return (
                    <PaletteItem
                      key={category}
                      value={t("palette.new", { type: t(label) })}
                      keywords={["new", "neu"]}
                      onSelect={run(() => navigate({ view: "items", filter: { kind: "all" }, create: category }))}
                      icon={<Icon className="size-4" />}
                    >
                      {t("palette.new", { type: t(label) })}
                    </PaletteItem>
                  );
                })}
              </Command.Group>
              <Command.Group heading={t("palette.goTo")} className={groupClass}>
                <PaletteItem
                  value={t("term.watchtower")}
                  keywords={["watchtower", "security", "sicherheit"]}
                  onSelect={run(() => navigate({ view: "watchtower" }))}
                  icon={<ShieldCheck className="size-4" />}
                >
                  {t("term.watchtower")}
                </PaletteItem>
                <PaletteItem
                  value={t("term.generator")}
                  keywords={["password generator", "generator"]}
                  onSelect={run(() => navigate({ view: "generator" }))}
                  icon={<Wand2 className="size-4" />}
                >
                  {t("term.generator")}
                </PaletteItem>
                <PaletteItem
                  value={t("term.trash")}
                  keywords={["trash", "papierkorb", "deleted"]}
                  onSelect={run(() => navigate({ view: "trash" }))}
                  icon={<Trash2 className="size-4" />}
                >
                  {t("term.trash")}
                </PaletteItem>
                <PaletteItem
                  value={t("term.settings")}
                  keywords={["settings", "preferences", "einstellungen"]}
                  onSelect={run(() => navigate({ view: "settings" }))}
                  icon={<Settings className="size-4" />}
                >
                  {t("term.settings")}
                </PaletteItem>
              </Command.Group>
              <Command.Group heading={t("palette.actions")} className={groupClass}>
                <PaletteItem
                  value={dark ? t("palette.lightTheme") : t("palette.darkTheme")}
                  keywords={["theme", "dark", "light", "design", "dunkel", "hell"]}
                  onSelect={run(() => setPreferences({ theme: dark ? "light" : "dark" }))}
                  icon={dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
                >
                  {dark ? t("palette.lightTheme") : t("palette.darkTheme")}
                </PaletteItem>
                <PaletteItem
                  value={t("shell.lockVault")}
                  keywords={["lock", "sperren"]}
                  onSelect={run(() => client.lock())}
                  icon={<Lock className="size-4" />}
                >
                  {t("shell.lockVault")}
                </PaletteItem>
              </Command.Group>
            </Command.List>
            <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-hairline bg-surface-raised px-5 py-2.5 text-2xs text-text-muted coarse:hidden">
              <Hint keys={["↵"]} label={t("palette.hint.copy")} />
              <Hint keys={[mod, "↵"]} label={t("palette.hint.open")} />
              <Hint keys={[mod, "C"]} label={t("palette.hint.username")} />
              <Hint keys={[mod, "O"]} label={t("palette.hint.website")} />
            </footer>
          </Command>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

function Hint({ keys, label }: { keys: string[]; label: string }) {
  return (
    <span className="flex items-center gap-1">
      {keys.map((key) => (
        <Kbd key={key}>{key}</Kbd>
      ))}
      <span className="ml-0.5">{label}</span>
    </span>
  );
}

const groupClass =
  "[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:text-overline [&_[cmdk-group-heading]]:text-text-subtle [&_[cmdk-group-heading]]:uppercase";

interface PaletteItemProps {
  value: string;
  keywords?: string[];
  onSelect: () => void;
  icon: ReactNode;
  hint?: string;
  children: ReactNode;
}

function PaletteItem({ value, keywords, onSelect, icon, hint, children }: PaletteItemProps) {
  return (
    <Command.Item
      value={value}
      {...(keywords ? { keywords } : {})}
      onSelect={onSelect}
      className="flex h-11 cursor-default items-center gap-3 rounded-control px-2.5 text-body text-text data-[selected=true]:bg-accent data-[selected=true]:text-accent-contrast data-[selected=true]:shadow-glow [&[data-selected=true]_.text-text-muted]:text-accent-contrast/85 coarse:h-12"
    >
      <span className="flex size-6 items-center justify-center text-text-muted">{icon}</span>
      <span className="flex min-w-0 flex-1 items-baseline gap-2">{children}</span>
      {hint && <span className="text-2xs text-text-muted">{hint}</span>}
    </Command.Item>
  );
}
