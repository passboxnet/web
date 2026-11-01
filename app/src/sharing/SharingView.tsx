import { Badge, Button, Input } from "@passbox/ui";
import { Building2, ChevronRight, House, Link2, ShieldCheck } from "lucide-react";
import { type FormEvent, type ReactNode, useState } from "react";
import { FormError } from "../auth/AuthLayout";
import { cloudBilling, planFor, planPrice } from "../lib/billing";
import { useI18n } from "../lib/i18n";
import { useServerMeta } from "../lib/instance";
import type { Route } from "../lib/route";
import { awaitingConfirmation, isOrgAdmin, parseOrgInvite, setPendingOrgInvite } from "../lib/sharing";
import { useSnapshot } from "../useClient";
import { Page, Panel } from "../views/PageHeader";
import { CreateOrgDialog } from "./CreateOrgDialog";
import { OrgIcon, orgName, RoleBadge } from "./common";

/** "Family & team": start a family or team, or open one you belong to. */
export function SharingView({ navigate }: { navigate: (route: Route) => void }) {
  const i18n = useI18n();
  const { t } = i18n;
  const { orgs, vaults } = useSnapshot();
  const [creating, setCreating] = useState<"family" | "team">();
  const open = (orgId: string) => navigate({ view: "org", orgId });
  // On the hosted service, families are free (up to a limit) and teams are Business.
  const meta = useServerMeta();
  const cloud = cloudBilling(meta);
  const monthly = planFor(cloud, "month");
  const yearly = planFor(cloud, "year");
  const prices = [monthly, yearly].filter((plan) => plan !== undefined).map((plan) => planPrice(plan, t, i18n.locale));
  const businessPrice =
    prices.length === 2 ? t("billing.price.either", { monthly: prices[0] ?? "", yearly: prices[1] ?? "" }) : prices[0];
  const familyNote = cloud
    ? meta?.familyMemberLimit
      ? t("sharing.startFamily.free", { limit: meta.familyMemberLimit })
      : t("sharing.startFamily.freeUnlimited")
    : undefined;

  return (
    <Page title={t("sharing.title")} description={t("sharing.description")}>
      <div className="flex flex-col gap-6">
        {orgs.length > 0 && (
          <ul className="flex flex-col gap-3" aria-label={t("sharing.yourOrgs")}>
            {orgs.map((org) => {
              const waiting = isOrgAdmin(org) ? awaitingConfirmation(org).length : 0;
              const vaultCount = vaults.filter((v) => v.orgId === org.id).length;
              const people = org.members.filter((m) => m.status === "confirmed").length;
              return (
                <li key={org.id}>
                  <button
                    type="button"
                    onClick={() => open(org.id)}
                    className="flex w-full items-center gap-4 rounded-card border border-border bg-surface px-5 py-4 text-left shadow-card transition-colors hover:border-border-strong hover:bg-surface-raised"
                  >
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                      <OrgIcon kind={org.kind} className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-[0.9375rem] font-semibold">{orgName(org, t)}</span>
                        <RoleBadge org={org} role={org.role} />
                        {org.status === "accepted" && <Badge tone="warning">{t("sharing.status.waitingSelf")}</Badge>}
                        {waiting > 0 && (
                          <Badge tone="warning">{t("sharing.overview.waiting", { count: waiting })}</Badge>
                        )}
                      </span>
                      <span className="mt-0.5 block text-[0.8125rem] text-text-muted">
                        {org.status === "confirmed"
                          ? t("sharing.overview.summary", { people, vaults: vaultCount })
                          : t("sharing.overview.pendingSummary")}
                      </span>
                    </span>
                    <ChevronRight className="size-4 text-text-muted" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <section aria-labelledby="sharing-start" className="flex flex-col gap-3">
          <h2 id="sharing-start" className="text-sm font-semibold">
            {orgs.length > 0 ? t("sharing.startAnother") : t("sharing.start")}
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            <StartCard
              icon={<House className="size-5" />}
              title={t("sharing.startFamily.title")}
              text={t("sharing.startFamily.text")}
              note={familyNote}
              action={t("sharing.startFamily.action")}
              onClick={() => setCreating("family")}
            />
            {cloud ? (
              <StartCard
                icon={<Building2 className="size-5" />}
                title={t("sharing.startBusiness.title")}
                text={t("sharing.startBusiness.text")}
                note={businessPrice}
                action={t("sharing.startBusiness.action")}
                onClick={() => setCreating("team")}
              />
            ) : (
              <StartCard
                icon={<Building2 className="size-5" />}
                title={t("sharing.startTeam.title")}
                text={t("sharing.startTeam.text")}
                action={t("sharing.startTeam.action")}
                onClick={() => setCreating("team")}
              />
            )}
          </div>
        </section>

        <JoinByLink />

        <Panel title={t("sharing.howSafe.title")}>
          <div className="flex gap-3 px-5 py-4 text-[0.8125rem] leading-relaxed text-text-muted">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
            <div className="flex flex-col gap-2">
              <p>{t("sharing.howSafe.p1")}</p>
              <p>{t("sharing.howSafe.p2")}</p>
              <p>{t("sharing.howSafe.p3")}</p>
            </div>
          </div>
        </Panel>
      </div>

      <CreateOrgDialog
        kind={creating}
        onOpenChange={(open) => !open && setCreating(undefined)}
        onCreated={(orgId, business) =>
          business
            ? navigate({ view: "org-admin", orgId, section: "billing", interval: business.interval })
            : open(orgId)
        }
      />
    </Page>
  );
}

function StartCard({
  icon,
  title,
  text,
  note,
  action,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  /** Plan and price on the hosted service. */
  note?: string | undefined;
  action: string;
  onClick: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-card border border-border bg-surface p-5 shadow-card">
      <span className="flex size-10 items-center justify-center rounded-xl bg-accent-soft text-accent">{icon}</span>
      <div>
        <h3 className="text-[0.9375rem] font-semibold">{title}</h3>
        <p className="mt-1 text-[0.8125rem] text-text-muted">{text}</p>
        {note && <p className="mt-2 text-[0.8125rem] font-medium">{note}</p>}
      </div>
      <Button className="mt-auto self-start" onClick={onClick}>
        {action}
      </Button>
    </div>
  );
}

/** For invitations opened elsewhere (the desktop app has no address bar). */
function JoinByLink() {
  const { t } = useI18n();
  const [text, setText] = useState("");
  const [error, setError] = useState<string>();

  function submit(event: FormEvent) {
    event.preventDefault();
    const invite = parseOrgInvite(text);
    if (!invite) {
      setError(t("sharing.join.invalid"));
      return;
    }
    setError(undefined);
    setText("");
    setPendingOrgInvite(invite);
  }

  return (
    <Panel title={t("sharing.join.title")} description={t("sharing.join.text")}>
      <form onSubmit={submit} className="flex flex-wrap items-end gap-3 px-5 py-4">
        <div className="min-w-56 flex-1">
          <Input
            label={t("sharing.join.label")}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("sharing.join.placeholder")}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <Button type="submit" variant="secondary" disabled={!text.trim()}>
          <Link2 />
          {t("sharing.join.action")}
        </Button>
        <div className="basis-full">
          <FormError message={error} />
        </div>
      </form>
    </Panel>
  );
}
