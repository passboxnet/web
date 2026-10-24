import { Button } from "@passbox/ui";
import { ExternalLink, Eye, EyeOff } from "lucide-react";
import { type ReactNode, useState } from "react";
import type { VaultItem } from "../sampleData";
import { CopyButton } from "./CopyButton";
import { ItemIcon } from "./ItemIcon";
import { TotpField } from "./TotpField";

export function ItemDetail({ item }: { item: VaultItem | undefined }) {
  if (!item) {
    return (
      <section className="flex flex-1 items-center justify-center text-sm text-text-muted max-md:hidden">
        Select an item
      </section>
    );
  }
  return (
    <section aria-label={item.title} className="flex-1 overflow-y-auto p-8 max-md:hidden" key={item.id}>
      <header className="mb-8 flex items-center gap-4">
        <ItemIcon item={item} size="lg" />
        <div>
          <h1 className="text-2xl font-semibold">{item.title}</h1>
          <p className="text-sm text-text-muted">{item.vault}</p>
        </div>
      </header>
      <dl className="divide-y divide-border rounded-card border border-border bg-surface">
        {item.username && (
          <Field label="Username">
            <span className="truncate">{item.username}</span>
            <CopyButton value={item.username} label="username" />
          </Field>
        )}
        {item.password && (
          <Field label="Password">
            <PasswordValue value={item.password} />
          </Field>
        )}
        {item.totp && (
          <Field label="One-time password">
            <TotpField uri={item.totp} />
          </Field>
        )}
        {item.url && (
          <Field label="Website">
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer noopener"
              className="truncate text-accent hover:underline"
            >
              {item.url}
            </a>
            <ExternalLink className="size-4 text-text-muted" aria-hidden="true" />
          </Field>
        )}
        {item.notes && (
          <Field label="Notes">
            <p className="whitespace-pre-wrap">{item.notes}</p>
          </Field>
        )}
      </dl>
      {item.tags.length > 0 && (
        <ul className="mt-6 flex gap-2" aria-label="Tags">
          {item.tags.map((tag) => (
            <li key={tag} className="rounded-full bg-surface-raised px-3 py-1 text-xs text-text-muted">
              {tag}
            </li>
          ))}
        </ul>
      )}
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

function PasswordValue({ value }: { value: string }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <>
      <span className="truncate font-mono">{revealed ? <ColoredPassword value={value} /> : "••••••••••••"}</span>
      <span className="flex shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setRevealed((r) => !r)}
          aria-label={revealed ? "Hide password" : "Reveal password"}
        >
          {revealed ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </Button>
        <CopyButton value={value} label="password" />
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
