import type { ItemCategory } from "@passbox/client";
import { useEffect, useMemo, useState } from "react";
import { GeneratorPanel } from "../components/GeneratorPanel";
import { ItemDetail } from "../components/ItemDetail";
import { ItemEditor } from "../components/ItemEditor";
import { ItemList } from "../components/ItemList";
import { type Section, Sidebar } from "../components/Sidebar";
import { useAutoLock } from "../components/useAutoLock";
import { useClient, useSnapshot } from "../useClient";

const SYNC_INTERVAL_MS = 30_000;

type Pane = { kind: "view" } | { kind: "edit"; itemId: string } | { kind: "new"; category: ItemCategory };

export function VaultScreen() {
  const client = useClient();
  const snapshot = useSnapshot();
  const [section, setSection] = useState<Section>({ kind: "all" });
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string>();
  const [pane, setPane] = useState<Pane>({ kind: "view" });

  useAutoLock(() => client.lock());

  // Pull changes from other devices periodically and when the tab regains focus.
  useEffect(() => {
    const sync = () => void client.sync().catch(() => undefined);
    const timer = setInterval(sync, SYNC_INTERVAL_MS);
    window.addEventListener("focus", sync);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", sync);
    };
  }, [client]);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return snapshot.items
      .filter((item) => {
        if (section.kind === "favorites") return item.data.favorite;
        if (section.kind === "vault") return item.vaultId === section.id;
        return true;
      })
      .filter(
        (item) =>
          !q ||
          item.data.title.toLowerCase().includes(q) ||
          item.data.fields.some(
            (f) => f.type !== "concealed" && f.type !== "totp" && f.value.toLowerCase().includes(q),
          ),
      );
  }, [snapshot.items, section, query]);

  const selected = items.find((item) => item.id === selectedId) ?? items[0];
  const defaultVaultId = section.kind === "vault" ? section.id : snapshot.vaults[0]?.id;

  function select(id: string) {
    setSelectedId(id);
    setPane({ kind: "view" });
  }

  function renderPane() {
    if (pane.kind === "new" && defaultVaultId) {
      return (
        <ItemEditor
          key="new"
          category={pane.category}
          vaultId={defaultVaultId}
          onSaved={(id) => select(id)}
          onCancel={() => setPane({ kind: "view" })}
        />
      );
    }
    const editing = pane.kind === "edit" ? snapshot.items.find((item) => item.id === pane.itemId) : undefined;
    if (editing) {
      return (
        <ItemEditor
          key={editing.id}
          item={editing}
          category={editing.data.category}
          vaultId={editing.vaultId}
          onSaved={(id) => select(id)}
          onCancel={() => setPane({ kind: "view" })}
        />
      );
    }
    return (
      <ItemDetail
        item={selected}
        vaultName={snapshot.vaults.find((v) => v.id === selected?.vaultId)?.name}
        onEdit={(id) => setPane({ kind: "edit", itemId: id })}
      />
    );
  }

  return (
    <div className="flex h-full">
      <Sidebar
        section={section}
        vaults={snapshot.vaults}
        onSelect={(s) => {
          setSection(s);
          setPane({ kind: "view" });
        }}
        onLock={() => client.lock()}
      />
      {section.kind === "generator" ? (
        <GeneratorPanel />
      ) : (
        <>
          <ItemList
            items={items}
            query={query}
            onQueryChange={setQuery}
            selectedId={pane.kind === "view" ? selected?.id : undefined}
            onSelect={select}
            onCreate={(category) => setPane({ kind: "new", category })}
          />
          {renderPane()}
        </>
      )}
      {snapshot.errors.length > 0 && (
        <div role="alert" className="fixed right-4 bottom-4 max-w-sm rounded-card bg-danger p-4 text-sm text-white">
          {snapshot.errors.length} entries could not be decrypted and are hidden. They may have been tampered with.
        </div>
      )}
    </div>
  );
}
