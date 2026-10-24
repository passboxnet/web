import {
  FIELD,
  type FieldType,
  type Item,
  type ItemCategory,
  type ItemData,
  type ItemField,
  newItemData,
} from "@passbox/client";
import {
  Button,
  ConfirmDialog,
  cn,
  fieldClassName,
  Input,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  Monogram,
  PasswordInput,
  StrengthMeter,
  Textarea,
  Tooltip,
  toast,
} from "@passbox/ui";
import { AtSign, Hash, Link2, Lock, Plus, Star, Timer, Trash2, Type, Wand2, X } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { errorMessage, loadCore } from "../core";
import { CATEGORY_META } from "../lib/items";
import { useClient, useSnapshot } from "../useClient";

interface ItemEditorProps {
  item?: Item;
  category: ItemCategory;
  defaultVaultId: string;
  onDone: (id: string | undefined) => void;
}

const WELL_KNOWN = new Set<string>(Object.values(FIELD));

const CUSTOM_FIELD_TYPES: Array<{ type: FieldType; label: string; icon: typeof Type }> = [
  { type: "text", label: "Text", icon: Type },
  { type: "concealed", label: "Password or secret", icon: Lock },
  { type: "url", label: "Website", icon: Link2 },
  { type: "email", label: "Email", icon: AtSign },
  { type: "totp", label: "One-time password", icon: Timer },
];

