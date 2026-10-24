import { describe, expect, it } from "vitest";
import { isInsecurePage, isLoopbackHost, parseServerUrl, ServerUrlError } from "./server";

const problem = (input: string) => {
  try {
    parseServerUrl(input);
    return undefined;
  } catch (error) {
    return error instanceof ServerUrlError ? error.code : "other";
  }
};

describe("server address", () => {
  it("normalizes addresses", () => {
    expect(parseServerUrl("passbox.example.com/")).toBe("https://passbox.example.com");
    expect(parseServerUrl(" https://example.com/vault/ ")).toBe("https://example.com/vault");
    expect(parseServerUrl("http://localhost:8080")).toBe("http://localhost:8080");
    expect(parseServerUrl("http://127.0.0.1:8787")).toBe("http://127.0.0.1:8787");
  });

  it("refuses plain http to other computers and other mistakes", () => {
    expect(problem("http://192.168.1.10:8080")).toBe("insecure");
    expect(problem("http://passbox.example.com")).toBe("insecure");
    expect(problem("")).toBe("empty");
    expect(problem("ftp://example.com")).toBe("scheme");
    expect(problem("https://user:pw@example.com")).toBe("credentials");
    expect(problem("https://example.com/?a=1")).toBe("query");
    expect(problem("https://exa mple.com")).toBe("invalid");
  });

  it("knows loopback hosts and insecure pages", () => {
    expect(isLoopbackHost("localhost")).toBe(true);
    expect(isLoopbackHost("127.0.0.53")).toBe(true);
    expect(isLoopbackHost("[::1]")).toBe(true);
    expect(isLoopbackHost("10.0.0.1")).toBe(false);
    expect(isInsecurePage({ protocol: "http:", hostname: "vault.lan" })).toBe(true);
    expect(isInsecurePage({ protocol: "http:", hostname: "127.0.0.1" })).toBe(false);
    expect(isInsecurePage({ protocol: "https:", hostname: "vault.example.com" })).toBe(false);
  });
});
