import { canExportVault } from "@passbox/client";
import { countExportItems, createCsvExport, createEncryptedExport, exportFileName } from "@passbox/client/export";
import { Button, cn, Dialog, PasswordInput, StrengthMeter, Switch, toast } from "@passbox/ui";
import { Lock, ShieldAlert, ShieldCheck } from "lucide-react";
import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { errorMessage, loadCore, nextFrame } from "../core";
import { plural, translator } from "../import/messages";
import { useClient, useSnapshot } from "../useClient";
import { downloadFile } from "./download";

type Kind = "encrypted" | "csv";

/** Encrypted exports need at least this zxcvbn score. */
const MIN_EXPORT_SCORE = 3;

export function ExportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useMemo(() => translator(), []);
  const client = useClient();
  const snapshot = useSnapshot();
  const [kind, setKind] = useState<Kind>("encrypted");
  const [vaultIds, setVaultIds] = useState<string[]>([]);
  const [includeTrash, setIncludeTrash] = useState(false);
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [master, setMaster] = useState("");
  const [masterError, setMasterError] = useState<string>();
  const [busy, setBusy] = useState(false);

  // Start fresh every time the dialog opens; never keep passwords around.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset only when opened
  useEffect(() => {
    if (!open) return;
    setKind("encrypted");
    // Policy D2: organizations can forbid exporting their vaults.
    setVaultIds(snapshot.vaults.filter((v) => canExportVault(snapshot.effectivePolicy, v)).map((v) => v.id));
    setIncludeTrash(false);
    setPassword("");
    setRepeat("");
    setAcknowledged(false);
    setMaster("");
    setMasterError(undefined);
  }, [open]);

  const blockedVaults = snapshot.vaults.filter((v) => !canExportVault(snapshot.effectivePolicy, v)).length;
  const options = {
    vaultIds: vaultIds.filter((id) =>
      canExportVault(snapshot.effectivePolicy, snapshot.vaults.find((v) => v.id === id) ?? {}),
    ),
    includeTrash,
  };
  const count = countExportItems(snapshot, options);
  const strength = kind === "encrypted" && password ? client.estimateStrength(password) : undefined;
  const mismatch = repeat !== "" && repeat !== password;
  const ready =
    count > 0 &&
    master !== "" &&
    (kind === "csv"
      ? acknowledged
      : password !== "" && repeat === password && (strength?.score ?? 0) >= MIN_EXPORT_SCORE);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!ready) return;
    setBusy(true);
    setMasterError(undefined);
    try {
      await nextFrame();
      if (!(await client.verifyMasterPassword(master))) {
        setMasterError(t("export.masterPasswordWrong"));
        return;
      }
      const name = exportFileName(kind);
      if (kind === "encrypted") {
        const core = await loadCore();
        await nextFrame();
        downloadFile(name, createEncryptedExport(core, snapshot, password, options), "application/json");
        toast.success(t("export.done", { name }));
      } else {
        downloadFile(name, createCsvExport(snapshot, options), "text/csv");
        toast.success(t("export.done", { name }), { description: t("export.doneCsv", { name }) });
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(t("export.failed", { message: errorMessage(error) }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("export.title")}
      description={t("export.description")}
      size="lg"
    >
      <form onSubmit={submit} className="flex flex-col gap-5">
        <fieldset className="grid gap-2 sm:grid-cols-2">
          <legend className="sr-only">{t("export.title")}</legend>
          <KindOption
            checked={kind === "encrypted"}
            onSelect={() => setKind("encrypted")}
            icon={<ShieldCheck className="size-5 text-success" aria-hidden="true" />}
            title={t("export.kind.encrypted")}
            description={t("export.kind.encryptedHint")}
          />
          <KindOption
            checked={kind === "csv"}
            onSelect={() => setKind("csv")}
            icon={<ShieldAlert className="size-5 text-danger" aria-hidden="true" />}
            title={t("export.kind.csv")}
            description={t("export.kind.csvHint")}
          />
        </fieldset>

        {blockedVaults > 0 && (
          <p role="status" className="rounded-lg border border-warning/30 bg-warning-soft px-3 py-2 text-[13px]">
            {t("orgAdmin.export.blocked", { count: blockedVaults })}
          </p>
        )}
        {snapshot.vaults.length > 1 && (
          <fieldset>
            <legend className="mb-2 text-[13px] font-medium">{t("export.vaults")}</legend>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {snapshot.vaults.map((vault) => (
                <label key={vault.id} className="flex min-h-8 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 accent-control"
                    checked={vaultIds.includes(vault.id)}
                    disabled={!canExportVault(snapshot.effectivePolicy, vault)}
                    onChange={(e) =>
                      setVaultIds(e.target.checked ? [...vaultIds, vault.id] : vaultIds.filter((id) => id !== vault.id))
                    }
                  />
                  {vault.name}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <Switch label={t("export.includeTrash")} checked={includeTrash} onCheckedChange={setIncludeTrash} />
        <p className="text-sm font-medium" aria-live="polite">
          {plural(t, "export.count", count)}
        </p>

        {kind === "encrypted" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <PasswordInput
                label={t("export.password")}
                hint={t("export.passwordHint")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
              {strength && <StrengthMeter score={strength.score} label={strength.label} />}
              {strength && strength.score < MIN_EXPORT_SCORE && (
                <p className="text-xs text-danger">{t("export.passwordWeak")}</p>
              )}
            </div>
            <PasswordInput
              label={t("export.passwordRepeat")}
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
              error={mismatch ? t("export.passwordMismatch") : undefined}
              autoComplete="new-password"
            />
          </div>
        ) : (
          <div role="alert" className="rounded-card border border-danger/30 bg-danger-soft p-4 text-sm">
            <p className="font-semibold">{t("export.csvWarningTitle")}</p>
            <p className="mt-1 text-text-muted">{t("export.csvWarning")}</p>
            <label className="mt-3 flex min-h-8 items-center gap-2 font-medium">
              <input
                type="checkbox"
                className="size-4 accent-danger"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
              />
              {t("export.csvConfirm")}
            </label>
          </div>
        )}

        <PasswordInput
          label={t("export.masterPassword")}
          hint={t("export.masterPasswordHint")}
          value={master}
          onChange={(e) => {
            setMaster(e.target.value);
            setMasterError(undefined);
          }}
          error={masterError}
          autoComplete="current-password"
        />

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t("export.cancel")}
          </Button>
          <Button type="submit" variant={kind === "csv" ? "danger" : "primary"} loading={busy} disabled={!ready}>
            <Lock />
            {busy && kind === "encrypted" ? t("export.working") : t("export.submit")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function KindOption({
  checked,
  onSelect,
  icon,
  title,
  description,
}: {
  checked: boolean;
  onSelect: () => void;
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer gap-3 rounded-card border p-4 transition-colors",
        "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus",
        checked
          ? "border-selection-marker ring-2 ring-selection-marker/25"
          : "border-border hover:border-border-strong",
      )}
    >
      <input type="radio" name="export-kind" className="sr-only" checked={checked} onChange={onSelect} />
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span>
        <span className="block text-sm font-semibold">{title}</span>
        <span className="mt-1 block text-xs text-text-muted">{description}</span>
      </span>
    </label>
  );
}
