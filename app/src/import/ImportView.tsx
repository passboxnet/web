import type { ImportEntry, Item, ItemCategory } from "@passbox/client";
import { FIELD, fieldValue } from "@passbox/client";
import {
  type ColumnMapping,
  type DuplicateDecision,
  type DuplicateMatch,
  findDuplicates,
  ImportError,
  type ImportFile,
  type ImportFormat,
  type ImportResult,
  mappingProblem,
  mergeItem,
  previewCsv,
} from "@passbox/client/import";
import { Button, cn, Input, PasswordInput, SegmentedControl, Spinner } from "@passbox/ui";
import {
  ArrowLeft,
  CircleCheck,
  FileUp,
  KeyRound,
  ShieldCheck,
  Timer,
  Trash2,
  TriangleAlert,
  Upload,
} from "lucide-react";
import { type DragEvent, type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { errorMessage } from "../core";
import { useClient, useSnapshot } from "../useClient";
import { ColumnMappingTable } from "./ColumnMappingTable";
import { MappingSuggestion, type Suggested } from "./MappingSuggestion";
import { currentLocale, type MessageKey, plural, type Translate, translator } from "./messages";
import { parseFile } from "./parse";
import { formatSourceName, type ImportSource, SOURCES } from "./sources";

/** Larger files are refused before reading them into memory. */
const MAX_FILE_BYTES = 200 * 1024 * 1024;
const PREVIEW_ROWS = 8;
const DECISION_ROWS = 100;

type Step =
  | { kind: "source" }
  | { kind: "password"; file: ImportFile; error?: string }
  | { kind: "mapping"; file: ImportFile; preview: ReturnType<typeof previewCsv>; mapping: ColumnMapping }
  | { kind: "review"; file: ImportFile; result: ImportResult }
  | { kind: "done"; summary: Summary };

interface Summary {
  format: ImportFormat;
  created: number;
  updated: number;
  skipped: number;
  failed: { title: string; error: string }[];
  stopped: boolean;
  seconds: number;
}

export function ImportView({ onShowItems }: { onShowItems: () => void }) {
  const t = useMemo(() => translator(), []);
  const [source, setSource] = useState<ImportSource>();
  const [step, setStep] = useState<Step>({ kind: "source" });
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();

  function describeError(e: unknown): string {
    if (e instanceof ImportError) return t(`error.${e.code}` as MessageKey);
    return t("error.generic", { message: errorMessage(e) });
  }

  async function readFile(file: File) {
    setError(undefined);
    if (file.size > MAX_FILE_BYTES) {
      setError(t("error.tooLarge"));
      return;
    }
    setBusy(t("import.drop.reading", { name: file.name }));
    try {
      const imported: ImportFile = { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) };
      const format = source?.forceFormat;
      if (format === "generic-csv") {
        const preview = previewCsv(imported, PREVIEW_ROWS);
        setStep({ kind: "mapping", file: imported, preview, mapping: preview.mapping });
        return;
      }
      if (format === "passbox") {
        setStep({ kind: "password", file: imported });
        return;
      }
      try {
        const result = await parseFile(imported, format ? { format } : {});
        if (result.format === "generic-csv") {
          const preview = previewCsv(imported, PREVIEW_ROWS);
          setStep({ kind: "mapping", file: imported, preview, mapping: preview.mapping });
          return;
        }
        showReview(imported, result);
      } catch (e) {
        if (e instanceof ImportError && e.code === "password_required") setStep({ kind: "password", file: imported });
        else throw e;
      }
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(undefined);
    }
  }

  function showReview(file: ImportFile, result: ImportResult) {
    if (result.items.length === 0) {
      setError(t("error.no_items"));
      return;
    }
    setStep({ kind: "review", file, result });
  }

  async function openProtected(file: ImportFile, password: string) {
    setBusy(t("export.working"));
    try {
      showReview(file, await parseFile(file, { format: "passbox", password }));
    } catch (e) {
      setStep({ kind: "password", file, error: describeError(e) });
    } finally {
      setBusy(undefined);
    }
  }

  async function applyMapping(file: ImportFile, mapping: ColumnMapping) {
    setBusy(t("import.drop.reading", { name: file.name }));
    try {
      showReview(file, await parseFile(file, { format: "generic-csv", mapping }));
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(undefined);
    }
  }

  function restart() {
    setStep({ kind: "source" });
    setError(undefined);
  }

  const stepIndex = { source: 0, password: 1, mapping: 1, review: 2, done: 3 }[step.kind];

  return (
    <section aria-labelledby="import-title" className="flex min-w-0 flex-1 flex-col overflow-y-auto bg-canvas">
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-10">
        <header className="mb-6">
          <h1 id="import-title" className="text-2xl font-semibold tracking-tight">
            {t("import.title")}
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-text-muted">{t("import.description")}</p>
        </header>
        <Stepper t={t} active={stepIndex} />

        {error && (
          <div role="alert" className="mb-6 flex gap-3 rounded-card border border-danger/30 bg-danger-soft p-4 text-sm">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
            <p className="text-text">{error}</p>
          </div>
        )}

        {step.kind === "source" && (
          <SourceStep
            t={t}
            source={source}
            onSource={(s) => {
              setSource(s);
              setError(undefined);
            }}
            onFile={readFile}
            busy={busy}
          />
        )}
        {step.kind === "password" && (
          <PasswordStep
            t={t}
            error={step.error}
            busy={busy}
            onBack={restart}
            onSubmit={(password) => openProtected(step.file, password)}
          />
        )}
        {step.kind === "mapping" && (
          <MappingStep
            t={t}
            step={step}
            busy={busy}
            onChange={(mapping) => setStep({ ...step, mapping })}
            onBack={restart}
            onSubmit={() => applyMapping(step.file, step.mapping)}
          />
        )}
        {step.kind === "review" && (
          <ReviewStep
            t={t}
            file={step.file}
            result={step.result}
            onBack={restart}
            onDone={(summary) => setStep({ kind: "done", summary })}
            onError={(message) => {
              setError(t("error.import", { message }));
            }}
          />
        )}
        {step.kind === "done" && (
          <DoneStep t={t} summary={step.summary} source={source} onShowItems={onShowItems} onAnother={restart} />
        )}
      </div>
    </section>
  );
}

