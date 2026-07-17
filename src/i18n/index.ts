/**
 * i18n setup. English, Lao (lo), Thai (th).
 *
 * Resources are bundled, not fetched at runtime: three small JSON files, so
 * there is no loading state and no flash of untranslated text. The detector
 * picks the starting language from a previous choice in localStorage, then the
 * browser's `navigator.language`, falling back to English.
 *
 * English is also the fallback for any *missing* key, which is what makes the
 * staged rollout safe: a page not yet translated shows English rather than a
 * raw key like "dashboard.title".
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './locales/en.json';
import lo from './locales/lo.json';
import th from './locales/th.json';

export const SUPPORTED_LANGUAGES = ['en', 'lo', 'th'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/** localStorage key the detector reads and writes the chosen language to. */
const STORAGE_KEY = 'marketplace.lang';

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      lo: { translation: lo },
      th: { translation: th },
    },
    fallbackLng: 'en',
    supportedLngs: SUPPORTED_LANGUAGES,
    // Collapse regional variants: th-TH and lo-LA resolve to th and lo.
    load: 'languageOnly',
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: STORAGE_KEY,
      caches: ['localStorage'],
    },
    interpolation: {
      // React already escapes everything it renders, so i18next escaping too
      // would double-escape (e.g. turn an apostrophe into &#39;).
      escapeValue: false,
    },
  });

/**
 * Keep the document's <html lang> in sync with the active language. Assistive
 * tech and the browser use it to pick pronunciation and, importantly here, the
 * right script's line-breaking and font matching for Lao and Thai.
 */
function syncHtmlLang(lng: string): void {
  document.documentElement.lang = lng;
}
syncHtmlLang(i18n.language);
i18n.on('languageChanged', syncHtmlLang);

export default i18n;
