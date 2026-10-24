import type { Translator } from "@passbox/i18n";
import { PAGE_WIDTH, PdfPage, type Rgb } from "./pdf";

/**
 * Set after sign-up until the user has proven they saved the Emergency Kit
 * (by typing the last characters of the Secret Key). Survives reloads, so the
 * kit and the reminder keep coming back. Holds the account ID, so a flag
 * from another account never applies.
 */
const PENDING_KEY = "passbox.kitPending";

/** How many trailing characters of the Secret Key the user types to confirm the kit. */
export const KIT_CHECK_LENGTH = 4;

export function isKitPending(accountId: string | undefined): boolean {
  if (!accountId) return false;
  try {
    return window.localStorage.getItem(PENDING_KEY) === accountId;
  } catch {
    return false;
  }
}

export function setKitPending(accountId: string | undefined) {
  try {
    if (accountId) window.localStorage.setItem(PENDING_KEY, accountId);
    else window.localStorage.removeItem(PENDING_KEY);
  } catch {
    // Without storage the reminder only lasts for this page load.
  }
}

/** Compares what the user typed with the end of the Secret Key, ignoring case, spaces and dashes. */
export function matchesKitCheck(secretKey: string, input: string): boolean {
  const clean = (value: string) => value.replace(/[\s-]/g, "").toUpperCase();
  const expected = clean(secretKey).slice(-KIT_CHECK_LENGTH);
  return clean(input) === expected && expected.length === KIT_CHECK_LENGTH;
}

/** "P1-ABCDE-FGHIJ…" style prefix, for dialogs that must name the key without showing it. */
export function secretKeyPrefix(secretKey: string): string {
  return `${secretKey.slice(0, 8)}…`;
}

export interface KitData {
  email: string;
  server: string;
  secretKey: string;
  createdAt: number;
  /** The account recovery code, when the kit is made right after creating one. */
  recoveryCode?: string;
}

const ACCENT: Rgb = [0.2, 0.33, 0.85];
const MUTED: Rgb = [0.38, 0.4, 0.45];
const BORDER: Rgb = [0.82, 0.84, 0.88];

/** Builds the Emergency Kit as a one-page PDF, entirely on this device. */
export function emergencyKitPdf(kit: KitData, i18n: Translator): Uint8Array {
  const { t } = i18n;
  const page = new PdfPage();
  const left = 56;
  const width = PAGE_WIDTH - 2 * left;
  let y = 64;

  page.text(left, y, "Passbox", { size: 11, font: "bold", color: ACCENT });
  page.text(PAGE_WIDTH - left - 160, y, t("kit.pdf.created", { date: i18n.date(kit.createdAt) }), {
    size: 9,
    color: MUTED,
  });
  y += 34;
  page.text(left, y, t("kit.pdf.title"), { size: 26, font: "bold" });
  y += 26;
  y = page.paragraph(left, y, width, t(kit.recoveryCode ? "kit.pdf.introRecovery" : "kit.pdf.intro"), {
    size: 10.5,
    color: MUTED,
  });
  y += 10;

  const field = (label: string, value: string, font: "regular" | "mono" = "mono", size = 12) => {
    page.text(left, y, label.toUpperCase(), { size: 8, font: "bold", color: MUTED });
    y += 16;
    y = page.paragraph(left, y, width, value, { size, font, leading: size * 1.35 });
    y += 10;
    page.line(left, y - 6, left + width, y - 6, { color: BORDER });
    y += 10;
  };
  field(t("kit.field.server"), kit.server);
  field(t("kit.field.email"), kit.email);

  // The Secret Key in a tinted box, large and in groups.
  page.rect(left, y - 4, width, 62, { fill: [0.95, 0.96, 1], stroke: [0.78, 0.82, 0.96] });
  page.text(left + 14, y + 12, t("term.secretKey").toUpperCase(), { size: 8, font: "bold", color: ACCENT });
  page.text(left + 14, y + 40, kit.secretKey, { size: 19, font: "mono" });
  y += 78;

  if (kit.recoveryCode) {
    // Two lines of groups, so the 69 characters fit the page width.
    const groups = kit.recoveryCode.split("-");
    const half = Math.ceil(groups.length / 2);
    page.rect(left, y - 4, width, 96, { fill: [0.94, 0.98, 0.95], stroke: [0.7, 0.86, 0.75] });
    page.text(left + 14, y + 12, t("kit.field.recoveryCode").toUpperCase(), {
      size: 8,
      font: "bold",
      color: [0.1, 0.45, 0.25],
    });
    page.text(left + 14, y + 36, groups.slice(0, half).join("-"), { size: 14, font: "mono" });
    page.text(left + 14, y + 56, `-${groups.slice(half).join("-")}`, { size: 14, font: "mono" });
    page.paragraph(left + 14, y + 76, width - 28, t("kit.pdf.recoveryCodeHint"), { size: 8.5, color: MUTED });
    y += 110;
  }

  page.text(left, y, t("term.masterPassword").toUpperCase(), { size: 8, font: "bold", color: MUTED });
  y += 34;
  page.line(left, y, left + width, y, { dash: 3, color: [0.55, 0.57, 0.62] });
  y += 14;
  y = page.paragraph(left, y, width, t("kit.pdf.passwordHint"), { size: 9, color: MUTED });
  y += 18;

  page.text(left, y, t("kit.steps.title"), { size: 13, font: "bold" });
  y += 20;
  for (const [index, step] of [
    t("kit.steps.1", { server: kit.server }),
    t("kit.steps.2"),
    t("kit.steps.3"),
  ].entries()) {
    page.text(left, y, `${index + 1}.`, { size: 10.5, font: "bold", color: ACCENT });
    y = page.paragraph(left + 18, y, width - 18, step, { size: 10.5 });
    y += 4;
  }
  y += 14;

  // With a recovery code the page is full; the helper line is left out.
  if (!kit.recoveryCode) {
    page.text(left, y, t("kit.pdf.helper"), { size: 10.5 });
    y += 30;
  }

  page.rect(left, y, width, 64, { fill: [1, 0.97, 0.9], stroke: [0.93, 0.8, 0.5] });
  page.paragraph(left + 14, y + 20, width - 28, t("kit.storage"), { size: 10, leading: 14 });
  y += 88;
  page.paragraph(left, y, width, t("kit.pdf.footer"), { size: 8.5, color: MUTED });

  return page.toBytes(t("kit.pdf.title"));
}

/** Offers the kit as a download. Nothing is uploaded: the file is built and saved locally. */
export function downloadEmergencyKit(kit: KitData, i18n: Translator) {
  const bytes = emergencyKitPdf(kit, i18n);
  const url = URL.createObjectURL(new Blob([bytes.slice().buffer as ArrayBuffer], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = i18n.t("kit.pdf.fileName");
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
