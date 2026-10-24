import { AlertTriangle } from "lucide-react";
import { useI18n } from "../lib/i18n";
import { useSnapshot } from "../useClient";

/**
 * Items or vaults that could not be decrypted never vanish silently (S9):
 * they may have been changed on the server or written by a newer version.
 * Passbox does not delete them; the details help when reporting it.
 */
export function DecryptionErrors() {
  const { errors } = useSnapshot();
  const { t } = useI18n();
  if (errors.length === 0) return null;
  return (
    <div role="alert" className="border-b border-warning/30 bg-warning-soft px-4 py-3 text-[0.8125rem]">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p>
            <strong className="font-semibold">{t("decrypt.title", { count: errors.length })}</strong>{" "}
            {t("decrypt.body")}
          </p>
          <details className="mt-1">
            <summary className="cursor-pointer text-text-muted underline underline-offset-4">
              {t("decrypt.details")}
            </summary>
            <ul className="mt-2 flex flex-col gap-1 font-mono text-xs break-all text-text-muted">
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </details>
        </div>
      </div>
    </div>
  );
}
