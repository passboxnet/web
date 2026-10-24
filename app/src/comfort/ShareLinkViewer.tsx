import { createClient } from "@passbox/api-client";
import {
  openShareLink,
  type ShareLinkState,
  type ShareSnapshot,
  shareLinkInfo,
  WrongPassphraseError,
} from "@passbox/client";
import { Button, Logo, PasswordInput, Spinner } from "@passbox/ui";
import { Clock, Copy, Eye, EyeOff, Link2Off, LockKeyhole, ShieldCheck } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { FormError } from "../auth/AuthLayout";
import { errorMessage, loadCore } from "../core";
import { copyToClipboard } from "../lib/clipboard";
import { useI18n } from "../lib/i18n";

/** The link this page was opened with (`/s/{id}#{key}`), if any. */
export function shareLinkFromLocation(location: Pick<Location, "pathname" | "hash"> = window.location) {
  const match = /^\/s\/([0-9a-z]{26})\/?$/.exec(location.pathname);
  const key = location.hash.replace(/^#/, "");
  if (!match?.[1] || !/^[A-Za-z0-9_-]{43}$/.test(key)) return undefined;
  return { id: match[1], key };
}

/**
 * The page for people without an account who open a share link (B7). It
 * needs no sign-in: the key is in the link's fragment (never sent to the
 * server), the copy is decrypted in this browser. Opening counts a view, so
 * the page asks before it opens.
 */
export function ShareLinkViewer({ link }: { link: { id: string; key: string } }) {
  const i18n = useI18n();
  const { t } = i18n;
  const api = useMemo(() => createClient({ baseUrl: window.location.origin }), []);
  const [state, setState] = useState<ShareLinkState | "loading" | "failed">("loading");
  const [passphrase, setPassphrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [opened, setOpened] = useState<{ snapshot: ShareSnapshot; viewsLeft: number | null; expiresAt: number }>();

  useEffect(() => {
    document.title = t("shareLink.viewer.pageTitle");
    shareLinkInfo(api, link.id)
      .then(setState)
      .catch(() => setState("failed"));
  }, [api, link.id, t]);

  async function open(event?: FormEvent) {
    event?.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      const core = await loadCore();
      setOpened(await openShareLink(api, core, link.id, link.key, passphrase || undefined));
    } catch (e) {
      if (e instanceof WrongPassphraseError) setError(t("shareLink.viewer.wrongPassphrase"));
      else if (e instanceof Error && e.name === "ApiError" && "status" in e && e.status === 404)
        setState({ status: "gone" });
      else setError(t("shareLink.viewer.openFailed", { error: errorMessage(e) }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-full flex-col items-center bg-canvas px-4 py-10">
      <div className="w-full max-w-lg">
        <Logo className="text-text" />
        <main className="mt-8 rounded-card border border-border bg-surface p-6 shadow-card">
          {state === "loading" ? (
            <Spinner label={t("app.loading")} />
          ) : state === "failed" ? (
            <Message icon={<Link2Off />} title={t("shareLink.viewer.failed")} text={t("shareLink.viewer.failedText")} />
          ) : state.status === "gone" ? (
            <Message icon={<Link2Off />} title={t("shareLink.viewer.gone")} text={t("shareLink.viewer.goneText")} />
          ) : opened ? (
            <Snapshot snapshot={opened.snapshot} viewsLeft={opened.viewsLeft} expiresAt={opened.expiresAt} />
          ) : (
            <form onSubmit={open} className="flex flex-col gap-4">
              <div className="flex items-start gap-3">
                <LockKeyhole className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden="true" />
                <div>
                  <h1 className="text-lg font-semibold">{t("shareLink.viewer.title")}</h1>
                  <p className="mt-1 text-[0.8125rem] text-text-muted">{t("shareLink.viewer.text")}</p>
                </div>
              </div>
              <ul className="flex flex-col gap-1 text-xs text-text-muted">
                <li className="flex items-center gap-1.5">
                  <Clock className="size-3.5" aria-hidden="true" />
                  {t("shareLink.viewer.expires", { date: i18n.dateTime(state.expiresAt) })}
                </li>
                {state.viewsLeft !== null && (
                  <li className="flex items-center gap-1.5">
                    <Eye className="size-3.5" aria-hidden="true" />
                    {t("shareLink.viewer.viewsLeft", { count: state.viewsLeft })}
                  </li>
                )}
              </ul>
              {state.needsPassphrase && (
                <PasswordInput
                  label={t("shareLink.viewer.passphrase")}
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  autoComplete="off"
                  autoFocus
                />
              )}
              <FormError message={error} />
              <Button type="submit" loading={busy} disabled={state.needsPassphrase && !passphrase}>
                {t("shareLink.viewer.open")}
              </Button>
              {state.viewsLeft !== null && (
                <p className="text-xs text-text-muted">{t("shareLink.viewer.countsView")}</p>
              )}
            </form>
          )}
        </main>
        <p className="mt-6 flex items-start gap-2 text-xs text-text-muted">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {t("shareLink.viewer.privacy")}
        </p>
      </div>
    </div>
  );
}

function Message({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="flex items-start gap-3" role="status">
      <span className="mt-0.5 text-text-muted [&>svg]:size-5" aria-hidden="true">
        {icon}
      </span>
      <div>
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="mt-1 text-[0.8125rem] text-text-muted">{text}</p>
      </div>
    </div>
  );
}

function Snapshot({
  snapshot,
  viewsLeft,
  expiresAt,
}: {
  snapshot: ShareSnapshot;
  viewsLeft: number | null;
  expiresAt: number;
}) {
  const i18n = useI18n();
  const { t } = i18n;
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold break-words">{snapshot.title || t("item.untitled")}</h1>
        <p className="mt-1 text-xs text-text-muted">
          {viewsLeft === 0
            ? t("shareLink.viewer.lastView")
            : t("shareLink.viewer.expires", { date: i18n.dateTime(expiresAt) })}
        </p>
      </div>
      {snapshot.fields.length > 0 && (
        <dl className="divide-y divide-border rounded-lg border border-border">
          {snapshot.fields.map((field, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: the snapshot never changes
            <Field key={index} field={field} />
          ))}
        </dl>
      )}
      {snapshot.notes && (
        <div className="rounded-lg border border-border px-4 py-3">
          <p className="text-xs font-medium text-text-muted">{t("field.notes")}</p>
          <p className="mt-1.5 text-sm whitespace-pre-wrap">{snapshot.notes}</p>
        </div>
      )}
      <p className="text-xs text-text-muted">{t("shareLink.viewer.saveHint")}</p>
    </div>
  );
}

function Field({ field }: { field: ShareSnapshot["fields"][number] }) {
  const { t } = useI18n();
  const secret = field.type === "concealed";
  const [revealed, setRevealed] = useState(!secret);
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <dt className="text-xs font-medium text-text-muted">{field.label}</dt>
        <dd
          className={`mt-1 text-sm break-all ${secret || field.format === "multiline" ? "font-mono whitespace-pre-wrap" : ""}`}
        >
          {revealed ? field.value : "••••••••••••"}
        </dd>
      </div>
      {secret && (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={revealed ? t("detail.hide", { label: field.label }) : t("detail.reveal", { label: field.label })}
          onClick={() => setRevealed(!revealed)}
        >
          {revealed ? <EyeOff /> : <Eye />}
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t("detail.copy", { label: field.label })}
        onClick={() => void copyToClipboard(field.value, field.label)}
      >
        <Copy />
      </Button>
    </div>
  );
}
