import { type Item, type ItemCategory, type ItemData, type ItemField, newItemData } from "@passbox/client";
import { Button, Input } from "@passbox/ui";
import { Star, Wand2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import { loadCore } from "../core";
import { useClient } from "../useClient";
import { errorMessage, FormError } from "./AuthLayout";

interface ItemEditorProps {
  item?: Item;
  category: ItemCategory;
  vaultId: string;
  onSaved: (id: string) => void;
  onCancel: () => void;
}

const TITLES: Record<ItemCategory, string> = {
  login: "Login",
  note: "Secure note",
  card: "Credit card",
  identity: "Identity",
  other: "Item",
};

export function ItemEditor({ item, category, vaultId, onSaved, onCancel }: ItemEditorProps) {
  const client = useClient();
  const [data, setData] = useState<ItemData>(() => (item ? structuredClone(item.data) : newItemData(category)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const setField = (id: string, value: string) =>
    setData((d) => ({ ...d, fields: d.fields.map((f) => (f.id === id ? { ...f, value } : f)) }));

  async function generate(field: ItemField) {
    const core = await loadCore();
    setField(field.id, core.generatePassword(JSON.stringify({ length: 24 })));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    const cleaned: ItemData = {
      ...data,
      title: data.title.trim() || TITLES[data.category],
      fields: data.fields.map((f) => ({ ...f, value: f.type === "totp" ? f.value.trim() : f.value })),
    };
    try {
      if (item) {
        await client.updateItem(item.id, cleaned);
        onSaved(item.id);
      } else {
        onSaved(await client.createItem(vaultId, cleaned));
      }
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <section aria-label={item ? "Edit item" : "New item"} className="flex-1 overflow-y-auto p-8">
      <form onSubmit={submit} className="flex max-w-2xl flex-col gap-5">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">{item ? "Edit" : `New ${TITLES[data.category].toLowerCase()}`}</h1>
          <button
            type="button"
            aria-pressed={data.favorite}
            onClick={() => setData((d) => ({ ...d, favorite: !d.favorite }))}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-muted hover:bg-surface-raised"
          >
            <Star className={data.favorite ? "size-4 fill-warning text-warning" : "size-4"} aria-hidden="true" />
            Favorite
          </button>
        </div>
        <Input
          label="Title"
          value={data.title}
          onChange={(e) => setData((d) => ({ ...d, title: e.target.value }))}
          placeholder={TITLES[data.category]}
          autoFocus
        />
        {data.fields.map((field) => (
          <div key={field.id} className="flex items-end gap-2">
            <div className="flex-1">
              <Input
                label={field.label}
                value={field.value}
                onChange={(e) => setField(field.id, e.target.value)}
                className={field.type === "concealed" || field.type === "totp" ? "font-mono" : undefined}
                autoComplete="off"
                spellCheck={false}
                hint={field.type === "totp" ? "Paste the setup key or otpauth:// link from the website." : undefined}
              />
            </div>
            {field.type === "concealed" && data.category === "login" && (
              <Button
                variant="secondary"
                className="mb-[1px] h-11"
                aria-label="Generate password"
                onClick={() => generate(field)}
              >
                <Wand2 className="size-4" />
              </Button>
            )}
          </div>
        ))}
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Notes
          <textarea
            value={data.notes}
            onChange={(e) => setData((d) => ({ ...d, notes: e.target.value }))}
            rows={data.category === "note" ? 10 : 4}
            className="rounded-lg border border-border bg-surface px-3 py-2 font-normal text-text focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </label>
        <Input
          label="Tags"
          value={data.tags.join(", ")}
          onChange={(e) =>
            setData((d) => ({
              ...d,
              tags: e.target.value
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean),
            }))
          }
          hint="Separate tags with commas."
        />
        <FormError message={error} />
        <div className="flex gap-3">
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </Button>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
        </div>
      </form>
    </section>
  );
}
