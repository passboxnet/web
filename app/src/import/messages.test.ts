import { describe, expect, it } from "vitest";
import { plural, translator } from "./messages";
import { SOURCES } from "./sources";

describe("import and export messages", () => {
  it("formats placeholders, numbers and plurals", () => {
    const de = translator("de");
    expect(plural(de, "import.start", 1)).toBe("1 Eintrag importieren");
    expect(plural(de, "import.start", 40000)).toBe("40.000 Einträge importieren");
    expect(translator("en")("import.progress.count", { done: 1200, total: 40000 })).toBe("1,200 of 40,000");
    expect(de("import.done.deleteCsv")).toBe(
      "Löschen Sie die CSV-Datei jetzt – sie enthält Ihre Passwörter unverschlüsselt.",
    );
  });

  it("has export steps in both languages for every source", () => {
    for (const source of SOURCES) {
      expect(source.steps.en.length, source.id).toBeGreaterThan(1);
      expect(source.steps.de.length, source.id).toBe(source.steps.en.length);
    }
  });
});
