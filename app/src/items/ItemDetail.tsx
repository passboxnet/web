import {
  FIELD,
  fieldValue,
  type Item,
  type ItemCategory,
  type ItemField,
  type Passkey,
  type PasswordHistoryEntry,
  type VaultHealth,
} from "@passbox/client";
import {
  AlertCard,
  Avatar,
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  Kbd,
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
  Tooltip,
  tagDotClassName,
  toast,
} from "@passbox/ui";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  ArrowRightLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Fingerprint,
  History,
  KeyRound,
  Link2,
  Maximize2,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Share2,
  Star,
  Trash2,
} from "lucide-react";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { archiveWithUndo } from "../comfort/ArchiveView";
import { AttachmentsSection } from "../comfort/AttachmentsSection";
import { WifiJoinCard } from "../comfort/ItemTypeTools";
import { MoveItemsDialog } from "../comfort/MoveItemsDialog";
import { ShareLinkDialog } from "../comfort/ShareLinkDialog";
import { errorMessage } from "../core";
import { EnvironmentPanel } from "../developer/EnvironmentPanel";
import { copyToClipboard } from "../lib/clipboard";
import { shortcut, type Translator, useI18n } from "../lib/i18n";
import { CATEGORY_META, fieldLabel, hostname, itemTitle, safeHref } from "../lib/items";
import type { Route } from "../lib/route";
import { isGuestVault, vaultAudience as vaultAudienceIds } from "../lib/sharing";
import { vaultColor } from "../lib/vaultColor";
import { AudienceIcon, orgName, useAudience, useMyAccountId } from "../sharing/common";
import { ShareItemDialog } from "../sharing/ShareItemDialog";
import { VaultSharingDialog } from "../sharing/VaultSharingDialog";
import { vaultName } from "../shell/Sidebar";
import { useClient, useSnapshot } from "../useClient";
import { ChangePasswordDialog } from "./ChangePasswordDialog";
import { ColoredPassword } from "./ColoredPassword";
import { ItemIcon } from "./ItemIcon";
import { CountdownRing, useTotp } from "./TotpCode";
import { useAutoHide } from "./useAutoHide";
import { ItemUsageContext, type ReportUsage, useItemUsage } from "./useItemUsage";

interface ItemDetailProps {
  item: Item | undefined;
  health: VaultHealth;
  onEdit: (id: string) => void;
  onBack: () => void;
  onDeleted: () => void;
  navigate: (route: Route) => void;
}

/** Moves an item to the trash and offers "Undo" for 10 seconds. */
export async function trashWithUndo(
  client: ReturnType<typeof useClient>,
  item: Item,
  t: Translator["t"],
): Promise<boolean> {
  try {
    await client.trashItem(item.id);
  } catch (error) {
    toast.error(t("trash.moveFailed"), { description: errorMessage(error) });
    return false;
  }
  toast.success(t("trash.moved", { name: itemTitle(item, t) }), {
    id: `trash:${item.id}`,
    description: t("trash.movedHint"),
    duration: 10_000,
    action: {
      label: t("action.undo"),
      onClick: () => {
        client
          .restoreItem(item.id)
          .then(() => toast.success(t("trash.restored", { name: itemTitle(item, t) })))
          .catch((error: unknown) => toast.error(t("trash.restoreFailed"), { description: errorMessage(error) }));
      },
    },
  });
  return true;
}

