/**
 * The Chrome extension against the e2e server: choose the server and sign in
 * through the popup, fill through the inline menu, update a password with
 * Undo, refuse hidden fields, scripted submits and silent fills into frames
 * of other sites, clear the clipboard, and create and use passkeys (with
 * user verification) on a local relying party that verifies the signature
 * with WebCrypto.
 *
 * Needs a built extension (`pnpm --filter @passbox/extension build`). The
 * extension runs in Chromium's new headless mode (channel "chromium"), which
 * supports extensions. Set PASSBOX_SCREENSHOTS to a directory to save
 * screenshots of the popup, the inline menu, the save banner and the
 * passkey dialog.
 */
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type BrowserContext, chromium, expect, type Frame, type Page, test } from "@playwright/test";

/** The extension APIs used in code evaluated inside the extension. */
declare const chrome: {
  storage: {
    local: { set(items: Record<string, unknown>): Promise<void> };
    session: {
      get(keys: null): Promise<Record<string, unknown>>;
      set(items: Record<string, unknown>): Promise<void>;
    };
  };
};

const here = dirname(fileURLToPath(import.meta.url));
const extensionPath = resolve(here, "../../apps/extension/dist");
const fixtures = resolve(here, "../fixtures");
const screenshots = process.env.PASSBOX_SCREENSHOTS;

const PASSWORD = "correct horse battery staple";
const SITE_PASSWORD = "acme-Secret-42!";
const NEW_PASSWORD = "acme-New-Secret-43!";

async function shot(page: Page, name: string) {
  if (screenshots) await page.screenshot({ path: join(screenshots, `ext2-${name}.png`) });
}

const HIDDEN_PAGE = `<!doctype html><title>News</title>
<form method="post" action="/welcome">
  <label for="email">Email</label><input id="email" name="email" type="email">
  <div style="opacity:0"><input id="password" name="password" type="password"></div>
  <input id="password2" name="password2" type="password" style="position:absolute;left:-5000px">
  <button type="submit">Subscribe</button>
</form>`;

/** A page script fills a new password and "clicks" Sign in without any user input. */
const SPOOF_PAGE = `<!doctype html><title>Promo</title>
<form method="post" action="/welcome">
  <input id="email" name="email" type="email" value="alice@example.com">
  <input id="password" name="password" type="password">
  <button id="go" type="submit">Sign in</button>
</form>
<script>
  setTimeout(() => {
    document.getElementById("password").value = "attacker-Chosen-1";
    document.getElementById("go").click();
  }, 800);
</script>`;

/** A login site and relying party on http://localhost:<port> (also reachable as 127.0.0.1). */
function startSite(): Promise<{ server: Server; origin: string; otherOrigin: string }> {
  let port = 0;
  const server = createServer((request, response) => {
    const path = new URL(request.url ?? "/", "http://localhost").pathname;
    const pages: Record<string, string> = {
      "/login": "login.html",
      "/signup": "signup.html",
      "/passkey": "passkey.html",
    };
    const html = (body: string) => {
      response.writeHead(200, { "content-type": "text/html" });
      response.end(body);
    };
    if (path === "/welcome") return html("<!doctype html><title>Acme</title><h1>Welcome back</h1>");
    if (path === "/hidden") return html(HIDDEN_PAGE);
    if (path === "/spoof") return html(SPOOF_PAGE);
    // A page of another site that embeds the login form in a frame.
    if (path === "/framed") {
      return html(
        `<!doctype html><title>Prize</title><h1>You won!</h1><iframe src="http://localhost:${port}/login" style="width:480px;height:420px;border:0"></iframe>`,
      );
    }
    const page = pages[path];
    if (!page) {
      response.writeHead(404).end();
      return;
    }
    html(readFileSync(join(fixtures, page), "utf8"));
  });
  return new Promise((done) =>
    server.listen(0, "127.0.0.1", () => {
      port = (server.address() as AddressInfo).port;
      done({ server, origin: `http://localhost:${port}`, otherOrigin: `http://127.0.0.1:${port}` });
    }),
  );
}

