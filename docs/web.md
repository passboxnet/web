# Web app

The web vault lives in [`apps/web`](../apps/web) (React, Vite, Tailwind 4, hash routing). The desktop app shows the same build, so everything here applies to [desktop](desktop.md) as well; desktop-only parts sit behind `isDesktop` in `apps/web/src/desktop.ts`. Shared components and design tokens come from [`packages/ui`](../packages/ui), all cryptography from the WebAssembly core through [`@passbox/client`](../packages/client).

## Languages

- Messages come from [`packages/i18n`](../packages/i18n): `messages/<locale>/common.json` (shared with the extension) and `messages/<locale>/web.json` (this app). English and German exist; German uses "Sie" and the terms in [GLOSSARY.md](../packages/i18n/GLOSSARY.md).
- `apps/web/src/lib/i18n.ts` picks the locale from Settings → Language, or from `navigator.languages` when it is set to "System" (the default), so German browsers get German. `<html lang>` follows the choice.
- Components call `const { t } = useI18n()`; code outside React (toasts, errors) calls `i18n().t`. Dates, relative times and sorting use the translator (`relativeTime`, `date`, `dateTime`, `compare`). Shortcuts show ⌘ on Apple devices and Ctrl/Strg elsewhere (`shortcut(t, "K")`); keyboard hints are hidden on touch screens.
- Labels the shared components render themselves (Close, Cancel, Show password, Caps Lock) are passed in with `UiStringsProvider` from `@passbox/ui`.
- `apps/web/src/i18n.test.ts` fails on text in JSX that is not translated (text nodes and visible attributes such as `label`, `placeholder`, `aria-label`) and on `t("…")` keys that are missing in English or German. The catalog test in `packages/i18n` checks that both languages have the same keys and placeholders.

## Accounts and the Emergency Kit

| Topic | Behavior |
| --- | --- |
| First visit | A browser that has never had an account opens "Create account"; afterwards "Sign in". "Use a different server" sits under "Advanced". |
| Master password | Sign-up and "Change master password" require `acceptableMasterPassword` from the core estimator. The meter explains the score with localized warnings and tips, and "Suggest a passphrase" fills in a five-word passphrase. |
| Emergency Kit | Explains the two keys in plain words, shows the kit (server, full email, Secret Key, write-in line, date, three steps), offers **Download PDF** and **Print**, and asks for the last 4 characters of the Secret Key before the vault opens. "Do this later" leaves a reminder banner. |
| `kitPending` | `localStorage["passbox.kitPending"]` holds the account ID until the kit is confirmed. Every unlock shows the kit again (unless postponed in that session), so a reload never loses it. Signing out clears the flag. |
| Showing the kit again | Settings → Account → "Show Emergency Kit", the reminder banner and the sign-out dialog. When unlocked, Passbox asks for the master password and checks it with `client.verifyMasterPassword`, which derives the keys locally and opens the account key; nothing is sent. On the unlock screen the kit opens right after unlocking. |
| PDF | `lib/pdf.ts` writes a one-page PDF with the standard fonts (WinAnsi, so German text works) on the device; `lib/kit.ts` lays out the kit. No dependency and no network. A QR code with the setup data is not included yet, because Passbox has no QR encoder and the mobile apps cannot scan it yet. |
| Sign out | Every way to remove the account from the device ("Sign out" in Settings and the account menu, "Use a different account…" on the unlock screen) asks first, names the Secret Key prefix and offers "Show Emergency Kit". |
| Forgot master password | A link on sign-in, unlock and Settings opens an honest explanation: nobody can reset it, what to try, and that organization recovery is still to come. |
| Errors | `lib/errors.ts` maps every server error code to a message. The unlock screen only ever mentions the master password (with a Caps Lock hint). Sign-in checks the Secret Key format locally ("incomplete: 6 characters missing" or "doesn't look like a Secret Key"). `rate_limited` shows the minutes from `retryAfterSeconds`. |
| http | Server addresses must use https unless they are on this computer (`localhost`, `127.x`, `[::1]`); a stored http address for another host is ignored. A page served over plain http from another host shows a red warning on every screen. |
| Preview notice | Auth screens show a "Preview" badge with the not-audited notice; Settings → About repeats it with links to the security design and to SECURITY.md for reporting vulnerabilities. |

## Items