export function ItemDetail({ item, health, onEdit, onBack, onDeleted, navigate }: ItemDetailProps) {
  const client = useClient();
  const i18n = useI18n();
  const { t } = i18n;
  const { vaults, orgs } = useSnapshot();
  const [changing, setChanging] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [moving, setMoving] = useState(false);
  const [linking, setLinking] = useState(false);
  const itemVault = vaults.find((v) => v.id === item?.vaultId);
  const audience = useAudience(item?.vaultId);
  // View-only members of a shared vault can read, copy and fill, not change.
  // Guests are view-only, whatever the vault grants (B8).
  const guest = isGuestVault(itemVault, orgs);
  const canEdit = !guest && (!itemVault?.orgId || itemVault.role === "edit" || itemVault.role === "manage");

  // Item usage for organizations whose policy asks for it (D3).
  const itemId = item?.id;
  const reportUsage = useCallback<ReportUsage>(
    (action, field = "") => {
      if (itemId) client.reportItemUsage(itemId, action, field);
    },
    [client, itemId],
  );
  useEffect(() => {
    if (itemId) client.reportItemUsage(itemId, "item_viewed");
  }, [client, itemId]);

  // "e" edits the selected item when focus is not in a text field.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (!item || !canEdit || event.metaKey || event.ctrlKey || ["INPUT", "TEXTAREA"].includes(target.tagName)) {
        return;
      }
      if (event.key === "e" && !document.querySelector("[role=dialog]")) {
        event.preventDefault();
        onEdit(item.id);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item, onEdit, canEdit]);

  if (!item) {
    return (
      <section className="flex flex-1 items-center justify-center bg-canvas">
        <EmptyState
          icon={<KeyRound />}
          title={t("detail.none.title")}
          description={t("detail.none.text", { shortcut: shortcut(t, "K") })}
        />
      </section>
    );
  }

  const { data } = item;
  const vault = vaultName(vaults.find((v) => v.id === item.vaultId)?.name ?? "", t) || t("term.vault");
  const category = CATEGORY_META[data.category];
  const url = fieldValue(data, FIELD.url);
  const username = fieldValue(data, FIELD.username);
  const password = fieldValue(data, FIELD.password);
  const fields = data.fields.filter((field) => field.value);
  const warnings = canEdit ? securityWarnings(item.id, health, t) : [];
  const dotColor = itemVault ? vaultColor(itemVault) : "blue";

  async function toggleFavorite() {
    if (!item) return;
    try {
      await client.updateItem(item.id, { ...item.data, favorite: !item.data.favorite });
    } catch (error) {
      toast.error(t("detail.updateFailed"), { description: errorMessage(error) });
    }
  }

  async function moveToTrash() {
    if (!item) return;
    if (await trashWithUndo(client, item, t)) onDeleted();
  }

  async function archive() {
    if (!item) return;
    if (await archiveWithUndo(client, item, t)) onDeleted();
  }

  async function unarchive() {
    if (!item) return;
    try {
      await client.unarchiveItem(item.id);
      toast.success(t("archive.restored", { name: itemTitle(item, t) }));
    } catch (error) {
      toast.error(t("archive.restoreFailed"), { description: errorMessage(error) });
    }
  }

  return (
    <ItemUsageContext.Provider value={reportUsage}>
      <section
        aria-label={itemTitle(item, t)}
        className="flex min-w-0 flex-1 flex-col bg-surface/85 backdrop-blur-2xl"
        key={item.id}
      >
        <div className="flex h-12 shrink-0 items-center gap-1.5 border-b border-hairline px-3 md:hidden coarse:h-14">
          <Button variant="ghost" size="icon-sm" aria-label={t("detail.back")} onClick={onBack}>
            <ArrowLeft />
          </Button>
          <span className="truncate text-label text-text-muted">{vault}</span>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-4 pt-7 pb-10 sm:px-6 lg:px-10">
            <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
              <ItemIcon item={item} size="xl" className="shadow-card" />
              <div className="min-w-0 flex-1">
                <h2 className="text-title-sm break-words text-text">{itemTitle(item, t)}</h2>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <Badge tone="accent">{t(category.label)}</Badge>
                  <span className="inline-flex h-5 items-center gap-1.5 rounded-full bg-surface-raised px-2 text-2xs font-semibold text-text-muted ring-1 ring-hairline ring-inset">
                    <span aria-hidden="true" className={`size-1.5 rounded-full ${tagDotClassName[dotColor]}`} />
                    {vault}
                  </span>
                  {url && safeHref(url) && (
                    <a
                      href={safeHref(url)}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="ml-1 inline-flex items-center gap-1 rounded text-caption text-text-muted hover:text-accent"
                    >
                      {hostname(url)}
                      <ExternalLink className="size-3" aria-hidden="true" />
                    </a>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-0.5 max-sm:order-last max-sm:-ml-2 max-sm:w-full">
                {canEdit && (
                  <Tooltip content={data.favorite ? t("detail.unfavorite") : t("detail.favorite")}>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={data.favorite ? t("detail.unfavorite") : t("detail.favorite")}
                      aria-pressed={data.favorite}
                      onClick={toggleFavorite}
                    >
                      <Star className={data.favorite ? "fill-warning text-warning" : undefined} />
                    </Button>
                  </Tooltip>
                )}
                {canEdit && (
                  <Tooltip
                    content={
                      <span className="flex items-center gap-2">
                        {t("action.edit")} <Kbd>E</Kbd>
                      </span>
                    }
                  >
                    <Button variant="ghost" size="icon" aria-label={t("action.edit")} onClick={() => onEdit(item.id)}>
                      <Pencil />
                    </Button>
                  </Tooltip>
                )}
                {!guest && (
                  <Tooltip content={audience.shared ? t("sharing.detail.whoHasAccess") : t("sharing.detail.share")}>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={audience.shared ? t("sharing.detail.whoHasAccess") : t("sharing.detail.share")}
                      onClick={() => setSharing(true)}
                    >
                      <Share2 />
                    </Button>
                  </Tooltip>
                )}
                <Menu>
                  <MenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label={t("detail.more")}>
                      <MoreHorizontal />
                    </Button>
                  </MenuTrigger>
                  <MenuContent>
                    {username && (
                      <MenuItem
                        icon={<Copy />}
                        onSelect={() => {
                          reportUsage("item_copied", FIELD.username);
                          void copyToClipboard(username, t("field.username"));
                        }}
                      >
                        {t("list.copyUsername")}
                      </MenuItem>
                    )}
                    {password && (
                      <MenuItem
                        icon={<Copy />}
                        onSelect={() => {
                          reportUsage("item_copied", FIELD.password);
                          void copyToClipboard(password, t("field.password"));
                        }}
                      >
                        {t("list.copyPassword")}
                      </MenuItem>
                    )}
                    {url && safeHref(url) && (
                      <MenuItem
                        icon={<ExternalLink />}
                        onSelect={() => window.open(safeHref(url), "_blank", "noopener")}
                      >
                        {t("change.openWebsite")}
                      </MenuItem>
                    )}
                    {(username || password || url) && <MenuSeparator />}
                    {!guest && (
                      <MenuItem icon={<Link2 />} onSelect={() => setLinking(true)}>
                        {t("shareLink.menu")}
                      </MenuItem>
                    )}
                    {canEdit && (
                      <MenuItem icon={<ArrowRightLeft />} onSelect={() => setMoving(true)}>
                        {t("move.menu")}
                      </MenuItem>
                    )}
                    {canEdit && !data.archivedAt && (
                      <MenuItem icon={<Archive />} onSelect={() => void archive()}>
                        {t("archive.action")}
                      </MenuItem>
                    )}
                    {canEdit && (
                      <MenuItem icon={<Trash2 />} tone="danger" onSelect={() => void moveToTrash()}>
                        {t("action.moveToTrash")}
                      </MenuItem>
                    )}
                  </MenuContent>
                </Menu>
              </div>
            </div>

            {data.archivedAt !== undefined && (
              <div
                role="note"
                className="mt-6 flex flex-wrap items-center gap-3 rounded-control bg-surface-raised px-4 py-3 text-body ring-1 ring-hairline ring-inset"
                data-testid="archived-note"
              >
                <Archive className="size-4 shrink-0 text-text-muted" aria-hidden="true" />
                <p className="min-w-0 flex-1">
                  <strong className="font-semibold">{t("archive.note.title")}</strong>{" "}
                  <span className="text-text-muted">{t("archive.note.text")}</span>
                </p>
                {canEdit && (
                  <Button size="xs" variant="secondary" onClick={() => void unarchive()}>
                    <ArchiveRestore />
                    {t("archive.unarchive")}
                  </Button>
                )}
              </div>
            )}

            {!canEdit && (
              <div
                role="note"
                className="mt-6 flex items-start gap-3 rounded-control bg-surface-raised px-4 py-3 text-body ring-1 ring-hairline ring-inset"
              >
                <Eye className="mt-0.5 size-4 shrink-0 text-text-muted" aria-hidden="true" />
                <p data-testid={guest ? "guest-view-only" : undefined}>
                  <strong className="font-semibold">
                    {guest ? t("sharing.guest.title") : t("sharing.viewOnly.title")}
                  </strong>{" "}
                  <span className="text-text-muted">
                    {guest ? t("sharing.guest.text") : t("sharing.viewOnly.text")}
                  </span>
                </p>
              </div>
            )}

            {warnings.length > 0 && (
              <div className="mt-6" data-testid="item-alert">
                <AlertCard
                  tone="warning"
                  variant="banner"
                  title={warnings.some((w) => w.canChange) ? t("detail.alert.title") : t("detail.alert.insecure")}
                  action={
                    warnings.some((w) => w.canChange) && password ? (
                      <button
                        type="button"
                        onClick={() => setChanging(true)}
                        className="inline-flex items-center gap-1.5 rounded-md underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-current"
                      >
                        {t("change.action")}
                        <ExternalLink className="size-3.5" aria-hidden="true" />
                      </button>
                    ) : undefined
                  }
                />
                <ul className="mt-2.5 flex flex-col gap-1 px-1">
                  {warnings.map(({ text }) => (
                    <li key={text} className="flex gap-2 text-body-sm text-text-muted">
                      <span aria-hidden="true" className="mt-[0.45rem] size-1 shrink-0 rounded-full bg-warning" />
                      {text}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {data.category === "environment" && <EnvironmentPanel item={item} />}

            {fields.length > 0 && (
              <Card className="mt-6">
                {fields.map((field) => (
                  <FieldRow
                    key={field.id}
                    field={field}
                    category={data.category}
                    onEdit={canEdit ? () => onEdit(item.id) : undefined}
                  />
                ))}
              </Card>
            )}

            {data.category === "wifi" && <WifiJoinCard item={item} />}

            {data.passkeys && data.passkeys.length > 0 && (
              <Card className="mt-4">
                {data.passkeys.map((passkey) => (
                  <PasskeyRow key={passkey.credentialId} passkey={passkey} />
                ))}
              </Card>
            )}

            {data.notes && (
              <Card className="mt-4">
                <div className="px-4 py-3">
                  <p className="text-xs font-medium text-text-muted">{t("field.notes")}</p>
                  <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-wrap">{data.notes}</p>
                </div>
              </Card>
            )}

            <AttachmentsSection item={item} canEdit={canEdit} />

            {data.tags.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-1.5" aria-label={t("field.tags")}>
                {data.tags.map((tag) => (
                  <li key={tag}>
                    <Badge>{tag}</Badge>
                  </li>
                ))}
              </ul>
            )}

            {data.passwordHistory && data.passwordHistory.length > 0 && (
              <PasswordHistorySection item={item} history={data.passwordHistory} canRestore={canEdit} />
            )}

            <SharedWith audience={audience} onManage={guest ? undefined : () => setSharing(true)} />

            <dl className="mt-8 grid grid-cols-2 gap-4 border-t border-hairline pt-4 text-caption">
              <Meta
                label={t("detail.modified")}
                value={i18n.relativeTime(item.updatedAt)}
                title={i18n.dateTime(item.updatedAt)}
              />
              <Meta label={t("term.vault")} value={vault} />
            </dl>
          </div>
        </div>

        {password && <ChangePasswordDialog item={item} open={changing} onOpenChange={setChanging} />}
        <MoveItemsDialog
          itemIds={[item.id]}
          open={moving}
          onOpenChange={setMoving}
          onMoved={(vaultId) => navigate({ view: "items", filter: { kind: "vault", vaultId }, itemId: item.id })}
        />
        <ShareLinkDialog item={item} open={linking} onOpenChange={setLinking} />
        {audience.shared ? (
          <VaultSharingDialog vaultId={sharing ? item.vaultId : undefined} onOpenChange={setSharing} />
        ) : (
          <ShareItemDialog item={item} open={sharing} onOpenChange={setSharing} navigate={navigate} />
        )}
      </section>
    </ItemUsageContext.Provider>
  );
}

function securityWarnings(
  itemId: string,
  health: VaultHealth,
  t: Translator["t"],
): Array<{ text: string; canChange: boolean }> {
  const warnings: Array<{ text: string; canChange: boolean }> = [];
  if (health.weak.includes(itemId)) warnings.push({ text: t("detail.warning.weak"), canChange: true });
  const reused = health.reused.find((group) => group.includes(itemId));
  if (reused) warnings.push({ text: t("detail.warning.reused", { count: reused.length - 1 }), canChange: true });
  if (health.insecureUrls.includes(itemId)) warnings.push({ text: t("detail.warning.insecure"), canChange: false });
  return warnings;
}

function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={`divide-y divide-hairline rounded-card border border-hairline bg-surface shadow-card ${className ?? ""}`}
    >
      {children}
    </div>
  );
}

/** "Geteilt mit": the people who can see the item's vault, or "only you" with a way to share. */
function SharedWith({
  audience,
  onManage,
}: {
  audience: ReturnType<typeof useAudience>;
  onManage: (() => void) | undefined;
}) {
  const { t } = useI18n();
  const { orgs } = useSnapshot();
  const myId = useMyAccountId();
  const shared = audience.shared;
  const org = audience.org ?? orgs.find((o) => o.id === shared?.orgId);
  const ids = shared && org ? vaultAudienceIds(shared, org) : undefined;
  const people =
    ids && org
      ? org.members.filter((m) => m.accountId !== myId && m.status === "confirmed" && ids.has(m.accountId))
      : [];
  const shown = people.slice(0, 4);
  return (
    <section aria-labelledby="shared-with" className="mt-6">
      <h3 id="shared-with" className="mb-2 px-1 text-caption font-semibold text-text-muted">
        {t("detail.sharedWith")}
      </h3>
      <div className="flex flex-wrap items-center gap-3 rounded-card border border-hairline bg-surface px-4 py-3 shadow-card">
        {shown.length > 0 ? (
          <ul className="flex min-w-0 flex-1 flex-wrap items-center gap-x-5 gap-y-2">
            {shown.map((m) => (
              <li key={m.accountId} className="flex min-w-0 items-center gap-2.5">
                <Avatar name={m.email ?? m.accountId} size="sm" />
                <span className="min-w-0">
                  <span className="block truncate text-label text-text">
                    {m.email ?? t("detail.sharedWith.unknown")}
                  </span>
                  <span className="block truncate text-caption text-text-subtle">{orgName(org, t)}</span>
                </span>
              </li>
            ))}
            {people.length > shown.length && (
              <li className="text-caption text-text-muted">
                {t("detail.sharedWith.more", { count: people.length - shown.length })}
              </li>
            )}
          </ul>
        ) : (
          <span className="flex min-w-0 flex-1 items-center gap-2.5 text-body text-text-muted">
            <span className="flex size-8 items-center justify-center rounded-full bg-surface-raised text-text-subtle">
              <AudienceIcon shared={audience.shared !== undefined} className="size-4" />
            </span>
            {audience.shared ? t("sharing.audience.visibleFor", { audience: audience.label }) : audience.label}
          </span>
        )}
        {onManage && (
          <button
            type="button"
            onClick={onManage}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-label text-accent hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-focus coarse:py-3"
            data-testid="item-audience"
          >
            {audience.shared ? (
              <>
                <span className="sr-only">{t("sharing.audience.visibleFor", { audience: audience.label })} · </span>
                {t("detail.sharedWith.manage")}
              </>
            ) : (
              <>
                <span className="sr-only">{audience.label} · </span>
                {t("detail.share")}
              </>
            )}
          </button>
        )}
      </div>
    </section>
  );
}

function Meta({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div>
      <dt className="text-text-muted">{label}</dt>
      <dd className="mt-0.5 font-medium text-text" title={title}>
        {value}
      </dd>
    </div>
  );
}

/** Earlier passwords (S4, family P0): reveal, copy or restore one after a confirmation. */
function PasswordHistorySection({
  item,
  history,
  canRestore,
}: {
  item: Item;
  history: PasswordHistoryEntry[];
  canRestore: boolean;
}) {
  const client = useClient();
  const i18n = useI18n();
  const { t } = i18n;
  const [restoring, setRestoring] = useState<PasswordHistoryEntry>();
  const reportUsage = useItemUsage();

  async function restore(entry: PasswordHistoryEntry) {
    try {
      await client.updateItem(item.id, {
        ...item.data,
        fields: item.data.fields.map((f) => (f.id === FIELD.password ? { ...f, value: entry.value } : f)),
      });
      toast.success(t("history.restored"), { description: t("history.restoredHint") });
    } catch (error) {
      toast.error(t("detail.updateFailed"), { description: errorMessage(error) });
    }
  }

  return (
    <details className="group mt-4 rounded-card border border-border bg-surface shadow-card">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-[0.8125rem] font-medium coarse:py-4">
        <History className="size-4 text-text-muted" aria-hidden="true" />
        <span className="flex-1">{t("term.passwordHistory")}</span>
        <span className="text-xs font-normal text-text-muted">{history.length}</span>
        <ChevronRight className="size-4 text-text-muted transition-transform group-open:rotate-90" aria-hidden="true" />
      </summary>
      <ul className="divide-y divide-border border-t border-border">
        {history.map((entry) => (
          <li key={`${entry.replacedAt}-${entry.value.length}`} className="flex items-center gap-3 px-4 py-2.5">
            <div className="min-w-0 flex-1">
              <SecretText value={entry.value} label={t("field.password")} />
              <p className="text-xs text-text-muted" title={i18n.dateTime(entry.replacedAt)}>
                {t("history.replaced", { date: i18n.date(entry.replacedAt) })}
              </p>
            </div>
            <Tooltip content={t("history.copy")}>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("history.copy")}
                onClick={() => {
                  reportUsage("item_copied", "password_history");
                  void copyToClipboard(entry.value, t("history.previousPassword"));
                }}
              >
                <Copy />
              </Button>
            </Tooltip>
            {canRestore && (
              <Button variant="secondary" size="xs" onClick={() => setRestoring(entry)}>
                <RotateCcw />
                {t("action.restore")}
              </Button>
            )}
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={restoring !== undefined}
        onOpenChange={(open) => !open && setRestoring(undefined)}
        title={t("history.confirmTitle")}
        description={t("history.confirmText")}
        confirmLabel={t("action.restore")}
        onConfirm={() => restoring && void restore(restoring)}
      />
    </details>
  );
}

/** A masked secret with a reveal toggle that hides again after 30 seconds or when the window loses focus. */
function SecretText({ value, label }: { value: string; label: string }) {
  const { t } = useI18n();
  const [revealed, setRevealed] = useAutoHide();
  const reportUsage = useItemUsage();
  return (
    <span className="flex items-center gap-1">
      <span className="truncate font-mono text-[0.8125rem]">
        {revealed ? <ColoredPassword value={value} /> : "••••••••••••"}
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={revealed ? t("detail.hide", { label }) : t("detail.reveal", { label })}
        onClick={() => {
          if (!revealed) reportUsage("secret_revealed", "password_history");
          setRevealed(!revealed);
        }}
      >
        {revealed ? <EyeOff /> : <Eye />}
      </Button>
    </span>
  );
}

/** Read-only passkey summary. The private key is never shown or copied. */
function PasskeyRow({ passkey }: { passkey: Passkey }) {
  const i18n = useI18n();
  const { t } = i18n;
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
        <Fingerprint className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-text-muted">
          {t("term.passkey")}
          {passkey.createdAt ? (
            <>
              {" · "}
              <span title={i18n.dateTime(passkey.createdAt)}>
                {t("detail.passkeyCreated", { time: i18n.relativeTime(passkey.createdAt) })}
              </span>
            </>
          ) : null}
        </p>
        <p className="mt-0.5 truncate text-sm">
          {passkey.userName || passkey.userDisplayName || t("term.passkey")}
          <span className="text-text-muted"> · {passkey.rpId}</span>
        </p>
      </div>
      <Badge tone="accent">{t("term.passkey")}</Badge>
    </div>
  );
}

function FieldRow({
  field,
  category,
  onEdit,
}: {
  field: ItemField;
  category?: ItemCategory;
  onEdit: (() => void) | undefined;
}) {
  const { t } = useI18n();
  const label = fieldLabel(field, t, category);
  return (
    <div className="group flex items-center gap-4 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-text-muted">{label}</p>
        <div className="mt-1 min-h-6 text-sm">
          <FieldValue field={field} label={label} onEdit={onEdit} />
        </div>
      </div>
      <FieldActions field={field} label={label} />
    </div>
  );
}

function FieldValue({ field, label, onEdit }: { field: ItemField; label: string; onEdit: (() => void) | undefined }) {
  const i18n = useI18n();
  if (field.type === "text" && field.format) {
    switch (field.format) {
      case "multiline":
        return <span className="break-words whitespace-pre-wrap">{field.value}</span>;
      case "date": {
        const date = /^\d{4}-\d{2}-\d{2}$/.test(field.value) ? new Date(`${field.value}T12:00:00`) : undefined;
        return <span>{date && !Number.isNaN(date.getTime()) ? i18n.date(date.getTime()) : field.value}</span>;
      }
      case "phone":
        return (
          <a href={`tel:${field.value.replace(/[^+\d]/g, "")}`} className="text-accent hover:underline">
            {field.value}
          </a>
        );
    }
  }
  switch (field.type) {
    case "concealed":
      return field.format === "multiline" ? (
        <ConcealedBlock field={field} label={label} />
      ) : (
        <ConcealedValue field={field} label={label} />
      );
    case "totp":
      return <TotpValue uri={field.value} onEdit={onEdit} />;
    case "url": {
      const href = safeHref(field.value);
      return href ? (
        <a href={href} target="_blank" rel="noreferrer noopener" className="break-all text-accent hover:underline">
          {field.value}
        </a>
      ) : (
        <span className="break-all">{field.value}</span>
      );
    }
    default:
      return <span className="break-all">{field.value}</span>;
  }
}

function FieldActions({ field, label }: { field: ItemField; label: string }) {
  const { t } = useI18n();
  const reportUsage = useItemUsage();
  if (field.type === "totp" || field.type === "concealed") return null;
  return (
    <span>
      <Tooltip content={t("detail.copy", { label })}>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("detail.copy", { label })}
          onClick={() => {
            reportUsage("item_copied", field.id);
            void copyToClipboard(field.value, label);
          }}
        >
          <Copy />
        </Button>
      </Tooltip>
    </span>
  );
}

/** A secret with line breaks (private keys, recovery phrases): hidden until revealed, shown as a block. */
function ConcealedBlock({ field, label }: { field: ItemField; label: string }) {
  const [revealed, setRevealed] = useAutoHide();
  const reportUsage = useItemUsage();
  const { t } = useI18n();
  return (
    <div className="flex items-start justify-between gap-3">
      {revealed ? (
        <pre className="max-h-64 min-w-0 flex-1 overflow-auto rounded-md bg-surface-sunken p-2 font-mono text-xs whitespace-pre-wrap break-all">
          {field.value}
        </pre>
      ) : (
        <span className="font-mono text-[0.8125rem] tracking-tight">••••••••••••</span>
      )}
      <span className="flex shrink-0 items-center">
        <Tooltip content={revealed ? t("action.hide") : t("action.show")}>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => {
              if (!revealed) reportUsage("secret_revealed", field.id);
              setRevealed(!revealed);
            }}
            aria-label={revealed ? t("detail.hide", { label }) : t("detail.reveal", { label })}
          >
            {revealed ? <EyeOff /> : <Eye />}
          </Button>
        </Tooltip>
        <Tooltip content={t("detail.copy", { label })}>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("detail.copy", { label })}
            onClick={() => {
              reportUsage("item_copied", field.id);
              void copyToClipboard(field.value, label);
            }}
          >
            <Copy />
          </Button>
        </Tooltip>
      </span>
    </div>
  );
}

function ConcealedValue({ field, label }: { field: ItemField; label: string }) {
  const [revealed, setRevealed] = useAutoHide();
  const [large, setLarge] = useState(false);
  const client = useClient();
  const reportUsage = useItemUsage();
  const { t } = useI18n();
  const strength = field.id === FIELD.password ? client.estimateStrength(field.value) : undefined;
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate font-mono text-[0.8125rem] tracking-tight">
          {revealed ? <ColoredPassword value={field.value} /> : "••••••••••••"}
        </span>
        {strength && (
          <Badge tone={strength.score >= 3 ? "success" : strength.score === 2 ? "warning" : "danger"}>
            {t(`strength.${strength.score}`)}
          </Badge>
        )}
      </div>
      <span className="flex shrink-0 items-center">
        <Tooltip content={revealed ? t("action.hide") : t("action.show")}>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => {
              if (!revealed) reportUsage("secret_revealed", field.id);
              setRevealed(!revealed);
            }}
            aria-label={revealed ? t("detail.hide", { label }) : t("detail.reveal", { label })}
          >
            {revealed ? <EyeOff /> : <Eye />}
          </Button>
        </Tooltip>
        <Tooltip content={t("detail.large")}>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("detail.large")}
            onClick={() => {
              reportUsage("secret_revealed", field.id);
              setLarge(true);
            }}
          >
            <Maximize2 />
          </Button>
        </Tooltip>
        <Tooltip content={t("detail.copy", { label })}>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("detail.copy", { label })}
            onClick={() => {
              reportUsage("item_copied", field.id);
              void copyToClipboard(field.value, label);
            }}
          >
            <Copy />
          </Button>
        </Tooltip>
      </span>
      {large && <LargeType value={field.value} onClose={() => setLarge(false)} />}
    </div>
  );
}

