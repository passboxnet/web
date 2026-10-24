import { estimateStrength, FIELD, fieldValue, type Item, type ItemField, type VaultHealth } from "@passbox/client";
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
  KeyRound,
  Maximize2,
  MoreHorizontal,
  Pencil,
  Star,
  Trash2,
} from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { errorMessage } from "../core";
import { copyToClipboard } from "../lib/clipboard";
import { CATEGORY_META, hostname, relativeTime, safeHref } from "../lib/items";
import { useClient, useSnapshot } from "../useClient";
import { CountdownRing, useTotp } from "./TotpCode";

interface ItemDetailProps {
  item: Item | undefined;
  health: VaultHealth;
  onEdit: (id: string) => void;
  onBack: () => void;
  onDeleted: () => void;
}

export function ItemDetail({ item, health, onEdit, onBack, onDeleted }: ItemDetailProps) {
  const client = useClient();
  const { vaults } = useSnapshot();
  const [confirmDelete, setConfirmDelete] = useState(false);

  // "e" edits the selected item when focus is not in a text field.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (!item || event.metaKey || event.ctrlKey || ["INPUT", "TEXTAREA"].includes(target.tagName)) return;
      if (event.key === "e") {
        event.preventDefault();
        onEdit(item.id);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item, onEdit]);

  if (!item) {
    return (
      <section className="flex flex-1 items-center justify-center bg-canvas">
        <EmptyState
          icon={<KeyRound />}
          title="No item selected"
          description="Choose an item from the list, or press ⌘K to search everything."
        />
      </section>
    );
  }

  const { data } = item;
  const vaultName = vaults.find((v) => v.id === item.vaultId)?.name ?? "Vault";
  const category = CATEGORY_META[data.category];
  const url = fieldValue(data, FIELD.url);
  const username = fieldValue(data, FIELD.username);
  const password = fieldValue(data, FIELD.password);
  const fields = data.fields.filter((field) => field.value);
  const warnings = securityWarnings(item.id, health);

  async function toggleFavorite() {
    if (!item) return;
    try {
      await client.updateItem(item.id, { ...item.data, favorite: !item.data.favorite });
    } catch (error) {
      toast.error("Could not update the item", { description: errorMessage(error) });
    }
  }

  async function remove() {
    if (!item) return;
    try {
      await client.deleteItem(item.id);
      toast.success(`"${data.title || "Untitled"}" deleted`);
      onDeleted();
    } catch (error) {
      toast.error("Could not delete the item", { description: errorMessage(error) });
    }
  }

  return (
    <section aria-label={data.title || "Item"} className="flex min-w-0 flex-1 flex-col bg-canvas" key={item.id}>
      <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border bg-surface px-4">
        <div className="flex min-w-0 items-center gap-1.5 text-[13px] text-text-muted">
          <Button variant="ghost" size="icon-sm" aria-label="Back to list" onClick={onBack} className="md:hidden">
            <ArrowLeft />
          </Button>
          <span className="truncate">{vaultName}</span>
          <ChevronRight className="size-3.5 shrink-0 text-text-subtle" aria-hidden="true" />
          <span className="truncate">{category.label}</span>
        </div>
        <div className="flex items-center gap-1">
          <Tooltip content={data.favorite ? "Remove from favorites" : "Add to favorites"}>
            <Button
              variant="ghost"
              size="icon"
              aria-label={data.favorite ? "Remove from favorites" : "Add to favorites"}
              aria-pressed={data.favorite}
              onClick={toggleFavorite}
            >
              <Star className={data.favorite ? "fill-warning text-warning" : undefined} />
            </Button>
          </Tooltip>
          <Button variant="secondary" size="sm" onClick={() => onEdit(item.id)}>
            <Pencil />
            Edit
            <span className="ml-1 hidden sm:inline">
              <Kbd>E</Kbd>
            </span>
          </Button>
          <Menu>
            <MenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="More actions">
                <MoreHorizontal />
              </Button>
            </MenuTrigger>
            <MenuContent>
              {username && (
                <MenuItem icon={<Copy />} onSelect={() => copyToClipboard(username, "Username")}>
                  Copy username
                </MenuItem>
              )}
              {password && (
                <MenuItem icon={<Copy />} onSelect={() => copyToClipboard(password, "Password")}>
                  Copy password
                </MenuItem>
              )}
              {url && safeHref(url) && (
                <MenuItem icon={<ExternalLink />} onSelect={() => window.open(safeHref(url), "_blank", "noopener")}>
                  Open website
                </MenuItem>
              )}
              {(username || password || url) && <MenuSeparator />}
              <MenuItem icon={<Trash2 />} tone="danger" onSelect={() => setConfirmDelete(true)}>
                Delete item
              </MenuItem>
            </MenuContent>
          </Menu>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-6 py-8 lg:px-10">
          <div className="flex items-center gap-4">
            <Monogram name={data.title} size="xl" icon={data.category === "login" ? undefined : <category.icon />} />
            <div className="min-w-0">
              <h2 className="truncate text-2xl font-semibold tracking-tight">{data.title || "Untitled"}</h2>
              {url && safeHref(url) ? (
                <a
                  href={safeHref(url)}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-0.5 inline-flex items-center gap-1 text-[13px] text-text-muted hover:text-accent"
                >
                  {hostname(url)}
                  <ExternalLink className="size-3" aria-hidden="true" />
                </a>
              ) : (
                <p className="mt-0.5 text-[13px] text-text-muted">{category.label}</p>
              )}
            </div>
          </div>

          {warnings.length > 0 && (
            <div className="mt-6 flex flex-col gap-2">
              {warnings.map((warning) => (
                <div
                  key={warning}
                  className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-[13px]"
                >
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
                  <span>{warning}</span>
                </div>
              ))}
            </div>
          )}

          {fields.length > 0 && (
            <Card className="mt-6">
              {fields.map((field) => (
                <FieldRow key={field.id} field={field} />
              ))}
            </Card>
          )}

          {data.notes && (
            <Card className="mt-4">
              <div className="px-4 py-3">
                <p className="text-2xs font-medium text-text-subtle">Notes</p>
                <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed">{data.notes}</p>
              </div>
            </Card>
          )}

          {data.tags.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Tags">
              {data.tags.map((tag) => (
                <li key={tag}>
                  <Badge>{tag}</Badge>
                </li>
              ))}
            </ul>
          )}

          <dl className="mt-8 grid grid-cols-2 gap-4 border-t border-border pt-4 text-xs sm:grid-cols-3">
            <Meta
              label="Last modified"
              value={relativeTime(item.updatedAt)}
              title={new Date(item.updatedAt).toLocaleString()}
            />
            <Meta label="Vault" value={vaultName} />
            <Meta label="Revision" value={String(item.revision)} />
          </dl>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this item?"
        description={`"${data.title || "Untitled"}" will be deleted on all your devices. This cannot be undone.`}
        confirmLabel="Delete item"
        tone="danger"
        onConfirm={remove}
      />
    </section>
  );
}

