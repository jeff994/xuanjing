import { describe, expect, it } from 'vitest';
import { interpolate, LANGUAGES, translations } from './translations';

describe('i18n translations', () => {
  it('provides all keys with matching placeholders for every supported language', () => {
    const enKeys = Object.keys(translations.en).sort();

    for (const lang of LANGUAGES) {
      const dict = translations[lang.code];
      expect(dict, `Missing dictionary for ${lang.code}`).toBeDefined();
      expect(Object.keys(dict).sort()).toEqual(enKeys);

      for (const key of enKeys) {
        const enValue = translations.en[key as keyof typeof translations.en];
        const value = dict[key as keyof typeof dict];

        // Allow intentionally empty prefix keys (like book.signInPromptPrefix in en/es/fr)
        if (enValue.length > 0) {
          expect(value.trim().length, `Empty translation for ${lang.code}.${key}`).toBeGreaterThan(0);
        }

        const enPlaceholders = (enValue.match(/\{\w+\}/g) ?? []).sort();
        const langPlaceholders = (value.match(/\{\w+\}/g) ?? []).sort();
        expect(langPlaceholders, `Placeholder mismatch for ${lang.code}.${key}`).toEqual(enPlaceholders);
      }
    }
  });

  it('interpolates template variables cleanly', () => {
    expect(interpolate('by {author}', { author: 'Martin Kleppmann' })).toBe('by Martin Kleppmann');
    expect(interpolate('Comments ({count})', { count: 3 })).toBe('Comments (3)');
    expect(interpolate('Unmatched {missing}', {})).toBe('Unmatched {missing}');
  });
});
