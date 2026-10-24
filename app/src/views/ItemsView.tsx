import { analyzeVault, type Item } from "@passbox/client";
import { useMemo, useState } from "react";
import { ItemDetail } from "../items/ItemDetail";
import { ItemEditor } from "../items/ItemEditor";
import { ItemList, type SortOrder } from "../items/ItemList";
import { CATEGORY_META } from "../lib/items";
import type { ItemFilter, Route } from "../lib/route";
import { useSnapshot } from "../useClient";

type ItemsRoute = Extract<Route, { view: "items" }>;

interface ItemsViewProps {
  route: ItemsRoute;
  navigate: (route: Route) => void;
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

function matchesQuery(item: Item, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    item.data.title.toLowerCase().includes(q) ||
    item.data.tags.some((tag) => tag.toLowerCase().includes(q)) ||
    item.data.fields.some(
      (field) => field.type !== "concealed" && field.type !== "totp" && field.value.toLowerCase().includes(q),
    )
  );
}

export function ItemsView({ route, navigate }: ItemsViewProps) {
  const snapshot = useSnapshot();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortOrder>("name");
  const health = useMemo(() => analyzeVault(snapshot.items), [snapshot.items]);

  const items = useMemo(() => {
    const filtered = snapshot.items.filter((item) => matchesFilter(item, route.filter) && matchesQuery(item, query));
    return sort === "name"
      ? filtered.sort((a, b) => a.data.title.localeCompare(b.data.title, undefined, { sensitivity: "base" }))
      : filtered.sort((a, b) => b.updatedAt - a.updatedAt);
  }, [snapshot.items, route.filter, query, sort]);

  const title =
    route.filter.kind === "all"
      ? "All items"
      : route.filter.kind === "favorites"
        ? "Favorites"
        : route.filter.kind === "category"
          ? CATEGORY_META[route.filter.category].plural
          : (snapshot.vaults.find((v) => v.id === (route.filter as { vaultId: string }).vaultId)?.name ?? "Vault");

  const selected = route.create ? undefined : (snapshot.items.find((item) => item.id === route.itemId) ?? items[0]);
  const defaultVaultId =
    route.filter.kind === "vault"
      ? route.filter.vaultId
      : (snapshot.vaults.find((v) => v.name === "Private") ?? snapshot.vaults[0])?.id;

  const select = (itemId: string | undefined) =>
    navigate(itemId ? { view: "items", filter: route.filter, itemId } : { view: "items", filter: route.filter });
  const showDetailOnMobile = Boolean(route.itemId || route.create);

  let pane: React.ReactNode;
  if (route.create && defaultVaultId) {
    pane = (
      <ItemEditor
        key={`new-${route.create}`}
        category={route.create}
        defaultVaultId={defaultVaultId}
        onDone={(id) => select(id)}
      />
    );
  } else if (route.edit && selected) {
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
        onEdit={(id) => navigate({ view: "items", filter: route.filter, itemId: id, edit: true })}
        onBack={() => navigate({ view: "items", filter: route.filter })}
        onDeleted={() => select(undefined)}
      />
    );
  }

  return (
    <>
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
          totalCount={snapshot.items.length}
          query={query}
          onQueryChange={setQuery}
          sort={sort}
          onSortChange={setSort}
          selectedId={route.create ? undefined : selected?.id}
          onSelect={select}
          onCreate={(category) => navigate({ view: "items", filter: route.filter, create: category })}
        />
      </div>
      <div className={showDetailOnMobile ? "flex min-w-0 flex-1" : "hidden min-w-0 flex-1 md:flex"}>{pane}</div>
    </>
  );
}
