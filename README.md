# Passbox web vault

The web vault of [Passbox](https://passbox.net), an open-source password manager with passkeys, a built-in authenticator and single sign-on. React and Vite; all cryptography runs in the browser through the WebAssembly build of [passboxnet/core](https://github.com/passboxnet/core).

> **Status: early development.** The cryptographic design is a draft and has not been audited. Do not store real secrets in Passbox yet.

| Path | Description |
| --- | --- |
| [`app`](app) | The web vault (`@passbox/web`) |
| [`e2e`](e2e) | Browser end-to-end tests (Playwright) against a real server |
| [`docs/web.md`](docs/web.md) | Notes on the web vault |

## Development

Requirements: Node.js 22+ and pnpm 10 (`corepack enable`). The shared packages (`@passbox/client`, `@passbox/ui`, `@passbox/core-wasm`, ...) come from the [passboxnet/core release](https://github.com/passboxnet/core/releases) set in `pnpm-workspace.yaml`.

```sh
pnpm install
pnpm dev        # http://localhost:5173, proxies /api to PASSBOX_SERVER_URL (default http://127.0.0.1:8080)
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

Run a server from [passboxnet/server](https://github.com/passboxnet/server) next to it. The end-to-end tests start their own servers and need the binaries:

```sh
PASSBOX_SERVER_BIN=../server/target/debug/passbox-server \
PBX_BIN=../cli/target/debug/pbx \
PASSBOX_E2E_DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres \
  pnpm e2e
```

## Releases

A tag `vX.Y.Z` publishes `passbox-web-X.Y.Z.tar.gz` (the built vault) with `SHA256SUMS` and a build provenance attestation. The server image embeds it at a fixed version.

## Repositories

| Repository | Contents |
| --- | --- |
| [passboxnet/core](https://github.com/passboxnet/core) | Cryptographic core (Rust), WebAssembly build, Rust client, Swift/Kotlin bindings, AI gateway, shared TypeScript packages (`@passbox/*`) |
| [passboxnet/server](https://github.com/passboxnet/server) | Server (API, sync, web vault hosting), container image, Docker Compose for self-hosting |
| [passboxnet/web](https://github.com/passboxnet/web) | Web vault (React, Vite) and browser end-to-end tests |
| [passboxnet/browser-extension](https://github.com/passboxnet/browser-extension) | Browser extension with autofill and passkeys |
| [passboxnet/desktop](https://github.com/passboxnet/desktop) | Desktop app for Windows, macOS and Linux (Tauri) |
| [passboxnet/ios](https://github.com/passboxnet/ios) | iOS and iPadOS app |
| [passboxnet/android](https://github.com/passboxnet/android) | Android app |
| [passboxnet/cli](https://github.com/passboxnet/cli) | `pbx` command-line client and MCP server |

## License

[MIT](LICENSE)
