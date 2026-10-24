import { cn } from "@passbox/ui";
import { Search } from "lucide-react";
import type { VaultItem } from "../sampleData";
import { ItemIcon } from "./ItemIcon";

interface ItemListProps {
  items: VaultItem[];
  query: string;
  onQueryChange: (query: string) => void;
  selectedId: string | undefined;
  onSelect: (id: string) => void;
}

export function ItemList({ items, query, onQueryChange, selectedId, onSelect }: ItemListProps) {
  return (
    <section aria-label="Items" className="flex w-80 shrink-0 flex-col border-r border-border max-md:w-full">
      <div className="border-b border-border p-3">
        <label className="flex h-10 items-center gap-2 rounded-lg bg-surface-raised px-3 text-text-muted focus-within:ring-2 focus-within:ring-accent/30">
          <Search className="size-4" aria-hidden="true" />
          <span className="sr-only">Search items</span>
          <input
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search"
            className="w-full bg-transparent text-sm text-text outline-none placeholder:text-text-muted"
          />
        </label>
      </div>
      <ul className="flex-1 overflow-y-auto p-2">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onSelect(item.id)}
              aria-current={item.id === selectedId ? "true" : undefined}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition",
                item.id === selectedId ? "bg-accent/10" : "hover:bg-surface-raised",
              )}
            >
              <ItemIcon item={item} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{item.title}</span>
                <span className="block truncate text-xs text-text-muted">{item.username ?? item.vault}</span>
              </span>
            </button>
          </li>
        ))}
        {items.length === 0 && <li className="px-3 py-8 text-center text-sm text-text-muted">No items found</li>}
      </ul>
    </section>
  );
}
