import { createClient } from "@passbox/api-client";
import { PassboxClient } from "@passbox/client";
import init, * as core from "@passbox/core-wasm";
import { isDesktop } from "./desktop";
import { deviceInfo } from "./lib/device";
import { describeError, type ErrorContext } from "./lib/errors";
import { i18n } from "./lib/i18n";
import { serverUrl } from "./lib/server";

let ready: Promise<typeof core> | undefined;

/** Loads the Passbox core (WebAssembly) once and returns its exports. */
export function loadCore(): Promise<typeof core> {
  ready ??= init().then(() => core);
  return ready;
}

let client: Promise<PassboxClient> | undefined;

/** The app-wide client. It talks to the server from `serverUrl()`, by default the one the app was loaded from. */
export function loadClient(): Promise<PassboxClient> {
  client ??= loadCore().then((loaded) => {
    let instance: PassboxClient | undefined;
    const api = createClient({ baseUrl: serverUrl() ?? "", getToken: () => instance?.token });
    instance = new PassboxClient({
      core: loaded,
      api,
      storage: window.localStorage,
      device: deviceInfo(isDesktop, navigator.userAgent),
    });
    return instance;
  });
  return client;
}

/** Lets the browser paint (for example a spinner) before blocking work such as key derivation. */
export function nextFrame(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 30));
}

/** A localized message that says what happened and what to do. */
export function errorMessage(error: unknown, context: ErrorContext = "general"): string {
  const known = ["ApiError", "InvalidCredentialsError", "ConflictError", "SecretKeyFormatError", "TypeError"];
  if (!(error instanceof Error && known.includes(error.name))) console.error(error);
  return describeError(error, i18n().t, context);
}
