import type { Translator } from "@passbox/i18n";
import { PAGE_HEIGHT, PAGE_WIDTH, PdfPage, type Rgb, textWidth } from "./pdf";

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

/** `#RRGGBB` → PDF color components. */
const hex = (value: string): Rgb =>
  [0, 2, 4].map((at) => Number.parseInt(value.slice(1 + at, 3 + at), 16) / 255) as Rgb;

// Passbox Marina colors (sRGB from packages/ui/tokens/tokens.json, light theme): print on white.
const INK = hex("#11262F"); // text
const MUTED = hex("#455963"); // text-muted
const BORDER = hex("#D9E1E5"); // border
const GUIDE = hex("#9AAAB2");
const ACCENT = hex("#1E5F7D"); // accent-text (deep Sky)
const ACCENT_SOFT = hex("#E0F0F8"); // accent-soft (Sky tint)
const ACCENT_EDGE = hex("#A9D0E2");
const SUCCESS_TEXT = hex("#0A693C"); // success-text
const SUCCESS_SOFT = hex("#DFF8E6"); // success-soft
const SUCCESS_EDGE = hex("#B3E0C2");
const WARNING_SOFT = hex("#FEF1E2"); // warning-soft
const WARNING_EDGE = hex("#F7D19E");
const WHITE: Rgb = [1, 1, 1];
const SOLAR = hex("#FFE26D"); // palette.solar: the keyhole
const MARINA_LIP = hex("#0B1A21"); // palette.marina-lip: the lip under the band
/** The signature gradient: #36596A → #243E4B → #12232B. */
const SIGNATURE: Array<[number, Rgb]> = [
  [0, hex("#36596A")],
  [0.5, hex("#243E4B")],
  [1, hex("#12232B")],
];

/** The keyhole glyph (packages/ui/brand/glyph.svg, 32-unit grid) in Solar at `size` points. */
function keyhole(page: PdfPage, x: number, y: number, size: number) {
  const u = size / 32;
  page.circle(x + 16 * u, y + 13.4 * u, 4.2 * u, { fill: SOLAR });
  page.polygon(
    [
      [x + 14.2 * u, y + 16.2 * u],
      [x + 17.8 * u, y + 16.2 * u],
      [x + 18.95 * u, y + 23.4 * u],
      [x + 13.05 * u, y + 23.4 * u],
    ],
    SOLAR,
  );
}

