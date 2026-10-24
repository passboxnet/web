import { describe, expect, it } from "vitest";
import { describeTotpLink, QrError, totpFromQrText } from "./qr";

const code = (fn: () => unknown) => {
  try {
    fn();
    return undefined;
  } catch (error) {
    return error instanceof QrError ? error.code : "other";
  }
};

describe("2FA QR codes", () => {
  it("accepts otpauth TOTP links and rejects everything else", () => {
    const link = "otpauth://totp/GitHub:octocat?secret=JBSWY3DPEHPK3PXP&issuer=GitHub";
    expect(totpFromQrText(` ${link} `)).toBe(link);
    expect(code(() => totpFromQrText("https://example.com"))).toBe("notTotp");
    expect(code(() => totpFromQrText("otpauth://hotp/x?secret=ABC"))).toBe("notTotp");
    expect(code(() => totpFromQrText("otpauth-migration://offline?data=abc"))).toBe("migration");
  });

  it("describes a link without showing it", () => {
    expect(describeTotpLink("otpauth://totp/GitHub:octocat?secret=JBSWY3DPEHPK3PXP&issuer=GitHub")).toEqual({
      issuer: "GitHub",
      account: "octocat",
    });
    expect(describeTotpLink("otpauth://totp/alice%40example.com?secret=X")).toEqual({ account: "alice@example.com" });
    expect(describeTotpLink("JBSWY3DPEHPK3PXP")).toBeUndefined();
  });
});
