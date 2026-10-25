import { type MappingProposal, redactColumns, suggestMapping } from "@passbox/ai";
import {
  type ColumnMapping,
  type ColumnTarget,
  decodeText,
  type ImportFile,
  parseCsvTable,
} from "@passbox/client/import";
import { Button } from "@passbox/ui";
import { Sparkles, Undo2 } from "lucide-react";
import { useState } from "react";
import { endpointHost } from "../ai/AiPanel";
import { useAiGateway } from "../ai/useAiGateway";
import type { Translate } from "./messages";

/** Enough rows for a pattern profile without reading huge files twice. */
const SAMPLE_BYTES = 2 * 1024 * 1024;

/** The table for profiling: the whole file, or its first 2 MB cut at a line break. */
export function sampleTable(file: ImportFile) {
  if (file.bytes.length <= SAMPLE_BYTES) return parseCsvTable(decodeText(file.bytes));
  const cut = file.bytes.subarray(0, SAMPLE_BYTES).lastIndexOf(0x0a);
  const table = parseCsvTable(decodeText(file.bytes.subarray(0, cut > 0 ? cut : SAMPLE_BYTES)));
  return { headers: table.headers, rows: table.rows.slice(0, -1) };
}

/** Columns the header rules did not recognize (they became plain fields). */
export function unknownColumns(detected: ColumnMapping): number[] {
  return detected.flatMap((target, index) => (target === "field" ? [index] : []));
}

export type Suggested = ReadonlyMap<number, MappingProposal["source"]>;

/**
 * K6: suggests targets for unrecognized columns, with the AI model when the
 * feature is on (only headers and value patterns are sent), from value
 * patterns on this device otherwise. The user confirms in the table.
 */
export function MappingSuggestion({
  t,
  file,
  detected,
  mapping,
  onChange,
  suggested,
  onSuggested,
}: {
  t: Translate;
  file: ImportFile;
  detected: ColumnMapping;
  mapping: ColumnMapping;
  onChange: (mapping: ColumnMapping) => void;
  suggested: Suggested;
  onSuggested: (suggested: Suggested) => void;
}) {
  const { gateway, settings } = useAiGateway();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ message: string; previous: ColumnMapping; failed: boolean }>();
  const unknown = unknownColumns(detected);
  const ai = gateway.isEnabled("import-mapping");
  if (unknown.length === 0) return null;
  const where =
    settings.provider?.location === "on-device" && !settings.provider.endpoint.trim()
      ? t("ai.where.browser")
      : t(`ai.where.${settings.provider?.location ?? "on-device"}`, {
          host: endpointHost(settings.provider?.endpoint ?? "") ?? "–",
        });

  async function suggest() {
    setBusy(true);
    try {
      const table = sampleTable(file);
      const proposal = await suggestMapping(gateway, redactColumns(table, mapping, unknown));
      const failed = ai && proposal.source === "patterns";
      onChange(proposal.mapping as ColumnTarget[]);
      onSuggested(new Map(proposal.changed.map((c) => [c.index, proposal.source])));
      setResult({
        previous: mapping,
        failed,
        message:
          proposal.changed.length === 0
            ? t("ai.import.none")
            : t(proposal.source === "ai" ? "ai.import.doneAi" : "ai.import.donePatterns", {
                count: proposal.changed.length,
              }),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4 shadow-card sm:flex-row sm:items-center">
      <Sparkles className="hidden size-5 shrink-0 text-accent sm:block" aria-hidden="true" />
      <div className="min-w-0 flex-1 text-[0.8125rem]">
        <p className="font-medium">{t("ai.import.unknown", { count: unknown.length })}</p>
        <p className="mt-0.5 text-xs text-text-muted">
          {ai ? t("ai.import.sendsAi", { where }) : t("ai.import.sendsNothing")}
        </p>
        <p role="status" className="mt-1.5 text-xs text-text empty:hidden">
          {result ? `${result.message}${result.failed ? ` ${t("ai.import.failed")}` : ""}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        {result && suggested.size > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onChange(result.previous);
              onSuggested(new Map());
              setResult(undefined);
            }}
          >
            <Undo2 />
            {t("ai.import.undo")}
          </Button>
        )}
        <Button variant="secondary" size="sm" loading={busy} onClick={() => void suggest()} data-testid="ai-suggest">
          <Sparkles />
          {ai ? t("ai.import.suggestAi") : t("ai.import.suggest")}
        </Button>
      </div>
    </div>
  );
}