/** Builds the Emergency Kit as a one-page PDF, entirely on this device. */
export function emergencyKitPdf(kit: KitData, i18n: Translator): Uint8Array {
  const { t } = i18n;
  const page = new PdfPage();
  const left = 56;
  const width = PAGE_WIDTH - 2 * left;
  const right = left + width;

  // Brand band: the Marina signature gradient with its lip, the Solar keyhole, the wordmark and the title.
  const band = 122;
  page.gradientRect(0, 0, PAGE_WIDTH, band, SIGNATURE);
  page.rect(0, band - 3, PAGE_WIDTH, 3, { fill: MARINA_LIP });
  page.roundRect(left, 30, 30, 30, 8.4, { fill: [1, 1, 1] });
  page.gradientRect(left + 1.5, 31.5, 27, 27, SIGNATURE, 7.4, 24);
  keyhole(page, left + 1.5, 31.5, 27);
  page.text(left + 40, 51, "Passbox", { size: 15, font: "bold", color: WHITE });
  const created = t("kit.pdf.created", { date: i18n.date(kit.createdAt) });
  page.text(right - textWidth(created, 9), 50, created, { size: 9, color: WHITE });
  page.text(left, 100, t("kit.pdf.title"), { size: 28, font: "bold", color: WHITE });

  // The panel motif: dotted guides along the content edges with corner dots.
  const top = band + 16;
  let y = top + 26;
  y = page.paragraph(left, y, width, t(kit.recoveryCode ? "kit.pdf.introRecovery" : "kit.pdf.intro"), {
    size: 10.5,
    color: MUTED,
  });
  y += 8;

  const field = (label: string, value: string, font: "regular" | "mono" = "mono", size = 12) => {
    page.text(left, y, label.toUpperCase(), { size: 7.5, font: "bold", color: MUTED });
    y += 15;
    y = page.paragraph(left, y, width, value, { size, font, leading: size * 1.35, color: INK });
    y += 8;
    page.line(left, y - 6, right, y - 6, { color: BORDER });
    y += 9;
  };
  field(t("kit.field.server"), kit.server);
  field(t("kit.field.email"), kit.email);

  // The Secret Key in a tinted rounded box, large and in groups.
  page.roundRect(left, y - 4, width, 62, 12, { fill: ACCENT_SOFT, stroke: ACCENT_EDGE });
  page.text(left + 16, y + 13, t("term.secretKey").toUpperCase(), { size: 7.5, font: "bold", color: ACCENT });
  page.text(left + 16, y + 40, kit.secretKey, { size: 19, font: "mono", color: INK });
  y += 74;

  if (kit.recoveryCode) {
    // Two lines of groups, so the 69 characters fit the page width.
    const groups = kit.recoveryCode.split("-");
    const half = Math.ceil(groups.length / 2);
    page.roundRect(left, y - 4, width, 94, 12, { fill: SUCCESS_SOFT, stroke: SUCCESS_EDGE });
    page.text(left + 16, y + 13, t("kit.field.recoveryCode").toUpperCase(), {
      size: 7.5,
      font: "bold",
      color: SUCCESS_TEXT,
    });
    page.text(left + 16, y + 36, groups.slice(0, half).join("-"), { size: 14, font: "mono", color: INK });
    page.text(left + 16, y + 55, `-${groups.slice(half).join("-")}`, { size: 14, font: "mono", color: INK });
    page.paragraph(left + 16, y + 74, width - 32, t("kit.pdf.recoveryCodeHint"), { size: 8.5, color: MUTED });
    y += 110;
  }

  page.text(left, y, t("term.masterPassword").toUpperCase(), { size: 7.5, font: "bold", color: MUTED });
  y += 32;
  page.line(left, y, right, y, { dash: 3, color: GUIDE });
  y += 14;
  y = page.paragraph(left, y, width, t("kit.pdf.passwordHint"), { size: 9, color: MUTED });
  y += 16;

  page.text(left, y, t("kit.steps.title"), { size: 13, font: "bold", color: INK });
  y += 20;
  for (const [index, step] of [
    t("kit.steps.1", { server: kit.server }),
    t("kit.steps.2"),
    t("kit.steps.3"),
  ].entries()) {
    page.circle(left + 7, y - 3.5, 7, { fill: ACCENT_SOFT });
    page.text(left + 7 - textWidth(String(index + 1), 8.5, "bold") / 2, y - 0.5, String(index + 1), {
      size: 8.5,
      font: "bold",
      color: ACCENT,
    });
    y = page.paragraph(left + 22, y, width - 22, step, { size: 10.5, color: INK });
    y += 4;
  }
  y += 12;

  // With a recovery code the page is full; the helper line is left out.
  if (!kit.recoveryCode) {
    page.text(left, y, t("kit.pdf.helper"), { size: 10.5, color: INK });
    y += 28;
  }

  page.roundRect(left, y, width, 60, 12, { fill: WARNING_SOFT, stroke: WARNING_EDGE });
  page.paragraph(left + 18, y + 20, width - 32, t("kit.storage"), { size: 10, leading: 14, color: INK });
  y += 80;
  const end = page.paragraph(left, y, width, t("kit.pdf.footer"), { size: 8.5, color: MUTED });
  const bottom = Math.min(end + 2, PAGE_HEIGHT - 24);

  // Guides and corner dots last, so they frame everything above.
  for (const gx of [left - 20, right + 20]) {
    page.line(gx, top, gx, bottom, { dash: 1.2, color: GUIDE, width: 0.6 });
    page.circle(gx, top, 2, { fill: GUIDE });
    page.circle(gx, bottom, 2, { fill: GUIDE });
  }
  page.line(left - 20, top, right + 20, top, { dash: 1.2, color: GUIDE, width: 0.6 });

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
