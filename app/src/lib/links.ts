import type { Locale } from "@passbox/i18n";

/** The Passbox website. The app links to its pages, never to the code repositories. */
const SITE = "https://passbox.net";

/** Pages of passbox.net the app links to. */
export const SITE_PAGES = {
  security: "/security",
  design: "/docs/cryptography",
  vulnerability: "/docs/security",
  license: "/docs/license",
  download: "/download",
} as const;

/** A page of passbox.net in the app's language: English at the root, other languages under `/<locale>`. */
export function sitePage(page: keyof typeof SITE_PAGES, locale: Locale): string {
  return `${SITE}${locale === "en" ? "" : `/${locale}`}${SITE_PAGES[page]}`;
}

/** The import assistant (app/src/import). */
export const IMPORT_HASH = "#/import";
