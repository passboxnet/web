import { FIELD, fieldValue, type Item, type ItemCategory } from "@passbox/client";
import {
  Button,
  cn,
  EmptyState,
  Kbd,
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuTrigger,
  Monogram,
  Tooltip,
} from "@passbox/ui";
import {
  ArrowDownAZ,
  AtSign,
  Check,
  Clock3,
  KeyRound,
  Plus,
  Search,
  SearchX,
  Star,
  Timer,
  TimerReset,
  Users,
} from "lucide-react";
import { type KeyboardEvent, type ReactNode, useEffect, useRef } from "react";
import { loadCore } from "../core";
import { copyToClipboard } from "../lib/clipboard";
import { useI18n } from "../lib/i18n";
import { CATEGORY_META, itemSubtitle, itemTitle } from "../lib/items";
import type { Route } from "../lib/route";
import { normalize } from "../lib/search";
import { vaultName } from "../shell/Sidebar";
import { useSnapshot } from "../useClient";
import { GettingStartedCard } from "../views/GettingStarted";

export type SortOrder = "name" | "modified";

interface ItemListProps {
  title: string;
  items: Item[];
  /** The items are typo matches, not exact ones. */
  fuzzy: boolean;
  totalCount: number;
  query: string;
  onQueryChange: (query: string) => void;
  sort: SortOrder;
  onSortChange: (sort: SortOrder) => void;
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  onCreate: (category: ItemCategory) => void;
  navigate: (route: Route) => void;
  /** Set when the list shows one category, for a matching empty state. */
  category?: ItemCategory | undefined;
  /** Shown under the search field, for example who can see a shared vault. */
  banner?: ReactNode;
}

