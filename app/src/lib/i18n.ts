/**
 * Translations for the web and desktop app. Messages come from
 * `@passbox/i18n` (`common` plus the app's own `web` namespace). The locale
 * follows the language setting, or the browser's preferred languages, so
 * German is the default on German systems.
 */
import { createTranslator, detectLocale, type Locale, mergeCatalogs, type Translator } from "@passbox/i18n";
import deCommon from "@passbox/i18n/messages/de/common.json";
import deOrgAdmin from "@passbox/i18n/messages/de/orgadmin.json";
import deWeb from "@passbox/i18n/messages/de/web.json";
import enCommon from "@passbox/i18n/messages/en/common.json";
import enOrgAdmin from "@passbox/i18n/messages/en/orgadmin.json";
import enWeb from "@passbox/i18n/messages/en/web.json";
import { useMemo } from "react";
import { getPreferences, type LanguagePreference, usePreferences } from "./preferences";

export type { Locale, Translator } from "@passbox/i18n";

const CATALOGS = {
  en: mergeCatalogs(enCommon, enWeb, enOrgAdmin),
  de: mergeCatalogs(deCommon, deWeb, deOrgAdmin),
};

export function resolveLocale(
  preference: LanguagePreference,
  languages: readonly string[] | undefined = typeof navigator === "undefined" ? undefined : navigator.languages,
): Locale {
  return preference === "system" ? detectLocale(languages) : preference;
}

const cache = new Map<Locale, Translator>();

export function translatorFor(locale: Locale): Translator {
  let translator = cache.get(locale);
  if (!translator) {
    translator = createTranslator(locale, CATALOGS);
    cache.set(locale, translator);
  }
  return translator;
}

/** The current translator, for code outside React components (toasts, errors). */
export function i18n(): Translator {
  return translatorFor(resolveLocale(getPreferences().language));
}

/** The current translator; components re-render when the language changes. */
export function useI18n(): Translator {
  const { language } = usePreferences();
  return useMemo(() => translatorFor(resolveLocale(language)), [language]);
}

/** Keeps `<html lang>` in sync so screen readers and hyphenation use the right language. */
export function applyLocale(locale: Locale = i18n().locale) {
  document.documentElement.lang = locale;
}

/** macOS, iOS and iPadOS show ⌘; everyone else Ctrl (Strg in German). */
export function isApplePlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  const platform =
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ??
    navigator.platform ??
    "";
  return /mac|iphone|ipad|ipod/i.test(platform || navigator.userAgent);
}

/** The label of the main shortcut modifier, for example "⌘" or "Strg". */
export function modifierKey(t: Translator["t"], apple: boolean = isApplePlatform()): string {
  return apple ? "⌘" : t("key.ctrl");
}

/** A shortcut such as "⌘K" or "Strg+K". */
export function shortcut(t: Translator["t"], key: string, apple: boolean = isApplePlatform()): string {
  return apple ? `⌘${key}` : `${t("key.ctrl")}+${key}`;
}
