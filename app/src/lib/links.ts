/** Public pages the app links to. */
const REPOSITORY = "https://github.com/passboxnet/passbox";

export const LINKS = {
  repository: REPOSITORY,
  security: `${REPOSITORY}/blob/main/SECURITY.md`,
  design: `${REPOSITORY}/blob/main/docs/architecture/cryptography.md`,
  extension: `${REPOSITORY}/tree/main/apps/extension`,
  mobile: `${REPOSITORY}#readme`,
} as const;

/** The import assistant (apps/web/src/import). */
export const IMPORT_HASH = "#/import";