/** Finds a Passbox iframe (they live in a closed shadow root) by kind. */
async function passboxFrame(page: Page, kind: "menu" | "save" | "passkey"): Promise<Frame> {
  let found: Frame | undefined;
  await expect
    .poll(() => {
      found = page.frames().find((frame) => frame.url().includes(`/frame.html#${kind}=`));
      return Boolean(found);
    })
    .toBe(true);
  // Wait until the frame has rendered; the click-jacking guard counts from then.
  await (found as Frame).locator("button").first().waitFor();
  return found as Frame;
}

const hasFrame = (page: Page, kind: "menu" | "save" | "passkey") =>
  page.frames().some((frame) => frame.url().includes(`/frame.html#${kind}=`));

/** Waits until the click-jacking guard accepts clicks (the frame must be visible for a moment). */
const settle = (page: Page) => page.waitForTimeout(700);

async function signUpWithLogin(page: Page, email: string, website: string): Promise<string> {
  await page.goto("/");
  await page.locator("fieldset").getByText("Create account").click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Master password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirm master password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  const secretKey = (await page.getByTestId("secret-key").textContent({ timeout: 30_000 }))?.trim() ?? "";
  await page.getByLabel(/last 4 characters of your Secret Key/).fill(secretKey.slice(-4));
  await page.getByRole("button", { name: "Continue to my vault" }).click();
  await expect(page.getByText("No passwords saved yet")).toBeVisible();

  await page.getByRole("button", { name: "New item" }).click();
  await page.getByRole("menuitem", { name: "Login" }).click();
  await page.getByLabel("Title").fill("Acme");
  await page.getByRole("textbox", { name: "Username" }).fill("alice@example.com");
  await page.getByLabel("Password", { exact: true }).fill(SITE_PASSWORD);
  await page.getByRole("textbox", { name: "Website" }).fill(website);
  await page
    .getByRole("textbox", { name: "Two-factor code (2FA)" })
    .fill("otpauth://totp/Acme:alice?secret=JBSWY3DPEHPK3PXP");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Acme", level: 2 })).toBeVisible();
  return secretKey;
}

async function openPopup(context: BrowserContext, extensionId: string): Promise<Page> {
  const popup = await context.newPage();
  await popup.setViewportSize({ width: 360, height: 600 });
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  return popup;
}

/** Opens the inline menu on the email field and clicks the Acme login. */
async function fillAcme(page: Page) {
  await page.getByLabel("Email").click();
  const menu = await passboxFrame(page, "menu");
  await settle(page);
  await menu.getByRole("button", { name: /Acme/ }).click();
}

