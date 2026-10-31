/** Public pages the app links to. The apps are listed on the download page. */
const CORE = "https://github.com/passboxnet/core";

export const LINKS = {
  repository: "https://github.com/passboxnet",
  security: `${CORE}/blob/main/SECURITY.md`,
  design: `${CORE}/blob/main/docs/architecture/cryptography.md`,
  extension: "https://passbox.net/download",
  mobile: "https://passbox.net/download",
} as const;

/** The import assistant (app/src/import). */
export const IMPORT_HASH = "#/import";