// --- Steps -------------------------------------------------------------------------

function Stepper({ t, active }: { t: Translate; active: number }) {
  const steps: MessageKey[] = ["import.step.source", "import.step.file", "import.step.review", "import.step.done"];
  return (
    <ol className="mb-8 flex flex-wrap items-center gap-2 text-[13px]" aria-label={t("import.title")}>
      {steps.map((key, i) => (
        <li key={key} className="flex items-center gap-2" aria-current={i === active ? "step" : undefined}>
          <span
            className={cn(
              "flex size-6 items-center justify-center rounded-full text-xs font-semibold",
              i < active && "bg-success-soft text-success",
              i === active && "bg-accent text-accent-contrast",
              i > active && "bg-surface-sunken text-text-muted",
            )}
          >
            {i < active ? <CircleCheck className="size-3.5" aria-hidden="true" /> : i + 1}
          </span>
          <span className={cn(i === active ? "font-semibold text-text" : "text-text-muted")}>{t(key)}</span>
          {i < steps.length - 1 && <span className="mx-1 h-px w-6 bg-border" aria-hidden="true" />}
        </li>
      ))}
    </ol>
  );
}

function SourceStep({
  t,
  source,
  onSource,
  onFile,
  busy,
}: {
  t: Translate;
  source: ImportSource | undefined;
  onSource: (source: ImportSource) => void;
  onFile: (file: File) => void;
  busy: string | undefined;
}) {
  const locale = currentLocale();
  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="import-sources">
        <h2 id="import-sources" className="mb-3 text-sm font-semibold">
          {t("import.chooseSource")}
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5" role="radiogroup">
          {SOURCES.map((s) => (
            // biome-ignore lint/a11y/useSemanticElements: tiles are styled radio buttons
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={source?.id === s.id}
              onClick={() => onSource(s)}
              className={cn(
                "flex min-h-14 items-center gap-3 rounded-card border bg-surface px-3 py-2.5 text-left text-[13px] font-medium shadow-xs transition-colors",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                source?.id === s.id
                  ? "border-accent ring-2 ring-accent/30"
                  : "border-border hover:border-border-strong",
              )}
            >
              <span
                aria-hidden="true"
                className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-sunken text-xs font-semibold text-text-muted"
              >
                {s.monogram}
              </span>
              <span>{s.name}</span>
            </button>
          ))}
        </div>
      </section>

      {source && (
        <div className="grid gap-4 lg:grid-cols-2">
          <section
            className="rounded-card border border-border bg-surface p-5 shadow-card"
            aria-labelledby="import-howto"
          >
            <h2 id="import-howto" className="text-sm font-semibold">
              {t("import.howTo", { source: source.name })}
            </h2>
            <ol className="mt-3 flex list-none flex-col gap-3">
              {source.steps[locale].map((text, i) => (
                <li key={text} className="flex gap-3 text-sm">
                  <span
                    aria-hidden="true"
                    className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent"
                  >
                    {i + 1}
                  </span>
                  <span className="pt-0.5">{text}</span>
                </li>
              ))}
            </ol>
          </section>
          <DropZone t={t} accept={source.accept} onFile={onFile} busy={busy} />
        </div>
      )}
      <p className="flex items-center gap-2 text-xs text-text-muted">
        <ShieldCheck className="size-4 shrink-0 text-success" aria-hidden="true" />
        {t("import.privacy")}
      </p>
    </div>
  );
}

