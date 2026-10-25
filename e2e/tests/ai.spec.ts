/**
 * AI features (K6 import mapping, K4 security plan): off by default, useful
 * without a model, and with a model only headers, patterns, kinds, counts
 * and domains leave the page. The model server is faked with request
 * interception, so the test sees exactly what would be sent.
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page, type Route, test } from "@playwright/test";

const PASSWORD = "correct horse battery staple";
const ENDPOINT = "http://127.0.0.1:9/v1";
const SCREENSHOTS = process.env.PASSBOX_SCREENSHOTS;

const CELLS = [
  ["Bank", "ada@example.org", "Tr0ub4dor&3xyzQ!", "https://bank.example.org", "JBSWY3DPEHPK3PXP"],
  ["Mail", "bob@example.org", "Tr0ub4dor&3xyzQ!", "https://mail.example.org", "GEZDGNBVGY3TQOJQ"],
  ["Forum", "carl@example.org", "Wq7!nB4$kL9@zX2#", "http://forum.example.org", ""],
];
const CSV = `Bezeichnung,Kennung,Zugang,Seite2,Zweitfaktor\n${CELLS.map((r) => r.join(",")).join("\n")}\n`;

async function shot(page: Page, name: string) {
  if (!SCREENSHOTS) return;
  mkdirSync(SCREENSHOTS, { recursive: true });
  await page.screenshot({ path: join(SCREENSHOTS, `${name}.png`) });
}

async function signUp(page: Page) {
  await page.goto("/");
  await page.locator("fieldset").getByText("Create account").click();
  await page.getByLabel("Email").fill(`ai-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`);
  await page.getByLabel("Master password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirm master password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  const secretKey = (await page.getByTestId("secret-key").textContent({ timeout: 30_000 }))?.trim() ?? "";
  await page.getByLabel(/last 4 characters of your Secret Key/).fill(secretKey.slice(-4));
  await page.getByRole("button", { name: "Continue to my vault" }).click();
  await expect(page.getByText("No passwords saved yet")).toBeVisible();
}

async function openCsv(page: Page) {
  await page.goto("/#/import");
  await page.getByRole("radio", { name: "Excel / CSV" }).click();
  await page.getByTestId("import-file-input").setInputFiles({
    name: "liste.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(CSV),
  });
}

/** A fake OpenAI-compatible server; records request bodies. */
async function fakeModel(page: Page, answer: (body: string) => unknown, bodies: string[]) {
  await page.route(`${ENDPOINT}/chat/completions`, async (route: Route) => {
    const headers = {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "content-type, authorization, accept",
      "access-control-allow-methods": "POST, OPTIONS",
    };
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers });
      return;
    }
    const body = route.request().postData() ?? "";
    bodies.push(body);
    await route.fulfill({
      status: 200,
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ choices: [{ message: { content: JSON.stringify(answer(body)) } }] }),
    });
  });
}

