/// <reference lib="webworker" />
// Parses import files off the main thread, so large exports do not freeze the page.
import { ImportError, parseImport } from "@passbox/client/import";
import type { ParseRequest, ParseResponse } from "./parse";

self.onmessage = (event: MessageEvent<ParseRequest>) => {
  const { file, options } = event.data;
  let response: ParseResponse;
  try {
    response = { ok: true, result: parseImport(file, options) };
  } catch (error) {
    response = {
      ok: false,
      code: error instanceof ImportError ? error.code : undefined,
      message: error instanceof Error ? error.message : String(error),
    };
  }
  (self as unknown as Worker).postMessage(response);
};
