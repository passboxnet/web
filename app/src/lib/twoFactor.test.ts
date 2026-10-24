import jsQR from "jsqr";
import { describe, expect, it } from "vitest";
import {
  groupSecret,
  looksLikeRecoveryCode,
  qrMatrix,
  qrPath,
  recoveryCodesText,
  secondFactorFromInput,
} from "./twoFactor";

describe("two-factor input", () => {
  it("tells recovery codes from app codes", () => {
    expect(looksLikeRecoveryCode("7K2M-9QXD-4HPT-WZ3C")).toBe(true);
    expect(looksLikeRecoveryCode("7k2m 9qxd 4hpt wz3c")).toBe(true);
    expect(looksLikeRecoveryCode("OOOO-IIII-LLLL-0000")).toBe(true);
    expect(looksLikeRecoveryCode("123456")).toBe(false);
    expect(looksLikeRecoveryCode("UUUU-UUUU-UUUU-UUUU")).toBe(false);
    expect(secondFactorFromInput(" 123 456 ")).toEqual({ method: "totp", code: "123456" });
    expect(secondFactorFromInput("7K2M-9QXD-4HPT-WZ3C")).toEqual({ method: "recovery", code: "7K2M-9QXD-4HPT-WZ3C" });
  });

  it("formats setup keys and recovery code files", () => {
    expect(groupSecret("JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP")).toBe("JBSW Y3DP EHPK 3PXP JBSW Y3DP EHPK 3PXP");
    const text = recoveryCodesText(["AAAA-BBBB-CCCC-DDDD", "EEEE-FFFF-GGGG-HHHH"], "Header", "Note", "2026-10-24");
    expect(text.split("\n")).toEqual([
      "Header",
      "2026-10-24",
      "",
      " 1. AAAA-BBBB-CCCC-DDDD",
      " 2. EEEE-FFFF-GGGG-HHHH",
      "",
      "Note",
      "",
    ]);
  });
});

describe("QR codes", () => {
  it("encodes an otpauth URI that a QR reader decodes again", () => {
    const uri =
      "otpauth://totp/Passbox:anna%2Btest@example.com?secret=JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP&algorithm=SHA1&digits=6&period=30&issuer=Passbox";
    const matrix = qrMatrix(uri);
    const margin = 4;
    const scale = 4;
    const side = (matrix.size + 2 * margin) * scale;
    const pixels = new Uint8ClampedArray(side * side * 4).fill(255);
    for (let row = 0; row < matrix.size; row++) {
      for (let col = 0; col < matrix.size; col++) {
        if (!matrix.isDark(row, col)) continue;
        for (let y = 0; y < scale; y++) {
          for (let x = 0; x < scale; x++) {
            const offset = (((row + margin) * scale + y) * side + (col + margin) * scale + x) * 4;
            pixels.fill(0, offset, offset + 3);
          }
        }
      }
    }
    expect(jsQR(pixels, side, side)?.data).toBe(uri);

    const path = qrPath(matrix, margin);
    expect(path.startsWith(`M${margin} ${margin}h1v1h-1z`)).toBe(true);
    const dark = path.split("z").length - 1;
    let expected = 0;
    for (let row = 0; row < matrix.size; row++)
      for (let col = 0; col < matrix.size; col++) expected += Number(matrix.isDark(row, col));
    expect(dark).toBe(expected);
  });
});