export function ItemList({
  title,
  items,
  fuzzy,
  totalCount,
  query,
  onQueryChange,
  sort,
  onSortChange,
  selectedId,
  onSelect,
  onCreate,
  navigate,
  category,
  banner,
}: ItemListProps) {
  const { t } = useI18n();
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // "/" focuses the search field, like in most professional tools.
  useEffect(() => {
    function onKey(event: globalThis.KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (event.key === "/" && !["INPUT", "TEXTAREA"].includes(target.tagName) && !target.isContentEditable) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Keep the selected row in view when it changes through the keyboard.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run when the selection changes
  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);

  function onListKey(event: KeyboardEvent) {
    // Ctrl/⌘+C on the list copies the selected item's password.
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "c" && !window.getSelection()?.toString()) {
      const item = items.find((i) => i.id === selectedId);
      const password = item && fieldValue(item.data, FIELD.password);
      if (password) {
        event.preventDefault();
        void copyToClipboard(password, t("field.password"));
      }
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const index = items.findIndex((item) => item.id === selectedId);
    const next = items[Math.min(Math.max(index + (event.key === "ArrowDown" ? 1 : -1), 0), items.length - 1)];
    if (next) onSelect(next.id);
  }

  const groups = groupItems(items, sort, fuzzy, t);

  let empty: ReactNode;
  if (items.length === 0) {
    if (query) {
      empty = (
        <EmptyState
          icon={<SearchX />}
          title={t("list.noMatch.title")}
          description={t("list.noMatch.text", { query })}
        />
      );
    } else if (totalCount === 0) {
      empty = (
        <div className="flex-1 overflow-y-auto">
          <EmptyState
            icon={<KeyRound />}
            title={t("list.empty.title")}
            description={t("list.empty.text")}
            action={
              <Button onClick={() => onCreate("login")}>
                <Plus />
                {t("list.empty.newLogin")}
              </Button>
            }
          />
          <div className="px-4 pb-6">
            <GettingStartedCard navigate={navigate} compact />
          </div>
        </div>
      );
    } else {
      empty = (
        <EmptyState
          icon={<KeyRound />}
          title={t("list.emptyCategory.title")}
          description={
            category === "login" || category === "note" || category === "card" || category === "environment"
              ? t(`list.emptyCategory.${category}`)
              : t("list.emptyCategory.other")
          }
          action={
            category && (
              <Button variant="secondary" onClick={() => onCreate(category)}>
                <Plus />
                {t("list.add", { type: t(CATEGORY_META[category].label) })}
              </Button>
            )
          }
        />
      );
    }
  }

  return (
    <section aria-label={title} className="flex min-w-0 flex-1 flex-col bg-surface">
      <header className="flex flex-col gap-3 border-b border-border px-4 pt-4 pb-3">
        <div className="flex items-center justify-between gap-2">
          <h1 className="truncate text-[0.9375rem] font-semibold">
            {title}
            <span className="ml-2 text-[0.8125rem] font-normal text-text-muted tabular-nums">{items.length}</span>
          </h1>
          <Menu>
            <MenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={t("list.sort")}>
                {sort === "name" ? <ArrowDownAZ /> : <Clock3 />}
              </Button>
            </MenuTrigger>
            <MenuContent>
              <MenuLabel>{t("list.sortBy")}</MenuLabel>
              <MenuItem
                icon={<ArrowDownAZ />}
                onSelect={() => onSortChange("name")}
                shortcut={sort === "name" ? <Check className="size-3.5" /> : undefined}
              >
                {t("list.sortName")}
              </MenuItem>
              <MenuItem
                icon={<Clock3 />}
                onSelect={() => onSortChange("modified")}
                shortcut={sort === "modified" ? <Check className="size-3.5" /> : undefined}
              >
                {t("list.sortModified")}
              </MenuItem>
            </MenuContent>
          </Menu>
        </div>
        <label className="flex h-9 items-center gap-2 rounded-lg border border-border bg-surface-raised px-2.5 text-text-muted transition focus-within:border-accent focus-within:bg-surface focus-within:ring-3 focus-within:ring-accent/20 coarse:h-11">
          <Search className="size-4" aria-hidden="true" />
          <span className="sr-only">{t("list.search")}</span>
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                listRef.current?.focus();
              }
              if (e.key === "Escape") onQueryChange("");
            }}
            placeholder={t("list.searchPlaceholder")}
            className="min-w-0 flex-1 bg-transparent text-[0.8125rem] text-text outline-none placeholder:text-text-muted"
          />
          <Kbd>/</Kbd>
        </label>
        {banner}
      </header>

      {empty ?? (
        <div
          ref={listRef}
          role="listbox"
          aria-label={t("list.items", { title })}
          tabIndex={0}
          onKeyDown={onListKey}
          className="flex-1 overflow-y-auto px-2 pb-4 outline-none"
        >
          {fuzzy && (
            <p role="status" className="px-2 pt-3 text-xs text-text-muted">
              {t("list.fuzzy", { query })}
            </p>
          )}
          {groups.map(([heading, groupItems]) => (
            <div key={heading}>
              {heading && (
                <p
                  aria-hidden="true"
                  className="sticky top-0 z-[1] bg-surface/95 px-2 pt-3 pb-1 text-2xs font-semibold tracking-wide text-text-muted uppercase backdrop-blur"
                >
                  {heading}
                </p>
              )}
              <div className="flex flex-col gap-px">
                {groupItems.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    selected={item.id === selectedId}
                    onSelect={() => onSelect(item.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function groupItems(
  items: Item[],
  sort: SortOrder,
  fuzzy: boolean,
  t: (key: string) => string,
): Array<[string, Item[]]> {
  if (fuzzy) return [["", items]];
  if (sort === "modified") return [[t("list.recent"), items]];
  const groups = new Map<string, Item[]>();
  for (const item of items) {
    // "Ärzte" belongs under A, as in a German phone book.
    const first = normalize(item.data.title.trim().charAt(0)).toUpperCase();
    const key = /\p{L}/u.test(first) ? first : "#";
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.entries()];
}

function ItemRow({ item, selected, onSelect }: { item: Item; selected: boolean; onSelect: () => void }) {
  const { t } = useI18n();
  const { vaults } = useSnapshot();
  const vault = vaults.find((v) => v.id === item.vaultId);
  const shared = vault?.orgId !== undefined;
  const Icon = CATEGORY_META[item.data.category].icon;
  const username = fieldValue(item.data, FIELD.username);
  const password = fieldValue(item.data, FIELD.password);
  const totp = fieldValue(item.data, FIELD.totp);

  async function copyCode() {
    if (!totp) return;
    try {
      const core = await loadCore();
      await copyToClipboard(core.totpCode(totp, Math.floor(Date.now() / 1000)), t("list.code"));
    } catch {
      // An invalid setup key: the detail view explains it.
      onSelect();
    }
  }

  return (
    <div
      role="option"
      tabIndex={-1}
      aria-selected={selected}
      // Rows are reached with the listbox's arrow keys; clicking selects.
      onClick={onSelect}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
      className={cn(
        "group flex cursor-default items-center gap-3 rounded-lg px-2 py-2 transition-colors",
        selected ? "bg-accent-soft" : "hover:bg-surface-sunken",
      )}
    >
      <Monogram name={item.data.title} size="lg" icon={item.data.category === "login" ? undefined : <Icon />} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.8125rem] font-medium text-text">{itemTitle(item, t)}</span>
        <span className="block truncate text-xs text-text-muted">{itemSubtitle(item, t)}</span>
      </span>
      {/* Quick copy: on hover or for the selected row with a mouse, always on touch screens. */}
      <span
        className={cn(
          "hidden items-center gap-0.5 group-hover:flex coarse:flex",
          selected && "flex",
          !(username || password || totp) && "!hidden",
        )}
      >
        {username && (
          <RowButton label={t("list.copyUsername")} onClick={() => copyToClipboard(username, t("field.username"))}>
            <AtSign />
          </RowButton>
        )}
        {password && (
          <RowButton label={t("list.copyPassword")} onClick={() => copyToClipboard(password, t("field.password"))}>
            <KeyRound />
          </RowButton>
        )}
        {totp && (
          <RowButton label={t("list.copyCode")} onClick={() => void copyCode()}>
            <TimerReset />
          </RowButton>
        )}
      </span>
      <span
        className={cn(
          "flex items-center gap-1 text-text-muted",
          (username || password || totp) && "group-hover:hidden coarse:hidden",
          selected && (username || password || totp) && "hidden",
        )}
      >
        {shared && (
          <Users
            className="size-3.5"
            aria-label={t("sharing.list.shared", { vault: vaultName(vault?.name ?? "", t) })}
          />
        )}
        {totp && <Timer className="size-3.5" aria-label={t("list.hasTotp")} />}
        {item.data.favorite && <Star className="size-3.5 fill-warning text-warning" aria-label={t("list.favorite")} />}
      </span>
    </div>
  );
}

function RowButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <Tooltip content={label}>
      <Button
        variant="ghost"
        size="icon-sm"
        tabIndex={-1}
        aria-label={label}
        onClick={(event) => {
          // Copying must not also select the row and open it on phones.
          event.stopPropagation();
          onClick();
        }}
      >
        {children}
      </Button>
    </Tooltip>
  );
}
