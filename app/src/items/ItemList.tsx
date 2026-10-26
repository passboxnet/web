import { FIELD, fieldValue, type Item, type ItemCategory } from "@passbox/client";
import {
  Button,
  cn,
  EmptyState,
  Fab,
  Kbd,
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuTrigger,
  Tooltip,
  toast,
} from "@passbox/ui";
import {
  Archive,
  ArrowDownAZ,
  ArrowRightLeft,
  AtSign,
  Check,
  CheckSquare,
  Clock3,
  KeyRound,
  Plus,
  Search,
  SearchX,
  ShieldAlert,
  Star,
  Timer,
  TimerReset,
  Users,
  X,
} from "lucide-react";
import { type KeyboardEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { MoveItemsDialog } from "../comfort/MoveItemsDialog";
import { errorMessage, loadCore } from "../core";
import { copyToClipboard } from "../lib/clipboard";
import { useI18n } from "../lib/i18n";
import { CATEGORY_META, itemSubtitle, itemTitle } from "../lib/items";
import type { Route } from "../lib/route";
import { normalize } from "../lib/search";
import { writableVaults } from "../lib/sharing";
import { NewItemMenu } from "../shell/NewItemMenu";
import { vaultName } from "../shell/Sidebar";
import { useClient, useSnapshot } from "../useClient";
import { GettingStartedCard } from "../views/GettingStarted";
import { ItemIcon } from "./ItemIcon";

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
  /** Items with a security finding (weak, reused, insecure address): a shield badge on the row. */
  risky?: ReadonlySet<string>;
  /** The selection is the first item by default, not one the user opened: not highlighted on phones, where only the list shows. */
  implicitSelection?: boolean;
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
  risky,
  implicitSelection = false,
}: ItemListProps) {
  const { t } = useI18n();
  const client = useClient();
  const { vaults } = useSnapshot();
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // Selection mode for moving or archiving several items at once (B5, G14).
  const [picked, setPicked] = useState<string[] | undefined>();
  const [moving, setMoving] = useState(false);
  const writable = new Set(writableVaults(vaults).map((v) => v.id));
  const pickable = items.filter((i) => writable.has(i.vaultId));
  const toggle = (id: string) =>
    setPicked((list) => (list?.includes(id) ? list.filter((x) => x !== id) : [...(list ?? []), id]));

  async function archivePicked() {
    if (!picked?.length) return;
    const ids = picked;
    try {
      const failed = await client.archiveItems(ids);
      const done = ids.length - failed.length;
      if (done > 0) {
        toast.success(t("archive.doneMany", { count: done }), {
          duration: 10_000,
          action: {
            label: t("action.undo"),
            onClick: () => void client.unarchiveItems(ids).catch(() => undefined),
          },
        });
      }
      if (failed.length > 0) toast.error(t("archive.failedMany", { count: failed.length }));
      setPicked(undefined);
    } catch (error) {
      toast.error(t("archive.failed"), { description: errorMessage(error) });
    }
  }

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
          tone="quiet"
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
              <Button shape="pill" onClick={() => onCreate("login")}>
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
    <section aria-label={title} className="relative flex min-w-0 flex-1 flex-col bg-surface/45 backdrop-blur-2xl">
      <header className="flex flex-col gap-3 px-4 pt-4 pb-2">
        <div className="flex items-center justify-between gap-2">
          <h1 className="truncate text-headline text-text">
            {title}
            <span className="ml-2 text-body font-normal text-text-subtle tabular-nums">{items.length}</span>
          </h1>
          <span className="ml-auto" />
          {pickable.length > 0 && (
            <Tooltip content={picked ? t("select.done") : t("select.start")}>
              <Button
                variant={picked ? "secondary" : "ghost"}
                size="icon-sm"
                aria-label={picked ? t("select.done") : t("select.start")}
                aria-pressed={picked !== undefined}
                onClick={() => setPicked(picked ? undefined : [])}
                data-testid="select-items"
              >
                <CheckSquare />
              </Button>
            </Tooltip>
          )}
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
        <label className="flex h-11 items-center gap-2.5 rounded-control border border-hairline bg-field px-3.5 text-text-subtle shadow-xs transition focus-within:border-focus focus-within:ring-4 focus-within:ring-focus/25 coarse:h-12">
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
            className="min-w-0 flex-1 bg-transparent text-body text-text outline-none placeholder:text-text-subtle"
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
          className="flex-1 overflow-y-auto px-2.5 pb-24 outline-none"
        >
          {fuzzy && (
            <p role="status" className="px-2 pt-3 text-caption text-text-muted">
              {t("list.fuzzy", { query })}
            </p>
          )}
          {groups.map(([heading, groupItems]) => (
            <div key={heading}>
              {heading && (
                <p aria-hidden="true" className="px-2.5 pt-3 pb-1 text-overline text-text-subtle uppercase">
                  {heading}
                </p>
              )}
              <div className="flex flex-col gap-1">
                {groupItems.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    selected={item.id === selectedId}
                    risky={risky?.has(item.id) ?? false}
                    implicit={implicitSelection}
                    checked={picked ? picked.includes(item.id) : undefined}
                    disabled={picked !== undefined && !writable.has(item.vaultId)}
                    onSelect={() => (picked ? writable.has(item.vaultId) && toggle(item.id) : onSelect(item.id))}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {!picked && !empty && (
        <NewItemMenu align="end" side="top" onCreate={onCreate}>
          <Fab label={t("list.fab")} icon={<Plus />} className="absolute right-5 bottom-5 z-(--pb-z-sticky)" />
        </NewItemMenu>
      )}

      {picked && (
        <div
          role="toolbar"
          aria-label={t("select.toolbar")}
          className="flex flex-wrap items-center gap-2 border-t border-hairline bg-surface-raised px-3 py-2"
          data-testid="bulk-bar"
        >
          <span className="min-w-0 flex-1 text-[0.8125rem] font-medium" aria-live="polite">
            {t("select.count", { count: picked.length })}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPicked(picked.length === pickable.length ? [] : pickable.map((i) => i.id))}
          >
            {picked.length === pickable.length ? t("select.none") : t("select.all")}
          </Button>
          <Button size="sm" variant="secondary" disabled={picked.length === 0} onClick={() => setMoving(true)}>
            <ArrowRightLeft />
            {t("select.move")}
          </Button>
          <Button size="sm" variant="secondary" disabled={picked.length === 0} onClick={() => void archivePicked()}>
            <Archive />
            {t("select.archive")}
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label={t("select.done")} onClick={() => setPicked(undefined)}>
            <X />
          </Button>
        </div>
      )}
      <MoveItemsDialog
        itemIds={picked ?? []}
        open={moving}
        onOpenChange={setMoving}
        onMoved={() => setPicked(undefined)}
      />
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

function ItemRow({
  item,
  selected,
  risky,
  implicit = false,
  checked,
  disabled,
  onSelect,
}: {
  item: Item;
  selected: boolean;
  risky: boolean;
  implicit?: boolean;
  /** Set in selection mode. */
  checked?: boolean | undefined;
  disabled?: boolean;
  onSelect: () => void;
}) {
  const { t } = useI18n();
  const { vaults } = useSnapshot();
  const vault = vaults.find((v) => v.id === item.vaultId);
  const shared = vault?.orgId !== undefined;
  const username = fieldValue(item.data, FIELD.username);
  const password = fieldValue(item.data, FIELD.password);
  const totp = fieldValue(item.data, FIELD.totp);
  const copyable = Boolean(username || password || totp);
  // The selected row (Sky tint with a marker): a single selected item; in selection mode the ticked rows are tinted instead.
  const solid = checked === undefined && selected;
  // Phones show the list alone: a default selection is only highlighted from `md` up.
  // (Literal class names, so Tailwind generates both variants.)
  // `base` normally, `on` on the solid row, `base` + `onMd` for a default selection (highlighted from `md` up).
  const tone = (base: string, on: string, onMd: string) => (solid ? (implicit ? `${base} ${onMd}` : on) : base);

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
      aria-selected={checked ?? selected}
      aria-disabled={disabled || undefined}
      // Rows are reached with the listbox's arrow keys; clicking selects.
      onClick={onSelect}
      onKeyDown={(e) => (e.key === "Enter" || (checked !== undefined && e.key === " ")) && onSelect()}
      className={cn(
        "group flex min-h-14 cursor-default items-center gap-3 rounded-control px-2.5 py-2 transition-colors duration-150",
        checked
          ? "bg-selection"
          : tone(
              "hover:bg-surface-raised",
              "bg-selection shadow-[inset_3px_0_0_0_var(--pb-selection-marker)]",
              "md:bg-selection md:shadow-[inset_3px_0_0_0_var(--pb-selection-marker)]",
            ),
        disabled && "opacity-50",
      )}
    >
      {checked !== undefined && (
        <span
          aria-hidden="true"
          className={cn(
            "flex size-4 shrink-0 items-center justify-center rounded border",
            checked ? "border-control bg-control text-control-contrast" : "border-border-strong bg-surface",
          )}
        >
          {checked && <Check className="size-3" />}
        </span>
      )}
      <ItemIcon item={item} size="lg" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-label text-text">{itemTitle(item, t)}</span>
        <span className="block truncate text-body-sm text-text-muted">{itemSubtitle(item, t)}</span>
      </span>
      {/* Quick copy: on hover with a mouse, always on touch screens. */}
      <span className={cn("hidden items-center gap-0.5 group-hover:flex coarse:flex", !copyable && "!hidden")}>
        {username && (
          <RowButton
            solid={solid}
            label={t("list.copyUsername")}
            onClick={() => copyToClipboard(username, t("field.username"))}
          >
            <AtSign />
          </RowButton>
        )}
        {password && (
          <RowButton
            solid={solid}
            label={t("list.copyPassword")}
            onClick={() => copyToClipboard(password, t("field.password"))}
          >
            <KeyRound />
          </RowButton>
        )}
        {totp && (
          <RowButton solid={solid} label={t("list.copyCode")} onClick={() => void copyCode()}>
            <TimerReset />
          </RowButton>
        )}
      </span>
      <span
        className={cn("flex items-center gap-1.5 text-text-subtle", copyable && "group-hover:hidden coarse:hidden")}
      >
        {shared && (
          <Users
            className="size-3.5"
            aria-label={t("sharing.list.shared", { vault: vaultName(vault?.name ?? "", t) })}
          />
        )}
        {totp && <Timer className="size-3.5" aria-label={t("list.hasTotp")} />}
        {item.data.favorite && <Star className="size-3.5 fill-warning text-warning" aria-label={t("list.favorite")} />}
        {risky && (
          <ShieldAlert className="size-[18px] text-warning" aria-label={t("list.risky")} data-testid="risky-badge" />
        )}
      </span>
    </div>
  );
}

function RowButton({
  label,
  onClick,
  solid,
  children,
}: {
  label: string;
  onClick: () => void;
  solid: boolean;
  children: ReactNode;
}) {
  return (
    <Tooltip content={label}>
      <Button
        variant={solid ? "onAccent" : "ghost"}
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
