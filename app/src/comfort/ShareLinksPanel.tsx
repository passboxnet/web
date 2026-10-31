import type { ShareLink } from "@passbox/client";
import { Badge, Button, ConfirmDialog, Spinner, toast } from "@passbox/ui";
import { Link2, LockKeyhole, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useI18n } from "../lib/i18n";
import { useClient } from "../useClient";
import { Panel } from "../views/PageHeader";
import { comfortError } from "./errors";

/** The account's share links in Settings: how often each was opened, and "End link". */
export function ShareLinksPanel() {
  const client = useClient();
  const i18n = useI18n();
  const { t } = i18n;
  const [links, setLinks] = useState<ShareLink[]>();
  const [error, setError] = useState<string>();
  const [ending, setEnding] = useState<ShareLink>();

  const load = useCallback(() => {
    client
      .shareLinks()
      .then(setLinks)
      .catch((e: unknown) => setError(comfortError(e, t)));
  }, [client, t]);
  useEffect(load, [load]);

  async function end(link: ShareLink) {
    try {
      await client.deleteShareLink(link.id);
      toast.success(t("shareLinks.ended", { name: link.label || t("item.untitled") }));
      load();
    } catch (e) {
      toast.error(t("shareLinks.endFailed"), { description: comfortError(e, t) });
    }
  }

  return (
    <Panel id="share-links" icon={<Link2 />} title={t("shareLinks.title")} description={t("shareLinks.description")}>
      {links === undefined && !error ? (
        <div className="px-5 py-4">
          <Spinner label={t("app.loading")} />
        </div>
      ) : error ? (
        <p className="px-5 py-4 text-[0.8125rem] text-danger" role="alert">
          {error}
        </p>
      ) : links && links.length === 0 ? (
        <p className="px-5 py-4 text-[0.8125rem] text-text-muted">{t("shareLinks.none")}</p>
      ) : (
        links?.map((link) => (
          <div key={link.id} className="flex flex-wrap items-center gap-3 px-5 py-3" data-testid="share-link-row">
            <Link2 className="size-4 shrink-0 text-text-muted" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 truncate text-[0.8125rem] font-medium">
                {link.label || t("item.untitled")}
                {link.hasPassphrase && (
                  <Badge>
                    <LockKeyhole className="size-3" aria-hidden="true" />
                    {t("shareLinks.passphrase")}
                  </Badge>
                )}
              </p>
              <p className="text-xs text-text-muted">
                {link.maxViews > 0
                  ? t("shareLinks.viewsOf", { views: link.views, max: link.maxViews })
                  : t("shareLinks.views", { views: link.views })}{" "}
                · {t("shareLinks.expires", { date: i18n.dateTime(link.expiresAt) })}
              </p>
            </div>
            <Button variant="ghost" size="sm" className="text-danger hover:text-danger" onClick={() => setEnding(link)}>
              <Trash2 />
              {t("shareLinks.end")}
            </Button>
          </div>
        ))
      )}
      <ConfirmDialog
        open={ending !== undefined}
        onOpenChange={(open) => !open && setEnding(undefined)}
        title={t("shareLinks.endTitle")}
        description={t("shareLinks.endText", { name: ending?.label || t("item.untitled") })}
        confirmLabel={t("shareLinks.end")}
        tone="danger"
        onConfirm={() => ending && void end(ending)}
      />
    </Panel>
  );
}
