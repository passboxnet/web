# Contributing to Passbox

Thanks for your interest in Passbox! This document explains how the repository is organized and what we expect from changes.

## Conventions

- **Language:** code, comments, commit messages and technical documentation are written in English.
- **Repositories:** Passbox is split into several repositories (see the [README](README.md#repositories)). This one is the web vault (`app/`) and its browser end-to-end tests (`e2e/`). The shared TypeScript packages (`@passbox/client`, `@passbox/ui`, `@passbox/i18n`, ...) come from the passboxnet/core release set in `pnpm-workspace.yaml`.
- **Cryptography lives only in [passboxnet/core](https://github.com/passboxnet/core).** The web vault calls it through the WebAssembly build (`@passbox/core-wasm`) and `@passbox/client`. Do not add cryptographic code in TypeScript.
- **No secrets in logs or error messages.** Keep secret values out of anything that may be logged, reported or shown in a crash report.

## Database for tests

The end-to-end tests start a real Passbox server, which needs PostgreSQL 15 or newer. For example:

```sh
docker run -d --name passbox-pg -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:16
export PASSBOX_E2E_DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres
```

`PASSBOX_E2E_DATABASE_URL` is a superuser connection. Every server the tests start gets a database of its own with the production roles, which is dropped afterwards. `e2e/database.sh` (needs `psql`) creates these databases with the script and roles of [passboxnet/server](https://github.com/passboxnet/server), checked out next to this repository (or set `PASSBOX_SERVER_DIR`).

## Before you open a pull request

```sh
pnpm lint
pnpm typecheck && pnpm test && pnpm build
pnpm e2e
```

`pnpm e2e` needs `PASSBOX_E2E_DATABASE_URL` (above) and the server and CLI binaries (`PASSBOX_SERVER_BIN`, `PBX_BIN`); see the [README](README.md#development).

Significant design decisions are recorded as ADRs in [passboxnet/core: `docs/adr`](https://github.com/passboxnet/core/tree/main/docs/adr). Add one when you change the architecture, the cryptography or a public interface.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
