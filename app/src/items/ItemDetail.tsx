import {
  FIELD,
  fieldValue,
  type Item,
  type ItemField,
  type Passkey,
  type PasswordHistoryEntry,
  type VaultHealth,
} from "@passbox/client";
import {
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
  Monogram,
  Tooltip,
  toast,
} from "@passbox/ui";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Fingerprint,
  History,
  KeyRound,
  Maximize2,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Share2,
  Star,
  Trash2,
} from "lucide-react";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { errorMessage } from "../core";
import { copyToClipboard } from "../lib/clipboard";
import { shortcut, type Translator, useI18n } from "../lib/i18n";
import { CATEGORY_META, fieldLabel, hostname, itemTitle, safeHref } from "../lib/items";
import type { Route } from "../lib/route";
import { AudienceIcon, useAudience } from "../sharing/common";
import { ShareItemDialog } from "../sharing/ShareItemDialog";
import { VaultSharingDialog } from "../sharing/VaultSharingDialog";
import { vaultName } from "../shell/Sidebar";
import { useClient, useSnapshot } from "../useClient";
import { ChangePasswordDialog } from "./ChangePasswordDialog";
import { ColoredPassword } from "./ColoredPassword";
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
  const { vaults } = useSnapshot();
  const [changing, setChanging] = useState(false);
  const [sharing, setSharing] = useState(false);
  const itemVault = vaults.find((v) => v.id === item?.vaultId);
  const audience = useAudience(item?.vaultId);
  // View-only members of a shared vault can read, copy and fill, not change.
  const canEdit = !itemVault?.orgId || itemVault.role === "edit" || itemVault.role === "manage";

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

  return (
    <ItemUsageContext.Provider value={reportUsage}>
      <section aria-label={itemTitle(item, t)} className="flex min-w-0 flex-1 flex-col bg-canvas" key={item.id}>
        <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border bg-surface px-4 coarse:h-16">
          <div className="flex min-w-0 items-center gap-1.5 text-[0.8125rem] text-text-muted">
            <Button variant="ghost" size="icon-sm" aria-label={t("detail.back")} onClick={onBack} className="md:hidden">
              <ArrowLeft />
            </Button>
            <AudienceIcon shared={audience.shared !== undefined} className="hidden shrink-0 sm:inline" />
            <span className="hidden truncate sm:inline">{vault}</span>
            <ChevronRight className="hidden size-3.5 shrink-0 text-text-muted sm:inline" aria-hidden="true" />
            <span className="truncate">{t(category.label)}</span>
          </div>
          <div className="flex items-center gap-1">
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
              <Button variant="secondary" size="sm" onClick={() => onEdit(item.id)}>
                <Pencil />
                {t("action.edit")}
                <span className="ml-1 hidden sm:inline">
                  <Kbd>E</Kbd>
                </span>
              </Button>
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
                  <MenuItem icon={<ExternalLink />} onSelect={() => window.open(safeHref(url), "_blank", "noopener")}>
                    {t("change.openWebsite")}
                  </MenuItem>
                )}
                {(username || password || url) && <MenuSeparator />}
                <MenuItem icon={<Share2 />} onSelect={() => setSharing(true)}>
                  {audience.shared ? t("sharing.detail.whoHasAccess") : t("sharing.detail.share")}
                </MenuItem>
                {canEdit && (
                  <MenuItem icon={<Trash2 />} tone="danger" onSelect={() => void moveToTrash()}>
                    {t("action.moveToTrash")}
                  </MenuItem>
                )}
              </MenuContent>
            </Menu>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-10">
            <div className="flex items-center gap-4">
              <Monogram name={data.title} size="xl" icon={data.category === "login" ? undefined : <category.icon />} />
              <div className="min-w-0">
                <h2 className="text-2xl font-semibold tracking-tight break-words">{itemTitle(item, t)}</h2>
                {url && safeHref(url) ? (
                  <a
                    href={safeHref(url)}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="mt-0.5 inline-flex items-center gap-1 text-[0.8125rem] text-text-muted hover:text-accent"
                  >
                    {hostname(url)}
                    <ExternalLink className="size-3" aria-hidden="true" />
                  </a>
                ) : (
                  <p className="mt-0.5 text-[0.8125rem] text-text-muted">{t(category.label)}</p>
                )}
                <button
                  type="button"
                  onClick={() => setSharing(true)}
                  className="mt-1.5 flex items-center gap-1.5 rounded-md text-xs text-text-muted hover:text-accent coarse:py-2"
                  data-testid="item-audience"
                >
                  <AudienceIcon shared={audience.shared !== undefined} />
                  {audience.shared ? t("sharing.audience.visibleFor", { audience: audience.label }) : audience.label}
                </button>
              </div>
            </div>

            {!canEdit && (
              <div
                role="note"
                className="mt-6 flex items-start gap-3 rounded-lg border border-border bg-surface-raised px-4 py-3 text-[0.8125rem]"
              >
                <Eye className="mt-0.5 size-4 shrink-0 text-text-muted" aria-hidden="true" />
                <p>
                  <strong className="font-semibold">{t("sharing.viewOnly.title")}</strong>{" "}
                  <span className="text-text-muted">{t("sharing.viewOnly.text")}</span>
                </p>
              </div>
            )}

            {warnings.length > 0 && (
              <div className="mt-6 flex flex-col gap-2">
                {warnings.map(({ text, canChange }) => (
                  <div
                    key={text}
                    className="flex flex-wrap items-start gap-3 rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-[0.8125rem]"
                  >
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
                    <span className="min-w-0 flex-1">{text}</span>
                    {canChange && password && (
                      <Button size="xs" variant="secondary" onClick={() => setChanging(true)}>
                        {t("change.action")}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {fields.length > 0 && (
              <Card className="mt-6">
                {fields.map((field) => (
                  <FieldRow key={field.id} field={field} onEdit={canEdit ? () => onEdit(item.id) : undefined} />
                ))}
              </Card>
            )}

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

            <dl className="mt-8 grid grid-cols-2 gap-4 border-t border-border pt-4 text-xs">
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
      className={`divide-y divide-border rounded-card border border-border bg-surface shadow-card ${className ?? ""}`}
    >
      {children}
    </div>
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

function FieldRow({ field, onEdit }: { field: ItemField; onEdit: (() => void) | undefined }) {
  const { t } = useI18n();
  const label = fieldLabel(field, t);
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
  switch (field.type) {
    case "concealed":
      return <ConcealedValue field={field} label={label} />;
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
    <span className="opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 coarse:opacity-100">
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
