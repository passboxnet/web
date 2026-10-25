import { AiGateway, IMPORT_TARGETS, recordingProvider, redactColumns, suggestMapping } from "@passbox/ai";
import type { Finding, Item, SecurityReport } from "@passbox/client";
import { detectColumns, SINGLE_TARGETS } from "@passbox/client/import";
import { describe, expect, it } from "vitest";
import { sampleTable, unknownColumns } from "../import/MappingSuggestion";
import { translator } from "../import/messages";
import { securityFindings, vaultSecrets } from "./SecurityPlan";
import { apiKeyOf, buildGateway } from "./useAiGateway";

const item = (id: string, url: string, password: string, extra: Item["data"]["fields"] = []): Item =>
  ({
    id,
    vaultId: "v",
    revision: 1,
    data: {
      v: 1,
      category: "login",
      title: id,
      fields: [
        { id: "username", label: "Username", type: "text", value: "ada" },
        { id: "password", label: "Password", type: "concealed", value: password },
        { id: "url", label: "Website", type: "url", value: url },
        ...extra,
      ],
      notes: "",
      tags: [],
      favorite: false,
    },
  }) as unknown as Item;

const finding = (kind: Finding["kind"], itemId: string): Finding => ({
  kind,
  severity: "high",
  itemId,
  fix: "change_password",
  related: [],
  dismissed: false,
});

const report = (findings: Finding[]): SecurityReport =>
  ({ logins: 3, breachChecked: true, findings }) as unknown as SecurityReport;

describe("AI in the web app", () => {
  it("uses the import's target vocabulary", () => {
    const ids = IMPORT_TARGETS.map((t) => t.id);
    expect(ids.filter((id) => IMPORT_TARGETS.find((t) => t.id === id)?.single)).toEqual([...SINGLE_TARGETS]);
    expect(ids).toEqual([...SINGLE_TARGETS, "field", "secret", "skip"]);
  });

  it("sends no cell of an imported CSV file to the model", async () => {
    const csv =
      "Bezeichnung;Kennung;Zugang;Seite2\nBank;ada@example.org;Tr0ub4dor&3xyzQ!;https://bank.example.org\nMail;bob@example.org;Zq8#mW2$vK9!pL4x;https://mail.example.org\n";
    const file = { name: "liste.csv", bytes: new TextEncoder().encode(csv) };
    const table = sampleTable(file);
    const detected = detectColumns(table.headers);
    const unknown = unknownColumns(detected);
    expect(unknown).toEqual([2, 3]);
    const provider = recordingProvider({ columns: [{ index: 2, target: "password", confidence: "high" }] });
    const gateway = new AiGateway({
      settings: {
        enabled: true,
        provider: { location: "cloud", endpoint: "https://a.example/v1", model: "m", apiKeyItemId: "k" },
        features: ["import-mapping"],
      },
      provider,
    });
    const proposal = await suggestMapping(gateway, redactColumns(table, detected, unknown));
    expect(proposal.mapping[2]).toBe("password");
    const sent = provider.sent();
    for (const row of table.rows) for (const cell of row) expect(sent).not.toContain(cell);
  });

  it("builds security findings without passwords", () => {
    const items = [
      item("a", "https://gmx.de", "same-password-1"),
      item("b", "https://shop.example", "same-password-1"),
      item("c", "http://old.example", "Unique-Strong-Pass-99"),
    ];
    const findings = securityFindings(
      items,
      report([
        finding("breached", "a"),
        finding("reused", "a"),
        finding("reused", "b"),
        finding("insecure_url", "c"),
        finding("missing_two_factor", "a"),
        finding("missing_two_factor", "b"),
        finding("missing_two_factor", "c"),
        finding("old", "c"),
        { ...finding("weak", "c"), dismissed: true },
      ]),
    );
    expect(findings.breachChecked).toBe(true);
    expect(findings.sites).toEqual([
      { host: "gmx.de", kinds: ["breached", "reused", "no-totp"] },
      { host: "shop.example", kinds: ["reused", "no-totp"] },
      { host: "old.example", kinds: ["insecure-url", "no-totp"] },
    ]);
    expect(JSON.stringify(findings)).not.toContain("password-1");
    const guard = vaultSecrets(items);
    expect(guard.leaks("same-password-1")).toBe(true);
    expect(guard.leaks("ada")).toBe(false);
  });

  it("is off without settings and reads the API key from the vault item", () => {
    const off = buildGateway("acc", { enabled: false, features: [] }, []);
    expect(off.gateway.isEnabled("import-mapping")).toBe(false);
    const key = item("key", "https://api.example.eu", "sk-live-123");
    expect(apiKeyOf(key)).toBe("sk-live-123");
    const missingKey = buildGateway(
      "acc",
      {
        enabled: true,
        provider: { location: "cloud", endpoint: "https://api.example.eu/v1", model: "m", apiKeyItemId: "gone" },
        features: ["import-mapping"],
      },
      [key],
    );
    expect(missingKey.gateway.isEnabled("import-mapping")).toBe(false);
    expect(missingKey.problem?.code).toBe("settings");
    const on = buildGateway(
      "acc",
      {
        enabled: true,
        provider: { location: "cloud", endpoint: "https://api.example.eu/v1", model: "m", apiKeyItemId: "key" },
        features: ["import-mapping"],
      },
      [key],
    );
    expect(on.gateway.isEnabled("import-mapping")).toBe(true);
    expect(on.gateway.isEnabled("security-copilot")).toBe(false);
  });

  it("has the rule plan texts in both languages", () => {
    for (const locale of ["en", "de"] as const) {
      const t = translator(locale);
      for (const kind of ["breached", "reused", "weak", "insecure-url", "no-totp"]) {
        expect(t(`ai.plan.${kind}.title`, { count: 2 })).not.toContain("ai.plan");
        expect(t(`ai.plan.${kind}.detail`)).not.toContain("ai.plan");
      }
    }
    expect(translator("de")("ai.plan.reused.title", { count: 1 })).toBe("1 Anmeldung ein eigenes Passwort geben");
  });
});
