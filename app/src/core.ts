import { createClient } from "@passbox/api-client";
import { PassboxClient } from "@passbox/client";
import init, * as core from "@passbox/core-wasm";

let ready: Promise<typeof core> | undefined;

/** Loads the Passbox core (WebAssembly) once and returns its exports. */
export function loadCore(): Promise<typeof core> {
  ready ??= init().then(() => core);
  return ready;
}

let client: Promise<PassboxClient> | undefined;

/** The app-wide client. The web app talks to the server it was loaded from. */
export function loadClient(): Promise<PassboxClient> {
  client ??= loadCore().then((loaded) => {
    let instance: PassboxClient | undefined;
    const api = createClient({ getToken: () => instance?.token });
    instance = new PassboxClient({ core: loaded, api, storage: window.localStorage });
    return instance;
  });
  return client;
}

/** Lets the browser paint (for example a spinner) before blocking work such as key derivation. */
export function nextFrame(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 30));
}
