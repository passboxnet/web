import type { AuditQuery, AuditRecord, ChainCheck } from "@passbox/api-client";
import { AUDIT_CATEGORIES, auditDetails, type Org } from "@passbox/client";
import { Badge, Button, cn, fieldClassName, Menu, MenuContent, MenuItem, MenuTrigger, toast } from "@passbox/ui";
import { ChevronDown, Download, FileJson, FileSpreadsheet, PenLine, ShieldCheck, ShieldX } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { errorMessage } from "../core";
import { downloadFile } from "../export/download";
import { useI18n } from "../lib/i18n";
import { memberLabel } from "../lib/sharing";
import { useClient } from "../useClient";
import { localizedDeviceName } from "../views/settings/DevicesPanel";
import { describeAuditEntry } from "./auditText";
import { Loading, Section, useNames } from "./common";

const selectClass = cn(fieldClassName, "h-9 px-2 text-[0.8125rem] coarse:h-11");
const PAGE = 50;

interface Filters {
  category: string;
  actor: string;
  source: "" | "client" | "server";
  from: string;
  to: string;
}

const EMPTY: Filters = { category: "", actor: "", source: "", from: "", to: "" };

function toQuery(filters: Filters): AuditQuery {
  const query: AuditQuery = {};
  const actions = filters.category ? AUDIT_CATEGORIES[filters.category] : undefined;
  if (actions) query.action = actions.join(",");
  if (filters.actor) query.actor = filters.actor;
  if (filters.source) query.source = filters.source;
  // Dates are local days: from the start of `from` to the end of `to`.
  if (filters.from) query.from = new Date(`${filters.from}T00:00:00`).getTime();
  if (filters.to) query.to = new Date(`${filters.to}T23:59:59.999`).getTime();
  return query;
}

