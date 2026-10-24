import { computed, Injectable, signal } from '@angular/core';
import languageData from './language.json';

export type Language = 'de' | 'en';
export type Dictionary = typeof languageData.de;
export type TranslationKey = keyof Dictionary;

/** `en` must provide every key of `de` (compile-time check). */
const DICTIONARIES: Readonly<Record<Language, Dictionary>> = {
  de: languageData.de,
  en: languageData.en,
};

const STORAGE_KEY = 'dartboard.language';

/**
 * Signal-based i18n (DE/EN) ported from the template's `TranslationService`.
 * Templates call `i18n.t('key')`; the language signal makes OnPush views re-render on switch.
 */
@Injectable({ providedIn: 'root' })
export class TranslationService {
  private readonly lang = signal<Language>(TranslationService.initialLanguage());
  private readonly dictionary = computed(() => DICTIONARIES[this.lang()]);

  readonly language = this.lang.asReadonly();

  constructor() {
    document.documentElement.lang = this.lang();
  }

  setLanguage(language: Language): void {
    this.lang.set(language);
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // Storage unavailable (private mode): the choice simply is not persisted.
    }
    document.documentElement.lang = language;
  }

  toggleLanguage(): void {
    this.setLanguage(this.lang() === 'de' ? 'en' : 'de');
  }

  /** Translates `key`, replacing `{param}` placeholders. */
  t(key: TranslationKey, params?: Readonly<Record<string, string | number>>): string {
    const template = this.dictionary()[key] ?? DICTIONARIES.de[key] ?? key;
    if (!params) {
      return template;
    }
    return template.replace(/\{(\w+)\}/g, (match, name: string) =>
      Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match,
    );
  }

  /** Maps a Firebase/callable error code (`functions/permission-denied`, ...) to a message. */
  errorMessage(code: string): string {
    const key = `error.${code.replace(/^(functions|firestore|auth)\//, '')}`;
    return TranslationService.isKey(key) ? this.t(key) : this.t('error.unknown');
  }

  static isKey(key: string): key is TranslationKey {
    return Object.prototype.hasOwnProperty.call(DICTIONARIES.de, key);
  }

  private static initialLanguage(): Language {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'de' || stored === 'en') {
        return stored;
      }
    } catch {
      // ignore
    }
    return navigator.language?.toLowerCase().startsWith('en') ? 'en' : 'de';
  }
}