/** Full-screen display of a secret, for typing it on another device. */
function LargeType({ value, onClose }: { value: string; onClose: () => void }) {
  const { t } = useI18n();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    window.addEventListener("blur", onClose);
    const timer = setTimeout(onClose, 60_000);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("blur", onClose);
      clearTimeout(timer);
    };
  }, [onClose]);
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label={t("detail.closeLarge")}
      className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-black/70 p-4 backdrop-blur-sm sm:p-8"
    >
      <span className="flex flex-wrap justify-center gap-1 rounded-card bg-surface p-4 shadow-overlay sm:p-8">
        {Array.from(value).map((char, index) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: characters repeat; position is the identity
            key={index}
            className="flex w-10 flex-col items-center rounded-md bg-surface-raised py-2 sm:w-12"
          >
            <span className="font-mono text-3xl sm:text-4xl">
              <ColoredPassword value={char} />
            </span>
            <span className="text-2xs text-text-muted">{index + 1}</span>
          </span>
        ))}
      </span>
    </button>
  );
}

function TotpValue({ uri, onEdit }: { uri: string; onEdit: (() => void) | undefined }) {
  const { t } = useI18n();
  const reportUsage = useItemUsage();
  const totp = useTotp(uri);
  if (totp === undefined) return <span className="text-text-muted">…</span>;
  if (totp === "invalid") {
    return (
      <span className="flex flex-wrap items-center gap-2 text-danger">
        {t("detail.totpInvalid")}
        {onEdit && (
          <Button variant="secondary" size="xs" onClick={onEdit}>
            <Pencil />
            {t("action.edit")}
          </Button>
        )}
      </span>
    );
  }
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-3">
        <span className="font-mono text-xl font-medium tracking-[0.15em]">
          {totp.code.slice(0, 3)} {totp.code.slice(3)}
        </span>
        <CountdownRing remaining={totp.remaining} period={totp.period} />
      </span>
      <Tooltip content={t("list.copyCode")}>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("list.copyCode")}
          onClick={() => {
            reportUsage("item_copied", "totp");
            void copyToClipboard(totp.code, t("list.code"));
          }}
        >
          <Copy />
        </Button>
      </Tooltip>
    </div>
  );
}
