/**
 * The Chrome extension against the e2e server: sign up in the web vault, sign
 * into the extension, fill a login through the inline menu, save a changed
 * password from the update prompt, and create and use a passkey on a local
 * relying party that verifies the signature with WebCrypto.
 *
 * Needs a built extension (`pnpm --filter @passbox/extension build`). The
 * extension runs in Chromium's new headless mode (channel "chromium"), which
 * supports extensions. Set PASSBOX_SCREENSHOTS to a directory to save
 * screenshots of the popup, the inline menu and the passkey dialog.
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
    session: { get(keys: null): Promise<Record<string, unknown>> };
  };
};

const here = dirname(fileURLToPath(import.meta.url));
const extensionPath = resolve(here, "../../apps/extension/dist");
const fixtures = resolve(here, "../fixtures");
const screenshots = process.env.PASSBOX_SCREENSHOTS;

const PASSWORD = "correct horse battery staple";
const SITE_PASSWORD = "acme-Secret-42!";

async function shot(page: Page, name: string) {
  if (screenshots) await page.screenshot({ path: join(screenshots, `ext2-${name}.png`) });
}

/** A relying party / login site on http://localhost:<port>. */
function startSite(): Promise<{ server: Server; origin: string }> {
  const server = createServer((request, response) => {
    const path = new URL(request.url ?? "/", "http://localhost").pathname;
    const page = path === "/login" ? "login.html" : path === "/passkey" ? "passkey.html" : undefined;
    if (path === "/welcome") {
      response.writeHead(200, { "content-type": "text/html" });
      response.end("<!doctype html><title>Acme</title><h1>Welcome back</h1>");
      return;
    }
    if (!page) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { "content-type": "text/html" });
    response.end(readFileSync(join(fixtures, page)));
  });
  return new Promise((done) =>
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      done({ server, origin: `http://localhost:${port}` });
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
  return found as Frame;
}

/** Waits until the click-jacking guard accepts clicks (the frame must be visible for a moment). */
const settle = (page: Page) => page.waitForTimeout(500);

async function signUpWithLogin(page: Page, email: string, website: string): Promise<string> {
  await page.goto("/");
  await page.locator("fieldset").getByText("Create account").click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Master password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirm master password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  const secretKey = (await page.getByTestId("secret-key").textContent({ timeout: 30_000 }))?.trim() ?? "";
  await page.getByLabel("I have saved my Emergency Kit").check();
  await page.getByRole("button", { name: "Open my vault" }).click();
  await expect(page.getByText("Your vault is empty")).toBeVisible();

  await page.getByRole("button", { name: "New item" }).click();
  await page.getByRole("menuitem", { name: "Login" }).click();
  await page.getByLabel("Title").fill("Acme");
  await page.getByRole("textbox", { name: "Username" }).fill("alice@example.com");
  await page.getByLabel("Password", { exact: true }).fill(SITE_PASSWORD);
  await page.getByRole("textbox", { name: "Website" }).fill(website);
  await page
    .getByRole("textbox", { name: "One-time password" })
    .fill("otpauth://totp/Acme:alice?secret=JBSWY3DPEHPK3PXP");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Acme", level: 2 })).toBeVisible();
  return secretKey;
}

