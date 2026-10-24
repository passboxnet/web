import { FIELD, fieldValue, type Item, type ItemCategory } from "@passbox/client";
import { Button, cn } from "@passbox/ui";
import { Plus, Search } from "lucide-react";
import { useState } from "react";
import { ItemIcon } from "./ItemIcon";

interface ItemListProps {
  items: Item[];
  query: string;
  onQueryChange: (query: string) => void;
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  onCreate: (category: ItemCategory) => void;
}

const NEW_ITEM_TYPES: Array<{ category: ItemCategory; label: string }> = [
  { category: "login", label: "Login" },
  { category: "note", label: "Secure note" },
  { category: "card", label: "Credit card" },
];

export function ItemList({ items, query, onQueryChange, selectedId, onSelect, onCreate }: ItemListProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <section aria-label="Items" className="flex w-80 shrink-0 flex-col border-r border-border max-md:w-full">
      <div className="flex gap-2 border-b border-border p-3">
        <label className="flex h-10 flex-1 items-center gap-2 rounded-lg bg-surface-raised px-3 text-text-muted focus-within:ring-2 focus-within:ring-accent/30">
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
        <div className="relative">
          <Button aria-label="New item" aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)}>
            <Plus className="size-4" />
          </Button>
          {menuOpen && (
            <ul className="absolute right-0 z-10 mt-2 w-44 rounded-lg border border-border bg-surface p-1 shadow-lg">
              {NEW_ITEM_TYPES.map(({ category, label }) => (
                <li key={category}>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onCreate(category);
                    }}
                    className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-surface-raised"
                  >
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
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
              <ItemIcon title={item.data.title} category={item.data.category} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{item.data.title || "Untitled"}</span>
                <span className="block truncate text-xs text-text-muted">{subtitle(item)}</span>
              </span>
            </button>
          </li>
        ))}
        {items.length === 0 && (
          <li className="px-3 py-8 text-center text-sm text-text-muted">
            {query ? "No items found" : "No items yet. Add your first one with +."}
          </li>
        )}
      </ul>
    </section>
  );
}

function subtitle(item: Item): string {
  switch (item.data.category) {
    case "login":
      return fieldValue(item.data, FIELD.username) ?? fieldValue(item.data, FIELD.url) ?? "Login";
    case "card": {
      const number = fieldValue(item.data, FIELD.cardNumber);
      return number ? `•••• ${number.replace(/\s/g, "").slice(-4)}` : "Credit card";
    }
    case "note":
      return "Secure note";
    default:
      return "";
  }
}
