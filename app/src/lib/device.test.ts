import { describe, expect, it } from "vitest";
import { deviceInfo, deviceName } from "./device";

describe("device name", () => {
  it("names common browsers and systems", () => {
    expect(
      deviceName(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36",
      ),
    ).toBe("Chrome on Windows");
    expect(
      deviceName(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36 Edg/141.0",
      ),
    ).toBe("Edge on Windows");
    expect(deviceName("Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0")).toBe(
      "Firefox on Linux",
    );
    expect(
      deviceName(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
      ),
    ).toBe("Safari on iOS");
    expect(deviceName("curl/8")).toBe("Browser");
  });

  it("marks the desktop app", () => {
    expect(deviceInfo(true, "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15")).toEqual({
      name: "Passbox Desktop on macOS",
      kind: "desktop",
    });
    expect(deviceInfo(false, "x").kind).toBe("web");
  });
});
