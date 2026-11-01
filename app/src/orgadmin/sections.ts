import type { Org } from "@passbox/client";

export const ADMIN_SECTIONS = [
  "overview",
  "members",
  "groups",
  "vaults",
  "policies",
  "activity",
  "reports",
  "recovery",
  "integrations",
  "billing",
  "settings",
] as const;
export type AdminSection = (typeof ADMIN_SECTIONS)[number];

/** Sections only teams (Business) have; the server refuses them for families. */
export const TEAM_SECTIONS: readonly AdminSection[] = ["groups", "policies", "activity", "integrations"];

/**
 * Sections a family's organizer sees: groups, policies, the activity log
 * and SIEM integrations are for teams. Billing only exists for Business
 * (teams) on the hosted service.
 */
export function sectionsFor(org: Pick<Org, "kind">, business: boolean): AdminSection[] {
  const sections = ADMIN_SECTIONS.filter((s) => s !== "billing" || business);
  return org.kind === "team" ? sections : sections.filter((s) => !TEAM_SECTIONS.includes(s));
}
