import { describe, expect, it } from "vitest";
import { editDistance, isExactMatch, matchScore, normalize } from "./search";

describe("search", () => {
  it("normalizes case and accents", () => {
    expect(normalize("Müller ÄÖÜ")).toBe("muller aou");
  });

  it("measures edit distance with swapped letters", () => {
    expect(editDistance("salesfroce", "salesforce")).toBe(1);
    expect(editDistance("kitten", "sitting", 3)).toBe(3);
    expect(editDistance("abc", "abcdef", 2)).toBe(3);
  });

  it("finds substrings, prefixes with typos and loose words", () => {
    expect(matchScore("sales", "Salesforce")).toBe(3);
    expect(matchScore("bank", "Sparkasse Online-Banking")).toBe(3);
    expect(matchScore("salesfroce", "Salesforce m.mueller@firma.de")).toBeGreaterThan(0);
    expect(matchScore("linkdin", "LinkedIn")).toBeGreaterThan(0);
    expect(matchScore("muller", "Michael Müller")).toBe(3);
    expect(matchScore("spark bank", "Sparkasse Online-Banking")).toBe(3);
  });

  it("rejects unrelated text and short typos", () => {
    expect(matchScore("xyz", "Salesforce")).toBe(0);
    expect(matchScore("gitlab", "GitHub")).toBe(0);
    expect(matchScore("abc", "abd")).toBe(0);
    expect(matchScore("bank shop", "Sparkasse Online-Banking")).toBe(0);
  });

  it("tells exact from fuzzy matches", () => {
    expect(isExactMatch("sales", "Salesforce")).toBe(true);
    expect(isExactMatch("salesfroce", "Salesforce")).toBe(false);
    expect(isExactMatch("", "anything")).toBe(true);
  });
});