test("AI is off by default; import and security plan work without and with a model", async ({ page }) => {
  await signUp(page);
  const bodies: string[] = [];
  await fakeModel(
    page,
    (body) =>
      body.includes("import a CSV file")
        ? {
            columns: [
              { index: 2, target: "password", confidence: "high" },
              { index: 3, target: "url", confidence: "high" },
              { index: 4, target: "totp", confidence: "medium" },
            ],
          }
        : {
            summary: "Two accounts share one password.",
            steps: [
              {
                kind: "reused",
                title: "Give bank.example.org its own password",
                detail: "Change it on the website and let Passbox create a new one.",
                sites: ["bank.example.org"],
              },
            ],
          },
    bodies,
  );

  // Off by default.
  await page.goto("/#/settings/ai");
  const enable = page.getByRole("switch", { name: "Use AI features" });
  await expect(enable).not.toBeChecked();

  // Without AI: suggestions from value patterns on this device.
  await openCsv(page);
  await expect(page.getByText("Passbox did not recognize 3 columns.")).toBeVisible();
  await page.getByRole("button", { name: "Suggest fields" }).click();
  await expect(page.getByText("Suggested fields for 3 columns from their values.")).toBeVisible();
  await expect(page.getByText("Suggested", { exact: true })).toHaveCount(3);
  expect(bodies).toHaveLength(0);

  // Switch on AI with a self-hosted model for the import.
  await page.goto("/#/settings/ai");
  await enable.click();
  await page.locator("label", { hasText: "Your own server" }).click();
  await page.getByLabel("Address (OpenAI-compatible)").fill(ENDPOINT);
  await page.getByLabel("Model").fill("llama3.2");
  await page.getByRole("switch", { name: "Import: suggest how columns are assigned" }).click();
  await expect(page.getByText("Goes to your server 127.0.0.1:9.")).toBeVisible();
  await page.locator("#ai").scrollIntoViewIfNeeded();
  await shot(page, "en-settings-ai");

  await openCsv(page);
  await page.getByRole("button", { name: "Suggest with AI" }).click();
  await expect(page.getByText("Suggested fields for 3 columns. Check them before you continue.")).toBeVisible();
  await expect(page.getByText("AI suggestion", { exact: true })).toHaveCount(3);
  await shot(page, "en-import-suggestion");
  expect(bodies).toHaveLength(1);
  for (const row of CELLS) for (const cell of row) if (cell.length >= 8) expect(bodies[0]).not.toContain(cell);
  expect(bodies[0]).toContain("Seite2");

  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Import 3 items" }).click();
  await expect(page.getByRole("heading", { name: "Import finished" })).toBeVisible({ timeout: 30_000 });

  // The plan from rules, without any request.
  await page.goto("/#/watchtower");
  await expect(page.getByRole("heading", { name: "Your plan" })).toBeVisible();
  await expect(page.getByText("Give 2 logins their own passwords")).toBeVisible();
  await expect(page.getByText("Plan from rules on this device. No data was sent anywhere.")).toBeVisible();
  await shot(page, "en-security-plan");
  expect(bodies).toHaveLength(1);

  // With the copilot switched on: the model explains from metadata only.
  await page.goto("/#/settings/ai");
  await page.getByRole("switch", { name: "Security check: explain and prioritise" }).click();
  await page.goto("/#/watchtower");
  await page.getByRole("button", { name: "Explain with AI" }).click();
  await expect(page.getByText("Give bank.example.org its own password")).toBeVisible();
  await expect(page.getByText("Two accounts share one password.")).toBeVisible();
  await shot(page, "en-security-plan-ai");
  expect(bodies).toHaveLength(2);
  expect(bodies[1]).toContain("bank.example.org");
  for (const secret of ["Tr0ub4dor&3xyzQ!", "Wq7!nB4$kL9@zX2#", "JBSWY3DPEHPK3PXP", "ada@example.org"]) {
    expect(bodies[1]).not.toContain(secret);
  }

  // The AI log lists both requests, without their content.
  await page.goto("/#/settings/ai");
  await page.getByText("AI log").click();
  await expect(page.getByRole("cell", { name: "Answered" })).toHaveCount(2);

  if (SCREENSHOTS) {
    await page.goto("/#/settings/appearance");
    await page.locator("label", { hasText: "Deutsch" }).click();
    await page.goto("/#/settings/ai");
    await page.locator("#ai").scrollIntoViewIfNeeded();
    await shot(page, "de-settings-ai");
    await openCsv(page);
    await page.getByTestId("ai-suggest").click();
    await expect(page.getByText("KI-Vorschlag", { exact: true }).first()).toBeVisible();
    await shot(page, "de-import-suggestion");
    await page.goto("/#/watchtower");
    await expect(page.getByRole("heading", { name: "Ihr Plan" })).toBeVisible();
    await shot(page, "de-security-plan");
    await page.getByTestId("ai-explain").click();
    await expect(page.getByText("Give bank.example.org its own password")).toBeVisible();
    await shot(page, "de-security-plan-ai");
  }
});

test("cloud provider presets show the region and where data goes", async ({ page }) => {
  test.setTimeout(120_000);
  await signUp(page);
  await page.goto("/#/settings/ai");
  await page.getByRole("switch", { name: "Use AI features" }).click();
  await page.locator("label", { hasText: "Cloud provider" }).click();
  await page.getByTestId("ai-preset").selectOption("ionos");
  const note = page.getByTestId("ai-preset-note");
  await expect(note).toContainText("IONOS AI Model Hub");
  await expect(note).toContainText("Processed in: EU (DE)");
  await expect(page.getByLabel("Address (OpenAI-compatible)")).toHaveValue(
    "https://openai.inference.de-txl.ionos.com/v1",
  );
  await page.locator("#ai").scrollIntoViewIfNeeded();
  await shot(page, "en-settings-ai-preset-ionos");
  await page.getByTestId("ai-preset").selectOption("anthropic");
  await expect(note).toContainText("Processed in: USA (US)");
  await expect(page.getByLabel("Model")).toHaveValue("claude-opus-5-5");
  await shot(page, "en-settings-ai-preset-anthropic");
  // Typing another endpoint leaves the preset.
  await page.getByLabel("Address (OpenAI-compatible)").fill("https://llm.example.com/v1");
  await expect(note).toHaveCount(0);

  await page.evaluate(() => {
    const raw = localStorage.getItem("passbox.preferences");
    localStorage.setItem("passbox.preferences", JSON.stringify({ ...(raw ? JSON.parse(raw) : {}), language: "de" }));
  });
  await page.reload();
  await page.getByLabel("Master-Passwort", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Entsperren" }).click();
  await page.goto("/#/settings/ai");
  await page.getByTestId("ai-preset").selectOption("stackit");
  await expect(page.getByTestId("ai-preset-note")).toContainText("Verarbeitung: EU (DE)");
  await page.locator("#ai").scrollIntoViewIfNeeded();
  await shot(page, "de-settings-ai-preset-stackit");
});
