import type { AdminUser } from "@passbox/api-client";
import { Badge, Button, ConfirmDialog, Input, Spinner, toast } from "@passbox/ui";
import { Ban, CheckCircle2, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { errorMessage } from "../../core";
import { useI18n } from "../../lib/i18n";
import { useClient, useSnapshot } from "../../useClient";
import { Panel } from "../PageHeader";

const PAGE_SIZE = 25;

/** Accounts on the server, with search and disable/enable. */
export function UsersPanel({ onChange }: { onChange: () => void }) {
  const client = useClient();
  const { email: ownEmail } = useSnapshot();
  const i18n = useI18n();
  const { t } = i18n;
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [users, setUsers] = useState<AdminUser[]>();
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string>();
  const [confirm, setConfirm] = useState<{ user: AdminUser; action: "disable" | "enable" }>();

  // Search once typing pauses.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(query.trim());
      setOffset(0);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const load = useCallback(() => {
    setError(undefined);
    client.admin
      .adminUsers({ q: search, limit: PAGE_SIZE, offset })
      .then((result) => {
        setUsers(result.users);
        setTotal(result.total);
      })
      .catch((e: unknown) => setError(errorMessage(e)));
  }, [client, search, offset]);

  useEffect(load, [load]);

  async function apply(user: AdminUser, action: "disable" | "enable") {
    try {
      if (action === "disable") {
        await client.admin.disableUser(user.id);
        toast.success(t("admin.users.disabled", { email: user.email }));
      } else {
        await client.admin.enableUser(user.id);
        toast.success(t("admin.users.enabled", { email: user.email }));
      }
      load();
      onChange();
    } catch (e) {
      toast.error(t("admin.users.failed"), { description: errorMessage(e) });
    }
  }

  const lastPage = offset + PAGE_SIZE >= total;

  return (
    <Panel id="users" title={t("admin.users.title")} description={t("admin.users.description")}>
      <div className="px-5 py-4">
        <Input
          label={t("admin.users.search")}
          hideLabel
          type="search"
          value={query}
          placeholder={t("admin.users.searchPlaceholder")}
          leading={<Search className="size-4" aria-hidden="true" />}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {error ? (
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-[0.8125rem] text-danger">
          {error}
          <Button size="sm" variant="secondary" onClick={load}>
            {t("action.retry")}
          </Button>
        </div>
      ) : !users ? (
        <div className="flex justify-center px-5 py-6 text-text-muted">
          <Spinner label={t("app.loading")} />
        </div>
      ) : users.length === 0 ? (
        <p className="px-5 py-4 text-[0.8125rem] text-text-muted">{t("admin.users.none")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[0.8125rem]">
            <thead className="text-xs text-text-muted">
              <tr className="border-b border-border">
                <th scope="col" className="px-5 py-2 font-medium">
                  {t("admin.users.email")}
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  {t("admin.users.created")}
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  {t("admin.users.lastActivity")}
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  {t("admin.users.status")}
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  {t("admin.users.twoFactor")}
                </th>
                <th scope="col" className="px-5 py-2">
                  <span className="sr-only">{t("admin.users.actions")}</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="px-5 py-3">
                    <span className="flex flex-wrap items-center gap-2 break-all">
                      {user.email}
                      {user.instanceAdmin && <Badge tone="accent">{t("admin.users.admin")}</Badge>}
                    </span>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-text-muted" title={i18n.dateTime(user.createdAt)}>
                    {i18n.date(user.createdAt)}
                  </td>
                  <td
                    className="px-3 py-3 whitespace-nowrap text-text-muted"
                    title={user.lastActivityAt ? i18n.dateTime(user.lastActivityAt) : undefined}
                  >
                    {user.lastActivityAt ? i18n.relativeTime(user.lastActivityAt) : t("admin.users.never")}
                  </td>
                  <td className="px-3 py-3">
                    {user.status === "active" ? (
                      <Badge tone="success">{t("admin.users.active")}</Badge>
                    ) : (
                      <Badge tone="danger">{t("admin.users.disabledBadge")}</Badge>
                    )}
                  </td>
                  <td className="px-3 py-3 text-text-muted">
                    {user.twoFactorEnabled === null
                      ? t("admin.users.twoFactorUnknown")
                      : user.twoFactorEnabled
                        ? t("admin.users.twoFactorOn")
                        : t("admin.users.twoFactorOff")}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {user.email === ownEmail ? null : user.status === "active" ? (
                      <Button size="sm" variant="ghost" onClick={() => setConfirm({ user, action: "disable" })}>
                        <Ban />
                        {t("admin.users.disable")}
                      </Button>
                    ) : (
                      <Button size="sm" variant="secondary" onClick={() => setConfirm({ user, action: "enable" })}>
                        <CheckCircle2 />
                        {t("admin.users.enable")}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {users && total > PAGE_SIZE && (
        <div className="flex items-center justify-between gap-3 px-5 py-3 text-xs text-text-muted">
          {t("admin.users.range", {
            from: offset + 1,
            to: Math.min(offset + PAGE_SIZE, total),
            total,
          })}
          <span className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            >
              {t("admin.users.previous")}
            </Button>
            <Button size="sm" variant="secondary" disabled={lastPage} onClick={() => setOffset(offset + PAGE_SIZE)}>
              {t("admin.users.next")}
            </Button>
          </span>
        </div>
      )}
      <ConfirmDialog
        open={confirm !== undefined}
        onOpenChange={(open) => !open && setConfirm(undefined)}
        title={
          confirm?.action === "enable"
            ? t("admin.users.enableTitle", { email: confirm.user.email })
            : t("admin.users.disableTitle", { email: confirm?.user.email ?? "" })
        }
        description={confirm?.action === "enable" ? t("admin.users.enableText") : t("admin.users.disableText")}
        confirmLabel={confirm?.action === "enable" ? t("admin.users.enable") : t("admin.users.disable")}
        tone={confirm?.action === "enable" ? "default" : "danger"}
        onConfirm={() => confirm && void apply(confirm.user, confirm.action)}
      />
    </Panel>
  );
}