| Topic | Behavior |
| --- | --- |
| Trash | "Move to trash" has no confirmation but an **Undo** toast (10 s). The sidebar shows Trash with a count; items can be restored or deleted permanently (with confirmation), and "Empty trash" asks first. After every unlock `client.purgeTrash()` deletes items older than 30 days (best effort). |
| Previous passwords | Item detail lists earlier passwords (from `passwordHistory`) with reveal, copy and "Restore" after a confirmation. Restoring moves the current password into the history. |
| Two-factor code (2FA) | The field validates with `totpInputProblem` before saving and explains a pasted 6-digit code. "QR code from image", "Paste QR code" (or pasting an image into the field) decode the QR code on the device with [jsQR](https://github.com/cozmo/jsQR) (1.4.0, Apache-2.0, no dependencies, loaded on demand). Links from a QR code show as "Set up from QR code: GitHub · octocat", never as `otpauth://`. A "How it works" guide explains where to find the key. An invalid key shows "Can't create a code – check the setup key [Edit]". |
| Duplicates | Saving a new login for a website and username that already exist offers "Update existing" (fills in what was typed), "Create new anyway" or Cancel. |
| Secrets on screen | Revealed values hide again after 30 seconds and when the window loses focus. Large type closes on blur or after a minute. Lists show "Secure note · 3 lines" instead of note content. |
| Speed | List rows show copy buttons for username, password and 2FA code on hover, for the selected row, and always on touch screens; Ctrl/⌘+C on the list copies the selected password. Search tolerates typos ("salesfroce" finds Salesforce) and says when it shows similar results. In the command palette, Enter copies the password, Ctrl/⌘+Enter opens the item, Ctrl/⌘+C copies the username and Ctrl/⌘+O opens the website. |
| Decryption failures | Items or vaults the client could not decrypt (`snapshot.errors`) show a persistent banner with details in the item list and the security check. They are never deleted. |

## Security check

The former Watchtower. It shows "X of Y logins are secure" with a bar instead of a score, then the problems in priority order (used more than once, found in breaches, easy to guess, unsecured connection) with plain labels. Logins without 2FA are under "More tips". Each problem row has **Change now**, a three-step dialog: open the website and copy the current password, copy a new generated one, then "Did it work?" → save or keep the old one. The new password is kept as an in-memory draft per item until it is saved or discarded and is forgotten on lock.

"Check for leaked passwords" is opt-in per session: it explains k-anonymity and then calls `breachCount` (Have I Been Pwned range API; only the first 5 characters of the SHA-1 hash leave the device). Results stay in memory.

## Settings

Account (Emergency Kit, masked Secret Key `P1-•••••-…`, change master password, forgot password), **Devices** (`client.sessions()`, this device marked, sign out one or all others, with confirmations), **Activity** (last 50 events; failed attempts are called sign-in attempts, with the note that wrong master passwords are detected on the device and may not appear), security on this device, language and theme, About (audit status, server, license) and **Technical details** (account ID, algorithms, KDF parameters, server version). The web app names its device "Chrome on Windows" and so on from the user agent; the desktop app reports "Passbox Desktop on …".

## First steps

An empty vault shows a checklist instead of a bare empty state, also reachable as "Getting started" in the sidebar until it is complete or hidden: account created, Emergency Kit, browser extension, import (links to `#/import`), phone, security check. Manual steps are ticked off by the user and stored in the preferences.

## Accessibility

- Touch screens (`pointer: coarse`) get targets of at least 44 px: the `coarse:` Tailwind variant from `packages/ui/src/tokens.css` enlarges buttons, inputs, menu items, nav items and segmented controls, and keeps per-row and per-field copy buttons visible.
- `--pb-text-subtle` is darker in light mode (oklch 0.5) and lighter in dark mode (0.68); badges and meters use `--pb-warning-text` and `--pb-success-text` so their text reaches 4.5:1. Font sizes are in rem and `text-2xs` is 0.75 rem.
- The logo's gradient ID comes from `useId`, so the mark stays visible when another copy is hidden.
- Toasts appear bottom center for 4 seconds and are cleared when switching screens.

## Tests

- Unit tests: `pnpm --filter @passbox/web test` (search, PDF writer, kit check, errors, QR text, server addresses, device names, translations, clipboard, auto-lock).
- End-to-end: `pnpm --filter @passbox/web build && pnpm e2e` (`e2e/tests/vault.spec.ts`), in English by default plus a German smoke test; covers the kit check after a reload, trash and undo, sign-out confirmation, the 2FA check and server address rules.
