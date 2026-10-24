import { type Item, TRASH_RETENTION_MS } from "@passbox/client";
import { Button, ConfirmDialog, EmptyState, Monogram, toast } from "@passbox/ui";
import { RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { errorMessage } from "../core";
import { useI18n } from "../lib/i18n";
import { CATEGORY_META, itemSubtitle, itemTitle } from "../lib/items";
import { useClient, useSnapshot } from "../useClient";
import { Page } from "./PageHeader";

/** Items moved to the trash, restorable for 30 days. Only "Delete permanently" is final. */
export function TrashView() {
  const client = useClient();
  const { trash } = useSnapshot();
  const i18n = useI18n();
  const { t } = i18n;
  const [deleting, setDeleting] = useState<Item>();
  const [emptying, setEmptying] = useState(false);

  async function restore(item: Item) {
    try {
      await client.restoreItem(item.id);
      toast.success(t("trash.restored", { name: itemTitle(item, t) }));
    } catch (error) {
      toast.error(t("trash.restoreFailed"), { description: errorMessage(error) });
    }
  }

  async function deleteForever(item: Item) {
    try {
      await client.deleteItem(item.id);
      toast.success(t("trash.deleted", { name: itemTitle(item, t) }));
    } catch (error) {
      toast.error(t("trash.deleteFailed"), { description: errorMessage(error) });
    }
  }

  async function emptyTrash() {
    try {
      const count = await client.purgeTrash(true);
      toast.success(t("trash.emptied", { count }));
    } catch (error) {
      toast.error(t("trash.deleteFailed"), { description: errorMessage(error) });
    }
  }

  return (
    <Page
      title={t("term.trash")}
      description={t("trash.description")}
      actions={
        trash.length > 0 && (
          <Button variant="secondary" onClick={() => setEmptying(true)}>
            <Trash2 />
            {t("trash.empty")}
          </Button>
        )
      }
    >
      <div className="rounded-card border border-border bg-surface shadow-card">
        {trash.length === 0 ? (
          <EmptyState icon={<Trash2 />} title={t("trash.none.title")} description={t("trash.none.text")} />
        ) : (
          <ul className="divide-y divide-border">
            {trash.map((item) => {
              const Icon = CATEGORY_META[item.data.category].icon;
              const purgeAt = (item.data.trashedAt ?? Date.now()) + TRASH_RETENTION_MS;
              return (
                <li key={item.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                  <Monogram
                    name={item.data.title}
                    size="lg"
                    icon={item.data.category === "login" ? undefined : <Icon />}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.8125rem] font-medium">{itemTitle(item, t)}</p>
                    <p className="truncate text-xs text-text-muted">
                      {itemSubtitle(item, t)} ·{" "}
                      <span title={i18n.dateTime(purgeAt)}>{t("trash.purgeOn", { date: i18n.date(purgeAt) })}</span>
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={() => void restore(item)}>
                      <RotateCcw />
                      {t("action.restore")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-danger hover:text-danger"
                      onClick={() => setDeleting(item)}
                    >
                      {t("action.deletePermanently")}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={deleting !== undefined}
        onOpenChange={(open) => !open && setDeleting(undefined)}
        title={t("trash.deleteTitle")}
        description={t("trash.deleteText", { name: deleting ? itemTitle(deleting, t) : "" })}
        confirmLabel={t("action.deletePermanently")}
        tone="danger"
        onConfirm={() => deleting && void deleteForever(deleting)}
      />
      <ConfirmDialog
        open={emptying}
        onOpenChange={setEmptying}
        title={t("trash.emptyTitle")}
        description={t("trash.emptyText", { count: trash.length })}
        confirmLabel={t("trash.empty")}
        tone="danger"
        onConfirm={() => void emptyTrash()}
      />
    </Page>
  );
}
