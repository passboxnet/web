import type { TagColor } from "@passbox/ui";

/** Colors for vault dots after the personal vault's blue, in the order of the brand board. */
const PALETTE: TagColor[] = ["pink", "orange", "green", "violet", "teal", "yellow", "red"];

/**
 * The colored dot of a vault in the sidebar, the item detail and pickers:
 * the personal vault is blue, every other vault gets a stable color from its ID.
 */
export function vaultColor(vault: { id: string; name: string; orgId?: string | null | undefined }): TagColor {
  if (!vault.orgId && vault.name === "Private") return "blue";
  let hash = 0;
  for (const char of vault.id) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
  return PALETTE[hash % PALETTE.length] ?? "violet";
}
