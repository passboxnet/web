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
  Dialog,
  fieldClassName,
  Input,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  Monogram,
  PasswordInput,
  Textarea,
  Tooltip,
  toast,
} from "@passbox/ui";
import { AtSign, Hash, Link2, Lock, Plus, Star, Timer, Trash2, Type, Wand2, X } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { errorMessage, loadCore } from "../core";
import { shortcut, useI18n } from "../lib/i18n";
import { CATEGORY_META, fieldLabel, findDuplicateLogin, hostname, itemTitle, mergeInto } from "../lib/items";
import { vaultName } from "../shell/Sidebar";
import { useClient, useSnapshot } from "../useClient";
import { PasswordStrength } from "./PasswordStrength";
import { TotpField } from "./TotpField";

interface ItemEditorProps {
  item?: Item;
  category: ItemCategory;
  defaultVaultId: string;
  onDone: (id: string | undefined) => void;
}

const WELL_KNOWN = new Set<string>(Object.values(FIELD));

const CUSTOM_FIELD_TYPES: Array<{ type: FieldType; label: string; icon: typeof Type }> = [
  { type: "text", label: "editor.fieldType.text", icon: Type },
  { type: "concealed", label: "editor.fieldType.concealed", icon: Lock },
  { type: "url", label: "editor.fieldType.url", icon: Link2 },
  { type: "email", label: "editor.fieldType.email", icon: AtSign },
  { type: "totp", label: "editor.fieldType.totp", icon: Timer },
];

