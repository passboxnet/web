import { describe, expect, it } from "vitest";
import { PdfPage, textWidth, winAnsi, wrapText } from "./pdf";

const decode = (bytes: Uint8Array) => Array.from(bytes, (b) => String.fromCharCode(b)).join("");

describe("pdf", () => {
  it("encodes German text as WinAnsi", () => {
    expect(winAnsi("Größe „Notfall“ – ok • €")).toBe("Gr\xf6\xdfe \x84Notfall\x93 \x96 ok \x95 \x80");
    expect(winAnsi("日本")).toBe("??");
  });

  it("wraps at spaces and splits long words", () => {
    const lines = wrapText("one two three four five six", textWidth("one two three", 10), 10);
    expect(lines).toEqual(["one two three", "four five six"]);
    const email = "maximilian.mustermann-schmidt.1975@example-company.com";
    const parts = wrapText(email, 100, 10, "mono");
    expect(parts.join("")).toBe(email);
    expect(parts.every((part) => textWidth(part, 10, "mono") <= 100)).toBe(true);
  });

  it("writes a valid document with a correct cross-reference table", () => {
    const page = new PdfPage();
    page.text(40, 60, "Notfall-Kit (Passbox) \\ test", { size: 20, font: "bold" });
    page.line(40, 80, 200, 80, { dash: 2 });
    page.rect(40, 100, 100, 40, { fill: [0.9, 0.9, 1], stroke: [0, 0, 1] });
    const pdf = decode(page.toBytes("Passbox Notfall-Kit"));
    expect(pdf.startsWith("%PDF-1.4")).toBe(true);
    expect(pdf.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(pdf).toContain("(Notfall-Kit \\(Passbox\\) \\\\ test) Tj");

    const xref = Number(/startxref\n(\d+)/.exec(pdf)?.[1]);
    expect(pdf.slice(xref, xref + 4)).toBe("xref");
    const entries = [...pdf.slice(xref).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
    expect(entries).toHaveLength(8);
    entries.forEach((offset, index) => {
      expect(pdf.slice(offset).startsWith(`${index + 1} 0 obj`)).toBe(true);
    });
    const length = Number(/\/Length (\d+)/.exec(pdf)?.[1]);
    const start = pdf.indexOf("stream\n") + "stream\n".length;
    expect(pdf.slice(start + length, start + length + "\nendstream".length)).toBe("\nendstream");
  });
});
