# Notes for AI coding agents

- Code, comments, commits and technical docs: **English**.
- Passbox is split into repositories (see README). This one is the web vault; it uses passbox-core only through its released packages.
- No cryptography here: it belongs in passbox-core (`@passbox/core-wasm`).
- License is MIT. Self-hosting must always include every feature.
- Checks: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`, `pnpm e2e` (see README).
- No AI attribution in commits or PRs (`git config core.hooksPath .githooks`).
