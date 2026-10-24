/**
 * Starting and finishing SSO flows in the browser.
 *
 * Sign-in: the tab keeps the flow secret in `sessionStorage` and goes to the
 * identity provider; the server redirects back to `#/sso?ticket=…`, and only
 * this tab can redeem the ticket. "Test connection" runs in a popup so the
 * admin stays unlocked: the server marks its redirect with `test=1`, and the
 * popup hands the ticket to the opening tab over a BroadcastChannel (same
 * origin only). The opening tab keeps the flow secret in memory.
 */
import { type PassboxClient, SSO_FLOW_KEY, type SsoFlowState } from "@passbox/client";

const TEST_CHANNEL = "passbox-sso-test";

/** Starts a sign-in at the organization's identity provider (leaves the page). */
export async function startSsoSignIn(client: PassboxClient, orgId: string, email?: string): Promise<void> {
  const start = await client.startSso(orgId, email);
  const state: SsoFlowState = {
    flowSecret: start.flowSecret,
    orgId,
    purpose: "login",
    ...(email ? { email } : {}),
    startedAt: Date.now(),
  };
  sessionStorage.setItem(SSO_FLOW_KEY, JSON.stringify(state));
  window.location.assign(start.authorizationUrl);
}

/** The sign-in this tab started, consumed once. */
export function takeSsoFlow(): SsoFlowState | undefined {
  const raw = sessionStorage.getItem(SSO_FLOW_KEY);
  sessionStorage.removeItem(SSO_FLOW_KEY);
  if (!raw) return undefined;
  try {
    const state = JSON.parse(raw) as SsoFlowState;
    // The server forgets flows after 10 minutes.
    return Date.now() - state.startedAt < 15 * 60 * 1000 ? state : undefined;
  } catch {
    return undefined;
  }
}

/** In the popup: passes the result to the tab that started the test. */
export function relayTestResult(result: { ticket?: string; error?: string }): void {
  const channel = new BroadcastChannel(TEST_CHANNEL);
  channel.postMessage(result);
  channel.close();
}

/**
 * Runs a connection test: opens the identity provider in a popup and
 * resolves with the ticket (or the error code) once the provider sent the
 * popup back. Rejects with `popup_blocked` or `timeout`.
 */
export function runSsoTest(authorizationUrl: string): Promise<{ ticket?: string; error?: string }> {
  const popup = window.open(authorizationUrl, "passbox-sso-test", "popup,width=520,height=720");
  if (!popup) return Promise.reject(new Error("popup_blocked"));
  return new Promise((resolve, reject) => {
    const channel = new BroadcastChannel(TEST_CHANNEL);
    const timeout = window.setTimeout(
      () => {
        channel.close();
        reject(new Error("timeout"));
      },
      10 * 60 * 1000,
    );
    channel.onmessage = (event: MessageEvent<{ ticket?: string; error?: string }>) => {
      window.clearTimeout(timeout);
      channel.close();
      resolve(event.data);
    };
  });
}
