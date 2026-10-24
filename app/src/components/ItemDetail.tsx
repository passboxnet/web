import { Button } from "@passbox/ui";
import { ExternalLink, Eye, EyeOff, Pencil, Star, Trash2 } from "lucide-react";
import { type ReactNode, useState } from "react";
import { CopyButton } from "./CopyButton";
import { ItemIcon } from "./ItemIcon";
import { type Item, type ItemField, useConfirmDelete } from "./itemActions";
import { TotpField } from "./TotpField";

interface ItemDetailProps {
  item: Item | undefined;
  vaultName: string | undefined;
  onEdit: (id: string) => void;
}

export function ItemDetail({ item, vaultName, onEdit }: ItemDetailProps) {
  const confirmDelete = useConfirmDelete();
  if (!item) {
    return (
      <section className="flex flex-1 items-center justify-center text-sm text-text-muted max-md:hidden">
        Select an item
      </section>
    );
  }
  const { data } = item;
  const fields = data.fields.filter((field) => field.value);
  return (
    <section aria-label={data.title} className="flex-1 overflow-y-auto p-8 max-md:hidden" key={item.id}>
      <header className="mb-8 flex items-center gap-4">
        <ItemIcon title={data.title} category={data.category} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 truncate text-2xl font-semibold">
            {data.title || "Untitled"}
            {data.favorite && <Star className="size-4 fill-warning text-warning" aria-label="Favorite" />}
          </h1>
          <p className="text-sm text-text-muted">{vaultName}</p>
        </div>
        <Button variant="secondary" onClick={() => onEdit(item.id)}>
          <Pencil className="size-4" aria-hidden="true" />
          Edit
        </Button>
        <Button variant="ghost" aria-label="Delete item" onClick={() => confirmDelete(item)}>
          <Trash2 className="size-4" />
        </Button>
      </header>
      {fields.length > 0 && (
        <dl className="divide-y divide-border rounded-card border border-border bg-surface">
          {fields.map((field) => (
            <Field key={field.id} label={field.label}>
              <FieldValue field={field} />
            </Field>
          ))}
        </dl>
      )}
      {data.notes && (
        <dl className="mt-6 rounded-card border border-border bg-surface">
          <Field label="Notes">
            <p className="whitespace-pre-wrap">{data.notes}</p>
          </Field>
        </dl>
      )}
      {data.tags.length > 0 && (
        <ul className="mt-6 flex gap-2" aria-label="Tags">
          {data.tags.map((tag) => (
            <li key={tag} className="rounded-full bg-surface-raised px-3 py-1 text-xs text-text-muted">
              {tag}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-6 text-xs text-text-muted">Last modified {new Date(item.updatedAt).toLocaleString()}</p>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="group px-4 py-3">
      <dt className="text-xs font-medium text-text-muted">{label}</dt>
      <dd className="mt-1 flex min-h-8 items-center justify-between gap-3 text-sm">{children}</dd>
    </div>
  );
}

function FieldValue({ field }: { field: ItemField }) {
  switch (field.type) {
    case "concealed":
      return <ConcealedValue value={field.value} label={field.label} />;
    case "totp":
      return <TotpField uri={field.value} />;
    case "url":
      return (
        <>
          <a
            href={safeUrl(field.value)}
            target="_blank"
            rel="noreferrer noopener"
            className="truncate text-accent hover:underline"
          >
            {field.value}
          </a>
          <ExternalLink className="size-4 shrink-0 text-text-muted" aria-hidden="true" />
        </>
      );
    default:
      return (
        <>
          <span className="truncate">{field.value}</span>
          <CopyButton value={field.value} label={field.label} />
        </>
      );
  }
}

/** Only http(s) links are clickable; anything else (javascript:, data:) is neutralized. */
function safeUrl(value: string): string | undefined {
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function ConcealedValue({ value, label }: { value: string; label: string }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <>
      <span className="truncate font-mono">{revealed ? <ColoredPassword value={value} /> : "••••••••••••"}</span>
      <span className="flex shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setRevealed((r) => !r)}
          aria-label={revealed ? `Hide ${label}` : `Reveal ${label}`}
        >
          {revealed ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </Button>
        <CopyButton value={value} label={label} />
      </span>
    </>
  );
}

/** Digits and symbols get their own colors so passwords are easier to read and type. */
export function ColoredPassword({ value }: { value: string }) {
  return (
    <>
      {Array.from(value).map((char, index) => (
        <span
          // Characters repeat, so the position is the only stable key.
          // biome-ignore lint/suspicious/noArrayIndexKey: static, never reordered
          key={index}
          className={/[0-9]/.test(char) ? "text-accent" : /[^a-zA-Z0-9]/.test(char) ? "text-danger" : undefined}
        >
          {char}
        </span>
      ))}
    </>
  );
}
