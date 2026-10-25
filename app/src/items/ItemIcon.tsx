import { FIELD, fieldValue, type Item } from "@passbox/client";
import { Monogram, type MonogramSize, SiteIcon } from "@passbox/ui";
import { useEffect, useRef, useState } from "react";
import { useServerMeta } from "../lib/instance";
import { CATEGORY_META, hostname } from "../lib/items";
import { usePreferences } from "../lib/preferences";
import { useClient } from "../useClient";

/** Loads at most this many icons at once (the server allows 600 a minute per session). */
const PARALLEL = 6;
let running = 0;
const waiting: Array<() => void> = [];

function limited<T>(task: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const start = () => {
      running++;
      task()
        .then(resolve, reject)
        .finally(() => {
          running--;
          waiting.shift()?.();
        });
    };
    if (running < PARALLEL) start();
    else waiting.push(start);
  });
}

/**
 * The host whose website icon an item shows: logins with a web address only.
 * IP addresses, `localhost` and other names without a dot have no public icon.
 */
export function iconHost(item: { data: Item["data"] }): string | undefined {
  if (item.data.category !== "login") return undefined;
  const url = fieldValue(item.data, FIELD.url);
  const host = hostname(url)?.toLowerCase();
  if (!host?.includes(".") || /^[\d.]+$/.test(host) || host.includes(":") || host.includes(" ")) {
    return undefined;
  }
  return host;
}

/** Whether this app shows website icons: the user's setting and the server's (`meta.icons`). */
export function useWebsiteIconsEnabled(): boolean {
  const { showWebsiteIcons } = usePreferences();
  const meta = useServerMeta();
  return showWebsiteIcons && meta?.icons !== false;
}

/**
 * The website icon of `host` as a `data:` URL once the element is (nearly)
 * visible: bundled with the app for popular sites, otherwise loaded through
 * the user's own Passbox server. `undefined` while
 * loading, off or when there is none.
 */
function useWebsiteIcon(host: string | undefined, element: React.RefObject<HTMLElement | null>): string | undefined {
  const client = useClient();
  const enabled = useWebsiteIconsEnabled();
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    setUrl(undefined);
    if (!enabled || !host) return;
    let cancelled = false;
    const load = () =>
      void limited(() => client.iconUrl(host)).then(
        (value) => !cancelled && setUrl(value ?? undefined),
        // Offline or rate limited: keep the monogram, try again next time.
        () => undefined,
      );
    const target = element.current;
    if (!target || typeof IntersectionObserver === "undefined") {
      load();
      return () => {
        cancelled = true;
      };
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          load();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(target);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [client, enabled, host, element]);
  return url;
}

export interface ItemIconProps {
  item: { data: Item["data"] };
  size?: MonogramSize;
  className?: string | undefined;
}

/**
 * An item's icon: the website icon of logins (through the user's server, see
 * docs/architecture/item-extras.md), else the tinted monogram or the
 * category icon. Decorative: the title is always shown next to it.
 */
export function ItemIcon({ item, size = "md", className }: ItemIconProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const host = iconHost(item);
  const src = useWebsiteIcon(host, ref);
  const Icon = CATEGORY_META[item.data.category]?.icon;
  const fallback = item.data.category === "login" || !Icon ? undefined : <Icon />;
  if (!host) return <Monogram name={item.data.title} size={size} icon={fallback} className={className} />;
  return (
    <span ref={ref} className="flex shrink-0">
      <SiteIcon src={src} name={item.data.title || host} size={size} icon={fallback} className={className} />
    </span>
  );
}
