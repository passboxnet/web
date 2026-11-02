// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { parseRoute } from "../lib/route";
import { captureCliLogin, clearPendingCliLogin, pendingCliLogin } from "./pending";

const ID = "0123456789abcdefghjkmnpqrs";
const SECRET = "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abcde";

function capture(hash: string, now = 1_000_000) {
  const calls: string[] = [];
  const captured = captureCliLogin(
    { pathname: "/", search: "", hash },
    { replaceState: (_: unknown, __: string, url?: string | URL | null) => calls.push(String(url)) },
    now,
  );
  return { captured, calls };
}

describe("sign-in links from pbx", () => {
  it("keeps the secret for this tab and removes it from the address bar", () => {
    const { captured, calls } = capture(`#/cli-login/${ID}#${SECRET}`);
    expect(captured).toBe(true);
    expect(calls).toEqual([`/#/cli-login/${ID}`]);
    expect(pendingCliLogin(ID, 1_000_000)).toBe(SECRET);
    expect(pendingCliLogin("1123456789abcdefghjkmnpqrs", 1_000_000)).toBeUndefined();
    // After ten minutes the request has expired anyway.
    expect(pendingCliLogin(ID, 1_000_000 + 10 * 60 * 1000 + 1)).toBeUndefined();
    clearPendingCliLogin();
    expect(pendingCliLogin(ID, 1_000_000)).toBeUndefined();
  });

  it("ignores other and incomplete links", () => {
    for (const hash of ["#/items", `#/cli-login/${ID}`, `#/cli-login/${ID}#short`, `#/cli-login/NOTANID#${SECRET}`]) {
      expect(capture(hash)).toEqual({ captured: false, calls: [] });
    }
  });

  it("routes to the request, with or without the secret still in the hash", () => {
    expect(parseRoute(`#/cli-login/${ID}`)).toEqual({ view: "cli-login", requestId: ID });
    expect(parseRoute(`#/cli-login/${ID}#${SECRET}`)).toEqual({ view: "cli-login", requestId: ID });
  });
});
