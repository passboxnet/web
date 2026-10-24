import { Button, Input } from "@passbox/ui";
import { CheckCircle2, ClipboardPaste, HelpCircle, ImageUp } from "lucide-react";
import { type ClipboardEvent, type ReactNode, useRef, useState } from "react";
import { useI18n } from "../lib/i18n";
import { clipboardImage, decodeQrImage, describeTotpLink, QrError, totpFromQrText } from "../lib/qr";

interface TotpFieldProps {
  id: string;
  label: string;
  labelAction?: ReactNode;
  value: string;
  error: string | undefined;
  onChange: (value: string) => void;
  trailing?: ReactNode;
}

/**
 * The 2FA setup field (business P0-4): type or paste the setup key, or read
 * the QR code from a screenshot or the clipboard. A link read from a QR code
 * is summarized ("GitHub · octocat") instead of showing otpauth:// text.
 */
export function TotpField({ id, label, labelAction, value, error, onChange, trailing }: TotpFieldProps) {
  const { t } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);
  const [guide, setGuide] = useState(false);
  // A saved or scanned link shows as a summary; typing always shows the field.
  const [summary, setSummary] = useState(() => describeTotpLink(value) !== undefined);
  const [qrError, setQrError] = useState<string>();
  const [reading, setReading] = useState(false);
  const link = describeTotpLink(value);

  async function readImage(image: Blob | undefined) {
    setQrError(undefined);
    if (!image) {
      setQrError(t("qr.error.noImage"));
      return;
    }
    setReading(true);
    try {
      onChange(totpFromQrText(await decodeQrImage(image)));
      setSummary(true);
    } catch (e) {
      setQrError(e instanceof QrError ? t(`qr.error.${e.code}`) : t("qr.error.unreadable"));
    } finally {
      setReading(false);
    }
  }

  async function pasteImage() {
    try {
      await readImage(await clipboardImage());
    } catch {
      setQrError(t("qr.error.clipboard"));
    }
  }

  function onPaste(event: ClipboardEvent<HTMLInputElement>) {
    const file = Array.from(event.clipboardData.files).find((f) => f.type.startsWith("image/"));
    if (file) {
      event.preventDefault();
      void readImage(file);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {link && summary ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[0.8125rem] font-medium text-text">{label}</span>
            {labelAction}
          </div>
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-success/30 bg-success-soft px-3 py-2.5 text-[0.8125rem]">
            <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              {t("totp.configured", {
                name: [link.issuer, link.account].filter(Boolean).join(" · ") || t("totp.configuredUnknown"),
              })}
            </span>
            <Button size="xs" variant="secondary" onClick={() => setSummary(false)}>
              {t("action.edit")}
            </Button>
            <Button size="xs" variant="ghost" onClick={() => onChange("")}>
              {t("totp.remove")}
            </Button>
            {trailing}
          </div>
          {error && <p className="text-xs text-danger">{error}</p>}
        </div>
      ) : (
        <Input
          id={id}
          label={label}
          labelAction={labelAction}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onPaste={onPaste}
          autoComplete="off"
          spellCheck={false}
          className="font-mono"
          placeholder={t("totp.placeholder")}
          hint={t("totp.hint")}
          error={error}
          trailing={trailing}
        />
      )}
      <div className="relative flex flex-wrap items-center gap-1">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            void readImage(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <Button variant="ghost" size="xs" loading={reading} onClick={() => fileRef.current?.click()}>
          <ImageUp />
          {t("totp.fromImage")}
        </Button>
        <Button variant="ghost" size="xs" onClick={() => void pasteImage()}>
          <ClipboardPaste />
          {t("totp.fromClipboard")}
        </Button>
        <Button variant="ghost" size="xs" aria-expanded={guide} onClick={() => setGuide((g) => !g)}>
          <HelpCircle />
          {t("totp.howTo")}
        </Button>
      </div>
      {qrError && (
        <p role="alert" className="text-xs text-danger">
          {qrError}
        </p>
      )}
      {guide && (
        <ol className="flex list-decimal flex-col gap-1 rounded-lg bg-surface-sunken py-3 pr-3 pl-8 text-[0.8125rem] text-text-muted">
          <li>{t("totp.guide.1")}</li>
          <li>{t("totp.guide.2")}</li>
          <li>{t("totp.guide.3")}</li>
        </ol>
      )}
    </div>
  );
}
