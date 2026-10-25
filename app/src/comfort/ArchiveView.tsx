import type { Item } from "@passbox/client";
import { Button, EmptyState, toast } from "@passbox/ui";
import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { errorMessage } from "../core";
import { trashWithUndo } from "../items/ItemDetail";
import { ItemIcon } from "../items/ItemIcon";
import { useI18n } from "../lib/i18n";
import { itemSubtitle, itemTitle } from "../lib/items";
import { writableVaults } from "../lib/sharing";
import { vaultName } from "../shell/Sidebar";
import { useClient, useSnapshot } from "../useClient";
import { Page } from "../views/PageHeader";

/**
 * Archived items (G14): out of the way of lists, search and autofill, but
 * kept, with their history, until they are taken out again or deleted.
 */
export function ArchiveView() {
  const client = useClient();
  const { archive, vaults } = useSnapshot();
  const writable = new Set(writableVaults(vaults).map((v) => v.id));
  const i18n = useI18n();
  const { t } = i18n;

  async function unarchive(item: Item) {
    try {
      await client.unarchiveItem(item.id);
      toast.success(t("archive.restored", { name: itemTitle(item, t) }));
    } catch (error) {
      toast.error(t("archive.restoreFailed"), { description: errorMessage(error) });
    }
  }

  return (
    <Page title={t("archive.title")} description={t("archive.description")}>
      <div className="rounded-card border border-border bg-surface shadow-card">
        {archive.length === 0 ? (
          <EmptyState icon={<Archive />} title={t("archive.none.title")} description={t("archive.none.text")} />
        ) : (
          <ul className="divide-y divide-border" data-testid="archive-list">
            {archive.map((item) => {
              const vault = vaults.find((v) => v.id === item.vaultId);
              return (
                <li key={item.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                  <ItemIcon item={item} size="lg" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.8125rem] font-medium">{itemTitle(item, t)}</p>
                    <p className="truncate text-xs text-text-muted">
                      {vault ? `${vaultName(vault.name, t)} · ` : ""}
                      {itemSubtitle(item, t)} ·{" "}
                      <span title={item.data.archivedAt ? i18n.dateTime(item.data.archivedAt) : undefined}>
                        {t("archive.since", { date: i18n.date(item.data.archivedAt ?? item.updatedAt) })}
                      </span>
                    </p>
                  </div>
                  {!writable.has(item.vaultId) ? (
                    <span className="text-xs text-text-muted">{t("sharing.viewOnly.short")}</span>
                  ) : (
                    <div className="flex gap-2">
                      <Button variant="secondary" size="sm" onClick={() => void unarchive(item)}>
                        <ArchiveRestore />
                        {t("archive.unarchive")}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => void trashWithUndo(client, item, t)}>
                        <Trash2 />
                        {t("action.moveToTrash")}
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Page>
  );
}

/** Archives an item and offers "Undo" for 10 seconds. */
export async function archiveWithUndo(
  client: ReturnType<typeof useClient>,
  item: Item,
  t: ReturnType<typeof useI18n>["t"],
): Promise<boolean> {
  try {
    await client.archiveItem(item.id);
  } catch (error) {
    toast.error(t("archive.failed"), { description: errorMessage(error) });
    return false;
  }
  toast.success(t("archive.done", { name: itemTitle(item, t) }), {
    description: t("archive.doneHint"),
    duration: 10_000,
    action: {
      label: t("action.undo"),
      onClick: () => {
        client
          .unarchiveItem(item.id)
          .then(() => toast.success(t("archive.restored", { name: itemTitle(item, t) })))
          .catch((error: unknown) => toast.error(t("archive.restoreFailed"), { description: errorMessage(error) }));
      },
    },
  });
  return true;
}
