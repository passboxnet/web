import { FIELD, newItemData } from "@passbox/client";
import { describe, expect, it } from "vitest";
import { iconHost } from "./ItemIcon";

function login(url: string) {
  const data = newItemData("login");
  return { data: { ...data, fields: data.fields.map((f) => (f.id === FIELD.url ? { ...f, value: url } : f)) } };
}

describe("iconHost", () => {
  it("uses the host of a login's website", () => {
    expect(iconHost(login("https://www.GitHub.com/login"))).toBe("github.com");
    expect(iconHost(login("accounts.google.com"))).toBe("accounts.google.com");
  });

  it("skips addresses without a public icon and other categories", () => {
    expect(iconHost(login(""))).toBeUndefined();
    expect(iconHost(login("http://localhost:8080"))).toBeUndefined();
    expect(iconHost(login("http://192.168.0.1"))).toBeUndefined();
    expect(iconHost(login("http://[::1]/"))).toBeUndefined();
    expect(iconHost({ data: newItemData("note") })).toBeUndefined();
  });
});
