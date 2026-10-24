import { Button } from "@passbox/ui";
import { Download, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import { translator } from "../import/messages";
import { ExportDialog } from "./ExportDialog";

/** The "Import and export" panel in Settings. */
export function ImportExportPanel() {
  const t = useMemo(() => translator(), []);
  const [exportOpen, setExportOpen] = useState(false);
  return (
    <section
      className="rounded-card border border-border bg-surface shadow-card"
      aria-labelledby="settings-import-export"
    >
      <header className="border-b border-border px-5 py-4">
        <h2 id="settings-import-export" className="text-sm font-semibold">
          {t("settings.title")}
        </h2>
        <p className="mt-0.5 text-[13px] text-text-muted">{t("settings.description")}</p>
      </header>
      <div className="divide-y divide-border">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[13px] font-medium">{t("settings.import")}</p>
            <p className="mt-0.5 text-xs text-text-muted">{t("settings.importHint")}</p>
          </div>
          <a
            href="#/import"
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border-strong bg-surface px-3 text-[13px] font-medium shadow-xs hover:bg-surface-raised [&_svg]:size-4"
          >
            <Upload aria-hidden="true" />
            {t("settings.importButton")}
          </a>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[13px] font-medium">{t("settings.export")}</p>
            <p className="mt-0.5 text-xs text-text-muted">{t("settings.exportHint")}</p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setExportOpen(true)}>
            <Download />
            {t("settings.exportButton")}
          </Button>
        </div>
      </div>
      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} />
    </section>
  );
}
