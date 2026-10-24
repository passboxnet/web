import init, * as core from "@passbox/core-wasm";

let ready: Promise<typeof core> | undefined;

/** Loads the Passbox core (WebAssembly) once and returns its exports. */
export function loadCore(): Promise<typeof core> {
  ready ??= init().then(() => core);
  return ready;
}
