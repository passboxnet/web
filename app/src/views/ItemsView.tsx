import type { Item, VaultHealth } from "@passbox/client";
import { type ReactNode, useMemo, useState } from "react";
import { RequestAccessView } from "../comfort/AccessRequests";
import { ItemDetail } from "../items/ItemDetail";
import { ItemEditor } from "../items/ItemEditor";
import { ItemList, type SortOrder } from "../items/ItemList";
import { useI18n } from "../lib/i18n";
import { CATEGORY_META, searchText } from "../lib/items";
import type { ItemFilter, Route } from "../lib/route";
import { matchScore } from "../lib/search";
import { defaultVault, writableVaults } from "../lib/sharing";
import { VaultBanner } from "../sharing/VaultBanner";
import { vaultName } from "../shell/Sidebar";
import { useSnapshot } from "../useClient";
import { DecryptionErrors } from "./DecryptionErrors";

type ItemsRoute = Extract<Route, { view: "items" }>;

interface ItemsViewProps {
  route: ItemsRoute;
  navigate: (route: Route) => void;
  health: VaultHealth;
}

function matchesFilter(item: Item, filter: ItemFilter): boolean {
  switch (filter.kind) {
    case "all":
      return true;
    case "favorites":
      return item.data.favorite;
    case "category":
      return item.data.category === filter.category;
    case "vault":
      return item.vaultId === filter.vaultId;
  }
}

export function ItemsView({ route, navigate, health }: ItemsViewProps) {
  const snapshot = useSnapshot();
  const i18n = useI18n();
  const { t } = i18n;
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortOrder>("name");

  const { items, fuzzy } = useMemo(() => {
    const scored = snapshot.items
      .filter((item) => matchesFilter(item, route.filter))
      .map((item) => ({ item, score: query ? matchScore(query, searchText(item)) : 3 }))
      .filter(({ score }) => score > 0);
    // Typo matches only appear when nothing matches exactly, and then the best ones come first.
    const exact = scored.filter(({ score }) => score === 3);
    const shown = exact.length > 0 ? exact : scored;
    const list = shown.map(({ item }) => item);
    if (exact.length === 0 && shown.length > 0) {
      const byScore = new Map(shown.map(({ item, score }) => [item.id, score]));
      list.sort((a, b) => (byScore.get(b.id) ?? 0) - (byScore.get(a.id) ?? 0));
    } else if (sort === "name") {
      list.sort((a, b) => i18n.compare(a.data.title, b.data.title));
    } else {
      list.sort((a, b) => b.updatedAt - a.updatedAt);
    }
    return { items: list, fuzzy: query !== "" && exact.length === 0 && shown.length > 0 };
  }, [snapshot.items, route.filter, query, sort, i18n]);

  const title =
    route.filter.kind === "all"
      ? t("term.allItems")
      : route.filter.kind === "favorites"
        ? t("term.favorites")
        : route.filter.kind === "category"
          ? t(CATEGORY_META[route.filter.category].plural)
          : vaultName(
              snapshot.vaults.find((v) => v.id === (route.filter as { vaultId: string }).vaultId)?.name ?? "",
              t,
            ) || t("term.vault");

  const selected = route.create ? undefined : (snapshot.items.find((item) => item.id === route.itemId) ?? items[0]);
  // New items go to the vault shown, unless it is view-only; then to the personal vault.
  const writable = writableVaults(snapshot.vaults);
  const filterVault = route.filter.kind === "vault" ? route.filter.vaultId : undefined;
  const defaultVaultId = writable.some((v) => v.id === filterVault) ? filterVault : defaultVault(snapshot.vaults)?.id;
  const canEdit = (item: Item) => writable.some((v) => v.id === item.vaultId);

  const select = (itemId: string | undefined) =>
    navigate(itemId ? { view: "items", filter: route.filter, itemId } : { view: "items", filter: route.filter });
  const edit = (id: string) => navigate({ view: "items", filter: route.filter, itemId: id, edit: true });
  const showDetailOnMobile = Boolean(route.itemId || route.create);

  // A shared vault this account lost access to (removed, left, deleted) falls back to all items.
  // (Before the first sync after unlocking there are no vaults at all yet.)
  const vaultGone =
    filterVault !== undefined && snapshot.vaults.length > 0 && !snapshot.vaults.some((v) => v.id === filterVault);
  // Instead of falling back to all items, offer to ask for access (B9): the
  // link may come from a colleague, or access ended.
  let pane: ReactNode;
  if (vaultGone && filterVault) {
    return <RequestAccessView key={filterVault} vaultId={filterVault} navigate={navigate} />;
  }
  if (route.create && defaultVaultId) {
    pane = (
      <ItemEditor
        key={`new-${route.create}`}
        category={route.create}
        defaultVaultId={defaultVaultId}
        onDone={(id) => select(id)}
      />
    );
  } else if (route.edit && selected && canEdit(selected)) {
    pane = (
      <ItemEditor
        key={`edit-${selected.id}`}
        item={selected}
        category={selected.data.category}
        defaultVaultId={selected.vaultId}
        onDone={(id) => select(id)}
      />
    );
  } else {
    pane = (
      <ItemDetail
        item={selected}
        health={health}
        onEdit={edit}
        onBack={() => navigate({ view: "items", filter: route.filter })}
        onDeleted={() => select(undefined)}
        navigate={navigate}
      />
    );
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <DecryptionErrors />
      <div className="flex min-h-0 flex-1">
        <div
          className={
            showDetailOnMobile
              ? "hidden w-[22rem] shrink-0 border-r border-border md:flex"
              : "flex w-full shrink-0 border-r border-border md:w-[22rem]"
          }
        >
          <ItemList
            title={title}
            items={items}
            fuzzy={fuzzy}
            totalCount={snapshot.items.length}
            query={query}
            onQueryChange={setQuery}
            sort={sort}
            onSortChange={setSort}
            selectedId={route.create ? undefined : selected?.id}
            onSelect={select}
            onCreate={(category) => navigate({ view: "items", filter: route.filter, create: category })}
            navigate={navigate}
            category={route.filter.kind === "category" ? route.filter.category : undefined}
            banner={filterVault ? <VaultBanner vaultId={filterVault} /> : undefined}
          />
        </div>
        <div className={showDetailOnMobile ? "flex min-w-0 flex-1" : "hidden min-w-0 flex-1 md:flex"}>{pane}</div>
      </div>
    </div>
  );
}
