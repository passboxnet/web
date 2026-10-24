import { environmentVariables, type Item, isEnvName } from "@passbox/client";
import { Button } from "@passbox/ui";
import { Copy, Variable } from "lucide-react";
import { copyToClipboard } from "../lib/clipboard";
import { useI18n } from "../lib/i18n";

/** `KEY="value"` lines, quoted like `pbx env` does. */
export function dotenv(vars: [string, string][]): string {
  const quote = (value: string) =>
    `"${value
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r")
      .replace(/\$/g, "\\$")}"`;
  return vars.map(([key, value]) => `${key}=${quote(value)}\n`).join("");
}

/**
 * Shown on environment items (F8): what the item is for, how to use it
 * from the command line, and copying it as `.env` content.
 */
export function EnvironmentPanel({ item }: { item: Item }) {
  const { t } = useI18n();
  const vars = environmentVariables(item.data);
  const invalid = item.data.fields.filter((f) => f.value && !isEnvName(f.label.trim()));
  return (
    <div
      className="mt-6 flex flex-col gap-3 rounded-lg border border-border bg-surface-raised px-4 py-3 text-[0.8125rem]"
      data-testid="environment-panel"
    >
      <p className="flex items-start gap-2">
        <Variable className="mt-0.5 size-4 shrink-0 text-text-muted" aria-hidden="true" />
        <span>{t("environment.explainer", { count: vars.length })}</span>
      </p>
      <code className="block overflow-x-auto rounded-md bg-surface-sunken px-3 py-2 font-mono text-xs">
        {`pbx env "${item.data.title}" -- npm start`}
      </code>
      {invalid.length > 0 && (
        <p className="text-xs text-warning-text">
          {t("environment.invalidNames", { names: invalid.map((f) => f.label || f.id).join(", ") })}
        </p>
      )}
      <div>
        <Button
          size="sm"
          variant="secondary"
          disabled={vars.length === 0}
          onClick={() => void copyToClipboard(dotenv(vars), t("environment.dotenv"))}
        >
          <Copy />
          {t("environment.copy")}
        </Button>
      </div>
    </div>
  );
}
