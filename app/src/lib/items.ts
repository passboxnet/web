import { FIELD, fieldValue, type Item, type ItemCategory, type ItemData } from "@passbox/client";
import type { Translate } from "@passbox/i18n";
import {
  Award,
  BookUser,
  Braces,
  Car,
  Contact,
  CreditCard,
  Database,
  FileText,
  IdCard,
  KeyRound,
  Landmark,
  type LucideIcon,
  Paperclip,
  Server,
  Shapes,
  Terminal,
  Wallet,
  Webhook,
  Wifi,
} from "lucide-react";

/** Message keys and icons per category. `label` is singular, `plural` names the list. */
export const CATEGORY_META: Record<ItemCategory, { label: string; plural: string; icon: LucideIcon }> = {
  login: { label: "category.login", plural: "category.logins", icon: KeyRound },
  note: { label: "category.note", plural: "category.notes", icon: FileText },
  card: { label: "category.card", plural: "category.cards", icon: CreditCard },
  identity: { label: "category.identity", plural: "category.identities", icon: IdCard },
  environment: { label: "category.environment", plural: "category.environments", icon: Braces },
  document: { label: "category.document", plural: "category.documents", icon: Paperclip },
  bankAccount: { label: "category.bankAccount", plural: "category.bankAccounts", icon: Landmark },
  idCard: { label: "category.idCard", plural: "category.idCards", icon: Contact },
  passport: { label: "category.passport", plural: "category.passports", icon: BookUser },
  driverLicense: { label: "category.driverLicense", plural: "category.driverLicenses", icon: Car },
  softwareLicense: { label: "category.softwareLicense", plural: "category.softwareLicenses", icon: Award },
  wifi: { label: "category.wifi", plural: "category.wifis", icon: Wifi },
  server: { label: "category.server", plural: "category.servers", icon: Server },
  database: { label: "category.database", plural: "category.databases", icon: Database },
  apiCredential: { label: "category.apiCredential", plural: "category.apiCredentials", icon: Webhook },
  cryptoWallet: { label: "category.cryptoWallet", plural: "category.cryptoWallets", icon: Wallet },
  sshKey: { label: "category.sshKey", plural: "category.sshKeys", icon: Terminal },
  other: { label: "category.other", plural: "category.others", icon: Shapes },
};

/** Categories that can be created from the UI, in menu groups (everyday, documents, technical). */
export const CREATABLE_GROUPS: ItemCategory[][] = [
  ["login", "note", "card", "identity", "document"],
  ["bankAccount", "idCard", "passport", "driverLicense"],
  ["wifi", "softwareLicense", "server", "database", "apiCredential", "sshKey", "cryptoWallet", "environment"],
];

/** Categories that can be created from the UI, in menu order. */
export const CREATABLE: ItemCategory[] = CREATABLE_GROUPS.flat();

/** Categories the sidebar always lists; others appear once they have items. */
export const ALWAYS_LISTED: ItemCategory[] = ["login", "note", "card"];

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
      return categoryDetail(item) ?? t(CATEGORY_META[item.data.category].label);
  }
}

/** A non-secret detail for the list's second line, by category. */
function categoryDetail(item: Item): string | undefined {
  const value = (id: string) => fieldValue(item.data, id);
  switch (item.data.category) {
    case "wifi":
      return value(FIELD.wifiSsid);
    case "server":
    case "apiCredential":
      return hostname(value(FIELD.url)) ?? value(FIELD.username);
    case "database":
      return value(FIELD.host) ?? value(FIELD.databaseName);
    case "bankAccount": {
      const iban = value(FIELD.iban) ?? value(FIELD.accountNumber);
      return iban ? `•••• ${iban.replace(/\s/g, "").slice(-4)}` : value(FIELD.bankName);
    }
    case "identity":
      return [value(FIELD.firstName), value(FIELD.lastName)].filter(Boolean).join(" ") || undefined;
    case "idCard":
    case "passport":
    case "driverLicense":
      return value(FIELD.fullName);
    case "softwareLicense":
      return value(FIELD.licensedTo) ?? value(FIELD.version);
    case "sshKey":
      return value(FIELD.fingerprint);
    case "cryptoWallet":
      return value(FIELD.network);
    case "document": {
      const files = item.data.attachments ?? [];
      return files.length === 1 ? files[0]?.name : undefined;
    }
    default:
      return undefined;
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
  [FIELD.firstName]: "field.firstName",
  [FIELD.lastName]: "field.lastName",
  [FIELD.fullName]: "field.fullName",
  [FIELD.birthDate]: "field.birthDate",
  [FIELD.email]: "field.emailAddress",
  [FIELD.phone]: "field.phone",
  [FIELD.address]: "field.address",
  [FIELD.bankName]: "field.bankName",
  [FIELD.accountHolder]: "field.accountHolder",
  [FIELD.iban]: "field.iban",
  [FIELD.bic]: "field.bic",
  [FIELD.accountNumber]: "field.accountNumber",
  [FIELD.pin]: "field.pin",
  [FIELD.documentNumber]: "field.documentNumber",
  [FIELD.nationality]: "field.nationality",
  [FIELD.issueDate]: "field.issueDate",
  [FIELD.expiryDate]: "field.expiryDate",
  [FIELD.authority]: "field.authority",
  [FIELD.licenseClasses]: "field.licenseClasses",
  [FIELD.licenseKey]: "field.licenseKey",
  [FIELD.licensedTo]: "field.licensedTo",
  [FIELD.version]: "field.version",
  [FIELD.purchaseDate]: "field.purchaseDate",
  [FIELD.wifiSsid]: "field.wifiSsid",
  [FIELD.wifiSecurity]: "field.wifiSecurity",
  [FIELD.host]: "field.host",
  [FIELD.port]: "field.port",
  [FIELD.databaseType]: "field.databaseType",
  [FIELD.databaseName]: "field.databaseName",
  [FIELD.apiKey]: "field.apiKey",
  [FIELD.apiSecret]: "field.apiSecret",
  [FIELD.walletAddress]: "field.walletAddress",
  [FIELD.recoveryPhrase]: "field.recoveryPhrase",
  [FIELD.network]: "field.network",
  [FIELD.privateKey]: "field.privateKey",
  [FIELD.publicKey]: "field.publicKey",
  [FIELD.fingerprint]: "field.fingerprint",
  [FIELD.passphrase]: "field.passphrase",
};

/**
 * Labels that depend on the category: the URL of a server item is its
 * address, of an API credential its endpoint.
 */
const CATEGORY_FIELD_LABELS: Partial<Record<ItemCategory, Record<string, string>>> = {
  server: { [FIELD.url]: "field.serverAddress" },
  apiCredential: { [FIELD.url]: "field.endpoint" },
};

/**
 * Well-known fields are labeled in the user's language (the stored label is
 * English); custom fields keep the label the user gave them.
 */
export function fieldLabel(field: { id: string; label: string }, t: Translate, category?: ItemCategory): string {
  const key = (category && CATEGORY_FIELD_LABELS[category]?.[field.id]) ?? FIELD_LABELS[field.id];
  return key ? t(key) : field.label;
}
