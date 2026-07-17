/**
 * Switches the whole app between English, Lao, and Thai.
 *
 * A native <select>, on purpose: three options need no custom dropdown, and the
 * native control is keyboard- and screen-reader-accessible for free, on every
 * device. The chosen language is persisted by the detector (localStorage), so it
 * survives a reload.
 *
 * The option labels are each language's own name — English / ລາວ / ໄທย — the
 * same in every locale, so a reader always finds their language by its native
 * spelling regardless of the language currently active.
 */
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from '../i18n';

export function LanguageSwitcher(): React.JSX.Element {
  const { i18n, t } = useTranslation();
  const current = i18n.resolvedLanguage ?? 'en';

  return (
    <label className="relative">
      <span className="sr-only">{t('language.switch')}</span>
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
      >
        <circle cx="12" cy="12" r="9" />
        <path strokeLinecap="round" d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
      </svg>
      <select
        value={current}
        onChange={(event) => void i18n.changeLanguage(event.target.value)}
        className="cursor-pointer rounded-lg border-0 bg-transparent py-2 pl-7 pr-2 text-sm font-medium text-slate-600 ring-1 ring-slate-300 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        {SUPPORTED_LANGUAGES.map((lng) => (
          <option key={lng} value={lng}>
            {t(`language.${lng}`)}
          </option>
        ))}
      </select>
    </label>
  );
}