function DropZone({
  t,
  accept,
  onFile,
  busy,
}: {
  t: Translate;
  accept: string;
  onFile: (file: File) => void;
  busy: string | undefined;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  function drop(event: DragEvent) {
    event.preventDefault();
    setOver(false);
    const file = event.dataTransfer.files[0];
    if (file) onFile(file);
  }
  return (
    <section
      aria-label={t("import.drop.title")}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={drop}
      className={cn(
        "flex min-h-56 flex-col items-center justify-center gap-3 rounded-card border-2 border-dashed p-6 text-center transition-colors",
        over ? "border-accent bg-accent-soft" : "border-border-strong bg-surface",
      )}
    >
      {busy ? (
        <Spinner label={busy} />
      ) : (
        <>
          <span className="flex size-11 items-center justify-center rounded-full bg-accent-soft text-accent">
            <FileUp className="size-5" aria-hidden="true" />
          </span>
          <p className="text-sm font-semibold">{t("import.drop.title")}</p>
          <p className="text-xs text-text-muted">{t("import.drop.or")}</p>
          <Button onClick={() => input.current?.click()}>
            <Upload />
            {t("import.drop.button")}
          </Button>
          <p className="text-xs text-text-subtle">{accept.split(",").join(" · ")}</p>
          <p className="max-w-xs text-xs text-text-muted">{t("import.otherFormats")}</p>
        </>
      )}
      <input
        ref={input}
        type="file"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        data-testid="import-file-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onFile(file);
        }}
      />
    </section>
  );
}

function PasswordStep({
  t,
  error,
  busy,
  onBack,
  onSubmit,
}: {
  t: Translate;
  error: string | undefined;
  busy: string | undefined;
  onBack: () => void;
  onSubmit: (password: string) => void;
}) {
  const [password, setPassword] = useState("");
  function submit(event: FormEvent) {
    event.preventDefault();
    if (password) onSubmit(password);
  }
  return (
    <form onSubmit={submit} className="max-w-md rounded-card border border-border bg-surface p-5 shadow-card">
      <h2 className="mb-4 text-sm font-semibold">{t("import.password.title")}</h2>
      <PasswordInput
        label={t("import.password.label")}
        hint={t("import.password.hint")}
        error={error}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoFocus
        autoComplete="off"
      />
      <div className="mt-5 flex justify-between gap-2">
        <Button variant="secondary" onClick={onBack}>
          <ArrowLeft />
          {t("import.back")}
        </Button>
        <Button type="submit" loading={!!busy} disabled={!password}>
          {t("import.password.submit")}
        </Button>
      </div>
    </form>
  );
}

