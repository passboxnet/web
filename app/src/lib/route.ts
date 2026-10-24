import type { ItemCategory } from "@passbox/client";
import { useCallback, useSyncExternalStore } from "react";

export type ItemFilter =
  | { kind: "all" }
  | { kind: "favorites" }
  | { kind: "category"; category: ItemCategory }
  | { kind: "vault"; vaultId: string };

export type Route =
  | { view: "items"; filter: ItemFilter; itemId?: string; edit?: boolean; create?: ItemCategory }
  | { view: "watchtower" }
  | { view: "generator" }
  | { view: "settings" };

export function parseRoute(hash: string): Route {
  const [path = "", query = ""] = hash.replace(/^#\/?/, "").split("?");
  const params = new URLSearchParams(query);
  const parts = path.split("/").filter(Boolean);
  if (parts[0] === "watchtower") return { view: "watchtower" };
  if (parts[0] === "generator") return { view: "generator" };
  if (parts[0] === "settings") return { view: "settings" };

  let filter: ItemFilter = { kind: "all" };
  if (parts[0] === "favorites") filter = { kind: "favorites" };
  else if (parts[0] === "category" && parts[1]) filter = { kind: "category", category: parts[1] as ItemCategory };
  else if (parts[0] === "vault" && parts[1]) filter = { kind: "vault", vaultId: parts[1] };

  const route: Route = { view: "items", filter };
  const item = params.get("item");
  const create = params.get("new");
  if (item) route.itemId = item;
  if (params.get("edit") === "1") route.edit = true;
  if (create) route.create = create as ItemCategory;
  return route;
}

export function formatRoute(route: Route): string {
  if (route.view !== "items") return `#/${route.view}`;
  const { filter } = route;
  const path =
    filter.kind === "all"
      ? "items"
      : filter.kind === "favorites"
        ? "favorites"
        : filter.kind === "category"
          ? `category/${filter.category}`
          : `vault/${filter.vaultId}`;
  const params = new URLSearchParams();
  if (route.itemId) params.set("item", route.itemId);
  if (route.edit) params.set("edit", "1");
  if (route.create) params.set("new", route.create);
  const query = params.toString();
  return `#/${path}${query ? `?${query}` : ""}`;
}

function subscribe(listener: () => void) {
  window.addEventListener("hashchange", listener);
  return () => window.removeEventListener("hashchange", listener);
}

export function useRoute(): [Route, (route: Route) => void] {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash);
  const navigate = useCallback((route: Route) => {
    window.location.hash = formatRoute(route);
  }, []);
  return [parseRoute(hash), navigate];
}
