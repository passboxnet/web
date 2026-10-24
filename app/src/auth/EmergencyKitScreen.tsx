import { Badge, Button, Input, Logo, toast } from "@passbox/ui";
import { CheckCircle2, Download, KeyRound, Printer, ShieldAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { useI18n } from "../lib/i18n";
import { downloadEmergencyKit, KIT_CHECK_LENGTH, type KitData, matchesKitCheck } from "../lib/kit";
import { serverUrl } from "../lib/server";
import { useClient, useSnapshot } from "../useClient";
import { useKit } from "./KitProvider";

/**
 * The Emergency Kit: what the two keys are, the kit itself (download as PDF
 * or print), and a check of the last characters of the Secret Key before the
 * vault opens. The Secret Key is needed to sign in on new devices and cannot
 * be recovered by the server.
 */
export function EmergencyKitScreen() {
  const client = useClient();
  const { email = "" } = useSnapshot();
  const i18n = useI18n();
  const { t } = i18n;
  const kit = useKit();
  const secretKey = client.deviceAccount?.secretKey ?? "";
  const [check, setCheck] = useState("");
  const verified = matchesKitCheck(secretKey, check);
  const typedEnough = check.replace(/[\s-]/g, "").length >= KIT_CHECK_LENGTH;
  const data: KitData = useMemo(
    () => ({ email, secretKey, server: serverUrl() ?? window.location.origin, createdAt: Date.now() }),
    [email, secretKey],
  );
  const needsCheck = kit.pending;

  function download() {
    downloadEmergencyKit(data, i18n);
    toast.success(t("kit.downloaded"), { description: t("kit.downloadedHint") });
  }

  function finish() {
    if (needsCheck) {
      if (!verified) return;
      kit.confirm();
      toast.success(t("kit.done"));
    }
    kit.close();
  }

  return (
    <main className="flex min-h-full justify-center bg-canvas px-4 py-10 print:block print:bg-white print:p-0">
      <div className="w-full max-w-2xl">
        <div className="mb-6 flex items-center justify-between print:hidden">
          <Logo className="text-text" />
          {kit.mode === "onboarding" && <Badge tone="success">{t("kit.badge.created")}</Badge>}
        </div>

        <div className="mb-6 print:hidden">
          <h1 className="text-2xl font-semibold tracking-tight">{t("kit.title")}</h1>
          <div className="mt-4 flex gap-4 rounded-card border border-accent/20 bg-accent-soft p-5">
            <KeyRound className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden="true" />
            <div className="text-sm leading-relaxed">
              <p className="font-semibold">{t("kit.explain.title")}</p>
              <p className="mt-1">{t("kit.explain.body")}</p>
              <p className="mt-2 text-text-muted">{t("kit.explain.noRecovery")}</p>
            </div>
          </div>
        </div>

        <section
          aria-labelledby="kit-title"
          className="overflow-hidden rounded-card border border-border bg-surface shadow-card print:border-0 print:shadow-none"
        >
          <div className="border-b border-border bg-surface-raised px-6 py-5 sm:px-8">
            <p className="text-2xs font-semibold tracking-wider text-accent uppercase">Passbox</p>
            <h2 id="kit-title" className="mt-1 text-xl font-semibold tracking-tight">
              {t("kit.card.heading")}
            </h2>
            <p className="mt-1 text-xs text-text-muted">{t("kit.card.created", { date: i18n.date(data.createdAt) })}</p>
          </div>
          <dl className="grid gap-px bg-border sm:grid-cols-2">
            <KitField label={t("kit.field.server")} value={data.server} />
            <KitField label={t("kit.field.email")} value={email} />
            <div className="bg-surface px-6 py-5 sm:col-span-2 sm:px-8">
              <dt className="text-2xs font-semibold tracking-wider text-text-muted uppercase">{t("term.secretKey")}</dt>
              <dd
                className="mt-2 font-mono text-xl font-medium tracking-wide break-all text-text sm:text-2xl"
                data-testid="secret-key"
              >
                {secretKey}
              </dd>
            </div>
            <div className="bg-surface px-6 py-5 sm:col-span-2 sm:px-8">
              <dt className="text-2xs font-semibold tracking-wider text-text-muted uppercase">
                {t("term.masterPassword")}
              </dt>
              <dd className="mt-8 border-b border-dashed border-border-strong">
                <span className="sr-only">{t("kit.field.passwordLine")}</span>
              </dd>
            </div>
            <div className="bg-surface px-6 py-5 sm:col-span-2 sm:px-8">
              <dt className="text-sm font-semibold">{t("kit.steps.title")}</dt>
              <dd>
                <ol className="mt-2 flex list-decimal flex-col gap-1 pl-5 text-sm text-text-muted">
                  <li>{t("kit.steps.1", { server: data.server })}</li>
                  <li>{t("kit.steps.2")}</li>
                  <li>{t("kit.steps.3")}</li>
                </ol>
              </dd>
            </div>
          </dl>
          <div className="flex items-start gap-3 border-t border-border bg-warning-soft px-6 py-4 text-[0.8125rem] text-text sm:px-8">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
            {t("kit.storage")}
          </div>
        </section>

        <div className="mt-6 flex flex-wrap gap-2 print:hidden">
          <Button size="lg" onClick={download}>
            <Download />
            {t("kit.download")}
          </Button>
          <Button size="lg" variant="secondary" onClick={() => window.print()}>
            <Printer />
            {t("kit.print")}
          </Button>
        </div>

        {needsCheck ? (
          <section
            aria-labelledby="kit-check"
            className="mt-6 rounded-card border border-border bg-surface p-5 shadow-card print:hidden"
          >
            <h2 id="kit-check" className="text-sm font-semibold">
              {t("kit.check.title")}
            </h2>
            <form
              className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end"
              onSubmit={(event) => {
                event.preventDefault();
                finish();
              }}
            >
              <div className="flex-1">
                <Input
                  label={t("kit.check.label", { count: KIT_CHECK_LENGTH })}
                  value={check}
                  onChange={(e) => setCheck(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={8}
                  className="max-w-48 font-mono tracking-widest uppercase"
                  error={typedEnough && !verified ? t("kit.check.wrong") : undefined}
                  hint={
                    verified ? (
                      <span className="flex items-center gap-1 text-success-text">
                        <CheckCircle2 className="size-3.5" aria-hidden="true" />
                        {t("kit.check.ok")}
                      </span>
                    ) : undefined
                  }
                />
              </div>
              <Button type="submit" size="lg" disabled={!verified}>
                {t("kit.continue")}
              </Button>
            </form>
            {kit.mode === "onboarding" && (
              <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={kit.later}
                  className="text-[0.8125rem] text-text-muted underline underline-offset-4 hover:text-text"
                >
                  {t("kit.later")}
                </button>
                <span className="text-xs text-text-muted">{t("kit.laterHint")}</span>
              </div>
            )}
            {kit.mode === "review" && (
              <div className="mt-4 border-t border-border pt-4">
                <Button variant="ghost" onClick={kit.close}>
                  {t("kit.close")}
                </Button>
              </div>
            )}
          </section>
        ) : (
          <div className="mt-6 flex justify-end print:hidden">
            <Button size="lg" onClick={kit.close}>
              {t("kit.close")}
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}

function KitField({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface px-6 py-5 sm:px-8">
      <dt className="text-2xs font-semibold tracking-wider text-text-muted uppercase">{label}</dt>
      {/* Never truncate: a cut-off email or address is useless when you need the kit. */}
      <dd className="mt-1.5 font-mono text-sm break-all">{value}</dd>
    </div>
  );
}