export function ItemEditor({ item, category, defaultVaultId, onDone }: ItemEditorProps) {
  const client = useClient();
  const { t } = useI18n();
  const { vaults, items } = useSnapshot();
  const initial = useMemo(() => (item ? structuredClone(item.data) : newItemData(category)), [item, category]);
  const [data, setData] = useState<ItemData>(initial);
  const [vaultId, setVaultId] = useState(item?.vaultId ?? defaultVaultId);
  const [tagInput, setTagInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [duplicate, setDuplicate] = useState<{ existing: Item; data: ItemData }>();
  const titleRef = useRef<HTMLInputElement>(null);

  // Focus the title when the editor opens; it is what users type first.
  useEffect(() => titleRef.current?.focus(), []);
  const dirty = JSON.stringify(data) !== JSON.stringify(initial) || Boolean(tagInput.trim());
  const meta = CATEGORY_META[data.category];

  const setField = (id: string, update: Partial<ItemField>) => {
    setData((d) => ({ ...d, fields: d.fields.map((f) => (f.id === id ? { ...f, ...update } : f)) }));
    if (update.value !== undefined) setFieldErrors(({ [id]: _cleared, ...rest }) => rest);
  };

  const cancel = useCallback(() => {
    if (dirty) setConfirmDiscard(true);
    else onDone(item?.id);
  }, [dirty, item, onDone]);

  /** Checks 2FA setup keys before saving: a 6-digit code is the most common mistake. */
  async function validate(fields: ItemField[]): Promise<boolean> {
    const core = await loadCore();
    const errors: Record<string, string> = {};
    for (const field of fields) {
      if (field.type !== "totp" || !field.value.trim()) continue;
      const problem = core.totpInputProblem(field.value.trim());
      if (problem) errors[field.id] = t(`totp.problem.${problem}`);
    }
    setFieldErrors(errors);
    const first = Object.keys(errors)[0];
    if (first) {
      const field = document.getElementById(`field-${first}`);
      field?.focus({ preventScroll: true });
      field?.scrollIntoView({ block: "nearest" });
      return false;
    }
    return true;
  }

  function cleaned(): ItemData {
    const tags = [...data.tags, ...tagInput.split(",").map((tag) => tag.trim())].filter(
      (tag, index, all) => tag && all.indexOf(tag) === index,
    );
    return {
      ...data,
      title: data.title.trim() || hostname(data.fields.find((f) => f.id === FIELD.url)?.value) || t(meta.label),
      tags,
      fields: data.fields
        .filter((f) => WELL_KNOWN.has(f.id) || f.value || f.label.trim())
        .map((f) => ({
          ...f,
          label: f.label.trim() || t("editor.field"),
          value: f.type === "totp" ? f.value.trim() : f.value,
        })),
    };
  }

  async function save(event?: FormEvent, options: { allowDuplicate?: boolean } = {}) {
    event?.preventDefault();
    if (busy) return;
    const next = cleaned();
    if (!(await validate(next.fields))) {
      toast.error(t("editor.checkFields"));
      return;
    }
    if (!item && !options.allowDuplicate) {
      const existing = findDuplicateLogin(items, next);
      if (existing) {
        setDuplicate({ existing, data: next });
        return;
      }
    }
    setBusy(true);
    try {
      if (item) {
        await client.updateItem(item.id, next);
        toast.success(t("editor.saved"));
        onDone(item.id);
      } else {
        const id = await client.createItem(vaultId, next);
        toast.success(t("editor.created", { type: t(meta.label) }));
        onDone(id);
      }
    } catch (error) {
      toast.error(t("editor.saveFailed"), { description: errorMessage(error) });
      setBusy(false);
    }
  }

  async function updateExisting() {
    if (!duplicate) return;
    setBusy(true);
    try {
      await client.updateItem(duplicate.existing.id, mergeInto(duplicate.existing.data, duplicate.data));
      toast.success(t("editor.saved"));
      setDuplicate(undefined);
      onDone(duplicate.existing.id);
    } catch (error) {
      toast.error(t("editor.saveFailed"), { description: errorMessage(error) });
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
    const label = t(CUSTOM_FIELD_TYPES.find((ft) => ft.type === type)?.label ?? "editor.field");
    setData((d) => ({ ...d, fields: [...d.fields, { id: crypto.randomUUID(), label, type, value: "" }] }));
  }

  return (
    <section
      aria-label={item ? t("editor.editLabel") : t("editor.newLabel")}
      className="flex min-w-0 flex-1 flex-col bg-canvas"
    >
      <form id="item-editor-form" onSubmit={save} className="flex min-h-0 flex-1 flex-col" noValidate>
        <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border bg-surface px-4 coarse:h-16">
          <p className="truncate text-[0.8125rem] font-medium">
            {item ? t("editor.editing", { name: itemTitle(item, t) }) : t("editor.new", { type: t(meta.label) })}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={cancel} disabled={busy}>
              {t("action.cancel")}
            </Button>
            <Tooltip content={t("editor.saveShortcut", { shortcut: shortcut(t, "S") })}>
              <Button type="submit" size="sm" loading={busy}>
                {t("action.save")}
              </Button>
            </Tooltip>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-10">
            <div className="flex items-center gap-4">
              <Monogram
                name={data.title || t(meta.label)}
                size="xl"
                icon={data.category === "login" ? undefined : <meta.icon />}
              />
              <div className="min-w-0 flex-1">
                <label htmlFor="item-title" className="sr-only">
                  {t("editor.title")}
                </label>
                <input
                  id="item-title"
                  value={data.title}
                  onChange={(e) => setData((d) => ({ ...d, title: e.target.value }))}
                  ref={titleRef}
                  placeholder={t("editor.titlePlaceholder")}
                  className="w-full rounded-md bg-transparent px-1 py-1 text-2xl font-semibold tracking-tight outline-none placeholder:text-text-muted focus:bg-surface focus:ring-3 focus:ring-accent/20"
                />
                <div className="mt-1 flex flex-wrap items-center gap-3 px-1 text-[0.8125rem] text-text-muted">
                  {item ? (
                    <span>{vaultName(vaults.find((v) => v.id === vaultId)?.name ?? "", t)}</span>
                  ) : (
                    // With a single vault there is nothing to choose.
                    vaults.length > 1 && (
                      <label className="flex items-center gap-2">
                        <span>{t("term.vault")}</span>
                        <select
                          value={vaultId}
                          onChange={(e) => setVaultId(e.target.value)}
                          className={cn(fieldClassName, "h-8 w-auto py-0 pr-8 pl-2.5 text-[0.8125rem] coarse:h-11")}
                        >
                          {vaults.map((vault) => (
                            <option key={vault.id} value={vault.id}>
                              {vaultName(vault.name, t)}
                            </option>
                          ))}
                        </select>
                      </label>
                    )
                  )}
                  <button
                    type="button"
                    aria-pressed={data.favorite}
                    onClick={() => setData((d) => ({ ...d, favorite: !d.favorite }))}
                    className="flex items-center gap-1.5 rounded-md px-2 py-1 hover:bg-surface-sunken hover:text-text coarse:py-2.5"
                  >
                    <Star className={cn("size-3.5", data.favorite && "fill-warning text-warning")} aria-hidden="true" />
                    {data.favorite ? t("list.favorite") : t("detail.favorite")}
                  </button>
                </div>
              </div>
            </div>

            {data.fields.length > 0 && (
              <div className="flex flex-col gap-5 rounded-card border border-border bg-surface p-4 shadow-card sm:p-5">
                {data.fields.map((field) => (
                  <FieldEditor
                    key={field.id}
                    field={field}
                    error={fieldErrors[field.id]}
                    custom={!WELL_KNOWN.has(field.id)}
                    canGenerate={
                      field.id === FIELD.password || (field.type === "concealed" && !WELL_KNOWN.has(field.id))
                    }
                    context={[data.title, fieldValueOf(data, FIELD.username), hostname(fieldValueOf(data, FIELD.url))]}
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
                  {t("editor.addField")}
                </Button>
              </MenuTrigger>
              <MenuContent align="start">
                {CUSTOM_FIELD_TYPES.map(({ type, label, icon: Icon }) => (
                  <MenuItem key={type} icon={<Icon />} onSelect={() => addField(type)}>
                    {t(label)}
                  </MenuItem>
                ))}
              </MenuContent>
            </Menu>

            <div className="flex flex-col gap-5 rounded-card border border-border bg-surface p-4 shadow-card sm:p-5">
              <Textarea
                label={t("field.notes")}
                value={data.notes}
                onChange={(e) => setData((d) => ({ ...d, notes: e.target.value }))}
                rows={data.category === "note" ? 12 : 4}
                placeholder={t("editor.notesPlaceholder")}
              />
              <div className="flex flex-col gap-2">
                <Input
                  label={t("field.tags")}
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
                  placeholder={t("editor.tagsPlaceholder")}
                  leading={<Hash />}
                />
                {data.tags.length > 0 && (
                  <ul className="flex flex-wrap gap-1.5" aria-label={t("field.tags")}>
                    {data.tags.map((tag) => (
                      <li
                        key={tag}
                        className="flex items-center gap-1 rounded-md bg-surface-sunken py-0.5 pr-1 pl-2 text-xs text-text-muted"
                      >
                        {tag}
                        <button
                          type="button"
                          aria-label={t("editor.removeTag", { tag })}
                          onClick={() => setData((d) => ({ ...d, tags: d.tags.filter((tg) => tg !== tag) }))}
                          className="rounded p-0.5 hover:bg-border hover:text-text coarse:p-2"
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
        title={t("editor.discardTitle")}
        description={t("editor.discardText")}
        confirmLabel={t("editor.discard")}
        cancelLabel={t("editor.keepEditing")}
        tone="danger"
        onConfirm={() => onDone(item?.id)}
      />

      <Dialog
        open={duplicate !== undefined}
        onOpenChange={(open) => !open && setDuplicate(undefined)}
        title={t("editor.duplicate.title", {
          site: hostname(fieldValueOf(duplicate?.data, FIELD.url)) ?? "",
        })}
        description={t("editor.duplicate.text", {
          name: duplicate ? itemTitle(duplicate.existing, t) : "",
          username: fieldValueOf(duplicate?.data, FIELD.username) ?? "",
        })}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDuplicate(undefined)}>
              {t("action.cancel")}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setDuplicate(undefined);
                void save(undefined, { allowDuplicate: true });
              }}
            >
              {t("editor.duplicate.createAnyway")}
            </Button>
            <Button onClick={() => void updateExisting()} loading={busy}>
              {t("editor.duplicate.update")}
            </Button>
          </>
        }
      />
    </section>
  );
}

function fieldValueOf(data: ItemData | undefined, id: string): string | undefined {
  const value = data?.fields.find((f) => f.id === id)?.value.trim();
  return value || undefined;
}

interface FieldEditorProps {
  field: ItemField;
  error: string | undefined;
  custom: boolean;
  canGenerate: boolean;
  /** Words the strength check treats as easy guesses (title, username, site). */
  context: Array<string | undefined>;
  onChange: (update: Partial<ItemField>) => void;
  onGenerate: () => void;
  onRemove: () => void;
}

function FieldEditor({ field, error, custom, canGenerate, context, onChange, onGenerate, onRemove }: FieldEditorProps) {
  const { t } = useI18n();
  const label = fieldLabel(field, t);
  const removeButton = custom ? (
    <Tooltip content={t("editor.removeField")}>
      <Button variant="ghost" size="icon-sm" aria-label={t("editor.removeNamed", { label })} onClick={onRemove}>
        <Trash2 />
      </Button>
    </Tooltip>
  ) : undefined;
  const labelAction = custom ? (
    <input
      aria-label={t("editor.fieldName")}
      value={field.label}
      onChange={(e) => onChange({ label: e.target.value })}
      className="w-40 rounded bg-transparent px-1 text-right text-xs text-text-muted outline-none focus:bg-surface-sunken"
      placeholder={t("editor.fieldName")}
    />
  ) : undefined;

  if (field.type === "totp") {
    return (
      <TotpField
        id={`field-${field.id}`}
        label={label}
        labelAction={labelAction}
        value={field.value}
        error={error}
        onChange={(value) => onChange({ value })}
        trailing={removeButton}
      />
    );
  }

  if (field.type === "concealed") {
    return (
      <div className="flex flex-col gap-2">
        <PasswordInput
          id={`field-${field.id}`}
          label={label}
          labelAction={labelAction}
          value={field.value}
          onChange={(e) => onChange({ value: e.target.value })}
          autoComplete="new-password"
          error={error}
          actions={removeButton}
        />
        {field.id === FIELD.password && field.value && (
          <PasswordStrength password={field.value} context={context.filter((c): c is string => Boolean(c))} />
        )}
        {canGenerate && (
          <Button variant="ghost" size="xs" className="self-start text-accent" onClick={onGenerate}>
            <Wand2 />
            {t("editor.generate")}
          </Button>
        )}
      </div>
    );
  }

  return (
    <Input
      id={`field-${field.id}`}
      label={label}
      labelAction={labelAction}
      value={field.value}
      onChange={(e) => onChange({ value: e.target.value })}
      type={field.type === "email" ? "email" : "text"}
      inputMode={field.type === "url" ? "url" : undefined}
      autoComplete="off"
      spellCheck={false}
      error={error}
      placeholder={field.type === "url" ? t("editor.urlPlaceholder") : undefined}
      trailing={removeButton}
    />
  );
}
