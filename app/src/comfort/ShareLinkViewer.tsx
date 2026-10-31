import { createClient } from "@passbox/api-client";
import {
  openShareLink,
  type ShareLinkState,
  type ShareSnapshot,
  shareLinkInfo,
  WrongPassphraseError,
} from "@passbox/client";
import { Badge, Button, cn, GridFrame, Logo, Panel, PasswordInput, Spinner } from "@passbox/ui";
import { Clock, Copy, Eye, EyeOff, Link2Off, LockKeyhole, ShieldCheck } from "lucide-react";
import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
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
 * The page for people without an account who open a share link. It
 * needs no sign-in: the key is in the link's fragment (never sent to the
 * server), the copy is decrypted in this browser. Opening counts a view, so
 * the page asks before it opens.
 *
 * Often the first thing someone sees of Passbox, so it carries the brand
 * line: the backdrop gradient, a bezelled panel with the dotted grid frame,
 * the logo and a pill button.
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
    <div className="relative isolate flex min-h-full flex-col items-center bg-backdrop px-4 py-10 sm:py-16">
      <div aria-hidden="true" className="grain pointer-events-none absolute inset-0 -z-10" />
      <div className="w-full max-w-xl">
        <Panel bezel>
          <GridFrame edges="both" className="mt-5 py-8 sm:mt-6 sm:py-10">
            <div className="px-5 sm:px-6">
              <Logo className="text-text" />
            </div>
            <main className="mt-8 px-5 sm:px-6">
              {state === "loading" ? (
                <div className="flex justify-center py-8 text-text-muted">
                  <Spinner label={t("app.loading")} />
                </div>
              ) : state === "failed" ? (
                <Message
                  icon={<Link2Off />}
                  title={t("shareLink.viewer.failed")}
                  text={t("shareLink.viewer.failedText")}
                />
              ) : state.status === "gone" ? (
                <Message icon={<Link2Off />} title={t("shareLink.viewer.gone")} text={t("shareLink.viewer.goneText")} />
              ) : opened ? (
                <Snapshot snapshot={opened.snapshot} viewsLeft={opened.viewsLeft} expiresAt={opened.expiresAt} />
              ) : (
                <form onSubmit={open} className="flex flex-col gap-5">
                  <div className="flex flex-col gap-4">
                    <Tile tone="accent">
                      <LockKeyhole />
                    </Tile>
                    <div>
                      <h1 className="text-title-sm text-text">{t("shareLink.viewer.title")}</h1>
                      <p className="mt-1.5 text-sm text-text-muted">{t("shareLink.viewer.text")}</p>
                    </div>
                  </div>
                  <ul className="flex flex-wrap gap-2">
                    <li>
                      <Badge tone="neutral" className="gap-1.5 [&_svg]:size-3.5">
                        <Clock aria-hidden="true" />
                        {t("shareLink.viewer.expires", { date: i18n.dateTime(state.expiresAt) })}
                      </Badge>
                    </li>
                    {state.viewsLeft !== null && (
                      <li>
                        <Badge tone="accent" className="gap-1.5 [&_svg]:size-3.5">
                          <Eye aria-hidden="true" />
                          {t("shareLink.viewer.viewsLeft", { count: state.viewsLeft })}
                        </Badge>
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
                  <div className="flex flex-col gap-3">
                    <Button
                      type="submit"
                      size="lg"
                      shape="pill"
                      className="w-full sm:w-auto sm:self-start sm:px-8"
                      loading={busy}
                      disabled={state.needsPassphrase && !passphrase}
                    >
                      {t("shareLink.viewer.open")}
                    </Button>
                    {state.viewsLeft !== null && (
                      <p className="text-xs text-text-muted">{t("shareLink.viewer.countsView")}</p>
                    )}
                  </div>
                </form>
              )}
            </main>
          </GridFrame>
          <p className="flex items-start gap-2.5 px-11 py-5 text-xs text-text-muted sm:px-16">
            <ShieldCheck className="mt-px size-4 shrink-0 text-success" aria-hidden="true" />
            {t("shareLink.viewer.privacy")}
          </p>
        </Panel>
      </div>
    </div>
  );
}

/** An icon tile (28 % radius), the shape every Passbox surface shares. */
function Tile({ tone, children }: { tone: "accent" | "neutral"; children: ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-12 items-center justify-center rounded-[13px] shadow-highlight [&_svg]:size-6",
        tone === "accent" ? "bg-accent-soft text-accent" : "bg-surface-raised text-text-muted",
      )}
    >
      {children}
    </span>
  );
}

function Message({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="flex flex-col gap-4" role="status">
      <Tile tone="neutral">{icon}</Tile>
      <div>
        <h1 className="text-title-sm text-text">{title}</h1>
        <p className="mt-1.5 text-sm text-text-muted">{text}</p>
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
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-title-sm break-words text-text">{snapshot.title || t("item.untitled")}</h1>
        <p className="mt-1.5 text-xs text-text-muted">
          {viewsLeft === 0
            ? t("shareLink.viewer.lastView")
            : t("shareLink.viewer.expires", { date: i18n.dateTime(expiresAt) })}
        </p>
      </div>
      {snapshot.fields.length > 0 && (
        <dl className="rounded-card border border-hairline bg-surface px-4 shadow-card">
          {snapshot.fields.map((field, index) => (
            <Field
              // biome-ignore lint/suspicious/noArrayIndexKey: the snapshot never changes
              key={index}
              field={field}
              last={index === snapshot.fields.length - 1}
            />
          ))}
        </dl>
      )}
      {snapshot.notes && (
        <div className="rounded-card border border-hairline bg-surface px-4 py-3 shadow-card">
          <p className="text-xs font-medium text-text-subtle">{t("field.notes")}</p>
          <p className="mt-1.5 text-sm whitespace-pre-wrap">{snapshot.notes}</p>
        </div>
      )}
      <p className="text-xs text-text-muted">{t("shareLink.viewer.saveHint")}</p>
    </div>
  );
}

function Field({ field, last }: { field: ShareSnapshot["fields"][number]; last: boolean }) {
  const { t } = useI18n();
  const secret = field.type === "concealed";
  const [revealed, setRevealed] = useState(!secret);
  return (
    <div className={cn("flex items-center gap-3 py-3", !last && "border-b border-hairline")}>
      <div className="min-w-0 flex-1">
        <dt className="text-xs font-medium text-text-subtle">{field.label}</dt>
        <dd
          className={cn(
            "mt-1 text-[0.9375rem] break-all text-text",
            (secret || field.format === "multiline") && "font-mono text-sm whitespace-pre-wrap",
          )}
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
