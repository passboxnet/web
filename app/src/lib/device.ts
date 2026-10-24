import type { ClientKind } from "@passbox/api-client";

/**
 * A readable name for this device in the account's device list, such as
 * "Chrome on Windows". Built from the user agent only; nothing else about
 * the device is sent.
 */
export function deviceName(userAgent: string): string {
  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /OPR\//.test(userAgent)
      ? "Opera"
      : /Firefox\//.test(userAgent)
        ? "Firefox"
        : /Chrome\//.test(userAgent)
          ? "Chrome"
          : /Safari\//.test(userAgent)
            ? "Safari"
            : "Browser";
  const os = /Windows/.test(userAgent)
    ? "Windows"
    : /iPhone|iPad|iPod/.test(userAgent)
      ? "iOS"
      : /Mac OS X|Macintosh/.test(userAgent)
        ? "macOS"
        : /Android/.test(userAgent)
          ? "Android"
          : /CrOS/.test(userAgent)
            ? "ChromeOS"
            : /Linux/.test(userAgent)
              ? "Linux"
              : undefined;
  return os ? `${browser} on ${os}` : browser;
}

export function deviceInfo(desktop: boolean, userAgent: string): { name: string; kind: ClientKind } {
  if (desktop) {
    const os = deviceName(userAgent).split(" on ")[1];
    return { name: os ? `Passbox Desktop on ${os}` : "Passbox Desktop", kind: "desktop" };
  }
  return { name: deviceName(userAgent), kind: "web" };
}
