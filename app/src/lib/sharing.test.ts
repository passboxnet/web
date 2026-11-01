// @vitest-environment jsdom
import type { Org, OrgMember, SharedVault, Vault } from "@passbox/client";
import { beforeEach, describe, expect, it } from "vitest";
import { formatRoute, parseRoute } from "./route";
import {
  assignableRoles,
  awaitingConfirmation,
  bannerWarnings,
  canManageMember,
  captureOrgInvite,
  defaultVault,
  fingerprintGroups,
  isGuestVault,
  isLockedVault,
  isOrgAdmin,
  orgInviteFromLocation,
  orgRoleKey,
  parseOrgInvite,
  pendingOrgInvite,
  setPendingOrgInvite,
  sharedWithEveryone,
  vaultAudience,
  warningCategory,
  writableVaults,
} from "./sharing";

const TOKEN = "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abcde";

function member(accountId: string, role: string, status = "confirmed"): OrgMember {
  return { accountId, email: `${accountId}@example.com`, role, status, verified: true, keyChanged: false };
}

function org(role: string, members: OrgMember[], status = "confirmed"): Org {
  return {
    id: "org",
    kind: "family",
    name: "Doe",
    role,
    status,
    fingerprint: "1 2",
    rootHash: "r",
    verified: true,
    members,
    groups: [
      {
        id: "kids",
        orgId: "org",
        name: "Kids",
        keyVersion: 1,
        members: ["carol"],
        membersVerified: true,
        verified: true,
        isMember: true,
      },
    ],
  };
}

const people = [member("alice", "owner"), member("bob", "admin"), member("carol", "member"), member("dan", "guest")];

describe("roles", () => {
  it("lets owners and admins administer, and only owners manage admins", () => {
    const asOwner = org("owner", people);
    const asAdmin = org("admin", people);
    expect(isOrgAdmin(asOwner)).toBe(true);
    expect(isOrgAdmin(org("admin", people, "accepted"))).toBe(false);
    expect(isOrgAdmin(org("member", people))).toBe(false);
    expect(canManageMember(asOwner, people[1] as OrgMember, "alice")).toBe(true);
    expect(canManageMember(asAdmin, people[1] as OrgMember, "bob")).toBe(false);
    expect(canManageMember(asAdmin, people[0] as OrgMember, "bob")).toBe(false);
    expect(canManageMember(asAdmin, people[2] as OrgMember, "bob")).toBe(true);
    expect(assignableRoles(asOwner)).toEqual(["admin", "member", "guest"]);
    expect(assignableRoles(asAdmin)).toEqual(["member", "guest"]);
  });

  it("uses family wording for families", () => {
    expect(orgRoleKey({ kind: "family" }, "owner")).toBe("sharing.role.family.owner");
    expect(orgRoleKey({ kind: "team" }, "admin")).toBe("sharing.role.team.admin");
    expect(orgRoleKey({ kind: "team" }, "weird")).toBe("sharing.role.team.member");
  });

  it("lists members waiting for confirmation", () => {
    expect(
      awaitingConfirmation(org("owner", [...people, member("eve", "member", "accepted")])).map((m) => m.accountId),
    ).toEqual(["eve"]);
  });
});

describe("vault audience", () => {
  const vault: SharedVault = {
    vaultId: "v",
    orgId: "org",
    role: "manage",
    serverRole: "manage",
    keyEpoch: 1,
    manifestVersion: 1,
    members: [
      { principalType: "account", principalId: "alice", role: "manage" },
      { principalType: "group", principalId: "kids", role: "view" },
    ],
    verified: true,
    hasKey: true,
    rotationPending: false,
  };

  it("expands groups", () => {
    expect([...vaultAudience(vault, org("owner", people))].sort()).toEqual(["alice", "carol"]);
  });

  it("knows when everyone can see a vault", () => {
    const family = org("owner", people.slice(0, 1).concat(people[2] as OrgMember));
    expect(sharedWithEveryone(vaultAudience(vault, family), family)).toBe(true);
    expect(sharedWithEveryone(vaultAudience(vault, org("owner", people)), org("owner", people))).toBe(false);
  });
});

