import { Button, Logo, toast } from "@passbox/ui";
import { KeyRound, Menu as MenuIcon, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { InsecurePageBanner } from "../auth/AuthLayout";
import { useKit } from "../auth/KitProvider";
import { onCommandPaletteRequest } from "../desktop";
import { AgentApprovalWatcher } from "../developer/AgentApproval";
import { DeveloperView } from "../developer/DeveloperView";
import { ImportView } from "../import/ImportView";
import { useI18n } from "../lib/i18n";
import { setChecklist, usePreferences } from "../lib/preferences";
import { useRoute } from "../lib/route";
import { InvitationPrompt } from "../sharing/InvitationPrompt";
import { OrgView } from "../sharing/OrgView";
import { SharingView } from "../sharing/SharingView";
import { SharingWarningsBanner } from "../sharing/SharingWarnings";
import { usePendingRotations } from "../sharing/usePendingRotations";
import { useClient, useSnapshot } from "../useClient";
import { AdminView } from "../views/admin/AdminView";
import { EmergencyVaultView } from "../views/EmergencyVaultView";
import { GeneratorView } from "../views/GeneratorView";
import { GettingStartedView } from "../views/GettingStarted";
import { ItemsView } from "../views/ItemsView";
import { RecoveryRequestsView } from "../views/RecoveryRequestsView";
import { SettingsView } from "../views/SettingsView";
import { TrashView } from "../views/TrashView";
import { WatchtowerView } from "../views/WatchtowerView";
import { CommandPalette } from "./CommandPalette";
import { Sidebar } from "./Sidebar";
import { useAutoLock } from "./useAutoLock";
import { useSyncStatus } from "./useSyncStatus";

export function AppShell() {
  const client = useClient();
  const snapshot = useSnapshot();
  const preferences = usePreferences();
  const { t } = useI18n();
  const [route, navigate] = useRoute();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [syncState, syncNow] = useSyncStatus();
  // biome-ignore lint/correctness/useExhaustiveDependencies: recompute when the items change
  const health = useMemo(() => client.health(), [client, snapshot.items]);

  // A stable callback: a new one on every render would restart the inactivity timer.
  const lock = useCallback(() => client.lock(), [client]);
  useAutoLock(lock, preferences.autoLockMinutes);
  usePendingRotations();

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

  // Toasts belong to the screen they were shown on; switching screens clears
  // them so they never cover the next screen's controls.
  const view = useRef(route.view);
  useEffect(() => {
    if (view.current === route.view) return;
    view.current = route.view;
    toast.dismiss();
    if (route.view === "watchtower") setChecklist({ securityCheck: true });
  }, [route.view]);

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
    // relative + overflow-hidden: screen-reader-only text deep in a scrolled pane must not
    // stretch the document, which would let the whole window scroll.
    <div className="relative flex h-full flex-col overflow-hidden bg-canvas">
      <InsecurePageBanner />
      <KitReminder />
      <SharingWarningsBanner />
      <div className="flex min-h-0 flex-1">
        <div className="hidden w-64 shrink-0 lg:block">{sidebar}</div>

        {drawerOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button
              type="button"
              aria-label={t("shell.closeNavigation")}
              className="absolute inset-0 animate-fade-in bg-black/40"
              onClick={() => setDrawerOpen(false)}
            />
            <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] animate-scale-in shadow-overlay">{sidebar}</div>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-surface px-3 lg:hidden coarse:h-14">
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("shell.openNavigation")}
              onClick={() => setDrawerOpen(true)}
            >
              {drawerOpen ? <X /> : <MenuIcon />}
            </Button>
            <Logo className="text-text" />
            <span className="size-9" />
          </header>
          <main className="flex min-h-0 flex-1">
            {route.view === "items" && <ItemsView route={route} navigate={navigate} health={health} />}
            {route.view === "watchtower" && <WatchtowerView health={health} navigate={navigate} />}
            {route.view === "trash" && <TrashView />}
            {route.view === "getting-started" && <GettingStartedView navigate={navigate} />}
            {route.view === "generator" && <GeneratorView />}
            {route.view === "settings" && <SettingsView />}
            {route.view === "admin" && <AdminView />}
            {route.view === "recovery-requests" && <RecoveryRequestsView />}
            {route.view === "emergency" && <EmergencyVaultView key={route.grantId} grantId={route.grantId} />}
            {route.view === "sharing" && <SharingView navigate={navigate} />}
            {route.view === "org" && <OrgView key={route.orgId} orgId={route.orgId} navigate={navigate} />}
            {route.view === "developer" && (
              <DeveloperView
                section={route.section ?? "agents"}
                onSection={(section) => navigate({ view: "developer", section })}
              />
            )}
            {route.view === "import" && (
              <ImportView onShowItems={() => navigate({ view: "items", filter: { kind: "all" } })} />
            )}
          </main>
        </div>
      </div>

      <InvitationPrompt navigate={navigate} />
      <AgentApprovalWatcher />
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} navigate={navigate} />
    </div>
  );
}

/** Stays until the Emergency Kit is confirmed (S2, business P0-1). */
function KitReminder() {
  const kit = useKit();
  const { t } = useI18n();
  if (!kit.pending) return null;
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-warning/30 bg-warning-soft px-4 py-2.5 text-[0.8125rem]"
    >
      <KeyRound className="size-4 shrink-0 text-warning" aria-hidden="true" />
      <p className="min-w-0 flex-1">
        <strong className="font-semibold">{t("kit.reminder.title")}</strong>
        <span className="hidden sm:inline"> – {t("kit.reminder.body")}</span>
      </p>
      <Button size="sm" onClick={kit.requestKit}>
        {t("kit.reminder.action")}
      </Button>
    </div>
  );
}
