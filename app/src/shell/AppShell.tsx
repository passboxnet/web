import { Button, Logo } from "@passbox/ui";
import { Menu as MenuIcon, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { onCommandPaletteRequest } from "../desktop";
import { usePreferences } from "../lib/preferences";
import { useRoute } from "../lib/route";
import { useClient, useSnapshot } from "../useClient";
import { GeneratorView } from "../views/GeneratorView";
import { ItemsView } from "../views/ItemsView";
import { SettingsView } from "../views/SettingsView";
import { WatchtowerView } from "../views/WatchtowerView";
import { CommandPalette } from "./CommandPalette";
import { Sidebar } from "./Sidebar";
import { useAutoLock } from "./useAutoLock";
import { useSyncStatus } from "./useSyncStatus";

export function AppShell() {
  const client = useClient();
  const snapshot = useSnapshot();
  const preferences = usePreferences();
  const [route, navigate] = useRoute();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [syncState, syncNow] = useSyncStatus();
  // biome-ignore lint/correctness/useExhaustiveDependencies: recompute when the items change
  const health = useMemo(() => client.health(), [client, snapshot.items]);

  useAutoLock(client.lock.bind(client), preferences.autoLockMinutes);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Global shortcut of the desktop app.
  useEffect(() => onCommandPaletteRequest(() => setPaletteOpen(true)), []);

  // Close the mobile drawer on navigation.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the route changes
  useEffect(() => setDrawerOpen(false), [window.location.hash]);

  const sidebar = (
    <Sidebar
      route={route}
      navigate={navigate}
      health={health}
      syncState={syncState}
      onSync={syncNow}
      onOpenPalette={() => setPaletteOpen(true)}
    />
  );

  return (
    <div className="flex h-full bg-canvas">
      <div className="hidden w-64 shrink-0 lg:block">{sidebar}</div>

      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 animate-fade-in bg-black/40"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-72 animate-scale-in shadow-overlay">{sidebar}</div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-surface px-3 lg:hidden">
          <Button variant="ghost" size="icon" aria-label="Open navigation" onClick={() => setDrawerOpen(true)}>
            {drawerOpen ? <X /> : <MenuIcon />}
          </Button>
          <Logo className="text-text" />
          <span className="size-9" />
        </header>
        <main className="flex min-h-0 flex-1">
          {route.view === "items" && <ItemsView route={route} navigate={navigate} />}
          {route.view === "watchtower" && <WatchtowerView health={health} navigate={navigate} />}
          {route.view === "generator" && <GeneratorView />}
          {route.view === "settings" && <SettingsView />}
        </main>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} navigate={navigate} />
    </div>
  );
}
