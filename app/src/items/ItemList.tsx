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
} from "@passbox/ui";
import { ArrowDownAZ, Check, Clock3, KeyRound, Plus, Search, SearchX, Star, Timer } from "lucide-react";
import { type KeyboardEvent, useEffect, useRef } from "react";
import { CATEGORY_META, itemSubtitle } from "../lib/items";

export type SortOrder = "name" | "modified";

interface ItemListProps {
  title: string;
  items: Item[];
  totalCount: number;
  query: string;
  onQueryChange: (query: string) => void;
  sort: SortOrder;
  onSortChange: (sort: SortOrder) => void;
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  onCreate: (category: ItemCategory) => void;
}

export function ItemList({
  title,
  items,
  totalCount,
  query,
  onQueryChange,
  sort,
  onSortChange,
  selectedId,
  onSelect,
  onCreate,
}: ItemListProps) {
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
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const index = items.findIndex((item) => item.id === selectedId);
    const next = items[Math.min(Math.max(index + (event.key === "ArrowDown" ? 1 : -1), 0), items.length - 1)];
    if (next) onSelect(next.id);
  }

  const groups = groupItems(items, sort);

  return (
    <section aria-label={title} className="flex min-w-0 flex-1 flex-col bg-surface">
      <header className="flex flex-col gap-3 border-b border-border px-4 pt-4 pb-3">
        <div className="flex items-center justify-between gap-2">
          <h1 className="truncate text-[15px] font-semibold">
            {title}
            <span className="ml-2 text-[13px] font-normal text-text-subtle tabular-nums">{items.length}</span>
          </h1>
          <Menu>
            <MenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Sort">
                {sort === "name" ? <ArrowDownAZ /> : <Clock3 />}
              </Button>
            </MenuTrigger>
            <MenuContent>
              <MenuLabel>Sort by</MenuLabel>
              <MenuItem
                icon={<ArrowDownAZ />}
                onSelect={() => onSortChange("name")}
                shortcut={sort === "name" ? <Check className="size-3.5" /> : undefined}
              >
                Name
              </MenuItem>
              <MenuItem
                icon={<Clock3 />}
                onSelect={() => onSortChange("modified")}
                shortcut={sort === "modified" ? <Check className="size-3.5" /> : undefined}
              >
                Last modified
              </MenuItem>
            </MenuContent>
          </Menu>
        </div>
        <label className="flex h-9 items-center gap-2 rounded-lg border border-border bg-surface-raised px-2.5 text-text-subtle transition focus-within:border-accent focus-within:bg-surface focus-within:ring-3 focus-within:ring-accent/20">
          <Search className="size-4" aria-hidden="true" />
          <span className="sr-only">Search items</span>
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
            placeholder="Search"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-text outline-none placeholder:text-text-subtle"
          />
          <Kbd>/</Kbd>
        </label>
      </header>

      {items.length === 0 ? (
        query ? (
          <EmptyState
            icon={<SearchX />}
            title="No matching items"
            description={`Nothing matches "${query}". Search looks at titles, usernames, websites and tags.`}
          />
        ) : totalCount === 0 ? (
          <EmptyState
            icon={<KeyRound />}
            title="Your vault is empty"
            description="Add your first login. Everything is encrypted on this device before it is synced."
            action={
              <Button onClick={() => onCreate("login")}>
                <Plus />
                New login
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={<KeyRound />}
            title="Nothing here yet"
            description="Items you add here will show up in this list."
          />
        )
      ) : (
        <div
          ref={listRef}
          role="listbox"
          aria-label={`${title} items`}
          tabIndex={0}
          onKeyDown={onListKey}
          className="flex-1 overflow-y-auto px-2 pb-4 outline-none"
        >
          {groups.map(([heading, groupItems]) => (
            <div key={heading}>
              <p
                aria-hidden="true"
                className="sticky top-0 z-[1] bg-surface/95 px-2 pt-3 pb-1 text-2xs font-semibold tracking-wide text-text-subtle uppercase backdrop-blur"
              >
                {heading}
              </p>
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

function groupItems(items: Item[], sort: SortOrder): Array<[string, Item[]]> {
  if (sort === "modified") return [["Recently modified", items]];
  const groups = new Map<string, Item[]>();
  for (const item of items) {
    const first = item.data.title.trim().charAt(0).toUpperCase();
    const key = /[A-Z]/.test(first) ? first : "#";
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.entries()];
}

function ItemRow({ item, selected, onSelect }: { item: Item; selected: boolean; onSelect: () => void }) {
  const Icon = CATEGORY_META[item.data.category].icon;
  const hasTotp = Boolean(fieldValue(item.data, FIELD.totp));
  return (
    <div
      role="option"
      tabIndex={-1}
      aria-selected={selected}
      // Rows are reached with the listbox's arrow keys; clicking selects.
      onClick={onSelect}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
      className={cn(
        "flex cursor-default items-center gap-3 rounded-lg px-2 py-2 transition-colors",
        selected ? "bg-accent-soft" : "hover:bg-surface-sunken",
      )}
    >
      <Monogram name={item.data.title} size="lg" icon={item.data.category === "login" ? undefined : <Icon />} />
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate text-[13px] font-medium", selected ? "text-text" : "text-text")}>
          {item.data.title || "Untitled"}
        </span>
        <span className="block truncate text-xs text-text-muted">{itemSubtitle(item)}</span>
      </span>
      <span className="flex items-center gap-1 text-text-subtle">
        {hasTotp && <Timer className="size-3.5" aria-label="Has one-time password" />}
        {item.data.favorite && <Star className="size-3.5 fill-warning text-warning" aria-label="Favorite" />}
      </span>
    </div>
  );
}
