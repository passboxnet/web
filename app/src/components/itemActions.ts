import type { Item } from "@passbox/client";
import { useCallback } from "react";
import { useClient } from "../useClient";

export type { Item, ItemField } from "@passbox/client";

/** Asks for confirmation, then deletes the item. */
export function useConfirmDelete() {
  const client = useClient();
  return useCallback(
    (item: Item) => {
      if (!window.confirm(`Delete "${item.data.title || "Untitled"}"? This cannot be undone.`)) return;
      client.deleteItem(item.id).catch((error: unknown) => window.alert(String(error)));
    },
    [client],
  );
}
