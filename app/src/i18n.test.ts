/**
 * Guards the translations: no user-visible English may be hard-coded in JSX,
 * and every message key the app uses must exist in the catalogs.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import deCommon from "@passbox/i18n/messages/de/common.json";
import deDeveloper from "@passbox/i18n/messages/de/developer.json";
import deWeb from "@passbox/i18n/messages/de/web.json";
import enCommon from "@passbox/i18n/messages/en/common.json";
import enDeveloper from "@passbox/i18n/messages/en/developer.json";
import enWeb from "@passbox/i18n/messages/en/web.json";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const root = import.meta.dirname;
const en: Record<string, string> = { ...enCommon, ...enWeb, ...enDeveloper };
const de: Record<string, string> = { ...deCommon, ...deWeb, ...deDeveloper };

/** Text that is the same in every language: the brand, key names, formats. */
const ALLOWED_TEXT = new Set(["Passbox", "Esc", "E", "K", "/", "PIN", "v"]);
/** Attributes that end up in front of users (shown or read out). */
const VISIBLE_ATTRIBUTES = new Set([
  "label",
  "title",
  "description",
  "placeholder",
  "aria-label",
  "hint",
  "content",
  "confirmLabel",
  "cancelLabel",
  "submitLabel",
  "alt",
]);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

const files = sourceFiles(root).map((path) => ({
  path: relative(root, path),
  source: ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true),
}));

function visit(node: ts.Node, fn: (node: ts.Node) => void) {
  fn(node);
  node.forEachChild((child) => visit(child, fn));
}

const where = (file: (typeof files)[number], node: ts.Node) =>
  `${file.path}:${file.source.getLineAndCharacterOfPosition(node.getStart()).line + 1}`;

describe("translations", () => {
  it("has no hard-coded text in JSX", () => {
    const problems: string[] = [];
    for (const file of files.filter((f) => f.path.endsWith(".tsx"))) {
      visit(file.source, (node) => {
        if (ts.isJsxText(node)) {
          const text = node.getText().trim();
          if (/\p{L}/u.test(text) && !ALLOWED_TEXT.has(text)) problems.push(`${where(file, node)} "${text}"`);
        }
        if (ts.isJsxAttribute(node) && VISIBLE_ATTRIBUTES.has(node.name.getText())) {
          const value = node.initializer;
          const literal =
            value && ts.isStringLiteral(value)
              ? value.text
              : value && ts.isJsxExpression(value) && value.expression && ts.isStringLiteralLike(value.expression)
                ? value.expression.text
                : undefined;
          if (literal && /\p{Ll}{2}/u.test(literal) && !ALLOWED_TEXT.has(literal)) {
            problems.push(`${where(file, node)} ${node.name.getText()}="${literal}"`);
          }
        }
      });
    }
    expect(problems).toEqual([]);
  });

  it("only uses message keys that exist in English and German", () => {
    const missing: string[] = [];
    for (const file of files) {
      visit(file.source, (node) => {
        if (!ts.isCallExpression(node) || node.expression.getText() !== "t") return;
        const [first] = node.arguments;
        if (!first) return;
        if (ts.isStringLiteralLike(first)) {
          if (!(first.text in en) || !(first.text in de)) missing.push(`${where(file, node)} ${first.text}`);
        } else if (ts.isTemplateExpression(first)) {
          // `strength.${score}`: some key must start with the fixed part.
          const prefix = first.head.text;
          if (!Object.keys(en).some((key) => key.startsWith(prefix))) missing.push(`${where(file, node)} ${prefix}*`);
        }
      });
    }
    expect(missing).toEqual([]);
  });

  it("resolves the dynamic keys the app builds", () => {
    const dynamic = [
      ...[0, 1, 2, 3, 4].map((score) => `strength.${score}`),
      ...["empty", "invalid", "scheme", "credentials", "query", "insecure"].map((code) => `server.error.${code}`),
      ...["noCode", "notTotp", "migration", "unreadable"].map((code) => `qr.error.${code}`),
      ...["one_time_code", "invalid"].map((code) => `totp.problem.${code}`),
      ...["web", "extension", "desktop", "ios", "android", "cli", "unknown"].map((kind) => `devices.kind.${kind}`),
      ...["password", "words", "readable", "pin"].map((mode) => `generator.modeHint.${mode}`),
      ...["login", "note", "card", "other"].map((category) => `list.emptyCategory.${category}`),
    ];
    expect(dynamic.filter((key) => !(key in en) || !(key in de))).toEqual([]);
  });
});
