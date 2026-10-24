import { useMemo, useState } from "react";
import { GeneratorPanel } from "../components/GeneratorPanel";
import { ItemDetail } from "../components/ItemDetail";
import { ItemList } from "../components/ItemList";
import { type Section, Sidebar } from "../components/Sidebar";
import { sampleItems } from "../sampleData";

export function VaultScreen({ onLock }: { onLock: () => void }) {
  const [section, setSection] = useState<Section>({ kind: "all" });
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | undefined>(sampleItems[0]?.id);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sampleItems
      .filter((item) => {
        if (section.kind === "favorites") return item.favorite;
        if (section.kind === "vault") return item.vault === section.name;
        return true;
      })
      .filter(
        (item) =>
          !q ||
          item.title.toLowerCase().includes(q) ||
          item.username?.toLowerCase().includes(q) ||
          item.url?.toLowerCase().includes(q),
      )
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [section, query]);

  const selected = items.find((item) => item.id === selectedId) ?? items[0];

  return (
    <div className="flex h-full">
      <Sidebar section={section} onSelect={setSection} onLock={onLock} />
      {section.kind === "generator" ? (
        <GeneratorPanel />
      ) : (
        <>
          <ItemList
            items={items}
            query={query}
            onQueryChange={setQuery}
            selectedId={selected?.id}
            onSelect={setSelectedId}
          />
          <ItemDetail item={selected} />
        </>
      )}
    </div>
  );
}
