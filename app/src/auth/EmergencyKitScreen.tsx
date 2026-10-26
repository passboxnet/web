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
  const recoveryCode = kit.recoveryCode;
  const checkingCode = kit.mode === "recoveryCode" && recoveryCode !== undefined;
  const [check, setCheck] = useState("");
  const verified = matchesKitCheck(checkingCode ? recoveryCode : secretKey, check);
  const typedEnough = check.replace(/[\s-]/g, "").length >= KIT_CHECK_LENGTH;
  const data: KitData = useMemo(
    () => ({
      email,
      secretKey,
      server: serverUrl() ?? window.location.origin,
      createdAt: Date.now(),
      ...(recoveryCode ? { recoveryCode } : {}),
    }),
    [email, secretKey, recoveryCode],
  );
  const needsCheck = kit.pending || checkingCode;

  function download() {
    downloadEmergencyKit(data, i18n);
    toast.success(t("kit.downloaded"), { description: t("kit.downloadedHint") });
  }

  function finish() {
    if (needsCheck) {
      if (!verified) return;
      if (kit.pending) kit.confirm();
      toast.success(checkingCode ? t("recoveryCode.saved") : t("kit.done"));
    }
    kit.close();
  }

  return (
    <main className="relative isolate flex min-h-full justify-center bg-backdrop px-4 py-10 print:block print:bg-white print:p-0">
      <div aria-hidden="true" className="grain pointer-events-none absolute inset-0 -z-10 print:hidden" />
      <div className="w-full max-w-2xl">
        <div className="mb-6 flex items-center justify-between print:hidden">
          <Logo className="text-white" />
          {kit.mode === "onboarding" && (
            <Badge tone="success">{kit.recovered ? t("kit.badge.recovered") : t("kit.badge.created")}</Badge>
          )}
          {checkingCode && <Badge tone="success">{t("kit.badge.recoveryCode")}</Badge>}
        </div>

        <div className="mb-6 print:hidden">
          <h1 className="text-title text-white">{kit.recovered ? t("kit.titleRecovered") : t("kit.title")}</h1>
          {kit.recovered && (
            <p role="status" className="mt-2 text-sm text-white/80">
              {t("kit.recoveredHint")}
            </p>
          )}
          <div className="mt-4 flex gap-4 rounded-card border border-hairline bg-surface p-5 shadow-raised">
            <KeyRound className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden="true" />
            <div className="text-sm leading-relaxed">
              <p className="font-semibold">{t("kit.explain.title")}</p>
              <p className="mt-1">{t("kit.explain.body")}</p>
              <p className="mt-2 text-text-muted">
                {recoveryCode ? t("kit.explain.withRecoveryCode") : t("kit.explain.noRecovery")}
              </p>
            </div>
          </div>
        </div>

        <section
          aria-labelledby="kit-title"
          className="overflow-hidden rounded-panel border border-hairline bg-surface shadow-raised print:border-0 print:shadow-none"
        >
          <div className="relative bg-signature px-6 py-6 text-white shadow-[inset_0_-3px_0_0_var(--color-marina-lip)] sm:px-8 print:bg-none print:text-black print:shadow-none">
            <Logo className="text-white print:text-black" />
            <h2 id="kit-title" className="mt-4 text-title-sm">
              {t("kit.card.heading")}
            </h2>
            <p className="mt-1 text-caption text-white/80 print:text-black">
              {t("kit.card.created", { date: i18n.date(data.createdAt) })}
            </p>
          </div>
          <dl className="grid gap-px bg-hairline sm:grid-cols-2">
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
            {recoveryCode && (
              <div className="bg-success-soft px-6 py-5 sm:col-span-2 sm:px-8">
                <dt className="text-2xs font-semibold tracking-wider text-success-text uppercase">
                  {t("kit.field.recoveryCode")}
                </dt>
                <dd
                  className="mt-2 font-mono text-base font-medium tracking-wide text-text sm:text-lg"
                  data-testid="recovery-code"
                >
                  {/* Lines break only after a dash, never inside a group. */}
                  {recoveryCode.split(/(?<=-)/).map((group, index) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: groups can repeat and never move
                    <span key={index}>
                      {group}
                      <wbr />
                    </span>
                  ))}
                </dd>
                <dd className="mt-2 text-xs text-text-muted">{t("kit.recoveryCodeHint")}</dd>
              </div>
            )}
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
          <Button size="lg" shape="pill" onClick={download}>
            <Download />
            {t("kit.download")}
          </Button>
          <Button size="lg" shape="pill" variant="secondary" onClick={() => window.print()}>
            <Printer />
            {t("kit.print")}
          </Button>
        </div>

        {needsCheck ? (
          <section
            aria-labelledby="kit-check"
            className="mt-6 rounded-card border border-hairline bg-surface p-5 shadow-raised print:hidden"
          >
            <h2 id="kit-check" className="text-sm font-semibold">
              {checkingCode ? t("recoveryCode.checkTitle") : t("kit.check.title")}
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
                  label={
                    checkingCode
                      ? t("recoveryCode.checkLabel", { count: KIT_CHECK_LENGTH })
                      : t("kit.check.label", { count: KIT_CHECK_LENGTH })
                  }
                  value={check}
                  onChange={(e) => setCheck(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={8}
                  className="max-w-48 font-mono tracking-widest uppercase"
                  error={
                    typedEnough && !verified
                      ? checkingCode
                        ? t("recoveryCode.checkWrong")
                        : t("kit.check.wrong")
                      : undefined
                  }
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
              <Button type="submit" size="lg" shape="pill" disabled={!verified}>
                {checkingCode ? t("recoveryCode.done") : t("kit.continue")}
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
            {(kit.mode === "review" || checkingCode) && (
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