test.describe("Chrome extension", () => {
  let site: { server: Server; origin: string };
  let context: BrowserContext;
  let userDataDir: string;
  let extensionId: string;

  test.beforeAll(async ({ baseURL }) => {
    site = await startSite();
    userDataDir = mkdtempSync(join(tmpdir(), "passbox-ext-"));
    context = await chromium.launchPersistentContext(userDataDir, {
      channel: "chromium",
      headless: true,
      viewport: { width: 1100, height: 760 },
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    });
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
    extensionId = new URL(worker.url()).host;
    // Point the extension at the e2e server.
    await worker.evaluate((url) => chrome.storage.local.set({ serverUrl: url }), baseURL ?? "");
  });

  test.afterAll(async () => {
    await context?.close();
    site?.server.close();
    if (userDataDir) rmSync(userDataDir, { recursive: true, force: true });
  });

  test("signs in, fills via the inline menu, updates a password and uses passkeys", async ({ page, baseURL }) => {
    test.setTimeout(180_000);
    const email = `ext-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
    const secretKey = await signUpWithLogin(page, email, site.origin);

    // The login page is open in a tab before the popup, so the popup suggests it.
    const login = await context.newPage();
    await login.goto(`${site.origin}/login`);

    // --- Sign in through the popup (opened as a tab at popup size) ---------------
    const popup = await context.newPage();
    await popup.setViewportSize({ width: 360, height: 560 });
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await expect(popup.getByRole("heading", { name: "Sign in to Passbox" })).toBeVisible();
    await popup.getByLabel("Email").fill(email);
    await popup.getByLabel("Master password", { exact: true }).fill(PASSWORD);
    await popup.getByLabel("Secret Key").fill(secretKey);
    await popup.getByRole("button", { name: "Sign in" }).click();
    await expect(popup.getByRole("heading", { name: /Suggestions for localhost/ })).toBeVisible({ timeout: 30_000 });
    await expect(popup.getByRole("button", { name: /Acme/ }).first()).toBeVisible();
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

    // --- A changed password triggers the update prompt after navigation ----------
    await login.getByLabel("Password").fill("acme-New-Secret-43!");
    await login.getByRole("button", { name: "Sign in" }).click();
    await expect(login.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    const banner = await passboxFrame(login, "save");
    await expect(banner.getByText("Update password?")).toBeVisible();
    await settle(login);
    await shot(login, "save-banner");
    await banner.getByRole("button", { name: "Update" }).click();
    await expect.poll(() => login.frames().some((frame) => frame.url().includes("frame.html#save="))).toBe(false);

    await login.goto(`${site.origin}/login`);
    await login.getByLabel("Email").click();
    const menuAgain = await passboxFrame(login, "menu");
    await settle(login);
    await menuAgain.getByRole("button", { name: /Acme/ }).click();
    await expect(login.getByLabel("Password")).toHaveValue("acme-New-Secret-43!");

    // --- Passkeys: create, then sign in; the page verifies the signature ---------
    const rp = await context.newPage();
    await rp.goto(`${site.origin}/passkey`);
    await rp.getByRole("button", { name: "Create a passkey" }).click();
    const createDialog = await passboxFrame(rp, "passkey");
    await expect(createDialog.getByRole("button", { name: "Save passkey" })).toBeVisible();
    await expect(createDialog.getByText("Added to “Acme”")).toBeVisible();
    await settle(rp);
    await shot(rp, "passkey");
    await createDialog.getByRole("button", { name: "Save passkey" }).click();
    await expect(rp.getByRole("status")).toHaveText(/^Registered /, { timeout: 15_000 });

    await rp.getByRole("button", { name: "Sign in with a passkey" }).click();
    const getDialog = await passboxFrame(rp, "passkey");
    await expect(getDialog.getByRole("button", { name: /alice@example\.com/ })).toBeVisible();
    await settle(rp);
    await shot(rp, "passkey-signin");
    await getDialog.getByRole("button", { name: /alice@example\.com/ }).click();
    await expect(rp.getByRole("status")).toHaveText("Signed in: signature verified", { timeout: 15_000 });

    // Locking clears the session; the inline menu then only offers to unlock.
    const popupAgain = await context.newPage();
    await popupAgain.goto(`chrome-extension://${extensionId}/popup.html`);
    await popupAgain.getByRole("button", { name: "Lock" }).click();
    await expect(popupAgain.getByRole("heading", { name: "Unlock your vault" })).toBeVisible();
    const session = await popupAgain.evaluate(() => chrome.storage.session.get(null));
    expect(Object.keys(session)).not.toContain("passbox.session");
    await popupAgain.close();
    await login.bringToFront();
    await login.reload();
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
    await page.reload();
    await page.getByLabel("Master password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Unlock" }).click();
    await page.getByRole("option", { name: /Acme/ }).click();
    await expect(page.getByText(/Passkey · created/)).toBeVisible();
    await expect(page.getByText("alice@example.com · localhost")).toBeVisible();
  });
});