test.describe("Chrome extension", () => {
  // Clicks into out-of-process extension iframes occasionally stall on a
  // heavily loaded machine; fail such an action fast and retry the flow once.
  test.describe.configure({ retries: 1, mode: "serial" });

  let site: Awaited<ReturnType<typeof startSite>>;
  let context: BrowserContext;
  /** The web vault, in the same browser profile as the extension. */
  let web: Page;
  let userDataDir: string;
  let extensionId: string;

  test.beforeAll(async () => {
    site = await startSite();
    userDataDir = mkdtempSync(join(tmpdir(), "passbox-ext-"));
    context = await chromium.launchPersistentContext(userDataDir, {
      channel: "chromium",
      headless: true,
      locale: "en-US",
      viewport: { width: 1100, height: 760 },
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    });
    context.setDefaultTimeout(15_000);
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
    extensionId = new URL(worker.url()).host;
  });

  test.afterAll(async () => {
    await context?.close();
    site?.server.close();
    if (userDataDir) rmSync(userDataDir, { recursive: true, force: true });
  });

  test("signs in, fills, updates passwords with undo and stays safe on hostile pages", async ({ baseURL }) => {
    test.setTimeout(240_000);
    const email = `ext-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
    web = await context.newPage();
    const secretKey = await signUpWithLogin(web, email, site.origin);

    // The login page is open in a tab before the popup, so the popup suggests it.
    const login = await context.newPage();
    await login.goto(`${site.origin}/login`);

    // --- First run: choose the server, then sign in -----------------------------
    const popup = await openPopup(context, extensionId);
    await expect(popup.getByRole("heading", { name: "Choose your server" })).toBeVisible();
    await shot(popup, "choose-server");
    await popup.getByLabel("Server address").fill("https://does-not-exist.invalid");
    await popup.getByRole("button", { name: "Continue" }).click();
    await expect(popup.getByText(/could not be reached|needs access/)).toBeVisible({ timeout: 20_000 });
    await popup.getByLabel("Server address").fill(baseURL ?? "");
    await popup.getByRole("button", { name: "Continue" }).click();
    await expect(popup.getByRole("heading", { name: "Sign in to Passbox" })).toBeVisible();
    // A malformed Secret Key is caught on the device.
    await popup.getByLabel("Email").fill(email);
    await popup.getByLabel("Master password", { exact: true }).fill(PASSWORD);
    await popup.getByLabel("Secret Key").fill("hello");
    await popup.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(popup.getByText("doesn't look like a Secret Key")).toBeVisible();
    await popup.getByLabel("Secret Key").fill(secretKey);
    await popup.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(popup.getByRole("heading", { name: /Suggestions for localhost/ })).toBeVisible({ timeout: 30_000 });
    await expect(popup.getByRole("button", { name: /Acme/ }).first()).toBeVisible();
    await expect(popup.getByText(/^127\.0\.0\.1|localhost:\d+$/)).toHaveCount(0);
    await shot(popup, "popup");
    await popup.emulateMedia({ colorScheme: "dark" });
    await shot(popup, "popup-dark");
    await popup.emulateMedia({ colorScheme: "light" });

    await popup.getByRole("button", { name: /^Acme/ }).first().click();
    await expect(popup.getByRole("heading", { name: "Acme", level: 1 })).toBeVisible();
    await expect(popup.getByText(/^\d{3} \d{3}$/)).toBeVisible();
    await shot(popup, "item");

    // MV3 stops idle service workers. The session survives a restart.
    const cdp = await context.newCDPSession(popup);
    await cdp.send("ServiceWorker.enable");
    await cdp.send("ServiceWorker.stopAllWorkers");
    await popup.reload();
    await expect(popup.getByRole("heading", { name: /Suggestions for localhost/ })).toBeVisible();
    await expect(popup.getByRole("heading", { name: "Unlock your vault" })).toHaveCount(0);
    await popup.close();

    // --- Fill through the inline menu ------------------------------------------
    await login.bringToFront();
    await login.reload();
    await login.getByLabel("Email").click();
    const menu = await passboxFrame(login, "menu");
    await expect(menu.getByRole("button", { name: /Acme/ })).toBeVisible();
    await settle(login);
    await shot(login, "inline-menu");
    await menu.getByRole("button", { name: /Acme/ }).click();
    await expect(login.getByLabel("Email")).toHaveValue("alice@example.com");
    await expect(login.getByLabel("Password")).toHaveValue(SITE_PASSWORD);
    // The page's own input listeners saw the values (as React or Vue would).
    await expect(login.locator("body")).toHaveAttribute("data-email-input", "alice@example.com");
    await expect(login.locator("body")).toHaveAttribute("data-password-input", SITE_PASSWORD);

    // --- A changed password triggers the update prompt; Undo restores the old one -
    await login.getByLabel("Password").fill(NEW_PASSWORD);
    await login.getByRole("button", { name: "Sign in" }).click();
    await expect(login.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    let banner = await passboxFrame(login, "save");
    await expect(banner.getByText("Update password?")).toBeVisible();
    await expect(banner.getByText("Only update if you signed in successfully.")).toBeVisible();
    await settle(login);
    await shot(login, "save-banner");
    await banner.getByRole("button", { name: "Update", exact: true }).click();
    await expect(banner.getByRole("status")).toContainText("Password updated");
    await shot(login, "save-undo");
    await banner.getByRole("button", { name: /Undo/ }).click();
    await expect.poll(() => hasFrame(login, "save")).toBe(false);
    await login.goto(`${site.origin}/login`);
    await fillAcme(login);
    await expect(login.getByLabel("Password")).toHaveValue(SITE_PASSWORD);

    // Update again and keep it; the banner closes by itself after ten seconds.
    await login.getByLabel("Password").fill(NEW_PASSWORD);
    await login.getByRole("button", { name: "Sign in" }).click();
    banner = await passboxFrame(login, "save");
    await settle(login);
    await banner.getByRole("button", { name: "Update", exact: true }).click();
    await expect(banner.getByRole("status")).toContainText("Password updated");
    await expect.poll(() => hasFrame(login, "save"), { timeout: 20_000 }).toBe(false);
    await login.goto(`${site.origin}/login`);
    await fillAcme(login);
    await expect(login.getByLabel("Password")).toHaveValue(NEW_PASSWORD);

    // --- A page script cannot raise an update prompt ----------------------------
    await login.goto(`${site.origin}/spoof`);
    await expect(login.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    await login.waitForTimeout(2500);
    expect(hasFrame(login, "save")).toBe(false);

    // --- Hidden password fields are never filled -------------------------------
    await login.goto(`${site.origin}/hidden`);
    await login.getByLabel("Email").click();
    const hiddenMenu = await passboxFrame(login, "menu");
    await settle(login);
    await hiddenMenu.getByRole("button", { name: /Acme/ }).click();
    await expect(login.getByLabel("Email")).toHaveValue("alice@example.com");
    await expect(hiddenMenu.getByText("no visible password field")).toBeVisible();
    await shot(login, "username-only");
    expect(await login.locator("#password").inputValue()).toBe("");
    expect(await login.locator("#password2").inputValue()).toBe("");

    // --- A login inside a frame of another site needs a second click -------------
    await login.goto(`${site.otherOrigin}/framed`);
    const framed = login.frameLocator("iframe").first();
    await framed.getByLabel("Email").click();
    const frameMenu = await passboxFrame(login, "menu");
    await expect(frameMenu.getByText(/In a frame on/)).toBeVisible();
    await settle(login);
    await shot(login, "menu-in-frame");
    await frameMenu.getByRole("button", { name: /Acme/ }).click();
    await expect(frameMenu.getByText(/Click again to fill into the frame/)).toBeVisible();
    await expect(framed.getByLabel("Email")).toHaveValue("");
    await frameMenu.getByRole("button", { name: /Acme/ }).click();
    await expect(framed.getByLabel("Email")).toHaveValue("alice@example.com");

    // --- Sign-up: suggest a strong password, then offer to save the new login ----
    await login.goto(`${site.origin}/signup`);
    await login.getByLabel("Email").fill("bob@example.com");
    await login.getByLabel("Password", { exact: true }).click();
    const suggestion = await passboxFrame(login, "menu");
    await expect(suggestion.getByText("Suggested strong password")).toBeVisible();
    await settle(login);
    await shot(login, "new-password");
    await suggestion.getByRole("button", { name: "Use password" }).click();
    const generated = await login.getByLabel("Password", { exact: true }).inputValue();
    expect(generated).toHaveLength(20);
    await expect(login.getByLabel("Repeat password")).toHaveValue(generated);
    await login.getByRole("button", { name: "Create account" }).click();
    await expect(login.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    const saveBanner = await passboxFrame(login, "save");
    await expect(saveBanner.getByText("Save to Passbox?")).toBeVisible();
    // There is already a login for this site: offer to update it or save a new one.
    await expect(saveBanner.getByText("You already have a login for localhost.")).toBeVisible();
    await saveBanner.getByLabel("Name", { exact: true }).fill("Acme (Bob)");
    await settle(login);
    await shot(login, "save-new");
    await saveBanner.getByRole("button", { name: "Save", exact: true }).click();
    await expect.poll(() => hasFrame(login, "save")).toBe(false);
    await login.goto(`${site.origin}/login`);
    await login.getByLabel("Email").click();
    const twoLogins = await passboxFrame(login, "menu");
    await expect(twoLogins.getByRole("button", { name: /Acme \(Bob\).*bob@example\.com/ })).toBeVisible();
    await login.keyboard.press("Escape");
  });

  test("clears copied passwords from the clipboard when Passbox locks", async () => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const popup = await openPopup(context, extensionId);
    await popup
      .getByRole("button", { name: /alice@example\.com/ })
      .first()
      .click();
    await popup.getByRole("button", { name: "Copy Password" }).click();
    await expect(popup.getByText("Password copied")).toBeVisible();
    await expect(popup.getByText(/clears the clipboard in about 1 minute/)).toBeVisible();
    const read = () => popup.evaluate(() => navigator.clipboard.readText());
    expect(await read()).toBe(NEW_PASSWORD);
    const pending = await popup.evaluate(() => chrome.storage.session.get(null));
    expect(JSON.stringify(pending)).not.toContain(NEW_PASSWORD);
    await popup.getByRole("button", { name: "Back to all items" }).click();
    await popup.getByRole("button", { name: "Lock" }).click();
    await expect(popup.getByRole("heading", { name: "Unlock your vault" })).toBeVisible();
    await expect.poll(read, { timeout: 10_000 }).toBe("");
    // Unlocking shows only "Wrong master password" for a wrong password.
    await popup.getByPlaceholder("Master password").fill("wrong password");
    await popup.getByRole("button", { name: "Unlock", exact: true }).click();
    await expect(popup.getByText("Wrong master password.")).toBeVisible({ timeout: 30_000 });
    await popup.getByPlaceholder("Master password").fill(PASSWORD);
    await popup.getByRole("button", { name: "Unlock", exact: true }).click();
    await expect(popup.getByRole("heading", { name: /Suggestions for|All items/ }).first()).toBeVisible({
      timeout: 30_000,
    });
    await popup.close();
  });

  test("creates and uses passkeys with honest user verification", async () => {
    // The last master password entry is old (more than five minutes ago).
    const extensionPage = await openPopup(context, extensionId);
    await extensionPage.evaluate(() => chrome.storage.session.set({ "passbox.verifiedAt": 0 }));
    await extensionPage.close();

    const rp = await context.newPage();
    await rp.goto(`${site.origin}/passkey`);
    await rp.getByRole("button", { name: "Create a passkey" }).click();
    const createDialog = await passboxFrame(rp, "passkey");
    await expect(createDialog.getByRole("button", { name: "Save passkey" })).toBeVisible();
    await expect(createDialog.getByRole("heading", { name: /Save a passkey for\s*localhost\s*\?/ })).toBeVisible();
    await expect(createDialog.getByText("The site calls itself “Acme”.")).toBeVisible();
    await expect(createDialog.getByText("Added to “Acme”")).toBeVisible();
    // No automatic focus on the confirm button.
    expect(await createDialog.evaluate(() => document.activeElement?.tagName)).not.toBe("BUTTON");
    await settle(rp);
    await shot(rp, "passkey");
    await createDialog.getByRole("button", { name: "Save passkey" }).click();
    await expect(rp.getByRole("status")).toHaveText(/^Registered /, { timeout: 15_000 });

    // Not verified recently and the site does not insist: UV=0, no prompt.
    await rp.getByRole("button", { name: "Sign in with a passkey" }).click();
    let getDialog = await passboxFrame(rp, "passkey");
    await expect(getDialog.getByRole("button", { name: /alice@example\.com/ })).toBeVisible();
    await expect(getDialog.getByLabel("Master password")).toHaveCount(0);
    await settle(rp);
    await shot(rp, "passkey-signin");
    await getDialog.getByRole("button", { name: /alice@example\.com/ }).click();
    await expect(rp.getByRole("status")).toHaveText("Signed in: signature verified, UV=0", { timeout: 15_000 });

    // The site requires verification: Passbox asks for the master password first.
    await rp.getByRole("button", { name: "Sign in with verification" }).click();
    getDialog = await passboxFrame(rp, "passkey");
    await expect(getDialog.getByText("Enter your master password")).toBeVisible();
    await getDialog.getByLabel("Master password").fill(PASSWORD);
    await settle(rp);
    await shot(rp, "passkey-verify");
    await getDialog.getByRole("button", { name: /alice@example\.com/ }).click();
    await expect(rp.getByRole("status")).toHaveText("Signed in: signature verified, UV=1", { timeout: 30_000 });

    // Verified a moment ago: UV=1 without asking again.
    await rp.getByRole("button", { name: "Sign in with a passkey" }).click();
    getDialog = await passboxFrame(rp, "passkey");
    await settle(rp);
    await getDialog.getByRole("button", { name: /alice@example\.com/ }).click();
    await expect(rp.getByRole("status")).toHaveText("Signed in: signature verified, UV=1", { timeout: 15_000 });
    await rp.close();
  });

  test("groups shared family vaults in the popup and marks shared items", async ({ baseURL }) => {
    test.setTimeout(120_000);
    await web.bringToFront();
    await web.goto(`${baseURL}/#/sharing`);
    if (await web.getByRole("button", { name: "Unlock" }).isVisible()) {
      await web.getByLabel("Master password", { exact: true }).fill(PASSWORD);
      await web.getByRole("button", { name: "Unlock" }).click();
    }
    await web.getByRole("button", { name: "Start a family" }).first().click();
    await web.getByLabel("Family name").fill("The Millers");
    await web.getByRole("button", { name: "Start family" }).click();
    await web
      .getByRole("navigation")
      .getByRole("button", { name: /Family vault/ })
      .click();
    await web.getByRole("button", { name: "New item" }).click();
    await web.getByRole("menuitem", { name: "Login" }).click();
    await web.getByLabel("Title").fill("Family router");
    await web.getByRole("textbox", { name: "Username" }).fill("admin");
    await web.getByLabel("Password", { exact: true }).fill("router-Secret-7");
    await web.getByRole("button", { name: "Save", exact: true }).click();
    await expect(web.getByTestId("item-audience")).toContainText("Visible to: The Millers (1)");

    const popup = await openPopup(context, extensionId);
    await popup.evaluate(() =>
      (
        globalThis as { chrome?: { runtime: { sendMessage(m: unknown): Promise<unknown> } } }
      ).chrome?.runtime.sendMessage({
        type: "popup.sync",
      }),
    );
    await popup.reload();
    const filter = popup.getByLabel("Vault", { exact: true });
    await expect(filter.locator("optgroup[label='The Millers'] option")).toHaveText(["Family vault"]);
    await expect(
      popup.getByRole("button", { name: /Family router/ }).getByLabel("Shared with your family or team"),
    ).toBeVisible();
    await filter.selectOption({ label: "Family vault" });
    await expect(popup.getByRole("button", { name: /Acme/ })).toHaveCount(0);
    await shot(popup, "popup-shared");
    await popup.getByRole("button", { name: /Family router/ }).click();
    await expect(popup.getByText("Family vault · The Millers")).toBeVisible();
    await popup.close();
    // Leave the web vault on all items for the next test.
    await web.goto(`${baseURL}/#/items`);
  });

  test("locks, asks before signing out and stays out of the web vault", async ({ baseURL }) => {
    const popup = await openPopup(context, extensionId);
    await popup.getByRole("button", { name: "Lock" }).click();
    await expect(popup.getByRole("heading", { name: "Unlock your vault" })).toBeVisible();
    const session = await popup.evaluate(() => chrome.storage.session.get(null));
    expect(Object.keys(session)).not.toContain("passbox.session");

    // "Use a different account" asks first and offers the Emergency Kit.
    await popup.getByRole("button", { name: "Use a different account…" }).click();
    const dialog = popup.getByRole("dialog");
    await expect(dialog.getByText("Sign out of this device?")).toBeVisible();
    await expect(dialog.getByText(/Secret Key starting P1-/)).toBeVisible();
    await shot(popup, "sign-out");
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(popup.getByRole("heading", { name: "Unlock your vault" })).toBeVisible();

    const login = await context.newPage();
    await login.goto(`${site.origin}/login`);
    await login.getByLabel("Email").click();
    const lockedMenu = await passboxFrame(login, "menu");
    await expect(lockedMenu.getByText("Passbox is locked")).toBeVisible();
    await shot(login, "inline-menu-locked");

    // Passbox stays out of its own web vault: no menu on the master password.
    const vaultTab = await context.newPage();
    await vaultTab.goto(baseURL ?? "/");
    await vaultTab.getByLabel("Master password", { exact: true }).click();
    await vaultTab.waitForTimeout(1000);
    expect(vaultTab.frames().some((frame) => frame.url().includes("/frame.html#"))).toBe(false);
    await vaultTab.close();

    // The web vault shows the passkey without its private key.
    await web.bringToFront();
    await web.reload();
    await web.getByLabel("Master password", { exact: true }).fill(PASSWORD);
    await web.getByRole("button", { name: "Unlock" }).click();
    await web.getByRole("option", { name: /Acme/ }).first().click();
    await expect(web.getByText(/Passkey · created/)).toBeVisible();
    await expect(web.getByText("alice@example.com · localhost")).toBeVisible();
  });
});
