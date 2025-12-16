import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES } from './config';

// Import translation files
import enCommon from './locales/en/common.json';
import enScreens from './locales/en/screens.json';
import enErrors from './locales/en/errors.json';

import esCommon from './locales/es/common.json';
import esScreens from './locales/es/screens.json';
import esErrors from './locales/es/errors.json';

import frCommon from './locales/fr/common.json';
import frScreens from './locales/fr/screens.json';
import frErrors from './locales/fr/errors.json';

import deCommon from './locales/de/common.json';
import deScreens from './locales/de/screens.json';
import deErrors from './locales/de/errors.json';

import zhCNCommon from './locales/zh-CN/common.json';
import zhCNScreens from './locales/zh-CN/screens.json';
import zhCNErrors from './locales/zh-CN/errors.json';

import jaCommon from './locales/ja/common.json';
import jaScreens from './locales/ja/screens.json';
import jaErrors from './locales/ja/errors.json';

const LANGUAGE_STORAGE_KEY = '@app/language';

// Translation resources
const resources = {
  en: {
    common: enCommon,
    screens: enScreens,
    errors: enErrors,
  },
  es: {
    common: esCommon,
    screens: esScreens,
    errors: esErrors,
  },
  fr: {
    common: frCommon,
    screens: frScreens,
    errors: frErrors,
  },
  de: {
    common: deCommon,
    screens: deScreens,
    errors: deErrors,
  },
  'zh-CN': {
    common: zhCNCommon,
    screens: zhCNScreens,
    errors: zhCNErrors,
  },
  ja: {
    common: jaCommon,
    screens: jaScreens,
    errors: jaErrors,
  },
};

/**
 * Get the initial language from device or storage
 */
const getInitialLanguage = async (): Promise<string> => {
  try {
    // Check if user has saved a language preference
    const savedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (savedLanguage && savedLanguage in SUPPORTED_LANGUAGES) {
      return savedLanguage;
    }

    // Get device locale
    const locales = getLocales();
    const primaryLocale = locales[0];
    const deviceLocale = primaryLocale.languageTag; // e.g., 'en-US', 'zh-CN'
    const languageCode = primaryLocale.languageCode; // e.g., 'en', 'zh'

    // Check if device language is supported
    if (languageCode && languageCode in SUPPORTED_LANGUAGES) {
      return languageCode;
    }

    // Check for full locale match (e.g., 'zh-CN')
    if (deviceLocale && deviceLocale in SUPPORTED_LANGUAGES) {
      return deviceLocale;
    }

    // Fallback to default
    return DEFAULT_LANGUAGE;
  } catch (error) {
    console.error('[i18n] Failed to get initial language:', error);
    return DEFAULT_LANGUAGE;
  }
};

/**
 * Initialize i18next
 */
export const initI18n = async (): Promise<void> => {
  const initialLanguage = await getInitialLanguage();

  await i18n.use(initReactI18next).init({
    compatibilityJSON: 'v4', // Use v4 format for pluralization
    resources,
    lng: initialLanguage,
    fallbackLng: DEFAULT_LANGUAGE,
    defaultNS: 'common',
    ns: ['common', 'screens', 'errors'],
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    react: {
      useSuspense: false, // Disable suspense for React Native
    },
  });
};

/**
 * Change language and persist to storage
 */
export const changeLanguage = async (languageCode: string): Promise<void> => {
  try {
    if (languageCode in SUPPORTED_LANGUAGES) {
      await i18n.changeLanguage(languageCode);
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, languageCode);
    } else {
      console.warn(`[i18n] Unsupported language: ${languageCode}`);
    }
  } catch (error) {
    console.error('[i18n] Failed to change language:', error);
  }
};

/**
 * Get current language
 */
export const getCurrentLanguage = (): string => {
  return i18n.language || DEFAULT_LANGUAGE;
};

export default i18n;
