import { FIELD, fieldValue, type Item } from "@passbox/client";
import { Button, cn, Dialog, toast } from "@passbox/ui";
import { Check, Copy, ExternalLink, RefreshCw } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { errorMessage, loadCore } from "../core";
import { copyToClipboard } from "../lib/clipboard";
import { useI18n } from "../lib/i18n";
import { hostname, itemTitle, safeHref } from "../lib/items";
import { useClient } from "../useClient";
import { ColoredPassword } from "./ColoredPassword";

/**
 * New passwords that were generated but not confirmed yet, per item. They
 * live in memory only and are forgotten on lock, but survive closing the
 * dialog: the user may already have set the new password on the website.
 */
const drafts = new Map<string, string>();

export function clearPasswordDrafts() {
  drafts.clear();
}

/**
 * Guided password change (business P0-3): open the website and sign in with
 * the old password, set the new one there, then confirm. The vault only
 * changes after "Yes, save"; until then the old password stays.
 */
export function ChangePasswordDialog({
  item,
  open,
  onOpenChange,
}: {
  item: Item;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const client = useClient();
  const { t } = useI18n();
  const [step, setStep] = useState(1);
  const [next, setNext] = useState(() => drafts.get(item.id));
  const [busy, setBusy] = useState(false);
  const url = fieldValue(item.data, FIELD.url);
  const href = url ? safeHref(url) : undefined;
  const oldPassword = fieldValue(item.data, FIELD.password) ?? "";

  async function generate() {
    const core = await loadCore();
    const value = core.generatePassword(JSON.stringify({ length: 20, avoidAmbiguous: true }));
    drafts.set(item.id, value);
    setNext(value);
  }

  useEffect(() => {
    if (open) setStep(drafts.has(item.id) ? 2 : 1);
  }, [open, item.id]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: generate once when step 2 starts
  useEffect(() => {
    if (step === 2 && !next) void generate();
  }, [step]);

  async function save() {
    if (!next) return;
    setBusy(true);
    try {
      await client.updateItem(item.id, {
        ...item.data,
        fields: item.data.fields.map((field) => (field.id === FIELD.password ? { ...field, value: next } : field)),
      });
      drafts.delete(item.id);
      toast.success(t("change.saved"), { description: t("change.savedHint") });
      onOpenChange(false);
    } catch (error) {
      toast.error(t("change.saveFailed"), { description: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  function keepOld() {
    drafts.delete(item.id);
    setNext(undefined);
    onOpenChange(false);
    toast(t("change.kept"));
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("change.title", { name: itemTitle(item, t) })}
      description={t("change.description")}
    >
      <ol className="flex flex-col gap-4">
        <Step number={1} active={step === 1} done={step > 1} title={t("change.step1.title")}>
          <p>{t("change.step1.text", { site: hostname(url) ?? t("change.theWebsite") })}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {href && (
              <Button size="sm" variant="secondary" onClick={() => window.open(href, "_blank", "noopener")}>
                <ExternalLink />
                {t("change.openWebsite")}
              </Button>
            )}
            {oldPassword && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => copyToClipboard(oldPassword, t("change.oldPassword"))}
              >
                <Copy />
                {t("change.copyOld")}
              </Button>
            )}
            <Button size="sm" onClick={() => setStep(2)}>
              {t("action.continue")}
            </Button>
          </div>
        </Step>
        <Step number={2} active={step === 2} done={step > 2} title={t("change.step2.title")}>
          <p>{t("change.step2.text")}</p>
          {next && (
            <p className="mt-3 rounded-lg bg-surface-sunken px-3 py-2 font-mono text-[0.9375rem] break-all">
              <ColoredPassword value={next} />
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => void generate()}>
              <RefreshCw />
              {t("change.regenerate")}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={!next}
              onClick={() => next && copyToClipboard(next, t("change.newPassword"))}
            >
              <Copy />
              {t("change.copyNew")}
            </Button>
            <Button size="sm" onClick={() => setStep(3)} disabled={!next}>
              {t("action.continue")}
            </Button>
          </div>
        </Step>
        <Step number={3} active={step === 3} done={false} title={t("change.step3.title")}>
          <p>{t("change.step3.text")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void save()} loading={busy}>
              <Check />
              {t("change.yes")}
            </Button>
            <Button size="sm" variant="secondary" onClick={keepOld}>
              {t("change.no")}
            </Button>
          </div>
        </Step>
      </ol>
    </Dialog>
  );
}

function Step({
  number,
  active,
  done,
  title,
  children,
}: {
  number: number;
  active: boolean;
  done: boolean;
  title: string;
  children: ReactNode;
}) {
  return (
    <li className={cn("flex gap-3", !active && "opacity-60")} aria-current={active ? "step" : undefined}>
      <span
        aria-hidden="true"
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
          done ? "bg-success-soft text-success-text" : active ? "bg-accent text-accent-contrast" : "bg-surface-sunken",
        )}
      >
        {done ? <Check className="size-3.5" /> : number}
      </span>
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold">{title}</p>
        {active && <div className="mt-1 text-text-muted">{children}</div>}
      </div>
    </li>
  );
}