describe("vaults", () => {
  const vaults: Vault[] = [
    { id: "f", name: "Family", revision: 1, orgId: "org", role: "view" },
    { id: "w", name: "Work", revision: 1, orgId: "org", role: "edit" },
    { id: "p", name: "Private", revision: 1, role: "manage" },
  ];

  it("offers only writable vaults and prefers the personal one", () => {
    expect(writableVaults(vaults, []).map((v) => v.id)).toEqual(["w", "p"]);
    expect(defaultVault(vaults, [])?.id).toBe("p");
    expect(defaultVault(vaults.slice(0, 2), [])?.id).toBe("w");
  });

  it("makes the vaults of a locked organization read-only", () => {
    const locked = [{ id: "org", lock: { reason: "billing:payment_overdue", source: "billing" } }];
    expect(writableVaults(vaults, locked).map((v) => v.id)).toEqual(["p"]);
    expect(defaultVault(vaults.slice(0, 2), locked)).toBeUndefined();
    expect(isLockedVault(vaults[1], locked)).toBe(true);
    expect(isLockedVault(vaults[2], locked)).toBe(false);
    expect(isLockedVault(vaults[1], [{ id: "org", lock: null }])).toBe(false);
  });
});

describe("invitation links", () => {
  beforeEach(() => sessionStorage.clear());

  it("reads links from the address and from pasted text", () => {
    expect(orgInviteFromLocation(`/invite/${TOKEN}`, "#org=ROOT1")).toEqual({
      token: TOKEN,
      orgRoot: "ROOT1",
      link: `/invite/${TOKEN}#org=ROOT1`,
    });
    expect(orgInviteFromLocation("/", "#/?invite=x")).toBeUndefined();
    expect(orgInviteFromLocation(`/other/${TOKEN}`, "")).toBeUndefined();
    expect(parseOrgInvite(`  https://vault.example/invite/${TOKEN}#org=R  `)?.orgRoot).toBe("R");
    expect(parseOrgInvite("https://vault.example/invite/short")).toBeUndefined();
    expect(parseOrgInvite(`https://x/invite/${TOKEN}#org=<script>`)).toBeUndefined();
    expect(parseOrgInvite("hello")).toBeUndefined();
  });

  it("keeps a captured invitation for the tab and clears the address", () => {
    const calls: string[] = [];
    captureOrgInvite(
      { pathname: `/invite/${TOKEN}`, hash: "#org=R" } as Location,
      { replaceState: (_: unknown, __: string, url: string) => calls.push(url) } as unknown as History,
    );
    expect(calls).toEqual(["/#/"]);
    expect(pendingOrgInvite()?.token).toBe(TOKEN);
    setPendingOrgInvite(undefined);
    expect(pendingOrgInvite()).toBeUndefined();
  });
});

describe("warnings", () => {
  it("puts the own key first and drops duplicates", () => {
    const warnings = bannerWarnings([
      { kind: "grant_invalid", subjectId: "v", message: "" },
      { kind: "key_changed", subjectId: "bob", message: "" },
      { kind: "key_changed", subjectId: "bob", message: "" },
      { kind: "own_key_changed", subjectId: "me", message: "" },
    ]);
    expect(warnings.map((w) => w.kind)).toEqual(["own_key_changed", "key_changed", "grant_invalid"]);
    expect(warningCategory({ kind: "role_mismatch" })).toBe("mismatch");
  });

  it("splits fingerprints into groups", () => {
    expect(fingerprintGroups("12345 67890  11111")).toEqual(["12345", "67890", "11111"]);
  });
});

describe("guests", () => {
  it("are view-only in the vaults of the organizations they are guests of", () => {
    const orgs = [
      { id: "team", role: "guest" },
      { id: "family", role: "member" },
    ];
    expect(isGuestVault({ orgId: "team" }, orgs)).toBe(true);
    expect(isGuestVault({ orgId: "family" }, orgs)).toBe(false);
    expect(isGuestVault({}, orgs)).toBe(false);
    expect(isGuestVault(undefined, orgs)).toBe(false);
  });
});

describe("routes", () => {
  it("round-trips the sharing pages", () => {
    expect(parseRoute("#/sharing")).toEqual({ view: "sharing" });
    expect(parseRoute("#/org/abc")).toEqual({ view: "org", orgId: "abc" });
    expect(formatRoute({ view: "org", orgId: "abc" })).toBe("#/org/abc");
    expect(formatRoute({ view: "sharing" })).toBe("#/sharing");
    // A bare #org=… fragment from an invitation link is not a route.
    expect(parseRoute("#org=ROOT").view).toBe("items");
  });
});
