import type { ColumnMapping, ImportFile, ImportFormat, ImportResult } from "@passbox/client/import";
import { ImportError, parseImport } from "@passbox/client/import";
import { loadCore } from "../core";

export interface ParseRequest {
  file: ImportFile;
  options: { format?: ImportFormat; mapping?: ColumnMapping };
}

export type ParseResponse =
  | { ok: true; result: ImportResult }
  | { ok: false; code: ImportError["code"] | undefined; message: string };

function inWorker(request: ParseRequest): Promise<ImportResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./parse.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<ParseResponse>) => {
      worker.terminate();
      const data = event.data;
      if (data.ok) resolve(data.result);
      else reject(data.code ? new ImportError(data.code, data.message) : new Error(data.message));
    };
    worker.onerror = (event) => {
      worker.terminate();
      reject(new Error(event.message || "worker failed"));
    };
    worker.postMessage(request);
  });
}

/**
 * Parses an import file. Plain exports are parsed in a worker; encrypted
 * Passbox exports need the core and the password and are decrypted here.
 */
export async function parseFile(
  file: ImportFile,
  options: { format?: ImportFormat; mapping?: ColumnMapping; password?: string } = {},
): Promise<ImportResult> {
  if (options.format === "passbox" || options.password !== undefined) {
    const core = await loadCore();
    // Give the spinner a frame before the key derivation blocks.
    await new Promise((resolve) => setTimeout(resolve, 30));
    return parseImport(file, { ...options, core });
  }
  const request: ParseRequest = {
    file,
    options: {
      ...(options.format ? { format: options.format } : {}),
      ...(options.mapping ? { mapping: options.mapping } : {}),
    },
  };
  if (typeof Worker === "undefined") return parseImport(request.file, request.options);
  try {
    return await inWorker(request);
  } catch (error) {
    if (error instanceof ImportError) throw error;
    // Workers can be unavailable (strict CSP, old webviews): parse here instead.
    return parseImport(request.file, request.options);
  }
}
