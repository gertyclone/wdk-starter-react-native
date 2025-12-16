import i18n from '@/i18n';
import { getLocales } from 'expo-localization';

/**
 * Format a number using the current locale
 */
export const formatNumber = (
  value: number,
  options?: Intl.NumberFormatOptions
): string => {
  const locale = i18n.language || 'en';
  
  // Get locale-specific formatting from device
  const locales = getLocales();
  const deviceLocale = locales[0];
  
  // Use device locale for number formatting if available, otherwise use i18n language
  const formatLocale = deviceLocale?.languageTag || locale;

  return new Intl.NumberFormat(formatLocale, {
    ...options,
  }).format(value);
};

/**
 * Format a number with default options (2 decimal places, no grouping)
 */
export const formatNumberDefault = (value: number): string => {
  return formatNumber(value, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

/**
 * Format a number as a percentage
 */
export const formatPercentage = (
  value: number,
  options?: Intl.NumberFormatOptions
): string => {
  const locale = i18n.language || 'en';
  const locales = getLocales();
  const deviceLocale = locales[0];
  const formatLocale = deviceLocale?.languageTag || locale;

  return new Intl.NumberFormat(formatLocale, {
    style: 'percent',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
    ...options,
  }).format(value / 100);
};

export default formatNumber;
