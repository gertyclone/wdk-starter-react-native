import i18n from '@/i18n';
import { getLocales } from 'expo-localization';

export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'CNY' | string;

/**
 * Format a number as currency using the current locale
 */
export const formatCurrency = (
  value: number,
  currency: CurrencyCode = 'USD',
  options?: Intl.NumberFormatOptions
): string => {
  const locale = i18n.language || 'en';
  
  // Get locale-specific formatting from device
  const locales = getLocales();
  const deviceLocale = locales[0];
  
  // Use device locale for currency formatting if available, otherwise use i18n language
  const formatLocale = deviceLocale?.languageTag || locale;

  return new Intl.NumberFormat(formatLocale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options,
  }).format(value);
};

/**
 * Format USD value with symbol
 */
export const formatUSD = (
  value: number,
  options?: Intl.NumberFormatOptions
): string => {
  return formatCurrency(value, 'USD', options);
};

/**
 * Format currency without symbol (just the number)
 */
export const formatCurrencyValue = (
  value: number,
  currency: CurrencyCode = 'USD',
  options?: Intl.NumberFormatOptions
): string => {
  const locale = i18n.language || 'en';
  const locales = getLocales();
  const deviceLocale = locales[0];
  const formatLocale = deviceLocale?.languageTag || locale;

  return new Intl.NumberFormat(formatLocale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options,
  }).format(value);
};

export default formatCurrency;
