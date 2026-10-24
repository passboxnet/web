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
| Forgot master password | A link on sign-in, unlock and Settings (`recovery/ForgotPasswordDialog.tsx`) says that nobody can reset it and offers what this device knows about the account: the recovery code from the Emergency Kit, recovery through an organization, or asking an emergency contact. See [Account recovery](#account-recovery-and-emergency-access). |
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

## Families, teams and sharing

The UI for [organizations and shared vaults](architecture/sharing.md) lives in `apps/web/src/sharing/`; pure helpers (roles, audience, invitation links, warning order) are in `lib/sharing.ts`. All signing, sealing and verification stays in the core; the UI only calls `@passbox/client`.

| Topic | Behavior |
| --- | --- |
| Entry point | "Family & team" in the sidebar (`#/sharing`). Without an organization it offers **Start a family** (created with its family vault; the creator is the organizer) and **Create a team**, a field to paste an invitation link (for the desktop app) and a short, honest "How Passbox protects what you share". Each organization has a page `#/org/{id}`. The nav item shows how many people wait for the admin's confirmation, or "!" for sharing warnings. |
| Roles | Families say Organizer / Co-organizer / Family member / Guest, teams Owner / Admin / Member / Guest, each with a one-line description in the role picker. Only the owner appoints admins; the UI hides what the server would refuse. |
| Inviting | Email and role; the dialog then shows the link (`/invite/{token}#org={root}`) with **Copy link**, its expiry and what happens next. Whether mail went out is known only to instance admins (`adminSettings().mail.configured`); everyone else is told to pass the link on themselves if needed. Open invitations are listed with **Withdraw**. |
| Invitation link | The server serves the app for `/invite/…`. `captureOrgInvite` (before rendering) keeps the link in `sessionStorage` for the tab and replaces the address with `/#/`, so it survives sign-up, the Emergency Kit and reloads. Signed out, the sign-in/sign-up screen says who invited (`inviterEmail` from the preview) and pre-fills the invited address; on invite-only servers the token is passed as `inviteToken` when the address matches. Once unlocked, a dialog shows the role and the three steps and accepts (`acceptInvitation` pins the organization root from `#org=`). A link for another address is refused before anything is sent. Instance invitations (`#/?invite=`) are unaffected. |
| Waiting | A member who accepted sees "Waiting for confirmation" with their own security code to read out, and **Check now**. |
| Confirming | **Confirm** looks the member up in the key directory first and shows their security code and the admin's own side by side, with "Compare these numbers on the phone or in person" as an optional step. A changed key must be accepted after comparing before confirming. In a family the member then gets the family vault (edit). |
| Members | Role badge and status (waiting, paused, new security code, not verified); "Security code checked" for verified members. Menu: show security code, change role, pause/lift pause (explained as server-side only), **Remove…**. Removing lists the vaults the person could open, says they lose access at once but may have kept what they saw, replaces the keys (`removeMember`), and ends with "change important passwords" and **Open** per vault. |
| Shared vaults | Listed per organization with "Visible to: The Millers (4)" (or "3 people" when not everyone has access) and the own permission. **Share** / **Who has access** opens the access dialog: people and groups with View / Edit / Manage, add, change, remove (removal rotates the key). "How safe is “View”?" explains that View is enforced by the server, not by encryption. A pending rotation is shown with **Replace key now** for managers. |
| Groups (teams) | Create with members, rename, delete, add and remove members (removing replaces the group key and its vaults' keys). Only admins who are group members can change members. |
| Organization settings | Rename (admins), leave (non-owners), delete (owner, after typing the name). |
| Sidebar and items | Personal vaults under "Vaults", shared vaults under each organization's name with a people icon. Item rows in shared vaults carry the icon; the item detail shows "Visible to: …" (opens the access dialog) or "Only visible to you". New items default to the personal vault; the vault picker lists only writable vaults, shared ones as "Family vault · The Millers", with the audience below. |
| View only | Items in View vaults have no Edit, favorite, trash, password restore or "Change now"; a note says what is possible and who can grant edit rights. The trash does not offer restore/delete for them. |
| Share… | The item menu's **Share…** opens the access dialog for shared items. For personal items it explains that Passbox shares whole vaults, previews who will see the item, and moves it: a copy without earlier passwords goes to the chosen shared vault and the original to the trash (restorable for 30 days). Proper moving with the same item ID (B5) needs client support and is not implemented. Without an organization it leads to "Family & team". |
| Warnings | `sharingWarnings` show a calm yellow banner under the header ("A member's security code changed…", "Passbox couldn't verify some shared data…") with **Details**: per warning what it means and what to do; for changed keys both codes side by side and **Code matches – trust the new key** (`acceptKeyChange`). Technical details are behind a disclosure. |
| Security code | Settings → **Your security code**: the own fingerprint in 12 groups, when it is needed, and **Check with the key directory** (`verifyOwnKey`). |
| Key rotation | After unlocking (and whenever sync reports it), vaults marked `rotationPending` that this account manages are rotated automatically with a progress toast (`usePendingRotations`); removals started in the UI hold a lock so the same vault is never rotated twice at once. A vault the account lost access to falls back to all items. |

## Security check

The former Watchtower. It shows "X of Y logins are secure" with a bar instead of a score, then the problems in priority order (used more than once, found in breaches, easy to guess, unsecured connection) with plain labels. Logins without 2FA are under "More tips". Each problem row has **Change now**, a three-step dialog: open the website and copy the current password, copy a new generated one, then "Did it work?" → save or keep the old one. The new password is kept as an in-memory draft per item until it is saved or discarded and is forgotten on lock.

"Check for leaked passwords" is opt-in per session: it explains k-anonymity and then calls `breachCount` (Have I Been Pwned range API; only the first 5 characters of the SHA-1 hash leave the device). Results stay in memory.

## Settings

Account (Emergency Kit, masked Secret Key `P1-•••••-…`, change master password, forgot password), **Devices** (`client.sessions()`, this device marked, sign out one or all others, with confirmations), **Activity** (last 50 events; failed attempts are called sign-in attempts, with the note that wrong master passwords are detected on the device and may not appear), security on this device, language and theme, About (audit status, server, license) and **Technical details** (account ID, algorithms, KDF parameters, server version). The web app names its device "Chrome on Windows" and so on from the user agent; the desktop app reports "Passbox Desktop on …".

## Account recovery and emergency access

The design is in [recovery.md](architecture/recovery.md). The screens:

| Screen | Behavior |
| --- | --- |
| Sign-up | "Create a recovery code" (off by default) adds the code to the Emergency Kit. The kit then shows it in its own box (screen, PDF and print) with the warning to keep the kit like cash. |
| Settings → **Recovery** (`views/settings/RecoveryPanel.tsx`) | "Create recovery code" / "Create new code" / "Remove" (needs a recent login, then opens the kit with the new code); per organization the recovery status: admins turn it on ("Set up recovery") and seal it to other admins, members opt in or withdraw. "Add a device" shows a code and QR code, waits for the new device and asks to approve it with its name and IP. |
| Recovery with the code (`recovery/RecoveryScreens.tsx`) | Email and recovery code (format checked locally), the second factor if the account has one, then a new master password with the strength meter. Afterwards the new Emergency Kit (new Secret Key and recovery code) opens and must be confirmed. All other devices are signed out. |
| Recovery through the organization | The device creates a key pair and shows a **request code** (4 groups of 5 digits) that the admin compares by phone or in person; it then waits (also across reloads, `PendingRecoveryNotice`) until the request is approved, denied or expired, and continues with the new master password. |
| **Recovery requests** (`#/recovery-requests`, `views/RecoveryRequestsView.tsx`) | Recovery admins open it from Settings → Recovery, where each organization shows the number of pending requests. Approving asks to confirm two things: that the person was verified outside Passbox, and that the request code matches. |
| Settings → **Emergency access** (`views/settings/EmergencyPanel.tsx`) | Add a trusted person by email and waiting period (1–30 days, default 7). After they accept: choose the vaults, compare the fingerprint, confirm. A request shows the remaining days with "Allow now" and "Decline". People who trust this account are listed below with "Accept", "Request access" and, once released, "Open". |
| Emergency vaults (`#/emergency/{id}`, `views/EmergencyVaultView.tsx`) | Read-only view of the shared vaults, decrypted on this device and kept in memory only. |
| Code from another device | "Use a code from another device" on the sign-in screen: enter the code, wait for approval, then type the master password; the email and Secret Key are filled in. |

After every unlock the client refreshes the cached recovery options (for the locked screen) and re-seals emergency access when vault keys changed (`client.resealEmergencyAccess`). The activity log names all recovery and emergency events and marks recoveries and emergency requests as alerts.

## Two-factor sign-in

Settings → **Two-factor sign-in** (`views/settings/TwoFactorPanel.tsx`) shows the status and offers:

| Topic | Behavior |
| --- | --- |
| Authenticator app | "Set up" shows a QR code (encoded on the device with [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) 2.0.4, MIT, no dependencies, rendered as SVG) and the setup key in groups of four with a copy button, then asks for a first code. A wrong code says so and the dialog stays open. |
| Security keys and passkeys | "Add security key" asks for a name and lets the browser create a credential (`client.addSecurityKey`). Keys are bound to the host the web app is served from; the button is disabled without a secure context or on an IP address. Keys are listed with date added and last use and can be removed while another method remains. |
| Recovery codes | Shown once after the first method is added and after "Create new codes": a list with **Download** (.txt), **Print** (a hidden frame with only the codes) and **Copy**; "Done" stays disabled until "I have saved these codes" is switched on. The panel shows how many are unused (warning badge at 2 or fewer). |
| Turning it off | Asks for a current code, a recovery code or the security key. |
| Recent login | The server only accepts changes from a login in the last 10 minutes. When it refuses one, a dialog asks for the master password (and the second factor) and the action runs again. |
| Sign-in and unlock | After the master password, `TwoFactorStep` asks for the code from the app ("Use a recovery code instead" switches the field; a pasted recovery code is recognized either way) or offers "Use security key". "Remember this device for 30 days" is off by default. After a recovery code a toast says how many are left. The same step appears inside "Change master password" when the change needs a fresh login. |

The activity log names all two-factor events (turned on/off, method added/removed, recovery code used, new codes, wrong second factor, sign-in with a second factor).

## Developer: AI agents and service accounts

**Developer** in the sidebar (with a counter while agents wait) has two parts:

- **AI agents**: requests from agents connected with `pbx mcp` wait here for your decision. Wherever you are in the app, a dialog opens for a new request (the desktop app also comes to the front and asks for attention; in the browser you can turn on notifications). The dialog shows the request code the agent also shows, the items (looked up in your own vault; unknown items block approval), the exact command lines or files, the agent's reason (marked as its own words) and how long the access lasts. Approving signs the decision with your account key. Below are recent requests (revoke active ones), the agent activity log and setup instructions. See [architecture/ai-agents.md](architecture/ai-agents.md).
- **Service accounts**: create one per pipeline, server or agent (name, vaults with read or read and write access, expiry 30/90/365 days or never), copy the token once (the dialog closes only after you confirm you stored it), change vault access or renew it after a key rotation, see its activity, revoke or delete it (both confirmed). See [architecture/service-accounts.md](architecture/service-accounts.md).

Items of the category **Environment** hold the variables of an app (each field is a variable; the label is the name). Their detail view shows how to run a program with them (`pbx env "<title>" -- <command>`) and copies them as `.env` content.

## Administration

Instance admins (the first account on a server, and `PASSBOX_ADMIN_EMAILS`, see [self-hosting](self-hosting.md#administration)) see **Administration** in the sidebar under Tools and in Settings (`#/admin`); `client.accountInfo().instanceAdmin` decides, checked once per unlock. Other accounts never see it, and the server refuses its endpoints with `forbidden`.

| Panel | Behavior |
| --- | --- |
| Server settings | Name, who can create an account (Everyone / Invited only / Email domains with a domain list), help address, mail language, master password strength and length. Saving refreshes the cached `/api/v1/meta`. |
| Email | Delivery (SMTP with TLS/STARTTLS, or "Server log only" with a warning and the environment variables to set), sender, link address, queue, last error, **Send test email**. |
| Invitations | Invite by email; the link is shown with Copy (needed while mail is not set up). Open invitations can be withdrawn after a confirmation. |
| Accounts | Search by email (debounced), 25 per page, created, last active, status, 2FA (whether two-factor sign-in is on). Disable/enable after a confirmation; your own account has no button. |
| Administration log | Newest first with actor, time and IP, and "Log intact · n entries checked" or a red warning from the server's hash chain check. |

Sign-up follows `/api/v1/meta`: on invite-only servers "Create account" is hidden and a note asks for an invitation; an invitation link (`#/?invite=…&email=…`) opens "Create account" with the email filled in and is removed from the address bar after use; in `domains` mode the allowed domains are named; the server's password policy is enforced in sign-up and "Change master password" in addition to the client's own minimum (`lib/instance.ts`). A help address from the admins is linked on the sign-in screen and in Settings → About.

Settings → **Notifications** has "Email me when a new device signs in" (`client.updatePreferences`). Opening Settings also sets the account's mail language to the app language.

## First steps

An empty vault shows a checklist instead of a bare empty state, also reachable as "Getting started" in the sidebar until it is complete or hidden: account created, Emergency Kit, browser extension, import (links to `#/import`), phone, security check. Manual steps are ticked off by the user and stored in the preferences.

## Accessibility

- Touch screens (`pointer: coarse`) get targets of at least 44 px: the `coarse:` Tailwind variant from `packages/ui/src/tokens.css` enlarges buttons, inputs, menu items, nav items and segmented controls, and keeps per-row and per-field copy buttons visible.
- `--pb-text-subtle` is darker in light mode (oklch 0.5) and lighter in dark mode (0.68); badges and meters use `--pb-warning-text` and `--pb-success-text` so their text reaches 4.5:1. Font sizes are in rem and `text-2xs` is 0.75 rem.
- The logo's gradient ID comes from `useId`, so the mark stays visible when another copy is hidden.
- Toasts appear bottom center for 4 seconds and are cleared when switching screens.

## Tests

- Unit tests: `pnpm --filter @passbox/web test` (search, PDF writer, kit check, errors, QR text, server addresses, device names, translations, clipboard, auto-lock, sharing helpers and invitation links).
- `e2e/tests/sharing.spec.ts` uses two browser contexts: a family is started, the invitee signs up through the link, accepts and is confirmed after comparing the security code, both use the family vault, the member edits an item and then gets view-only, and loses access after being removed; a second test covers an existing, locked account opening a link and a link for another address.
- End-to-end: `pnpm --filter @passbox/web build && pnpm e2e` (`e2e/tests/vault.spec.ts`; two-factor sign-in with TOTP, recovery codes and a virtual security key in `e2e/tests/two-factor.spec.ts`), in English by default plus a German smoke test; covers the kit check after a reload, trash and undo, sign-out confirmation, the 2FA check and server address rules. `e2e/tests/recovery.spec.ts` covers the recovery code (sign-up with code, recovery on a fresh browser, the old Secret Key no longer works) and emergency access between two accounts. `e2e/tests/admin.spec.ts` runs against a second server of its own (`PASSBOX_E2E_ADMIN_PORT`, default `PASSBOX_E2E_PORT` + 1) and covers the administration, invite-only sign-up and disabled accounts.
