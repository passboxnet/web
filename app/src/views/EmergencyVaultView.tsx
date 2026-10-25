import type { EmergencyVaults, Item } from "@passbox/client";
import { Badge, Button, EmptyState, Spinner } from "@passbox/ui";
import { ArrowLeft, Copy, Eye, EyeOff, LifeBuoy } from "lucide-react";
import { useEffect, useState } from "react";
import { errorMessage } from "../core";
import { ItemIcon } from "../items/ItemIcon";
import { copyToClipboard } from "../lib/clipboard";
import { useI18n } from "../lib/i18n";
import { fieldLabel, itemSubtitle, itemTitle } from "../lib/items";
import { vaultName } from "../shell/Sidebar";
import { useClient } from "../useClient";
import { Page } from "./PageHeader";

/**
 * The vaults someone shared through emergency access, after the waiting
 * period (C3). Read only; decrypted on this device and kept in memory only.
 */
export function EmergencyVaultView({ grantId }: { grantId: string }) {
  const client = useClient();
  const { t } = useI18n();
  const [data, setData] = useState<EmergencyVaults>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    client
      .openEmergencyAccess(grantId)
      .then(setData)
      .catch((e: unknown) => setError(errorMessage(e)));
  }, [client, grantId]);

  return (
    <Page
      title={data ? t("emergency.view.title", { email: data.grantorEmail }) : t("emergency.view.loading")}
      description={t("emergency.view.description")}
      actions={
        <a
          href="#/settings/emergency"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border-strong bg-surface px-3.5 text-sm font-medium shadow-xs hover:bg-surface-raised coarse:h-11"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {t("emergency.view.back")}
        </a>
      }
    >
      {error ? (
        <p className="rounded-card border border-danger/30 bg-surface p-5 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : !data ? (
        <div className="flex justify-center py-10 text-text-muted">
          <Spinner label={t("app.loading")} />
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <p className="flex items-center gap-2 rounded-lg bg-accent-soft px-3 py-2.5 text-[0.8125rem]">
            <LifeBuoy className="size-4 shrink-0 text-accent" aria-hidden="true" />
            {t("emergency.view.readOnly")}
          </p>
          {data.vaults.map((vault) => {
            const items = data.items.filter((i) => i.vaultId === vault.id);
            return (
              <section key={vault.id} className="rounded-card border border-border bg-surface shadow-card">
                <header className="flex items-center justify-between border-b border-border px-5 py-4">
                  <h2 className="text-sm font-semibold">{vaultName(vault.name, t)}</h2>
                  <Badge>{t("emergency.view.count", { count: items.length })}</Badge>
                </header>
                {items.length === 0 ? (
                  <EmptyState icon={<LifeBuoy />} title={t("emergency.view.empty")} />
                ) : (
                  <ul className="divide-y divide-border">
                    {items.map((item) => (
                      <ItemRow key={item.id} item={item} />
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
          {data.errors.length > 0 && (
            <p className="text-xs text-danger">{t("emergency.view.errors", { count: data.errors.length })}</p>
          )}
        </div>
      )}
    </Page>
  );
}

function ItemRow({ item }: { item: Item }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [revealed, setRevealed] = useState<string>();
  const fields = item.data.fields.filter((f) => f.value && f.type !== "totp");
  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-surface-raised coarse:min-h-14"
      >
        <ItemIcon item={item} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.8125rem] font-medium">{itemTitle(item, t)}</span>
          <span className="block truncate text-xs text-text-muted">{itemSubtitle(item, t)}</span>
        </span>
      </button>
      {open && (
        <dl className="grid gap-x-6 gap-y-2 px-5 pb-4 text-[0.8125rem] sm:grid-cols-[10rem_1fr]">
          {fields.map((field) => {
            const secret = field.type === "concealed";
            const shown = !secret || revealed === field.id;
            return (
              <div key={field.id} className="contents">
                <dt className="text-text-muted">{fieldLabel(field, t)}</dt>
                <dd className="flex min-w-0 items-center gap-1">
                  <span className="min-w-0 flex-1 font-mono break-all">{shown ? field.value : "••••••••"}</span>
                  {secret && (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={shown ? t("action.hide") : t("action.show")}
                      onClick={() => setRevealed(shown ? undefined : field.id)}
                    >
                      {shown ? <EyeOff /> : <Eye />}
                    </Button>
                  )}
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={t("action.copy")}
                    onClick={() => void copyToClipboard(field.value, fieldLabel(field, t))}
                  >
                    <Copy />
                  </Button>
                </dd>
              </div>
            );
          })}
          {item.data.notes && (
            <>
              <dt className="text-text-muted">{t("field.notes")}</dt>
              <dd className="whitespace-pre-wrap">{item.data.notes}</dd>
            </>
          )}
        </dl>
      )}
    </li>
  );
}
