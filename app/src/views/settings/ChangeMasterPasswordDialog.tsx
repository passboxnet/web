import { Button, Dialog, PasswordInput, toast } from "@passbox/ui";
import { Info } from "lucide-react";
import { type FormEvent, useState } from "react";
import { FormError } from "../../auth/AuthLayout";
import { errorMessage, nextFrame } from "../../core";
import { PasswordStrength } from "../../items/PasswordStrength";
import { useI18n } from "../../lib/i18n";
import { meetsPasswordPolicy, useServerMeta } from "../../lib/instance";
import { useClient, useSnapshot } from "../../useClient";

/** Changes the master password (S10). The Secret Key stays; other devices are signed out. */
export function ChangeMasterPasswordDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const client = useClient();
  const { email = "" } = useSnapshot();
  const { t } = useI18n();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const policy = useServerMeta()?.passwordPolicy;

  function reset() {
    setCurrent("");
    setNext("");
    setConfirm("");
    setError(undefined);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(undefined);
    const verdict = meetsPasswordPolicy(next, client.estimateStrength(next, [email]), policy);
    if (verdict === "weak") {
      setError(t("signUp.tooWeak"));
      return;
    }
    if (verdict === "policy" && policy) {
      setError(t("signUp.policy", { length: policy.minLength, strength: t(`strength.${policy.minScore}`) }));
      return;
    }
    if (next !== confirm) {
      setError(t("signUp.mismatch"));
      return;
    }
    if (next === current) {
      setError(t("changeMaster.same"));
      return;
    }
    setBusy(true);
    await nextFrame();
    try {
      // Checked on this device first: a wrong password must not lock the vault.
      if (!(await client.verifyMasterPassword(current))) {
        setError(t("error.wrongMasterPassword"));
        return;
      }
      await client.changeMasterPassword(current, next);
      toast.success(t("changeMaster.done"), { description: t("changeMaster.doneHint") });
      reset();
      onOpenChange(false);
    } catch (e) {
      setError(errorMessage(e, "unlock"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) reset();
        onOpenChange(isOpen);
      }}
      title={t("changeMaster.title")}
      description={t("changeMaster.description")}
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <PasswordInput
          label={t("changeMaster.current")}
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          required
          autoFocus
        />
        <div className="flex flex-col gap-2">
          <PasswordInput
            label={t("changeMaster.new")}
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            required
          />
          {next && <PasswordStrength password={next} context={[email]} master />}
        </div>
        <PasswordInput
          label={t("changeMaster.confirm")}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
        <p className="flex items-start gap-2 rounded-lg bg-surface-sunken px-3 py-2.5 text-[0.8125rem]">
          <Info className="mt-0.5 size-4 shrink-0 text-text-muted" aria-hidden="true" />
          {t("changeMaster.note")}
        </p>
        <FormError message={error} />
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t("action.cancel")}
          </Button>
          <Button type="submit" loading={busy}>
            {t("changeMaster.submit")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
