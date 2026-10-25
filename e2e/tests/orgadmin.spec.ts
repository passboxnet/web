import { expect, test } from "@playwright/test";

const PASSWORD = "correct horse battery staple";

function uniqueEmail(name: string) {
  return `${name}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

test("an owner signs a policy in the admin console and checks the activity log", async ({ page }) => {
  test.setTimeout(180_000);
  const team = "Acme";

  await page.goto("/");
  await page.locator("fieldset").getByText("Create account").click();
  await page.getByLabel("Email").fill(uniqueEmail("owner"));
  await page.getByLabel("Master password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirm master password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).last().click();
  const secretKey = (await page.getByTestId("secret-key").textContent({ timeout: 30_000 }))?.trim() ?? "";
  await page.getByLabel(/last 4 characters of your Secret Key/).fill(secretKey.slice(-4));
  await page.getByRole("button", { name: "Continue to my vault" }).click();

  await page.getByRole("button", { name: "Family & team" }).click();
  await page.getByRole("button", { name: "Create a team" }).first().click();
  await page.getByLabel("Team name").fill(team);
  // Recovery through the organization is on from the start, and the dialog says so.
  await expect(page.getByTestId("create-org-recovery")).toContainText("Account recovery is on");
  await page.getByRole("button", { name: "Create team" }).click();
  await expect(page.getByRole("heading", { name: team, level: 1 })).toBeVisible();

  // The admin console opens on the overview: the first policy (recovery
  // required) and recovery are already set up.
  await page.getByRole("button", { name: "Open admin console" }).click();
  await expect(page.getByRole("heading", { name: "Overview", level: 1 })).toBeVisible();
  await expect(page.getByText("Version 1", { exact: true })).toBeVisible();
  await expect(page.getByText("There is no policy yet.")).toHaveCount(0);
  await expect(page.getByText("Recovery through the organization is not set up.")).toHaveCount(0);
  await page
    .getByRole("navigation", { name: "Admin console sections" })
    .getByRole("button", { name: "Policies" })
    .click();

  // Sign a policy: two-factor sign-in required, auto-lock after 15 minutes at most.
  await page.getByRole("switch", { name: "Require two-factor sign-in" }).click();
  await page.getByLabel("Maximum auto-lock time").selectOption("15");
  await page.getByRole("button", { name: "Review and sign" }).click();
  const review = page.getByRole("dialog");
  await expect(review).toContainText("Two-factor sign-in is required.");
  await expect(review).toContainText("Apps lock after at most 15 minutes without activity.");
  await review.getByRole("button", { name: "Sign and publish" }).click();
  await expect(page.getByText("Policy version 2 is published.")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Version 2", { exact: true })).toBeVisible();
  await expect(page.getByText("Verified", { exact: true })).toBeVisible();

  // The policy applies to the owner too: a banner asks for two-factor sign-in.
  await expect(page.getByText(`${team} requires two-factor sign-in`)).toBeVisible();

  // The activity log shows what happened, and the chain verifies on this device.
  await page
    .getByRole("navigation", { name: "Admin console sections" })
    .getByRole("button", { name: "Activity log" })
    .click();
  await expect(page.getByTestId("audit-entry").filter({ hasText: "Signed policy version 2" })).toBeVisible();
  await expect(page.getByTestId("audit-entry").filter({ hasText: "Created the organization" })).toBeVisible();
  await page.getByRole("button", { name: "Check on this device" }).click();
  await expect(page.getByText(/This device checked all \d+ entries: the chain is intact\./)).toBeVisible();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export" }).click();
  await page.getByRole("menuitem", { name: "JSON (verifiable)" }).click();
  expect((await download).suggestedFilename()).toMatch(/^passbox-audit-\d{4}-\d{2}-\d{2}\.json$/);

  // Filters: only administration entries.
  await page.getByLabel("Type").selectOption("admin");
  // "Check on this device" downloads the log as well, so there are two exports.
  await expect(page.getByTestId("audit-entry").filter({ hasText: "Exported the activity log (JSON)" })).toHaveCount(2);
  await expect(page.getByTestId("audit-entry").filter({ hasText: "Accepted the invitation" })).toHaveCount(0);

  // Members see the rules in plain language on the team page.
  await page.getByRole("button", { name: `Back to ${team}` }).click();
  await expect(page.getByRole("heading", { name: "Policy", level: 2 })).toBeVisible();
  await expect(page.getByText("Two-factor sign-in is required.")).toBeVisible();
});
