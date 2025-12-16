import { useTranslation as useI18nTranslation } from 'react-i18next';

/**
 * Custom translation hook with type safety and error handling
 * Wraps react-i18next's useTranslation hook
 */
export const useTranslation = (namespace?: string | string[]) => {
  const { t, i18n, ready } = useI18nTranslation(namespace);

  /**
   * Type-safe translation function with error handling
   */
  const translate = (key: string, options?: any): string => {
    try {
      const translation = t(key, options);
      
      // Ensure we return a string
      const result = typeof translation === 'string' ? translation : String(translation);
      
      // In development, log missing translations
      if (process.env.NODE_ENV === 'development' && result === key) {
        console.warn(`[i18n] Missing translation for key: ${key}`);
      }
      
      return result;
    } catch (error) {
      console.error(`[i18n] Translation error for key: ${key}`, error);
      return key; // Return key as fallback
    }
  };

  return {
    t: translate,
    i18n,
    ready,
    language: i18n.language,
    changeLanguage: i18n.changeLanguage,
  };
};

export default useTranslation;
