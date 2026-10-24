/**
 * Reads 2FA setup QR codes from images (a screenshot file or the clipboard).
 * Decoding happens on this device with jsQR; the image is never uploaded.
 */

/** Why an image could not be used. The UI shows `qr.error.<code>`. */
export type QrProblem = "noCode" | "notTotp" | "migration" | "unreadable";

export class QrError extends Error {
  constructor(readonly code: QrProblem) {
    super(`QR code: ${code}`);
    this.name = "QrError";
  }
}

/** Largest side the image is scaled to before decoding; plenty for screenshots, and fast. */
const MAX_SIDE = 1600;

/** Decodes the first QR code in an image. */
export async function decodeQrImage(image: Blob): Promise<string> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(image);
  } catch {
    throw new QrError("unreadable");
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new QrError("unreadable");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const pixels = context.getImageData(0, 0, width, height);
  const { default: jsQR } = await import("jsqr");
  const code = jsQR(pixels.data, width, height, { inversionAttempts: "attemptBoth" });
  if (!code?.data) throw new QrError("noCode");
  return code.data;
}

/**
 * Checks decoded QR text: it must be an `otpauth://totp/` link. Google
 * Authenticator export codes (`otpauth-migration://`) hold several accounts
 * in a format Passbox does not read yet.
 */
export function totpFromQrText(text: string): string {
  const value = text.trim();
  if (/^otpauth-migration:/i.test(value)) throw new QrError("migration");
  if (!/^otpauth:\/\/totp\//i.test(value)) throw new QrError("notTotp");
  return value;
}

/** Reads an image from the clipboard, if the browser allows it. */
export async function clipboardImage(): Promise<Blob | undefined> {
  if (!navigator.clipboard?.read) return undefined;
  const entries = await navigator.clipboard.read();
  for (const entry of entries) {
    const type = entry.types.find((t) => t.startsWith("image/"));
    if (type) return entry.getType(type);
  }
  return undefined;
}

/** Issuer and account name from an otpauth:// link, for a friendly summary instead of the raw link. */
export function describeTotpLink(value: string): { issuer?: string; account?: string } | undefined {
  if (!/^otpauth:\/\//i.test(value.trim())) return undefined;
  try {
    const url = new URL(value.trim());
    const label = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
    const [labelIssuer, account] = label.includes(":") ? label.split(/:(.*)/s) : [undefined, label];
    const issuer = url.searchParams.get("issuer") ?? labelIssuer;
    const result: { issuer?: string; account?: string } = {};
    if (issuer?.trim()) result.issuer = issuer.trim();
    if (account?.trim()) result.account = account.trim();
    return result;
  } catch {
    return {};
  }
}
