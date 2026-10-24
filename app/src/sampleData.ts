/**
 * Sample items for the UI preview. Accounts and sync are not implemented yet,
 * so the web client renders these instead of a real vault.
 */
export type ItemCategory = "login" | "card" | "note";

export interface VaultItem {
  id: string;
  title: string;
  category: ItemCategory;
  vault: string;
  username?: string;
  password?: string;
  url?: string;
  totp?: string;
  notes?: string;
  favorite?: boolean;
  tags: string[];
}

export const sampleVaults = ["Private", "Family", "Engineering"] as const;

export const sampleItems: VaultItem[] = [
  {
    id: "1",
    title: "GitHub",
    category: "login",
    vault: "Engineering",
    username: "octocat",
    password: "correct-horse-battery-staple",
    url: "https://github.com",
    totp: "otpauth://totp/GitHub:octocat?secret=JBSWY3DPEHPK3PXP&issuer=GitHub",
    favorite: true,
    tags: ["dev"],
  },
  {
    id: "2",
    title: "Google Workspace",
    category: "login",
    vault: "Private",
    username: "jane@example.com",
    password: "Tr0ub4dor&3-but-longer",
    url: "https://accounts.google.com",
    totp: "otpauth://totp/Google:jane@example.com?secret=KRSXG5CTMVRXEZLUKN2XAZLSKNSWG4TFOQ&issuer=Google",
    tags: ["work"],
  },
  {
    id: "3",
    title: "Netflix",
    category: "login",
    vault: "Family",
    username: "family@example.com",
    password: "popcorn-sofa-friday-42",
    url: "https://netflix.com",
    tags: [],
  },
  {
    id: "4",
    title: "Visa Credit Card",
    category: "card",
    vault: "Private",
    notes: "Expires 09/29",
    tags: ["finance"],
  },
  {
    id: "5",
    title: "Wi-Fi at home",
    category: "note",
    vault: "Family",
    notes: "Network: Passbox-Home\nPassword: see the fridge 🙂",
    favorite: true,
    tags: [],
  },
];
