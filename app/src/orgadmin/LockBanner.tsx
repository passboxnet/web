import { Button } from "@passbox/ui";
import { LockKeyhole } from "lucide-react";
import { cloudBilling, isBusinessOrg, lockKind } from "../lib/billing";
import { useI18n } from "../lib/i18n";
import { useServerMeta } from "../lib/instance";
import type { Route } from "../lib/route";
import { isOrgAdmin } from "../lib/sharing";
import { orgName } from "../sharing/common";
import { useSnapshot } from "../useClient";

/**
 * Organizations the server holds read-only (for example when a payment is
 * overdue on the hosted service): why, and what to do. Owners and admins
 * are sent to Billing; members are asked to talk to an admin. Members can
 * still open, copy and fill every entry.
 */
export function LockBanner({ navigate }: { navigate: (route: Route) => void }) {
  const { t } = useI18n();
  const { orgs } = useSnapshot();
  const cloud = cloudBilling(useServerMeta());
  const locked = orgs.filter((org) => org.lock && org.status === "confirmed");
  if (locked.length === 0) return null;

  return (
    <div
      role="status"
      data-testid="org-lock-banner"
      className="flex flex-col gap-2 border-b border-warning/30 bg-warning-soft px-4 py-2.5 text-[0.8125rem]"
    >
      {locked.map((org) => {
        const admin = isOrgAdmin(org);
        const kind = lockKind(org.lock?.reason ?? "");
        const billing = admin && isBusinessOrg(org, cloud) && kind !== "other";
        return (
          <div key={org.id} className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <LockKeyhole className="size-4 shrink-0 text-warning" aria-hidden="true" />
            <p className="min-w-0 flex-1">
              <strong className="font-semibold">{t("sharing.lock.title", { org: orgName(org, t) })}</strong>{" "}
              <span>{t(`sharing.lock.${kind}.${admin ? "admin" : "member"}`)}</span>
            </p>
            {billing && (
              <Button size="sm" onClick={() => navigate({ view: "org-admin", orgId: org.id, section: "billing" })}>
                {t("sharing.lock.action")}
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
