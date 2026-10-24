import { TestBed } from '@angular/core/testing';
import languageData from './language.json';
import { TranslationService } from './translation';

describe('TranslationService', () => {
  let i18n: TranslationService;

  beforeEach(() => {
    localStorage.clear();
    i18n = TestBed.inject(TranslationService);
    i18n.setLanguage('de');
  });

  it('provides the same keys for DE and EN', () => {
    expect(Object.keys(languageData.en).sort()).toEqual(Object.keys(languageData.de).sort());
  });

  it('translates and interpolates parameters', () => {
    expect(i18n.t('home.greeting', { name: 'Alice' })).toBe('Hallo, Alice!');
    i18n.setLanguage('en');
    expect(i18n.t('home.greeting', { name: 'Alice' })).toBe('Hi, Alice!');
  });

  it('toggles and persists the language', () => {
    i18n.toggleLanguage();
    expect(i18n.language()).toBe('en');
    expect(localStorage.getItem('dartboard.language')).toBe('en');
    expect(document.documentElement.lang).toBe('en');
  });

  it('maps callable error codes to messages', () => {
    expect(i18n.errorMessage('functions/permission-denied')).toBe(languageData.de['error.permission-denied']);
    expect(i18n.errorMessage('permission-denied')).toBe(languageData.de['error.permission-denied']);
    expect(i18n.errorMessage('functions/something-new')).toBe(languageData.de['error.unknown']);
  });
});
