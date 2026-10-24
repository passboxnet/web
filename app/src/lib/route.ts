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
  | { view: "trash" }
  | { view: "archive" }
  | { view: "getting-started" }
  | { view: "generator" }
  | { view: "settings"; section?: string }
  | { view: "import" }
  | { view: "admin" }
  | { view: "recovery-requests" }
  | { view: "emergency"; grantId: string }
  | { view: "sharing" }
  | { view: "org"; orgId: string }
  | { view: "org-sso"; orgId: string }
  | { view: "org-admin"; orgId: string; section?: string }
  | { view: "developer"; section?: "agents" | "service-accounts" };

export function parseRoute(hash: string): Route {
  const [path = "", query = ""] = hash.replace(/^#\/?/, "").split("?");
  const params = new URLSearchParams(query);
  const parts = path.split("/").filter(Boolean);
  if (parts[0] === "watchtower" || parts[0] === "security") return { view: "watchtower" };
  if (parts[0] === "trash") return { view: "trash" };
  if (parts[0] === "archive") return { view: "archive" };
  if (parts[0] === "getting-started") return { view: "getting-started" };
  if (parts[0] === "generator") return { view: "generator" };
  if (parts[0] === "settings") return parts[1] ? { view: "settings", section: parts[1] } : { view: "settings" };
  if (parts[0] === "import") return { view: "import" };
  if (parts[0] === "admin") return { view: "admin" };
  if (parts[0] === "recovery-requests") return { view: "recovery-requests" };
  if (parts[0] === "emergency" && parts[1]) return { view: "emergency", grantId: decodeURIComponent(parts[1]) };
  if (parts[0] === "sharing") return { view: "sharing" };
  if (parts[0] === "org" && parts[1] && parts[2] === "admin") {
    return parts[3]
      ? { view: "org-admin", orgId: parts[1], section: parts[3] }
      : { view: "org-admin", orgId: parts[1] };
  }
  if (parts[0] === "org" && parts[1]) return { view: "org", orgId: parts[1] };
  if (parts[0] === "org-sso" && parts[1]) return { view: "org-sso", orgId: parts[1] };
  if (parts[0] === "developer")
    return parts[1] === "service-accounts" ? { view: "developer", section: "service-accounts" } : { view: "developer" };

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
  if (route.view === "settings" && route.section) return `#/settings/${route.section}`;
  if (route.view === "emergency") return `#/emergency/${encodeURIComponent(route.grantId)}`;
  if (route.view === "org") return `#/org/${route.orgId}`;
  if (route.view === "org-sso") return `#/org-sso/${route.orgId}`;
  if (route.view === "org-admin") return `#/org/${route.orgId}/admin${route.section ? `/${route.section}` : ""}`;
  if (route.view === "developer" && route.section === "service-accounts") return "#/developer/service-accounts";
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
