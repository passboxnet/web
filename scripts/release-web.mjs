// Packs the built web vault (app/dist) as dist/passbox-web-<version>.tar.gz
// with a SHA256SUMS file. passbox-server's Dockerfile downloads this archive
// at a fixed version and checks the checksum.
//
//   pnpm build && node scripts/release-web.mjs v0.1.0

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const version = (process.argv[2] ?? "dev").replace(/^v/, "");
const dist = join(root, "dist");
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist);

const name = `passbox-web-${version}.tar.gz`;
execFileSync("tar", ["-czf", join(dist, name), "-C", join(root, "app/dist"), "."], { stdio: "inherit" });
const sum = createHash("sha256").update(readFileSync(join(dist, name))).digest("hex");
writeFileSync(join(dist, "SHA256SUMS"), `${sum}  ${name}\n`);
console.log(`${sum}  ${name}`);
