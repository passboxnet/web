/**
 * Translation helpers for the import wizard and the export dialog. The
 * strings live in the shared `web` catalogs (packages/i18n); plural pairs use
 * `_one`/`_other` key suffixes.
 */
import { i18n, translatorFor } from "../lib/i18n";

export type Locale = "en" | "de";

export type MessageKey = string;

/** The app's current language (the language setting, else the browser). */
export function currentLocale(): Locale {
  return i18n().locale;
}

export type Translate = (key: MessageKey, values?: Record<string, string | number>) => string;

/** A translator for `locale`. Numbers are formatted for the locale. */
export function translator(locale: Locale = currentLocale()): Translate {
  const { t } = translatorFor(locale);
  return (key, values) => t(key, values);
}

/** Picks the `_one` or `_other` variant of a key for `count`. */
export function plural(
  t: Translate,
  base: string,
  count: number,
  values: Record<string, string | number> = {},
): string {
  return t(`${base}_${count === 1 ? "one" : "other"}`, { count, ...values });
}
