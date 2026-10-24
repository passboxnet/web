import type { ColumnMapping, ColumnTarget, CsvTable } from "@passbox/client/import";
import { SINGLE_TARGETS } from "@passbox/client/import";
import type { MessageKey, Translate } from "./messages";

const TARGETS: ColumnTarget[] = [...SINGLE_TARGETS, "field", "secret", "skip"];
const SECRET: ReadonlySet<ColumnTarget> = new Set(["password", "secret", "totp"]);

/**
 * One row per column: header, an example value and the target. Values of
 * columns mapped to a password or hidden field are masked in the preview.
 */
export function ColumnMappingTable({
  t,
  table,
  mapping,
  onChange,
}: {
  t: Translate;
  table: CsvTable;
  mapping: ColumnMapping;
  onChange: (mapping: ColumnMapping) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-card border border-border bg-surface shadow-card">
      <table className="w-full min-w-[34rem] text-left text-[13px]">
        <thead className="bg-surface-sunken text-xs text-text-muted">
          <tr>
            <th scope="col" className="px-4 py-2.5 font-medium">
              {t("import.mapping.column")}
            </th>
            <th scope="col" className="px-4 py-2.5 font-medium">
              {t("import.mapping.example")}
            </th>
            <th scope="col" className="px-4 py-2.5 font-medium">
              {t("import.mapping.target")}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {table.headers.map((header, index) => {
            const target = mapping[index] ?? "skip";
            const examples = table.rows
              .map((row) => row[index] ?? "")
              .filter((v) => v.trim() !== "")
              .slice(0, 2);
            const label = header || `${t("import.mapping.column")} ${index + 1}`;
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: columns are identified by position
              <tr key={index} className={target === "skip" ? "text-text-subtle" : undefined}>
                <th scope="row" className="px-4 py-2 font-medium">
                  {label}
                </th>
                <td className="max-w-64 truncate px-4 py-2 font-mono text-xs text-text-muted">
                  {examples.map((v) => (SECRET.has(target) ? "••••••••" : v)).join(" · ")}
                </td>
                <td className="px-4 py-1.5">
                  <select
                    aria-label={`${label}: ${t("import.mapping.target")}`}
                    value={target}
                    onChange={(e) => {
                      const next = [...mapping];
                      const chosen = e.target.value as ColumnTarget;
                      // A single target moves: the column that had it becomes an extra field.
                      if (SINGLE_TARGETS.includes(chosen)) {
                        const previous = next.indexOf(chosen);
                        if (previous !== -1 && previous !== index) next[previous] = "field";
                      }
                      next[index] = chosen;
                      onChange(next);
                    }}
                    className="h-10 w-full min-w-48 rounded-lg border border-border-strong bg-surface px-2.5 text-[13px] text-text shadow-xs"
                  >
                    {TARGETS.map((value) => (
                      <option key={value} value={value}>
                        {t(`target.${value}` as MessageKey)}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
