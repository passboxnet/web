import { type Browser, expect, type Page, test } from "@playwright/test";

/**
 * Item types, attachments, share links, the archive, moving items between
 * vaults (with the permission preview) and access requests.
 */

const PASSWORD = "correct horse battery staple";
const SHOTS = process.env.PASSBOX_SCREENSHOT_DIR;

function uniqueEmail(name: string) {
  return `${name}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

async function newPage(browser: Browser, locale = "en-US"): Promise<Page> {
  const context = await browser.newContext({ locale, viewport: { width: 1280, height: 800 } });
  return context.newPage();
}

async function shot(page: Page, name: string) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

async function createAccount(page: Page, email: string) {
  await page.goto("/");
  await page.locator("fieldset").getByText("Create account").click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Master password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirm master password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).last().click();
  const secretKey = (await page.getByTestId("secret-key").textContent({ timeout: 30_000 }))?.trim() ?? "";
  await page.getByLabel(/last 4 characters of your Secret Key/).fill(secretKey.slice(-4));
  await page.getByRole("button", { name: "Continue to my vault" }).click();
}

async function unlock(page: Page) {
  await page.getByLabel("Master password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Unlock" }).click();
}

async function newItem(page: Page, type: string) {
  await page.getByRole("button", { name: "New item" }).click();
  await page.getByRole("menuitem", { name: type, exact: true }).click();
}

test("item types, attachments, share links, archive and moving", async ({ browser }) => {
  test.setTimeout(180_000);
  const page = await newPage(browser);
  await createAccount(page, uniqueEmail("comfort"));

  // A Wi-Fi item with a QR code to join.
  await newItem(page, "Wi-Fi");
  await page.getByLabel("Title").fill("Home Wi-Fi");
  await page.getByRole("textbox", { name: "Network name" }).fill("Miller Home");
  await page.getByLabel("Password", { exact: true }).fill("wifi-secret-123");
  await page.getByRole("textbox", { name: "Security" }).fill("WPA2");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Home Wi-Fi", level: 2 })).toBeVisible();
  await page.getByRole("button", { name: "Show QR code" }).click();
  await expect(page.getByRole("img", { name: /QR code to join the Wi-Fi network Miller Home/ })).toBeVisible();

  // Attachments: encrypted here, previewed in a sandboxed frame.
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkaPhfDwAEhgGAWNI7OgAAAABJRU5ErkJggg==",
    "base64",
  );
  await page.getByTestId("attachment-input").setInputFiles({ name: "router.png", mimeType: "image/png", buffer: png });
  await expect(page.getByTestId("attachments")).toContainText("router.png");
  await shot(page, "item-wifi-attachments-en");
  await page.getByRole("button", { name: "Preview router.png" }).click();
  await expect(page.getByTestId("attachment-preview")).toHaveAttribute("sandbox", "");
  await page.keyboard.press("Escape");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download router.png" }).click();
  expect((await download).suggestedFilename()).toBe("router.png");

  // A share link with a passphrase, opened without an account.
  await page.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Share via link…" }).click();
  await page.getByRole("switch", { name: "Protect with a passphrase" }).click();
  await page.getByLabel("Passphrase", { exact: true }).fill("open sesame");
  await shot(page, "share-link-dialog-en");
  await page.getByTestId("share-link-create").click();
  const url = await page.getByTestId("share-link-url").inputValue();
  expect(url).toMatch(/\/s\/[0-9a-z]{26}#[A-Za-z0-9_-]{43}$/);
  await page.getByRole("button", { name: "Done" }).click();

  const guest = await newPage(browser);
  await guest.goto(url);
  await expect(guest.getByRole("heading", { name: "Someone shared something with you" })).toBeVisible();
  await guest.getByLabel("Passphrase").fill("wrong");
  await guest.getByRole("button", { name: "Show", exact: true }).click();
  await expect(guest.getByRole("alert")).toContainText("The passphrase is not correct");
  await guest.getByLabel("Passphrase").fill("open sesame");
  await guest.getByRole("button", { name: "Show", exact: true }).click();
  await expect(guest.getByRole("heading", { name: "Home Wi-Fi" })).toBeVisible();
  await guest.getByRole("button", { name: "Show Password" }).click();
  await expect(guest.getByText("wifi-secret-123")).toBeVisible();
  await shot(guest, "share-link-viewer-en");
  // It was the only view: the link is gone.
  await guest.reload();
  await expect(guest.getByRole("heading", { name: "This link is no longer available" })).toBeVisible();
  await guest.context().close();

  // An SSH key generated on this device.
  await newItem(page, "SSH key");
  await page.getByLabel("Title").fill("Deploy key");
  await page.getByTestId("ssh-generate").click();
  await expect(page.getByLabel("Public key")).toHaveValue(/^ssh-ed25519 AAAA/);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  // The fingerprint shows in the item (and in its list row).
  await expect(page.getByRole("region", { name: "Deploy key" }).getByText(/^SHA256:/)).toBeVisible();

  // Archive and take out again.
  await page.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Archive" }).click();
  await expect(page.getByText("“Deploy key” is archived.")).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /^Archive/ })
    .click();
  await expect(page.getByTestId("archive-list")).toContainText("Deploy key");
  await shot(page, "archive-en");
  await page.getByRole("button", { name: "Take out of archive" }).click();
  await expect(page.getByText("“Deploy key” is back in your lists.")).toBeVisible();

  // Move into another vault, with the preview of who can see it.
  await page.getByRole("button", { name: "New vault" }).click();
  await page.getByLabel("Name").fill("Old devices");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Create/ })
    .click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /All items/ })
    .click();
  await page.getByRole("option", { name: /Home Wi-Fi/ }).click();
  await page.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Move to another vault…" }).click();
  await page.getByTestId("move-target").selectOption({ label: "Old devices" });
  await expect(page.getByTestId("move-preview")).toContainText("The same people as now.");
  await shot(page, "move-dialog-en");
  await page.getByRole("button", { name: "Move to “Old devices”" }).click();
  await expect(page.getByText("“Home Wi-Fi” is now in “Old devices”.")).toBeVisible();
  await expect(page.getByTestId("attachments")).toContainText("router.png");

  // Several at once: select, then archive.
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /All items/ })
    .click();
  await page.getByTestId("select-items").click();
  await page.getByRole("button", { name: "Select all" }).click();
  await expect(page.getByTestId("bulk-bar")).toContainText("2 selected");
  await shot(page, "bulk-select-en");
  await page.getByTestId("bulk-bar").getByRole("button", { name: "Archive" }).click();
  await expect(page.getByText("2 entries archived.")).toBeVisible();
});

test("asking for access to a vault", async ({ browser }) => {
  test.setTimeout(180_000);
  const ownerEmail = uniqueEmail("owner");
  const annaEmail = uniqueEmail("anna");
  const owner = await newPage(browser);
  await createAccount(owner, ownerEmail);
  await owner.getByRole("button", { name: "Family & team" }).click();
  await owner.getByRole("button", { name: "Start a family" }).first().click();
  await owner.getByLabel("Family name").fill("The Millers");
  await owner.getByRole("button", { name: "Start family" }).click();
  await owner.getByRole("button", { name: "Invite family member" }).click();
  await owner.getByLabel("Email", { exact: true }).fill(annaEmail);
  await owner.getByRole("button", { name: "Create invitation" }).click();
  const link = (await owner.getByTestId("org-invite-link").textContent())?.trim() ?? "";
  await owner.getByRole("button", { name: "Done" }).click();

  const anna = await newPage(browser);
  await anna.goto(link);
  await anna.getByLabel("Master password", { exact: true }).fill(PASSWORD);
  await anna.getByLabel("Confirm master password").fill(PASSWORD);
  await anna.getByRole("button", { name: "Create account" }).last().click();
  const secretKey = (await anna.getByTestId("secret-key").textContent({ timeout: 30_000 }))?.trim() ?? "";
  await anna.getByLabel(/last 4 characters of your Secret Key/).fill(secretKey.slice(-4));
  await anna.getByRole("button", { name: "Continue to my vault" }).click();
  await anna.getByRole("button", { name: "Accept invitation" }).click();
  await expect(anna.getByRole("heading", { name: "Waiting for confirmation" })).toBeVisible();

  await owner.reload();
  await unlock(owner);
  await owner.getByRole("button", { name: "Family & team" }).click();
  await owner.getByRole("button", { name: "The Millers" }).click();
  await owner.getByRole("button", { name: "Confirm", exact: true }).click();
  await owner.getByRole("dialog").getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(owner.getByRole("dialog")).toBeHidden({ timeout: 30_000 });

  // A second shared vault, not shared with Anna; its link goes to her.
  await owner.getByRole("button", { name: "New shared vault" }).first().click();
  await owner.getByRole("dialog").getByLabel(/Name/).fill("Bank papers");
  await owner
    .getByRole("dialog")
    .getByRole("button", { name: /Create/ })
    .click();
  // The new vault's sharing dialog opens; close it.
  await expect(owner.getByRole("dialog")).toContainText("Bank papers");
  await owner.keyboard.press("Escape");
  await owner
    .getByRole("navigation")
    .getByRole("button", { name: /Bank papers/ })
    .click();
  const vaultUrl = owner.url();

  await anna.goto(vaultUrl);
  await anna.reload();
  await unlock(anna);
  await expect(anna.getByTestId("request-access")).toBeVisible({ timeout: 30_000 });
  await shot(anna, "request-access-en");
  await anna.getByTestId("request-access-send").click();
  await expect(anna.getByText(/Waiting for a manager/)).toBeVisible();

  // The owner approves in the vault's sharing dialog.
  await owner.reload();
  await unlock(owner);
  await owner
    .getByRole("navigation")
    .getByRole("button", { name: /Bank papers/ })
    .click();
  await owner.getByRole("button", { name: "Share", exact: true }).click();
  await expect(owner.getByTestId("access-requests")).toContainText(annaEmail);
  await shot(owner, "access-request-approve-en");
  await owner.getByRole("button", { name: `Approve access for ${annaEmail}` }).click();
  await expect(owner.getByText(`${annaEmail} can now open the vault.`)).toBeVisible({ timeout: 30_000 });

  await anna.reload();
  await unlock(anna);
  await expect(anna.getByRole("navigation").getByRole("button", { name: /Bank papers/ })).toBeVisible({
    timeout: 30_000,
  });
});
