/**
 * A tiny OpenID Connect provider for the SSO end-to-end test: discovery,
 * JWKS, an authorization page with a "Sign in" button and a token endpoint
 * that checks the client secret and PKCE and returns an RS256 ID token.
 * Test infrastructure only (it signs with Node's crypto); Passbox verifies
 * tokens in its Rust core.
 */
import { createHash, createSign, generateKeyPairSync, randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";

export interface MockIdp {
  issuer: string;
  clientId: string;
  clientSecret: string;
  close(): Promise<void>;
}

const b64url = (data: Buffer | string) => Buffer.from(data).toString("base64url");

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => resolve(body));
  });
}

export async function startMockIdp(options: { email: (hint: string | null) => string }): Promise<MockIdp> {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: "jwk" }), kid: "e2e-1", use: "sig", alg: "RS256" };
  const clientId = "passbox-e2e";
  const clientSecret = "e2e-secret";
  const codes = new Map<string, { nonce: string; challenge: string; email: string; redirect: string }>();
  let issuer = "";

  function sign(claims: Record<string, unknown>) {
    const input = `${b64url(JSON.stringify({ alg: "RS256", kid: "e2e-1", typ: "JWT" }))}.${b64url(JSON.stringify(claims))}`;
    const signature = createSign("RSA-SHA256").update(input).sign(privateKey);
    return `${input}.${b64url(signature)}`;
  }

  const server: Server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", issuer);
    const json = (status: number, body: unknown) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };
    if (url.pathname === "/.well-known/openid-configuration") {
      return json(200, {
        issuer,
        authorization_endpoint: `${issuer}/authorize`,
        token_endpoint: `${issuer}/token`,
        jwks_uri: `${issuer}/jwks`,
        id_token_signing_alg_values_supported: ["RS256"],
        code_challenge_methods_supported: ["S256"],
        response_types_supported: ["code"],
      });
    }
    if (url.pathname === "/jwks") return json(200, { keys: [jwk] });
    if (url.pathname === "/authorize") {
      const email = options.email(url.searchParams.get("login_hint"));
      const code = randomUUID();
      codes.set(code, {
        nonce: url.searchParams.get("nonce") ?? "",
        challenge: url.searchParams.get("code_challenge") ?? "",
        email,
        redirect: url.searchParams.get("redirect_uri") ?? "",
      });
      const target = new URL(url.searchParams.get("redirect_uri") ?? "");
      target.searchParams.set("code", code);
      target.searchParams.set("state", url.searchParams.get("state") ?? "");
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(`<!doctype html><html lang="en"><head><title>Acme Identity</title>
<style>body{font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0;display:grid;place-items:center;height:100vh;margin:0}
main{background:#1e293b;padding:32px 40px;border-radius:16px;text-align:center}a{display:inline-block;margin-top:16px;background:#6366f1;color:white;padding:10px 18px;border-radius:10px;text-decoration:none}</style>
</head><body><main><h1>Acme Identity</h1><p>Signed in as ${email}</p><a href="${target.toString()}">Continue to Passbox</a></main></body></html>`);
      return;
    }
    if (url.pathname === "/token" && req.method === "POST") {
      const form = new URLSearchParams(await readBody(req));
      const auth = req.headers.authorization ?? "";
      const expected = `Basic ${Buffer.from(`${encodeURIComponent(clientId)}:${encodeURIComponent(clientSecret)}`).toString("base64")}`;
      const grant = codes.get(form.get("code") ?? "");
      codes.delete(form.get("code") ?? "");
      const verifier = form.get("code_verifier") ?? "";
      if (
        auth !== expected ||
        !grant ||
        b64url(createHash("sha256").update(verifier).digest()) !== grant.challenge ||
        form.get("redirect_uri") !== grant.redirect
      ) {
        return json(400, { error: "invalid_grant" });
      }
      const now = Math.floor(Date.now() / 1000);
      return json(200, {
        access_token: "at",
        token_type: "Bearer",
        id_token: sign({
          iss: issuer,
          aud: clientId,
          sub: `sub-${grant.email}`,
          email: grant.email,
          email_verified: true,
          name: "Ada Admin",
          groups: ["engineering"],
          nonce: grant.nonce,
          iat: now,
          exp: now + 300,
        }),
      });
    }
    json(404, { error: "not_found" });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  issuer = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return {
    issuer,
    clientId,
    clientSecret,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}
