import type { AuditRecord } from "@passbox/api-client";
import { auditDetails } from "@passbox/client";
import type { Translate } from "@passbox/i18n";

export interface Names {
  member: (accountId: string) => string;
  group: (groupId: string) => string;
  vault: (vaultId: string) => string;
}

const ROLES = new Set(["owner", "admin", "member", "guest", "view", "edit", "manage"]);
const FIELDS = new Set(["password", "username", "totp", "password_history", "url"]);

/** Turns `snake_case` into "Snake case" for actions this app does not know. */
function humanize(action: string): string {
  const text = action.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function str(value: unknown): string {
  return typeof value === "string" ? value : typeof value === "number" ? String(value) : "";
}

/** A localized sentence for an audit entry, naming the target where this device knows it. */
export function describeAuditEntry(entry: AuditRecord, names: Names, t: Translate): string {
  const details = auditDetails(entry);
  const target =
    entry.targetType === "account"
      ? names.member(entry.targetId)
      : entry.targetType === "vault"
        ? names.vault(entry.targetId)
        : entry.targetType === "group"
          ? names.group(entry.targetId)
          : "";
  const vaultId = str(details.vaultId);
  const role = (value: string) => (ROLES.has(value) ? t(`orgAdmin.role.${value}`) : value);
  const field = str(details.field);
  const params = {
    target,
    email: str(details.email),
    role: role(str(details.role) || str(details.to)),
    from: role(str(details.from)),
    to: role(str(details.to)),
    vault: vaultId ? names.vault(vaultId) : target,
    field: FIELDS.has(field) ? t(`orgAdmin.field.${field}`) : t("orgAdmin.field.other"),
    count: Number(details.count ?? 0),
    version: str(details.version),
    format: str(details.format).toUpperCase(),
    name: str(details.name),
    url: str(details.url),
    principal:
      str(details.principalType) === "group"
        ? names.group(str(details.principalId))
        : names.member(str(details.principalId)),
  };
  const key = `orgAdmin.audit.action.${entry.action}`;
  const text = t(key, params);
  return text === key ? humanize(entry.action) : text;
}

/** Where an entry came from, for the meta line. */
export function auditSource(entry: AuditRecord): "app" | "server" {
  return entry.clientEvent ? "app" : "server";
}
