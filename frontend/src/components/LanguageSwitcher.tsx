import { Globe } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { LANGUAGES, LanguageCode } from '../i18n/translations';

export function LanguageSwitcher() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">{t('nav.language')}</span>
      <Globe className="pointer-events-none absolute left-2.5 h-4 w-4 text-slate-500" />
      <select
        aria-label={t('nav.language')}
        value={language}
        onChange={(e) => setLanguage(e.target.value as LanguageCode)}
        className="cursor-pointer appearance-none rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-6 text-sm font-medium text-slate-700 shadow-sm outline-none transition hover:bg-slate-50 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
      >
        {LANGUAGES.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.label}
          </option>
        ))}
      </select>
    </label>
  );
}