function securityWarnings(itemId: string, health: VaultHealth): string[] {
  const warnings: string[] = [];
  if (health.weak.includes(itemId))
    warnings.push("This password is weak. Change it on the website and generate a strong one.");
  const reused = health.reused.find((group) => group.includes(itemId));
  if (reused)
    warnings.push(
      `This password is used in ${reused.length - 1} other ${reused.length === 2 ? "item" : "items"}. If one site is breached, all of them are at risk.`,
    );
  if (health.insecureUrls.includes(itemId)) warnings.push("This website uses an unencrypted http:// address.");
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
      <dt className="text-text-subtle">{label}</dt>
      <dd className="mt-0.5 font-medium text-text-muted" title={title}>
        {value}
      </dd>
    </div>
  );
}

function FieldRow({ field }: { field: ItemField }) {
  return (
    <div className="group flex items-center gap-4 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-2xs font-medium text-text-subtle">{field.label}</p>
        <div className="mt-1 min-h-6 text-sm">
          <FieldValue field={field} />
        </div>
      </div>
      <FieldActions field={field} />
    </div>
  );
}

function FieldValue({ field }: { field: ItemField }) {
  switch (field.type) {
    case "concealed":
      return <ConcealedValue field={field} />;
    case "totp":
      return <TotpValue uri={field.value} />;
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

function FieldActions({ field }: { field: ItemField }) {
  if (field.type === "totp" || field.type === "concealed") return null;
  return (
    <span className="opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
      <Tooltip content={`Copy ${field.label.toLowerCase()}`}>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Copy ${field.label}`}
          onClick={() => copyToClipboard(field.value, field.label)}
        >
          <Copy />
        </Button>
      </Tooltip>
    </span>
  );
}

function ConcealedValue({ field }: { field: ItemField }) {
  const [revealed, setRevealed] = useState(false);
  const [large, setLarge] = useState(false);
  const strength = field.id === FIELD.password ? estimateStrength(field.value) : undefined;
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate font-mono text-[13px] tracking-tight">
          {revealed ? <ColoredPassword value={field.value} /> : "••••••••••••"}
        </span>
        {strength && (
          <Badge tone={strength.score >= 3 ? "success" : strength.score === 2 ? "warning" : "danger"}>
            {strength.label}
          </Badge>
        )}
      </div>
      <span className="flex shrink-0 items-center">
        <Tooltip content={revealed ? "Hide" : "Reveal"}>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setRevealed((r) => !r)}
            aria-label={revealed ? `Hide ${field.label}` : `Reveal ${field.label}`}
          >
            {revealed ? <EyeOff /> : <Eye />}
          </Button>
        </Tooltip>
        <Tooltip content="Show in large type">
          <Button variant="ghost" size="icon-sm" aria-label="Show in large type" onClick={() => setLarge(true)}>
            <Maximize2 />
          </Button>
        </Tooltip>
        <Tooltip content={`Copy ${field.label.toLowerCase()}`}>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Copy ${field.label}`}
            onClick={() => copyToClipboard(field.value, field.label)}
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
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label="Close large type"
      className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-black/70 p-8 backdrop-blur-sm"
    >
      <span className="flex flex-wrap justify-center gap-1 rounded-card bg-surface p-8 shadow-overlay">
        {Array.from(value).map((char, index) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: characters repeat; position is the identity
            key={index}
            className="flex w-12 flex-col items-center rounded-md bg-surface-raised py-2"
          >
            <span className="font-mono text-4xl">
              <ColoredPassword value={char} />
            </span>
            <span className="text-2xs text-text-subtle">{index + 1}</span>
          </span>
        ))}
      </span>
    </button>
  );
}

function TotpValue({ uri }: { uri: string }) {
  const totp = useTotp(uri);
  if (totp === undefined) return <span className="text-text-muted">…</span>;
  if (totp === "invalid") return <span className="text-danger">Invalid one-time password setup</span>;
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-3">
        <span className="font-mono text-xl font-medium tracking-[0.15em]">
          {totp.code.slice(0, 3)} {totp.code.slice(3)}
        </span>
        <CountdownRing remaining={totp.remaining} period={totp.period} />
      </span>
      <Tooltip content="Copy code">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Copy one-time password"
          onClick={() => copyToClipboard(totp.code, "One-time password")}
        >
          <Copy />
        </Button>
      </Tooltip>
    </div>
  );
}

/** Digits and symbols get their own colors so passwords are easier to read and type. */
export function ColoredPassword({ value }: { value: string }) {
  return (
    <>
      {Array.from(value).map((char, index) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: characters repeat; position is the identity
          key={index}
          className={/[0-9]/.test(char) ? "text-accent" : /[^a-zA-Z0-9]/.test(char) ? "text-danger" : undefined}
        >
          {char}
        </span>
      ))}
    </>
  );
}