function MappingStep({
  t,
  step,
  busy,
  onChange,
  onBack,
  onSubmit,
}: {
  t: Translate;
  step: Extract<Step, { kind: "mapping" }>;
  busy: string | undefined;
  onChange: (mapping: ColumnMapping) => void;
  onBack: () => void;
  onSubmit: () => void;
}) {
  const problem = mappingProblem(step.mapping);
  const [suggested, setSuggested] = useState<Suggested>(new Map());
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-sm font-semibold">{t("import.mapping.title")}</h2>
        <p className="mt-1 text-sm text-text-muted">
          {t("import.mapping.description")} ({step.file.name}, {plural(t, "import.mapping.rows", step.preview.total)})
        </p>
      </div>
      <MappingSuggestion
        t={t}
        file={step.file}
        detected={step.preview.mapping}
        mapping={step.mapping}
        onChange={onChange}
        suggested={suggested}
        onSuggested={setSuggested}
      />
      <ColumnMappingTable
        t={t}
        table={step.preview.table}
        mapping={step.mapping}
        onChange={(mapping) => {
          // A column the user changes is no longer a suggestion.
          const next = new Map(suggested);
          mapping.forEach((target, i) => {
            if (target !== step.mapping[i]) next.delete(i);
          });
          setSuggested(next);
          onChange(mapping);
        }}
        suggested={suggested}
      />
      {problem && (
        <p role="alert" className="text-sm text-danger">
          {t(problem === "no_columns" ? "import.mapping.noColumns" : "import.mapping.duplicate")}
        </p>
      )}
      <div className="flex justify-between gap-2">
        <Button variant="secondary" onClick={onBack}>
          <ArrowLeft />
          {t("import.back")}
        </Button>
        <Button onClick={onSubmit} disabled={!!problem} loading={!!busy}>
          {t("import.next")}
        </Button>
      </div>
    </div>
  );
}

type VaultChoice = { mode: "single"; vaultId: string } | { mode: "new"; name: string } | { mode: "bySource" };

