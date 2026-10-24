import { FIELD, fieldValue, type Item, type ItemCategory, type ItemData } from "@passbox/client";
import type { Translate } from "@passbox/i18n";
import { CreditCard, FileText, IdCard, KeyRound, type LucideIcon, Shapes } from "lucide-react";

/** Message keys and icons per category. `label` is singular, `plural` names the list. */
export const CATEGORY_META: Record<ItemCategory, { label: string; plural: string; icon: LucideIcon }> = {
  login: { label: "category.login", plural: "category.logins", icon: KeyRound },
  note: { label: "category.note", plural: "category.notes", icon: FileText },
  card: { label: "category.card", plural: "category.cards", icon: CreditCard },
  identity: { label: "category.identity", plural: "category.identities", icon: IdCard },
  other: { label: "category.other", plural: "category.others", icon: Shapes },
};

/** Categories that can be created from the UI, in menu order. */
export const CREATABLE: ItemCategory[] = ["login", "note", "card"];

/** The title, or "Untitled" in the current language. */
export function itemTitle(item: { data: { title: string } }, t: Translate): string {
  return item.data.title.trim() || t("item.untitled");
}

/**
 * The second line in lists. Secure notes never show their content here,
 * so nothing secret is visible while scrolling or screen sharing.
 */
export function itemSubtitle(item: Item, t: Translate): string {
  switch (item.data.category) {
    case "login":
      return (
        fieldValue(item.data, FIELD.username) ??
        hostname(fieldValue(item.data, FIELD.url)) ??
        t(CATEGORY_META.login.label)
      );
    case "card": {
      const number = fieldValue(item.data, FIELD.cardNumber);
      return number ? `•••• ${number.replace(/\s/g, "").slice(-4)}` : t(CATEGORY_META.card.label);
    }
    case "note": {
      const lines = item.data.notes.split("\n").filter((line) => line.trim()).length;
      return lines > 0 ? t("item.noteLines", { count: lines }) : t(CATEGORY_META.note.label);
    }
    default:
      return t(CATEGORY_META[item.data.category].label);
  }
}

/** Text that search looks at: title, tags and visible fields (never passwords or notes). */
export function searchText(item: Item): string {
  return [
    item.data.title,
    ...item.data.tags,
    ...item.data.fields.filter((f) => f.type !== "concealed" && f.type !== "totp").map((f) => f.value),
  ].join(" ");
}

export function hostname(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(/^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Only http(s) links are clickable; anything else (javascript:, data:) is neutralized. */
export function safeHref(value: string): string | undefined {
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

/**
 * An existing login for the same website and username, if any. Used to warn
 * before saving a duplicate. Compares host names without "www." and
 * usernames without case.
 */
export function findDuplicateLogin(items: readonly Item[], data: ItemData, ignoreId?: string): Item | undefined {
  if (data.category !== "login") return undefined;
  const host = hostname(fieldValue(data, FIELD.url)?.trim())?.toLowerCase();
  const username = fieldValue(data, FIELD.username)?.trim().toLowerCase();
  if (!host || !username) return undefined;
  return items.find(
    (item) =>
      item.id !== ignoreId &&
      item.data.category === "login" &&
      hostname(fieldValue(item.data, FIELD.url)?.trim())?.toLowerCase() === host &&
      fieldValue(item.data, FIELD.username)?.trim().toLowerCase() === username,
  );
}

/**
 * Applies the values the user just typed to an existing item: filled fields
 * replace the stored ones, empty ones keep them, new custom fields and tags
 * are added and notes are appended.
 */
export function mergeInto(existing: ItemData, incoming: ItemData): ItemData {
  const fields = existing.fields.map((field) => {
    const update = incoming.fields.find((f) => f.id === field.id);
    return update?.value ? { ...field, value: update.value } : field;
  });
  for (const field of incoming.fields) {
    if (field.value && !fields.some((f) => f.id === field.id)) fields.push(field);
  }
  const notes =
    incoming.notes.trim() && !existing.notes.includes(incoming.notes.trim())
      ? [existing.notes, incoming.notes].filter((n) => n.trim()).join("\n\n")
      : existing.notes;
  return {
    ...existing,
    fields,
    notes,
    tags: [...new Set([...existing.tags, ...incoming.tags])],
    favorite: existing.favorite || incoming.favorite,
  };
}

const FIELD_LABELS: Record<string, string> = {
  [FIELD.username]: "field.username",
  [FIELD.password]: "field.password",
  [FIELD.url]: "field.website",
  [FIELD.totp]: "term.oneTimePassword",
  [FIELD.cardholder]: "field.cardholder",
  [FIELD.cardNumber]: "field.cardNumber",
  [FIELD.cardExpiry]: "field.cardExpiry",
  [FIELD.cardCode]: "field.cardCode",
};

/**
 * Well-known fields are labeled in the user's language (the stored label is
 * English); custom fields keep the label the user gave them.
 */
export function fieldLabel(field: { id: string; label: string }, t: Translate): string {
  const key = FIELD_LABELS[field.id];
  return key ? t(key) : field.label;
}
