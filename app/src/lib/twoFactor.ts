/** Helpers for two-factor sign-in screens. */
import qrcode from "qrcode-generator";

export { looksLikeRecoveryCode, secondFactorFromInput } from "@passbox/client";

/** A Base32 setup key in groups of four, easier to type into an app. */
export function groupSecret(secret: string): string {
  return secret.replace(/(.{4})/g, "$1 ").trim();
}

/** The text of a recovery codes file or printout. */
export function recoveryCodesText(codes: string[], header: string, note: string, date: string): string {
  return [header, date, "", ...codes.map((code, i) => `${String(i + 1).padStart(2, " ")}. ${code}`), "", note, ""].join(
    "\n",
  );
}

/** A QR code as a square grid of modules (true = dark). */
export interface QrMatrix {
  size: number;
  isDark: (row: number, col: number) => boolean;
}

/** Encodes text as a QR code (error correction M, smallest version that fits). */
export function qrMatrix(text: string): QrMatrix {
  const qr = qrcode(0, "M");
  qr.addData(text, "Byte");
  qr.make();
  return { size: qr.getModuleCount(), isDark: (row, col) => qr.isDark(row, col) };
}

/**
 * An SVG path drawing the dark modules, offset by a quiet zone of `margin`
 * modules. Each module is a 1×1 square, so the viewBox is `size + 2·margin`.
 */
export function qrPath(matrix: QrMatrix, margin = 4): string {
  const parts: string[] = [];
  for (let row = 0; row < matrix.size; row++) {
    for (let col = 0; col < matrix.size; col++) {
      if (matrix.isDark(row, col)) parts.push(`M${col + margin} ${row + margin}h1v1h-1z`);
    }
  }
  return parts.join("");
}