function ReviewStep({
  t,
  file,
  result,
  onBack,
  onDone,
  onError,
}: {
  t: Translate;
  file: ImportFile;
  result: ImportResult;
  onBack: () => void;
  onDone: (summary: Summary) => void;
  onError: (message: string) => void;
}) {
  const client = useClient();
  const { vaults, items: existing } = useSnapshot();
  const sourceName = formatSourceName(result.format);
  const sourceVaults = useMemo(
    () => [...new Set(result.items.map((i) => i.sourceVault).filter((v): v is string => !!v))],
    [result],
  );
  const [vault, setVault] = useState<VaultChoice>(() =>
    sourceVaults.length > 1 ? { mode: "bySource" } : { mode: "single", vaultId: vaults[0]?.id ?? "" },
  );
  // Duplicates are computed once: the snapshot changes while importing.
  const [duplicates] = useState<DuplicateMatch[]>(() => findDuplicates(result.items, existing));
  const [allDecision, setAllDecision] = useState<DuplicateDecision>("skip");
  const [decisions, setDecisions] = useState<Map<number, DuplicateDecision>>(new Map());
  const [perItem, setPerItem] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number }>();
  const abort = useRef<AbortController | undefined>(undefined);
  useEffect(() => () => abort.current?.abort(), []);

  const existingById = useMemo(() => new Map(existing.map((item) => [item.id, item])), [existing]);
  const duplicateOf = useMemo(() => new Map(duplicates.map((d) => [d.index, d.existingId])), [duplicates]);
  const decisionFor = (index: number): DuplicateDecision | undefined =>
    duplicateOf.has(index) ? (perItem ? (decisions.get(index) ?? allDecision) : allDecision) : undefined;
  const skipped = duplicates.filter((d) => decisionFor(d.index) === "skip").length;
  const toImport = result.items.length - skipped;

  const counts = useMemo(() => {
    const byCategory = new Map<ItemCategory, number>();
    let totp = 0;
    let passkeys = 0;
    for (const { data } of result.items) {
      byCategory.set(data.category, (byCategory.get(data.category) ?? 0) + 1);
      if (fieldValue(data, FIELD.totp)) totp++;
      if (data.passkeys?.length) passkeys++;
    }
    return { byCategory, totp, passkeys };
  }, [result]);

  async function start() {
    setProgress({ done: 0, total: toImport });
    const started = performance.now();
    const controller = new AbortController();
    abort.current = controller;
    try {
      const vaultIds = await resolveVaults();
      const groups = new Map<string, ImportEntry[]>();
      result.items.forEach((item, index) => {
        const decision = decisionFor(index);
        if (decision === "skip") return;
        const existingId = duplicateOf.get(index);
        const current = existingId ? existingById.get(existingId) : undefined;
        const entry: ImportEntry =
          decision === "update" && current
            ? { data: mergeItem(current.data, item.data), updateId: current.id }
            : { data: item.data };
        const target = vaultIds(item.sourceVault);
        const group = groups.get(target);
        if (group) group.push(entry);
        else groups.set(target, [entry]);
      });
      const total = toImport;
      let base = 0;
      let last = 0;
      const outcome = { created: 0, updated: 0, failed: [] as Summary["failed"] };
      for (const [vaultId, entries] of groups) {
        const r = await client.importItems(vaultId, entries, {
          signal: controller.signal,
          onProgress: (done) => {
            const now = performance.now();
            // Re-render at most every 100 ms.
            if (now - last > 100 || base + done === total) {
              last = now;
              setProgress({ done: base + done, total });
            }
          },
        });
        base += entries.length;
        outcome.created += r.created;
        outcome.updated += r.updated;
        outcome.failed.push(...r.failed);
        if (controller.signal.aborted) break;
      }
      onDone({
        format: result.format,
        ...outcome,
        skipped,
        stopped: controller.signal.aborted,
        seconds: Math.round((performance.now() - started) / 100) / 10,
      });
    } catch (e) {
      setProgress(undefined);
      onError(errorMessage(e));
    }
  }

  /** Creates vaults as needed and returns the target vault for an item's source vault. */
  async function resolveVaults(): Promise<(sourceVault: string | undefined) => string> {
    if (vault.mode === "single") return () => vault.vaultId;
    if (vault.mode === "new") {
      const id = await client.createVault(vault.name.trim() || `${sourceName} Import`);
      return () => id;
    }
    const byName = new Map(vaults.map((v) => [v.name.toLowerCase(), v.id]));
    for (const name of sourceVaults) {
      if (!byName.has(name.toLowerCase())) byName.set(name.toLowerCase(), await client.createVault(name));
    }
    const fallback = vaults[0]?.id ?? "";
    return (name) => (name ? (byName.get(name.toLowerCase()) ?? fallback) : fallback);
  }

  if (progress) {
    return <ProgressStep t={t} done={progress.done} total={progress.total} onStop={() => abort.current?.abort()} />;
  }

  const vaultValue = vault.mode === "single" ? vault.vaultId : vault.mode;
  const canStart = toImport > 0 && (vault.mode !== "single" || !!vault.vaultId);

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-card border border-border bg-surface p-5 shadow-card" aria-labelledby="import-review">
        <h2 id="import-review" className="text-base font-semibold">
          {plural(t, "import.review.found", result.items.length, { file: file.name })}
        </h2>
        <ul className="mt-3 flex flex-wrap gap-2 text-[13px]">
          {[...counts.byCategory].map(([category, count]) => (
            <li key={category} className="rounded-full bg-surface-sunken px-3 py-1">
              <span className="font-semibold">{count.toLocaleString()}</span> {t(`category.${category}` as MessageKey)}
            </li>
          ))}
          {counts.totp > 0 && (
            <li className="flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-accent">
              <Timer className="size-3.5" aria-hidden="true" />
              {t("import.review.withTotp", { count: counts.totp })}
            </li>
          )}
          {counts.passkeys > 0 && (
            <li className="flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-accent">
              <KeyRound className="size-3.5" aria-hidden="true" />
              {t("import.review.withPasskeys", { count: counts.passkeys })}
            </li>
          )}
        </ul>
        {result.warnings.length > 0 && (
          <ul className="mt-4 flex flex-col gap-2">
            {result.warnings.map((w) => (
              <li key={w.code} className="flex gap-2.5 rounded-lg bg-warning-soft p-3 text-[13px]">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
                <span>
                  {t(`warning.${w.code}` as MessageKey, { count: w.count, source: sourceName })}
                  {w.examples.length > 0 && (
                    <span className="block text-text-muted">
                      {t("warning.examples", { titles: w.examples.join(", ") })}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
        <PreviewTable t={t} result={result} />
      </section>

      <section className="rounded-card border border-border bg-surface p-5 shadow-card" aria-labelledby="import-vault">
        <h2 id="import-vault" className="text-sm font-semibold">
          {t("import.vault.title")}
        </h2>
        <div className="mt-3 flex flex-col gap-3">
          {sourceVaults.length > 0 && (
            <label className="flex items-start gap-2.5 text-sm">
              <input
                type="radio"
                name="vault-mode"
                className="mt-1 size-4 accent-[var(--color-accent)]"
                checked={vault.mode === "bySource"}
                onChange={() => setVault({ mode: "bySource" })}
              />
              <span>
                {t("import.vault.bySource", {
                  names: sourceVaults.slice(0, 4).join(", ") + (sourceVaults.length > 4 ? " …" : ""),
                })}
                <span className="block text-xs text-text-muted">{t("import.vault.bySourceHint")}</span>
              </span>
            </label>
          )}
          <div className="flex flex-wrap items-center gap-2.5 text-sm">
            {sourceVaults.length > 0 && (
              <input
                type="radio"
                name="vault-mode"
                aria-label={t("import.vault.single")}
                className="size-4 accent-[var(--color-accent)]"
                checked={vault.mode !== "bySource"}
                onChange={() => setVault({ mode: "single", vaultId: vaults[0]?.id ?? "" })}
              />
            )}
            <select
              aria-label={t("import.vault.title")}
              value={vault.mode === "bySource" ? (vaults[0]?.id ?? "") : vaultValue}
              disabled={vault.mode === "bySource"}
              onChange={(e) =>
                setVault(
                  e.target.value === "new"
                    ? { mode: "new", name: `${sourceName} Import` }
                    : { mode: "single", vaultId: e.target.value },
                )
              }
              className="h-10 min-w-56 rounded-lg border border-border-strong bg-surface px-3 text-sm shadow-xs disabled:opacity-50"
            >
              {vaults.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
              <option value="new">{t("import.vault.new")}</option>
            </select>
            {vault.mode === "new" && (
              <Input
                label={t("import.vault.newName")}
                hideLabel
                placeholder={t("import.vault.newName")}
                value={vault.name}
                onChange={(e) => setVault({ mode: "new", name: e.target.value })}
              />
            )}
          </div>
        </div>
      </section>

      <section className="rounded-card border border-border bg-surface p-5 shadow-card" aria-labelledby="import-dups">
        {duplicates.length === 0 ? (
          <p id="import-dups" className="flex items-center gap-2 text-sm text-text-muted">
            <CircleCheck className="size-4 text-success" aria-hidden="true" />
            {t("import.duplicates.none")}
          </p>
        ) : (
          <>
            <h2 id="import-dups" className="text-sm font-semibold">
              {plural(t, "import.duplicates.title", duplicates.length)}
            </h2>
            <p className="mt-1 text-[13px] text-text-muted">{t("import.duplicates.description")}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="text-[13px] font-medium">{t("import.duplicates.all")}</span>
              <SegmentedControl<DuplicateDecision>
                label={t("import.duplicates.all")}
                value={allDecision}
                onChange={setAllDecision}
                options={(["skip", "update", "keep"] as const).map((value) => ({
                  value,
                  label: t(`decision.${value}`),
                }))}
              />
            </div>
            <label className="mt-3 flex items-center gap-2 text-[13px]">
              <input
                type="checkbox"
                className="size-4 accent-[var(--color-accent)]"
                checked={perItem}
                onChange={(e) => setPerItem(e.target.checked)}
              />
              {t("import.duplicates.perItem")}
            </label>
            {perItem && (
              <DecisionTable
                t={t}
                result={result}
                duplicates={duplicates}
                existing={existingById}
                decisionFor={(i) => decisionFor(i) ?? "skip"}
                onDecision={(index, decision) => setDecisions(new Map(decisions).set(index, decision))}
              />
            )}
          </>
        )}
      </section>

      <div className="flex flex-wrap justify-between gap-2">
        <Button variant="secondary" onClick={onBack}>
          <ArrowLeft />
          {t("import.changeSource")}
        </Button>
        <Button size="lg" onClick={start} disabled={!canStart}>
          {plural(t, "import.start", toImport)}
        </Button>
      </div>
    </div>
  );
}

function PreviewTable({ t, result }: { t: Translate; result: ImportResult }) {
  const rows = result.items.slice(0, PREVIEW_ROWS);
  return (
    <div className="mt-5">
      <h3 className="mb-2 text-2xs font-semibold tracking-wide text-text-subtle uppercase">
        {t("import.review.preview")}
      </h3>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[32rem] text-left text-[13px]">
          <thead className="bg-surface-sunken text-xs text-text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">{t("import.col.name")}</th>
              <th className="px-3 py-2 font-medium">{t("import.col.username")}</th>
              <th className="px-3 py-2 font-medium">{t("import.col.website")}</th>
              <th className="px-3 py-2 font-medium">{t("import.col.type")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map(({ data }, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: preview rows have no ID
              <tr key={i}>
                <td className="max-w-48 truncate px-3 py-2 font-medium">{data.title}</td>
                <td className="max-w-48 truncate px-3 py-2">{fieldValue(data, FIELD.username) ?? ""}</td>
                <td className="max-w-56 truncate px-3 py-2 text-text-muted">{fieldValue(data, FIELD.url) ?? ""}</td>
                <td className="px-3 py-2 text-text-muted">{t(`kind.${data.category}` as MessageKey)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {result.items.length > rows.length && (
        <p className="mt-2 text-xs text-text-muted">
          {t("import.review.more", { count: result.items.length - rows.length })}
        </p>
      )}
    </div>
  );
}

function DecisionTable({
  t,
  result,
  duplicates,
  existing,
  decisionFor,
  onDecision,
}: {
  t: Translate;
  result: ImportResult;
  duplicates: DuplicateMatch[];
  existing: Map<string, Item>;
  decisionFor: (index: number) => DuplicateDecision;
  onDecision: (index: number, decision: DuplicateDecision) => void;
}) {
  const [limit, setLimit] = useState(DECISION_ROWS);
  return (
    <div className="mt-3">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[36rem] text-left text-[13px]">
          <thead className="bg-surface-sunken text-xs text-text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">{t("import.col.name")}</th>
              <th className="px-3 py-2 font-medium">{t("import.col.username")}</th>
              <th className="px-3 py-2 font-medium">{t("import.col.decision")}</th>
              <th className="px-3 py-2 font-medium">
                <span className="sr-only">{t("import.duplicates.all")}</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {duplicates.slice(0, limit).map(({ index, existingId }) => {
              const data = result.items[index]?.data;
              if (!data) return null;
              return (
                <tr key={index}>
                  <td className="max-w-48 truncate px-3 py-2 font-medium">{data.title}</td>
                  <td className="max-w-48 truncate px-3 py-2">{fieldValue(data, FIELD.username) ?? ""}</td>
                  <td className="max-w-48 truncate px-3 py-2 text-text-muted">
                    {existing.get(existingId)?.data.title}
                  </td>
                  <td className="px-3 py-1.5">
                    <select
                      aria-label={`${data.title}: ${t("import.col.decision")}`}
                      value={decisionFor(index)}
                      onChange={(e) => onDecision(index, e.target.value as DuplicateDecision)}
                      className="h-9 rounded-lg border border-border-strong bg-surface px-2 text-[13px]"
                    >
                      {(["skip", "update", "keep"] as const).map((d) => (
                        <option key={d} value={d}>
                          {t(`decision.${d}`)}
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
      {duplicates.length > limit && (
        <Button variant="ghost" size="sm" className="mt-2" onClick={() => setLimit(limit + DECISION_ROWS)}>
          {t("import.review.more", { count: duplicates.length - limit })}
        </Button>
      )}
    </div>
  );
}

function ProgressStep({ t, done, total, onStop }: { t: Translate; done: number; total: number; onStop: () => void }) {
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <section className="max-w-xl rounded-card border border-border bg-surface p-6 shadow-card" aria-live="polite">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <Spinner label="" />
        {t("import.progress.title")}
      </h2>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-label={t("import.progress.title")}
        className="mt-4 h-2 overflow-hidden rounded-full bg-surface-sunken"
      >
        <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-2 text-sm text-text-muted">
        {t("import.progress.count", { done, total })} · {percent} %
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-text-muted">{t("import.progress.keepOpen")}</p>
        <Button variant="secondary" size="sm" onClick={onStop}>
          {t("import.progress.stop")}
        </Button>
      </div>
    </section>
  );
}

function DoneStep({
  t,
  summary,
  source,
  onShowItems,
  onAnother,
}: {
  t: Translate;
  summary: Summary;
  source: ImportSource | undefined;
  onShowItems: () => void;
  onAnother: () => void;
}) {
  const plain = summary.format !== "passbox";
  const csv = summary.format.endsWith("csv");
  const lines: [string, ReactNode][] = [
    ["created", t("import.done.created", { count: summary.created })],
    ...(summary.updated
      ? [["updated", t("import.done.updated", { count: summary.updated })] as [string, ReactNode]]
      : []),
    ...(summary.skipped
      ? [["skipped", t("import.done.skipped", { count: summary.skipped })] as [string, ReactNode]]
      : []),
  ];
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <section className="rounded-card border border-border bg-surface p-6 shadow-card" aria-labelledby="import-done">
        <h2 id="import-done" className="flex items-center gap-2 text-lg font-semibold">
          <CircleCheck className="size-5 text-success" aria-hidden="true" />
          {t(summary.stopped ? "import.done.stopped" : "import.done.title")}
        </h2>
        <ul className="mt-3 flex flex-col gap-1 text-sm">
          {lines.map(([key, text]) => (
            <li key={key}>{text}</li>
          ))}
          {summary.failed.length > 0 && (
            <li className="text-danger">
              {t("import.done.failed", { count: summary.failed.length })}:{" "}
              {summary.failed
                .slice(0, 5)
                .map((f) => f.title)
                .join(", ")}
            </li>
          )}
        </ul>
        <p className="mt-2 text-xs text-text-muted">{t("import.done.time", { seconds: summary.seconds })}</p>
      </section>

      {plain && (
        <section role="alert" className="flex gap-3 rounded-card border border-warning/40 bg-warning-soft p-5">
          <Trash2 className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden="true" />
          <div className="text-sm">
            <p className="font-semibold">{t(csv ? "import.done.deleteCsv" : "import.done.deleteFile")}</p>
            <p className="mt-1 text-text-muted">{t("import.done.deleteHint")}</p>
          </div>
        </section>
      )}
      {source?.browser && (
        <p className="rounded-card border border-border bg-surface p-4 text-[13px] text-text-muted">
          {t("import.done.browserTip", { source: source.name })}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button onClick={onShowItems}>{t("import.done.show")}</Button>
        <Button variant="secondary" onClick={onAnother}>
          {t("import.done.another")}
        </Button>
      </div>
    </div>
  );
}
