import type { Attachment, Item } from "@passbox/client";
import { Button, ConfirmDialog, cn, Dialog, Spinner, Tooltip, toast } from "@passbox/ui";
import { Download, Eye, File, FileImage, FileText, Paperclip, Trash2, Upload } from "lucide-react";
import { type DragEvent, useEffect, useRef, useState } from "react";
import { useI18n } from "../lib/i18n";
import { useClient } from "../useClient";
import { comfortError } from "./errors";

/** Media types the preview shows (inside a sandboxed frame). */
const PREVIEW_IMAGES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml", "image/avif"]);

export function canPreview(type: string): boolean {
  return PREVIEW_IMAGES.has(type) || type === "application/pdf";
}

/** "1.2 MB" in the user's language. */
export function formatSize(bytes: number, locale: string): string {
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit++;
  }
  const digits = unit === 0 || value >= 100 ? 0 : 1;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(value)} ${units[unit]}`;
}

function iconFor(type: string) {
  if (type.startsWith("image/")) return FileImage;
  if (type === "application/pdf" || type.startsWith("text/")) return FileText;
  return File;
}

/** Saves bytes as a file through a temporary link. */
export function saveBytes(data: Uint8Array, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([data as BlobPart], { type: type || "application/octet-stream" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/**
 * Files attached to an item (G2): add by picking or dropping files, open a
 * preview of images and PDFs, download and remove. Files are encrypted on
 * this device before they are uploaded.
 */
export function AttachmentsSection({ item, canEdit }: { item: Item; canEdit: boolean }) {
  const client = useClient();
  const i18n = useI18n();
  const { t } = i18n;
  const attachments = item.data.attachments ?? [];
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<{ id: string; name: string }[]>([]);
  const [dragging, setDragging] = useState(false);
  const [removing, setRemoving] = useState<Attachment>();
  const [preview, setPreview] = useState<{ attachment: Attachment; url: string }>();
  const [maxSize, setMaxSize] = useState<number>();

  useEffect(() => {
    if (!canEdit) return;
    client
      .attachmentUsage()
      .then((usage) => setMaxSize(usage.maxFileSize))
      .catch(() => setMaxSize(undefined));
  }, [client, canEdit]);

  useEffect(() => () => preview && URL.revokeObjectURL(preview.url), [preview]);

  async function add(files: FileList | File[]) {
    for (const file of Array.from(files)) {
      if (maxSize !== undefined && file.size > maxSize) {
        toast.error(t("attachments.tooLarge", { name: file.name, max: formatSize(maxSize, i18n.locale) }));
        continue;
      }
      const upload = { id: crypto.randomUUID(), name: file.name };
      setUploading((list) => [...list, upload]);
      try {
        const data = new Uint8Array(await file.arrayBuffer());
        await client.addAttachment(item.id, { name: file.name, type: file.type, data });
        toast.success(t("attachments.added", { name: file.name }));
      } catch (error) {
        toast.error(t("attachments.addFailed", { name: file.name }), { description: comfortError(error, t) });
      } finally {
        setUploading((list) => list.filter((u) => u.id !== upload.id));
      }
    }
  }

  async function load(attachment: Attachment): Promise<Uint8Array | undefined> {
    try {
      return await client.attachmentData(item.id, attachment.id);
    } catch (error) {
      toast.error(t("attachments.openFailed", { name: attachment.name }), { description: comfortError(error, t) });
      return undefined;
    }
  }

  async function download(attachment: Attachment) {
    const data = await load(attachment);
    if (data) saveBytes(data, attachment.name, attachment.type);
  }

  async function show(attachment: Attachment) {
    const data = await load(attachment);
    if (!data) return;
    const url = URL.createObjectURL(new Blob([data as BlobPart], { type: attachment.type }));
    setPreview({ attachment, url });
  }

  async function remove(attachment: Attachment) {
    try {
      await client.removeAttachment(item.id, attachment.id);
      toast.success(t("attachments.removed", { name: attachment.name }));
    } catch (error) {
      toast.error(t("attachments.removeFailed"), { description: comfortError(error, t) });
    }
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    if (canEdit && event.dataTransfer.files.length > 0) void add(event.dataTransfer.files);
  }

  if (attachments.length === 0 && !canEdit) return null;

  return (
    <section
      aria-label={t("attachments.title")}
      className={cn(
        "mt-4 rounded-card border border-border bg-surface shadow-card transition-colors",
        dragging && "border-accent bg-accent-soft",
      )}
      onDragOver={(event) => {
        if (!canEdit) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      data-testid="attachments"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <p className="flex items-center gap-2 text-xs font-medium text-text-muted">
          <Paperclip className="size-3.5" aria-hidden="true" />
          {t("attachments.title")}
        </p>
        {canEdit && (
          <>
            <input
              ref={input}
              type="file"
              multiple
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => {
                if (e.target.files) void add(e.target.files);
                e.target.value = "";
              }}
              data-testid="attachment-input"
            />
            <Button variant="secondary" size="xs" onClick={() => input.current?.click()}>
              <Upload />
              {t("attachments.add")}
            </Button>
          </>
        )}
      </div>
      {attachments.length === 0 && uploading.length === 0 ? (
        <p className="border-t border-border px-4 py-4 text-center text-[0.8125rem] text-text-muted">
          {t("attachments.empty")}
          {maxSize ? ` ${t("attachments.limit", { max: formatSize(maxSize, i18n.locale) })}` : ""}
        </p>
      ) : (
        <ul className="divide-y divide-border border-t border-border">
          {attachments.map((attachment) => {
            const Icon = iconFor(attachment.type);
            return (
              <li key={attachment.id} className="group flex items-center gap-3 px-4 py-2.5">
                <Icon className="size-4 shrink-0 text-text-muted" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.8125rem] font-medium">{attachment.name}</p>
                  <p className="text-xs text-text-muted">
                    {formatSize(attachment.size, i18n.locale)}
                    {attachment.createdAt ? ` · ${i18n.date(attachment.createdAt)}` : ""}
                  </p>
                </div>
                <span className="flex items-center">
                  {canPreview(attachment.type) && (
                    <Tooltip content={t("attachments.preview", { name: attachment.name })}>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t("attachments.preview", { name: attachment.name })}
                        onClick={() => void show(attachment)}
                      >
                        <Eye />
                      </Button>
                    </Tooltip>
                  )}
                  <Tooltip content={t("attachments.download", { name: attachment.name })}>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("attachments.download", { name: attachment.name })}
                      onClick={() => void download(attachment)}
                    >
                      <Download />
                    </Button>
                  </Tooltip>
                  {canEdit && (
                    <Tooltip content={t("attachments.remove", { name: attachment.name })}>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t("attachments.remove", { name: attachment.name })}
                        onClick={() => setRemoving(attachment)}
                      >
                        <Trash2 />
                      </Button>
                    </Tooltip>
                  )}
                </span>
              </li>
            );
          })}
          {uploading.map(({ id, name }) => (
            <li
              key={id}
              className="flex items-center gap-3 px-4 py-2.5 text-[0.8125rem] text-text-muted"
              aria-live="polite"
            >
              <Spinner label={t("attachments.uploading", { name })} />
              <span className="truncate">{t("attachments.uploading", { name })}</span>
            </li>
          ))}
        </ul>
      )}
      {canEdit && <p className="border-t border-border px-4 py-2 text-xs text-text-muted">{t("attachments.hint")}</p>}

      <ConfirmDialog
        open={removing !== undefined}
        onOpenChange={(open) => !open && setRemoving(undefined)}
        title={t("attachments.removeTitle", { name: removing?.name ?? "" })}
        description={t("attachments.removeText")}
        confirmLabel={t("attachments.removeConfirm")}
        tone="danger"
        onConfirm={() => removing && void remove(removing)}
      />

      <Dialog
        open={preview !== undefined}
        onOpenChange={(open) => !open && setPreview(undefined)}
        title={preview?.attachment.name ?? ""}
        description={t("attachments.previewText")}
        size="lg"
        footer={
          preview && (
            <Button variant="secondary" onClick={() => void download(preview.attachment)}>
              <Download />
              {t("attachments.downloadShort")}
            </Button>
          )
        }
      >
        {preview && (
          // A sandboxed frame: the file cannot run scripts with the vault's
          // origin, read the page or navigate it. PDFs need scripts for the
          // browser's viewer, still in an opaque origin.
          <iframe
            title={preview.attachment.name}
            src={preview.url}
            sandbox={preview.attachment.type === "application/pdf" ? "allow-scripts" : ""}
            referrerPolicy="no-referrer"
            className="h-[65vh] w-full rounded-lg border border-border bg-surface-sunken"
            data-testid="attachment-preview"
          />
        )}
      </Dialog>
    </section>
  );
}
