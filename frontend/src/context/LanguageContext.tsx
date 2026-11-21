import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { interpolate, LANGUAGES, LanguageCode, TranslationKey, translations } from '../i18n/translations';

const LANG_STORAGE_KEY = 'book_portal_lang';
const SUPPORTED_CODES = new Set<LanguageCode>(LANGUAGES.map((l) => l.code));

function detectInitialLanguage(): LanguageCode {
  try {
    const saved = localStorage.getItem(LANG_STORAGE_KEY) as LanguageCode | null;
    if (saved && SUPPORTED_CODES.has(saved)) {
      return saved;
    }
  } catch {
    // Ignore storage errors
  }

  const browserLang = (navigator.language || 'en').toLowerCase().split('-')[0] as LanguageCode;
  if (SUPPORTED_CODES.has(browserLang)) {
    return browserLang;
  }
  return 'en';
}

interface LanguageContextValue {
  language: LanguageCode;
  dateLocale: string;
  setLanguage: (code: LanguageCode) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>(detectInitialLanguage);

  const setLanguage = useCallback((code: LanguageCode) => {
    setLanguageState(code);
    try {
      localStorage.setItem(LANG_STORAGE_KEY, code);
    } catch {
      // Ignore storage errors
    }
  }, []);

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>) => {
      const dict = translations[language] ?? translations.en;
      const template = dict[key] ?? translations.en[key];
      return interpolate(template, vars);
    },
    [language]
  );

  const dateLocale = LANGUAGES.find((l) => l.code === language)?.locale ?? 'en-US';

  useEffect(() => {
    document.documentElement.lang = dateLocale;
    document.title = translations[language]['app.title'];
  }, [language, dateLocale]);

  return (
    <LanguageContext.Provider value={{ language, dateLocale, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used inside LanguageProvider');
  }
  return ctx;
}
