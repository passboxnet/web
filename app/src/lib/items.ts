import { FIELD, fieldValue, type Item, type ItemCategory } from "@passbox/client";
import { CreditCard, FileText, IdCard, KeyRound, type LucideIcon, Shapes } from "lucide-react";

export const CATEGORY_META: Record<ItemCategory, { label: string; plural: string; icon: LucideIcon }> = {
  login: { label: "Login", plural: "Logins", icon: KeyRound },
  note: { label: "Secure note", plural: "Secure notes", icon: FileText },
  card: { label: "Credit card", plural: "Credit cards", icon: CreditCard },
  identity: { label: "Identity", plural: "Identities", icon: IdCard },
  other: { label: "Item", plural: "Other", icon: Shapes },
};

/** Categories that can be created from the UI, in menu order. */
export const CREATABLE: ItemCategory[] = ["login", "note", "card"];

export function itemSubtitle(item: Item): string {
  switch (item.data.category) {
    case "login":
      return fieldValue(item.data, FIELD.username) ?? hostname(fieldValue(item.data, FIELD.url)) ?? "Login";
    case "card": {
      const number = fieldValue(item.data, FIELD.cardNumber);
      return number ? `•••• ${number.replace(/\s/g, "").slice(-4)}` : "Credit card";
    }
    case "note": {
      const firstLine = item.data.notes.split("\n").find((line) => line.trim());
      return firstLine?.slice(0, 80) ?? "Secure note";
    }
    default:
      return CATEGORY_META[item.data.category].label;
  }
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

export function relativeTime(timestamp: number): string {
  const seconds = Math.round((Date.now() - timestamp) / 1000);
  if (seconds < 45) return "just now";
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return formatter.format(-minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (hours < 24) return formatter.format(-hours, "hour");
  const days = Math.round(hours / 24);
  if (days < 30) return formatter.format(-days, "day");
  return new Date(timestamp).toLocaleDateString();
}
