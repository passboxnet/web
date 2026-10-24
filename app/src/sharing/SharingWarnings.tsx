import type { Org, SharingWarning } from "@passbox/client";
import { Button, Dialog, toast } from "@passbox/ui";
import { ChevronRight, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { type Translator, useI18n } from "../lib/i18n";
import { bannerWarnings, memberLabel, warningCategory } from "../lib/sharing";
import { useClient, useSnapshot } from "../useClient";
import { displayVaultName, orgName, SecurityCode, sharingError } from "./common";

/**
 * Problems the core found while verifying sharing data. Calm, but it stays
 * until the cause is gone: a changed key needs a comparison, refused data
 * needs an admin.
 */
export function SharingWarningsBanner() {
  const { t } = useI18n();
  const { sharingWarnings } = useSnapshot();
  const [open, setOpen] = useState(false);
  const warnings = bannerWarnings(sharingWarnings);
  if (warnings.length === 0) return null;
  const first = warnings[0] as SharingWarning;
  const category = warningCategory(first);

  return (
    <>
      <div
        role="status"
        className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-warning/30 bg-warning-soft px-4 py-2.5 text-[0.8125rem]"
      >
        <ShieldAlert className="size-4 shrink-0 text-warning" aria-hidden="true" />
        <p className="min-w-0 flex-1">
          <strong className="font-semibold">{t(`sharing.warning.banner.${category}`)}</strong>
          {warnings.length > 1 && (
            <span className="text-text-muted"> · {t("sharing.warning.more", { count: warnings.length - 1 })}</span>
          )}
        </p>
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
          {t("sharing.warning.details")}
        </Button>
      </div>
      <WarningsDialog warnings={warnings} open={open} onOpenChange={setOpen} />
    </>
  );
}

function WarningsDialog({
  warnings,
  open,
  onOpenChange,
}: {
  warnings: SharingWarning[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useI18n();
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("sharing.warning.title")}
      description={t("sharing.warning.intro")}
      size="lg"
    >
      <ul className="flex flex-col gap-3">
        {warnings.map((warning) => (
          <li key={`${warning.kind}:${warning.subjectId}`}>
            <WarningItem warning={warning} />
          </li>
        ))}
      </ul>
    </Dialog>
  );
}

function WarningItem({ warning }: { warning: SharingWarning }) {
  const client = useClient();
  const { t } = useI18n();
  const { orgs, vaults } = useSnapshot();
  const [comparing, setComparing] = useState(false);
  const category = warningCategory(warning);
  const org = orgs.find((o) => o.id === warning.orgId) ?? orgs.find((o) => o.id === warning.subjectId);
  const subject = describeSubject(warning, org, orgs, vaults, t);

  function accept() {
    try {
      client.acceptKeyChange(warning.subjectId);
      toast.success(t("sharing.keyChange.accepted", { name: subject }));
    } catch (e) {
      toast.error(sharingError(e, t));
    }
  }

  const member = org?.members.find((m) => m.accountId === warning.subjectId);
  let own: string | undefined;
  try {
    own = client.ownFingerprint();
  } catch {
    own = undefined;
  }

  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-3 text-[0.8125rem]">
      <p className="font-medium">{t(`sharing.warning.${category}.title`, { name: subject })}</p>
      <p className="mt-1 text-text-muted">{t(`sharing.warning.${category}.text`, { name: subject })}</p>
      {category === "keyChanged" && (
        <div className="mt-3 flex flex-col gap-3">
          {comparing ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                {member?.fingerprint && (
                  <div className="flex flex-col gap-1.5">
                    <p className="text-xs font-medium break-all">{t("sharing.keyChange.newCode", { name: subject })}</p>
                    <SecurityCode
                      value={member.fingerprint}
                      label={t("sharing.keyChange.newCode", { name: subject })}
                      compact
                    />
                  </div>
                )}
                {own && (
                  <div className="flex flex-col gap-1.5">
                    <p className="text-xs font-medium">{t("sharing.securityCode.yours")}</p>
                    <SecurityCode value={own} label={t("sharing.securityCode.yours")} compact />
                  </div>
                )}
              </div>
              <p className="text-xs text-text-muted">{t("sharing.keyChange.how", { name: subject })}</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={accept}>
                  {t("sharing.keyChange.accept")}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setComparing(false)}>
                  {t("sharing.keyChange.notNow")}
                </Button>
              </div>
            </>
          ) : (
            <Button size="sm" variant="secondary" className="self-start" onClick={() => setComparing(true)}>
              {t("sharing.keyChange.compare")}
              <ChevronRight />
            </Button>
          )}
        </div>
      )}
      <details className="mt-2 text-xs text-text-muted">
        <summary className="cursor-pointer">{t("settings.technical")}</summary>
        <p className="mt-1 font-mono break-all">
          {warning.kind} · {warning.subjectId} · {warning.message}
        </p>
      </details>
    </div>
  );
}

function describeSubject(
  warning: SharingWarning,
  org: Org | undefined,
  orgs: Org[],
  vaults: { id: string; name: string }[],
  t: Translator["t"],
): string {
  const member = org?.members.find((m) => m.accountId === warning.subjectId);
  if (member) return memberLabel(member, t("sharing.member"));
  const subjectOrg = orgs.find((o) => o.id === warning.subjectId);
  if (subjectOrg) return orgName(subjectOrg, t);
  const vault = vaults.find((v) => v.id === warning.subjectId);
  if (vault) return displayVaultName({ ...vault, revision: 0 }, t);
  const group = org?.groups.find((g) => g.id === warning.subjectId);
  if (group) return group.name ?? t("sharing.group.unnamed");
  return org ? orgName(org, t) : t("sharing.warning.unknownSubject");
}