/** The organization's audit log (D3): filters, details, the hash chain check and exports. */
export function ActivitySection({ org }: { org: Org }) {
  const client = useClient();
  const { t } = useI18n();
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [events, setEvents] = useState<AuditRecord[]>();
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string>();
  const [loadingMore, setLoadingMore] = useState(false);
  const [chain, setChain] = useState<ChainCheck>();
  const [local, setLocal] = useState<ChainCheck>();
  const [checking, setChecking] = useState(false);
  const [exporting, setExporting] = useState(false);
  const query = toQuery(filters);
  const queryKey = JSON.stringify(query);

  const load = useCallback(
    (before?: number) => {
      const page = { ...(JSON.parse(queryKey) as AuditQuery), limit: PAGE, ...(before ? { before } : {}) };
      return client.orgAdmin.audit(org.id, page).then((result) => {
        setEvents((current) => (before ? [...(current ?? []), ...result.events] : result.events));
        setMore(result.events.length === PAGE);
        setError(undefined);
      });
    },
    [client, org.id, queryKey],
  );

  useEffect(() => {
    setEvents(undefined);
    load().catch((e: unknown) => setError(errorMessage(e)));
  }, [load]);

  useEffect(() => {
    client.orgAdmin
      .verifyAudit(org.id)
      .then(setChain)
      .catch(() => setChain(undefined));
  }, [client, org.id]);

  async function loadMore() {
    const last = events?.at(-1);
    if (!last) return;
    setLoadingMore(true);
    try {
      await load(last.seq);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setLoadingMore(false);
    }
  }

  async function checkHere() {
    setChecking(true);
    try {
      const { check } = await client.exportAuditLog(org.id);
      setLocal(check);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setChecking(false);
    }
  }

  async function exportLog(format: "csv" | "json") {
    setExporting(true);
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      if (format === "csv") {
        const csv = await client.orgAdmin.exportAuditCsv(org.id, query);
        downloadFile(`passbox-audit-${stamp}.csv`, csv, "text/csv");
      } else {
        const { data, check } = await client.exportAuditLog(org.id, query);
        downloadFile(`passbox-audit-${stamp}.json`, `${JSON.stringify(data, null, 2)}\n`, "application/json");
        if (!check.valid) toast.error(t("orgAdmin.audit.exportBroken", { seq: check.brokenAt ?? 0 }));
      }
      toast.success(t("orgAdmin.audit.exported"));
    } catch (e) {
      toast.error(t("orgAdmin.audit.exportFailed"), { description: errorMessage(e) });
    } finally {
      setExporting(false);
    }
  }

  const set = (changes: Partial<Filters>) => setFilters((current) => ({ ...current, ...changes }));
  const filtered = JSON.stringify(filters) !== JSON.stringify(EMPTY);

  return (
    <Section
      title={t("orgAdmin.section.activity")}
      description={t("orgAdmin.audit.description")}
      actions={
        <Menu>
          <MenuTrigger asChild>
            <Button variant="secondary" loading={exporting}>
              <Download />
              {t("orgAdmin.audit.export")}
              <ChevronDown />
            </Button>
          </MenuTrigger>
          <MenuContent>
            <MenuItem icon={<FileSpreadsheet />} onSelect={() => void exportLog("csv")}>
              {t("orgAdmin.audit.exportCsv")}
            </MenuItem>
            <MenuItem icon={<FileJson />} onSelect={() => void exportLog("json")}>
              {t("orgAdmin.audit.exportJson")}
            </MenuItem>
          </MenuContent>
        </Menu>
      }
    >
      <ChainStatus chain={chain} local={local} checking={checking} onCheck={() => void checkHere()} />

      <fieldset className="flex flex-wrap items-end gap-3">
        <legend className="sr-only">{t("orgAdmin.audit.filters")}</legend>
        <label className="flex flex-col gap-1 text-xs text-text-muted">
          {t("orgAdmin.audit.filter.category")}
          <select className={selectClass} value={filters.category} onChange={(e) => set({ category: e.target.value })}>
            <option value="">{t("orgAdmin.audit.filter.all")}</option>
            {Object.keys(AUDIT_CATEGORIES).map((category) => (
              <option key={category} value={category}>
                {t(`orgAdmin.audit.category.${category}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-muted">
          {t("orgAdmin.audit.filter.member")}
          <select className={selectClass} value={filters.actor} onChange={(e) => set({ actor: e.target.value })}>
            <option value="">{t("orgAdmin.audit.filter.everyone")}</option>
            {org.members.map((m) => (
              <option key={m.accountId} value={m.accountId}>
                {memberLabel(m, t("sharing.member"))}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-muted">
          {t("orgAdmin.audit.filter.source")}
          <select
            className={selectClass}
            value={filters.source}
            onChange={(e) => set({ source: e.target.value as Filters["source"] })}
          >
            <option value="">{t("orgAdmin.audit.filter.all")}</option>
            <option value="server">{t("orgAdmin.audit.source.server")}</option>
            <option value="client">{t("orgAdmin.audit.source.app")}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-muted">
          {t("orgAdmin.audit.filter.from")}
          <input
            type="date"
            className={selectClass}
            value={filters.from}
            onChange={(e) => set({ from: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-muted">
          {t("orgAdmin.audit.filter.to")}
          <input type="date" className={selectClass} value={filters.to} onChange={(e) => set({ to: e.target.value })} />
        </label>
        {filtered && (
          <Button variant="ghost" size="sm" onClick={() => setFilters(EMPTY)}>
            {t("orgAdmin.audit.filter.clear")}
          </Button>
        )}
      </fieldset>

      {!events ? (
        <Loading error={error} onRetry={() => void load().catch((e: unknown) => setError(errorMessage(e)))} />
      ) : events.length === 0 ? (
        <p className="rounded-card border border-hairline bg-surface px-5 py-6 text-center text-[0.8125rem] text-text-muted shadow-card">
          {filtered ? t("orgAdmin.audit.noneFiltered") : t("orgAdmin.audit.none")}
        </p>
      ) : (
        <ol
          className="divide-y divide-border rounded-card border border-hairline bg-surface shadow-card"
          aria-label={t("orgAdmin.section.activity")}
        >
          {events.map((entry) => (
            <AuditRow key={entry.seq} org={org} entry={entry} />
          ))}
        </ol>
      )}
      {events && more && (
        <Button variant="secondary" className="self-center" loading={loadingMore} onClick={() => void loadMore()}>
          {t("orgAdmin.audit.loadMore")}
        </Button>
      )}
    </Section>
  );
}

function ChainStatus({
  chain,
  local,
  checking,
  onCheck,
}: {
  chain: ChainCheck | undefined;
  local: ChainCheck | undefined;
  checking: boolean;
  onCheck: () => void;
}) {
  const { t } = useI18n();
  const shown = local ?? chain;
  const valid = shown?.valid ?? true;
  return (
    <div
      role="status"
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-card border px-5 py-3.5 text-[0.8125rem] shadow-card",
        valid ? "border-border bg-surface" : "border-danger/30 bg-danger-soft",
      )}
    >
      {valid ? (
        <ShieldCheck className="size-4 shrink-0 text-success" aria-hidden="true" />
      ) : (
        <ShieldX className="size-4 shrink-0 text-danger" aria-hidden="true" />
      )}
      <p className="min-w-0 flex-1">
        {!shown
          ? t("app.loading")
          : shown.valid
            ? t(local ? "orgAdmin.audit.chainValidHere" : "orgAdmin.audit.chainValidServer", { count: shown.length })
            : t("orgAdmin.audit.chainBrokenLong", { seq: shown.brokenAt ?? 0 })}
        <span className="block text-xs text-text-muted">{t("orgAdmin.audit.chainHint")}</span>
      </p>
      <Button size="sm" variant="secondary" loading={checking} onClick={onCheck}>
        {t("orgAdmin.audit.checkHere")}
      </Button>
    </div>
  );
}

function AuditRow({ org, entry }: { org: Org; entry: AuditRecord }) {
  const i18n = useI18n();
  const { t } = i18n;
  const names = useNames(org);
  const [open, setOpen] = useState(false);
  const actor = entry.actorEmail || names.member(entry.actorId);
  const details = auditDetails(entry);
  const app = entry.clientEvent !== "";

  return (
    <li className="px-5 py-3" data-testid="audit-entry">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full flex-wrap items-baseline gap-x-3 gap-y-1 text-left"
      >
        <span className="w-12 shrink-0 text-xs text-text-subtle tabular-nums">{`#${entry.seq}`}</span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2 text-[0.8125rem] font-medium break-words">
            {describeAuditEntry(entry, names, t)}
            {app && (
              <Badge tone="accent">
                <PenLine />
                {t("orgAdmin.audit.signedByApp")}
              </Badge>
            )}
          </span>
          <span className="block text-xs text-text-muted" title={i18n.dateTime(entry.createdAt)}>
            {t("orgAdmin.audit.meta", {
              actor,
              time: i18n.relativeTime(entry.createdAt),
              device: entry.deviceName ? localizedDeviceName(entry.deviceName, t) : "–",
              ip: entry.ip || "–",
            })}
          </span>
        </span>
        <ChevronDown
          className={cn("size-4 shrink-0 text-text-muted transition-transform", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>
      {open && (
        <dl className="mt-3 grid gap-x-6 gap-y-1.5 rounded-lg bg-surface-sunken px-4 py-3 text-xs sm:grid-cols-[auto_1fr]">
          <dt className="text-text-muted">{t("orgAdmin.audit.detail.time")}</dt>
          <dd>{i18n.dateTime(entry.createdAt)}</dd>
          <dt className="text-text-muted">{t("orgAdmin.audit.detail.action")}</dt>
          <dd className="font-mono">{entry.action}</dd>
          {Object.keys(details).length > 0 && (
            <>
              <dt className="text-text-muted">{t("orgAdmin.audit.detail.details")}</dt>
              <dd className="font-mono break-all">{entry.details}</dd>
            </>
          )}
          <dt className="text-text-muted">{t("orgAdmin.audit.detail.hash")}</dt>
          <dd className="font-mono break-all">{entry.hash}</dd>
          <dt className="text-text-muted">{t("orgAdmin.audit.detail.prevHash")}</dt>
          <dd className="font-mono break-all">{entry.prevHash || "–"}</dd>
          {app && (
            <>
              <dt className="text-text-muted">{t("orgAdmin.audit.detail.signature")}</dt>
              <dd className="font-mono break-all">{entry.clientSignature}</dd>
            </>
          )}
        </dl>
      )}
    </li>
  );
}