export function ItemEditor({ item, category, defaultVaultId, onDone }: ItemEditorProps) {
  const client = useClient();
  const { vaults } = useSnapshot();
  const initial = useMemo(() => (item ? structuredClone(item.data) : newItemData(category)), [item, category]);
  const [data, setData] = useState<ItemData>(initial);
  const [vaultId, setVaultId] = useState(item?.vaultId ?? defaultVaultId);
  const [tagInput, setTagInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  // Focus the title when the editor opens; it is what users type first.
  useEffect(() => titleRef.current?.focus(), []);
  const dirty = JSON.stringify(data) !== JSON.stringify(initial) || Boolean(tagInput.trim());
  const meta = CATEGORY_META[data.category];

  const setField = (id: string, update: Partial<ItemField>) =>
    setData((d) => ({ ...d, fields: d.fields.map((f) => (f.id === id ? { ...f, ...update } : f)) }));

  const cancel = useCallback(() => {
    if (dirty) setConfirmDiscard(true);
    else onDone(item?.id);
  }, [dirty, item, onDone]);

  async function save(event?: FormEvent) {
    event?.preventDefault();
    if (busy) return;
    setBusy(true);
    const tags = [...data.tags, ...tagInput.split(",").map((t) => t.trim())].filter(
      (tag, index, all) => tag && all.indexOf(tag) === index,
    );
    const cleaned: ItemData = {
      ...data,
      title: data.title.trim() || meta.label,
      tags,
      fields: data.fields
        .filter((f) => WELL_KNOWN.has(f.id) || f.value || f.label.trim())
        .map((f) => ({ ...f, label: f.label.trim() || "Field", value: f.type === "totp" ? f.value.trim() : f.value })),
    };
    try {
      if (item) {
        await client.updateItem(item.id, cleaned);
        toast.success("Changes saved");
        onDone(item.id);
      } else {
        const id = await client.createItem(vaultId, cleaned);
        toast.success(`${meta.label} created`);
        onDone(id);
      }
    } catch (error) {
      toast.error("Could not save", { description: errorMessage(error) });
      setBusy(false);
    }
  }

  // ⌘S / Ctrl+S saves, Escape cancels.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        document
          .getElementById("item-editor-form")
          ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      }
      if (event.key === "Escape" && !document.querySelector("[role=dialog],[role=menu]")) cancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cancel]);

  async function generate(fieldId: string) {
    const core = await loadCore();
    setField(fieldId, { value: core.generatePassword(JSON.stringify({ length: 24 })) });
  }

  function addField(type: FieldType) {
    const label = CUSTOM_FIELD_TYPES.find((t) => t.type === type)?.label ?? "Field";
    setData((d) => ({ ...d, fields: [...d.fields, { id: crypto.randomUUID(), label, type, value: "" }] }));
  }

  return (
    <section aria-label={item ? "Edit item" : "New item"} className="flex min-w-0 flex-1 flex-col bg-canvas">
      <form id="item-editor-form" onSubmit={save} className="flex min-h-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border bg-surface px-4">
          <p className="truncate text-[13px] font-medium">
            {item ? `Editing ${item.data.title || "item"}` : `New ${meta.label.toLowerCase()}`}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={cancel} disabled={busy}>
              Cancel
            </Button>
            <Tooltip content="Save · ⌘S">
              <Button type="submit" size="sm" loading={busy}>
                Save
              </Button>
            </Tooltip>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8 lg:px-10">
            <div className="flex items-center gap-4">
              <Monogram
                name={data.title || meta.label}
                size="xl"
                icon={data.category === "login" ? undefined : <meta.icon />}
              />
              <div className="min-w-0 flex-1">
                <label htmlFor="item-title" className="sr-only">
                  Title
                </label>
                <input
                  id="item-title"
                  value={data.title}
                  onChange={(e) => setData((d) => ({ ...d, title: e.target.value }))}
                  ref={titleRef}
                  placeholder={`${meta.label} name`}
                  className="w-full rounded-md bg-transparent px-1 py-1 text-2xl font-semibold tracking-tight outline-none placeholder:text-text-subtle focus:bg-surface focus:ring-3 focus:ring-accent/20"
                />
                <div className="mt-1 flex items-center gap-3 px-1 text-[13px] text-text-muted">
                  {item ? (
                    <span>{vaults.find((v) => v.id === vaultId)?.name}</span>
                  ) : (
                    <label className="flex items-center gap-2">
                      <span>Vault</span>
                      <select
                        value={vaultId}
                        onChange={(e) => setVaultId(e.target.value)}
                        className={cn(fieldClassName, "h-8 w-auto py-0 pr-8 pl-2.5 text-[13px]")}
                      >
                        {vaults.map((vault) => (
                          <option key={vault.id} value={vault.id}>
                            {vault.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <button
                    type="button"
                    aria-pressed={data.favorite}
                    onClick={() => setData((d) => ({ ...d, favorite: !d.favorite }))}
                    className="flex items-center gap-1.5 rounded-md px-2 py-1 hover:bg-surface-sunken hover:text-text"
                  >
                    <Star className={cn("size-3.5", data.favorite && "fill-warning text-warning")} aria-hidden="true" />
                    {data.favorite ? "Favorite" : "Add to favorites"}
                  </button>
                </div>
              </div>
            </div>

            {data.fields.length > 0 && (
              <div className="flex flex-col gap-5 rounded-card border border-border bg-surface p-5 shadow-card">
                {data.fields.map((field) => (
                  <FieldEditor
                    key={field.id}
                    field={field}
                    custom={!WELL_KNOWN.has(field.id)}
                    canGenerate={
                      field.id === FIELD.password || (field.type === "concealed" && !WELL_KNOWN.has(field.id))
                    }
                    onChange={(update) => setField(field.id, update)}
                    onGenerate={() => generate(field.id)}
                    onRemove={() => setData((d) => ({ ...d, fields: d.fields.filter((f) => f.id !== field.id) }))}
                  />
                ))}
              </div>
            )}

            <Menu>
              <MenuTrigger asChild>
                <Button variant="secondary" size="sm" className="self-start">
                  <Plus />
                  Add field
                </Button>
              </MenuTrigger>
              <MenuContent align="start">
                {CUSTOM_FIELD_TYPES.map(({ type, label, icon: Icon }) => (
                  <MenuItem key={type} icon={<Icon />} onSelect={() => addField(type)}>
                    {label}
                  </MenuItem>
                ))}
              </MenuContent>
            </Menu>

            <div className="flex flex-col gap-5 rounded-card border border-border bg-surface p-5 shadow-card">
              <Textarea
                label="Notes"
                value={data.notes}
                onChange={(e) => setData((d) => ({ ...d, notes: e.target.value }))}
                rows={data.category === "note" ? 12 : 4}
                placeholder="Anything else worth remembering. Notes are encrypted too."
              />
              <div className="flex flex-col gap-2">
                <Input
                  label="Tags"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.key === "Enter" || e.key === ",") && tagInput.trim()) {
                      e.preventDefault();
                      const tag = tagInput.trim().replace(/,$/, "");
                      setData((d) => (d.tags.includes(tag) ? d : { ...d, tags: [...d.tags, tag] }));
                      setTagInput("");
                    }
                  }}
                  placeholder="Type a tag and press Enter"
                  leading={<Hash />}
                />
                {data.tags.length > 0 && (
                  <ul className="flex flex-wrap gap-1.5" aria-label="Tags">
                    {data.tags.map((tag) => (
                      <li
                        key={tag}
                        className="flex items-center gap-1 rounded-md bg-surface-sunken py-0.5 pr-1 pl-2 text-xs text-text-muted"
                      >
                        {tag}
                        <button
                          type="button"
                          aria-label={`Remove tag ${tag}`}
                          onClick={() => setData((d) => ({ ...d, tags: d.tags.filter((t) => t !== tag) }))}
                          className="rounded p-0.5 hover:bg-border hover:text-text"
                        >
                          <X className="size-3" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      </form>

      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title="Discard changes?"
        description="Your unsaved changes will be lost."
        confirmLabel="Discard"
        tone="danger"
        onConfirm={() => onDone(item?.id)}
      />
    </section>
  );
}

interface FieldEditorProps {
  field: ItemField;
  custom: boolean;
  canGenerate: boolean;
  onChange: (update: Partial<ItemField>) => void;
  onGenerate: () => void;
  onRemove: () => void;
}

function FieldEditor({ field, custom, canGenerate, onChange, onGenerate, onRemove }: FieldEditorProps) {
  const client = useClient();
  const strength = field.id === FIELD.password && field.value ? client.estimateStrength(field.value) : undefined;
  const removeButton = custom ? (
    <Tooltip content="Remove field">
      <Button variant="ghost" size="icon-sm" aria-label={`Remove ${field.label}`} onClick={onRemove}>
        <Trash2 />
      </Button>
    </Tooltip>
  ) : undefined;
  const labelAction = custom ? (
    <input
      aria-label="Field name"
      value={field.label}
      onChange={(e) => onChange({ label: e.target.value })}
      className="w-40 rounded bg-transparent px-1 text-right text-2xs text-text-subtle outline-none focus:bg-surface-sunken"
      placeholder="Field name"
    />
  ) : undefined;

  if (field.type === "concealed") {
    return (
      <div className="flex flex-col gap-2">
        <PasswordInput
          label={field.label}
          labelAction={labelAction}
          value={field.value}
          onChange={(e) => onChange({ value: e.target.value })}
          autoComplete="new-password"
          actions={
            <>
              {canGenerate && (
                <Tooltip content="Generate a strong password">
                  <button
                    type="button"
                    onClick={onGenerate}
                    aria-label="Generate password"
                    className="flex size-7 items-center justify-center rounded-md text-text-subtle hover:bg-surface-sunken hover:text-accent"
                  >
                    <Wand2 className="size-4" />
                  </button>
                </Tooltip>
              )}
              {removeButton}
            </>
          }
        />
        {strength && <StrengthMeter score={strength.score} label={strength.label} />}
      </div>
    );
  }

  return (
    <Input
      label={field.label}
      labelAction={labelAction}
      value={field.value}
      onChange={(e) => onChange({ value: e.target.value })}
      type={field.type === "email" ? "email" : "text"}
      inputMode={field.type === "url" ? "url" : undefined}
      autoComplete="off"
      spellCheck={false}
      className={field.type === "totp" ? "font-mono" : undefined}
      placeholder={
        field.type === "url" ? "example.com" : field.type === "totp" ? "Setup key or otpauth:// link" : undefined
      }
      hint={
        field.type === "totp"
          ? "Copy the setup key shown next to the QR code when you enable two-factor authentication."
          : undefined
      }
      trailing={removeButton}
    />
  );
}
