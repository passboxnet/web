import { type Item, shareSnapshot } from "@passbox/client";
import { Button, cn, Dialog, fieldClassName, PasswordInput, Switch } from "@passbox/ui";
import { Check, Copy, Info, Link2, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { FormError } from "../auth/AuthLayout";
import { ItemIcon } from "../items/ItemIcon";
import { copyToClipboard } from "../lib/clipboard";
import { useI18n } from "../lib/i18n";
import { fieldLabel, itemTitle } from "../lib/items";
import { serverUrl } from "../lib/server";
import { useClient, useSnapshot } from "../useClient";
import { comfortError } from "./errors";

const selectClass = cn(fieldClassName, "h-10 px-2.5 coarse:h-12");
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const EXPIRY = [HOUR, DAY, 7 * DAY, 30 * DAY] as const;
const VIEWS = [1, 5, 10, 0] as const;

/** The base of share links: the web app's origin (plus the server, if it is another one). */
export function shareLinkBase(): string {
  const server = serverUrl();
  return server && new URL(server).origin !== window.location.origin ? server : window.location.origin;
}

/**
 * "Share via link": a copy of selected fields for someone without an
 * account. The copy is encrypted here; the key is only in the link. The
 * link expires, can be limited to a number of views and protected with a
 * passphrase. An organization's policy may forbid or limit links.
 */
export function ShareLinkDialog({
  item,
  open,
  onOpenChange,
}: {
  item: Item;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const client = useClient();
  const i18n = useI18n();
  const { t } = i18n;
  const { vaults, policies } = useSnapshot();
  const vault = vaults.find((v) => v.id === item.vaultId);
  const rules = vault?.orgId ? policies.find((p) => p.orgId === vault.orgId)?.rules : undefined;
  const forbidden = rules?.shareLinks === "forbidden";
  const restricted = rules?.shareLinks === "restricted";
  const maxMs = restricted && rules?.shareLinkMaxDays ? rules.shareLinkMaxDays * DAY : Number.POSITIVE_INFINITY;
  const maxViews = restricted ? (rules?.shareLinkMaxViews ?? 0) : 0;
  const expiryOptions = EXPIRY.filter((ms) => ms <= maxMs);
  const viewOptions = VIEWS.filter((v) => (maxViews ? v > 0 && v <= maxViews : true));
  const fields = item.data.fields.filter((f) => f.value && f.type !== "totp");

  const [selected, setSelected] = useState<string[]>([]);
  const [notes, setNotes] = useState(true);
  const [expiry, setExpiry] = useState<number>(DAY);
  const [views, setViews] = useState<number>(1);
  const [protect, setProtect] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [link, setLink] = useState<string>();
  const [copied, setCopied] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset when the dialog opens
  useEffect(() => {
    if (!open) return;
    setSelected(fields.map((f) => f.id));
    setNotes(Boolean(item.data.notes));
    setExpiry(expiryOptions.includes(DAY) ? DAY : (expiryOptions[0] ?? HOUR));
    setViews(viewOptions[0] ?? 1);
    setProtect(false);
    setPassphrase("");
    setError(undefined);
    setLink(undefined);
    setCopied(false);
  }, [open]);

  async function create() {
    if (protect && passphrase.length < 6) {
      setError(t("shareLink.passphraseShort"));
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const snapshot = shareSnapshot(item, {
        fieldIds: selected,
        includeNotes: notes,
        labels: (id, label) => fieldLabel({ id, label }, t, item.data.category),
      });
      const created = await client.createShareLink({
        snapshot,
        label: itemTitle(item, t),
        expiresAt: Date.now() + expiry,
        maxViews: views,
        ...(protect ? { passphrase } : {}),
        vaultId: item.vaultId,
        linkBase: shareLinkBase(),
      });
      setLink(created.url);
    } catch (e) {
      setError(comfortError(e, t));
    } finally {
      setBusy(false);
    }
  }

  const expiryLabel = (ms: number) =>
    ms === HOUR ? t("shareLink.expiry.hour") : t("shareLink.expiry.days", { count: Math.round(ms / DAY) });
  const viewsLabel = (v: number) =>
    v === 0 ? t("shareLink.views.unlimited") : t("shareLink.views.count", { count: v });

  return (
    <Dialog
      open={open}
      icon={<ItemIcon item={item} size="lg" />}
      onOpenChange={onOpenChange}
      title={t("shareLink.title", { name: itemTitle(item, t) })}
      description={t("shareLink.text")}
      footer={
        link ? (
          <Button onClick={() => onOpenChange(false)}>{t("action.done")}</Button>
        ) : (
          !forbidden && (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                {t("action.cancel")}
              </Button>
              <Button
                onClick={() => void create()}
                loading={busy}
                disabled={selected.length === 0 && !notes}
                data-testid="share-link-create"
              >
                <Link2 />
                {t("shareLink.create")}
              </Button>
            </>
          )
        )
      }
    >
      {forbidden ? (
        <p className="flex gap-2 text-[0.8125rem] text-text-muted" role="note">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
          {t("shareLink.forbidden")}
        </p>
      ) : link ? (
        <div className="flex flex-col gap-3">
          <p className="text-[0.8125rem] font-medium">{t("shareLink.ready")}</p>
          <div className="flex gap-2">
            <input
              readOnly
              value={link}
              aria-label={t("shareLink.link")}
              onFocus={(e) => e.currentTarget.select()}
              className={cn(fieldClassName, "h-10 flex-1 px-2.5 font-mono text-xs")}
              data-testid="share-link-url"
            />
            <Button
              variant="secondary"
              onClick={() => {
                void copyToClipboard(link, t("shareLink.link")).then(() => setCopied(true));
              }}
            >
              {copied ? <Check /> : <Copy />}
              {copied ? t("shareLink.copied") : t("action.copy")}
            </Button>
          </div>
          <p className="flex gap-2 text-xs text-text-muted">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            {protect ? t("shareLink.readyHintPassphrase") : t("shareLink.readyHint")}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1 text-[0.8125rem] font-medium">{t("shareLink.contents")}</legend>
            {fields.map((field) => (
              <label key={field.id} className="flex items-center gap-2 text-[0.8125rem]">
                <input
                  type="checkbox"
                  className="size-4 accent-control"
                  checked={selected.includes(field.id)}
                  onChange={(e) =>
                    setSelected((list) =>
                      e.target.checked ? [...list, field.id] : list.filter((id) => id !== field.id),
                    )
                  }
                />
                {fieldLabel(field, t, item.data.category)}
                {field.type === "concealed" && (
                  <span className="text-xs text-text-muted">{t("shareLink.secretField")}</span>
                )}
              </label>
            ))}
            {item.data.notes && (
              <label className="flex items-center gap-2 text-[0.8125rem]">
                <input
                  type="checkbox"
                  className="size-4 accent-control"
                  checked={notes}
                  onChange={(e) => setNotes(e.target.checked)}
                />
                {t("field.notes")}
              </label>
            )}
            <p className="text-xs text-text-muted">{t("shareLink.notIncluded")}</p>
          </fieldset>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-[0.8125rem] font-medium">{t("shareLink.expiry")}</span>
              <select className={selectClass} value={expiry} onChange={(e) => setExpiry(Number(e.target.value))}>
                {expiryOptions.map((ms) => (
                  <option key={ms} value={ms}>
                    {expiryLabel(ms)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[0.8125rem] font-medium">{t("shareLink.views")}</span>
              <select className={selectClass} value={views} onChange={(e) => setViews(Number(e.target.value))}>
                {viewOptions.map((v) => (
                  <option key={v} value={v}>
                    {viewsLabel(v)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {restricted && <p className="text-xs text-text-muted">{t("shareLink.restricted")}</p>}

          <Switch
            checked={protect}
            onCheckedChange={setProtect}
            label={t("shareLink.passphrase")}
            description={t("shareLink.passphraseHint")}
          />
          {protect && (
            <PasswordInput
              label={t("shareLink.passphraseLabel")}
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              autoComplete="new-password"
            />
          )}
          <p className="flex gap-2 text-xs text-text-muted">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            {t("shareLink.howItWorks")}
          </p>
          <FormError message={error} />
        </div>
      )}
    </Dialog>
  );
}
