/**
 * i18n Configuration
 * Defines supported languages, default language, and RTL language detection
 */

export const SUPPORTED_LANGUAGES = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  'zh-CN': '简体中文',
  ja: '日本語',
} as const;

export type SupportedLanguage = keyof typeof SUPPORTED_LANGUAGES;

export const DEFAULT_LANGUAGE: SupportedLanguage = 'en';

export const RTL_LANGUAGES: SupportedLanguage[] = [
  // Add RTL languages here when supported (e.g., 'ar', 'he')
];

/**
 * Check if a language is RTL
 */
export const isRTL = (language: string): boolean => {
  return RTL_LANGUAGES.includes(language as SupportedLanguage);
};

/**
 * Get language display name
 */
export const getLanguageName = (code: SupportedLanguage): string => {
  return SUPPORTED_LANGUAGES[code] || code;
};

/**
 * Get all supported language codes
 */
export const getSupportedLanguageCodes = (): SupportedLanguage[] => {
  return Object.keys(SUPPORTED_LANGUAGES) as SupportedLanguage[];
};
