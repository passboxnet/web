import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compile } from "tailwindcss";
import { describe, expect, it } from "vitest";

// Regression test for forced theme subtrees (Panel theme="dark", the
// extension's shadow DOM): color and shadow utilities must read the --pb-*
// variables on the element they style. If they went through a --color-*
// theme variable resolved at :root, a data-theme="dark" subtree on a light
// page would keep the light colors.

const here = dirname(fileURLToPath(import.meta.url));
// The tokens of the installed @passbox/ui release.
const tokensPath = resolve(here, "../node_modules/@passbox/ui/src/tokens.css");
const tailwindIndex = resolve(here, "../node_modules/tailwindcss/index.css");

async function build(candidates: string[]): Promise<string> {
  const compiler = await compile(`@import "tailwindcss";\n@import "@passbox/ui/tokens.css";`, {
    base: here,
    async loadStylesheet(id) {
      const path = id === "tailwindcss" ? tailwindIndex : tokensPath;
      return { path, base: dirname(path), content: await readFile(path, "utf8") };
    },
  });
  return compiler.build(candidates);
}

describe("design tokens in Tailwind", () => {
  it("compiles semantic utilities to the per-element --pb-* variables", async () => {
    const css = await build(["bg-surface", "text-accent", "border-hairline", "shadow-card", "ring-focus"]);
    expect(css).toMatch(/\.bg-surface\s*{\s*background-color:\s*var\(--pb-surface\)/);
    expect(css).toMatch(/\.text-accent\s*{\s*color:\s*var\(--pb-accent-text\)/);
    expect(css).toMatch(/\.border-hairline\s*{[^}]*var\(--pb-hairline\)/);
    expect(css).toContain("var(--pb-shadow-card)");
    expect(css).not.toMatch(/background-color:\s*var\(--color-surface\)/);
  });

  it("re-declares every theme variable on [data-theme] elements", async () => {
    const css = await readFile(tokensPath, "utf8");
    for (const theme of ["light", "dark"]) {
      const block = css.match(new RegExp(`\\[data-theme="${theme}"\\] {([^}]*)}`));
      expect(block, theme).not.toBeNull();
      expect(block?.[1]).toContain("--pb-surface:");
      expect(block?.[1]).toContain("--pb-text:");
      expect(block?.[1]).toContain("--pb-shadow-card:");
    }
  });
});
