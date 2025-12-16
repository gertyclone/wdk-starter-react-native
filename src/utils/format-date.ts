import { useTranslation } from '@/hooks/use-translation';
import i18n from '@/i18n';

/**
 * Format a date using the current locale
 */
export const formatDate = (
  date: Date | number,
  options?: Intl.DateTimeFormatOptions
): string => {
  const locale = i18n.language || 'en';
  const dateObj = typeof date === 'number' ? new Date(date) : date;

  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...options,
  }).format(dateObj);
};

/**
 * Format a date with time using the current locale
 */
export const formatDateTime = (
  date: Date | number,
  options?: Intl.DateTimeFormatOptions
): string => {
  const locale = i18n.language || 'en';
  const dateObj = typeof date === 'number' ? new Date(date) : date;

  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    ...options,
  }).format(dateObj);
};

/**
 * Format a relative time (e.g., "2 hours ago", "in 3 days")
 */
export const formatRelativeTime = (
  date: Date | number,
  options?: Intl.RelativeTimeFormatOptions
): string => {
  const locale = i18n.language || 'en';
  const dateObj = typeof date === 'number' ? new Date(date) : date;
  const now = new Date();
  const diffInSeconds = Math.floor((dateObj.getTime() - now.getTime()) / 1000);

  const rtf = new Intl.RelativeTimeFormat(locale, {
    numeric: 'auto',
    ...options,
  });

  const absDiff = Math.abs(diffInSeconds);

  if (absDiff < 60) {
    return rtf.format(diffInSeconds, 'second');
  } else if (absDiff < 3600) {
    return rtf.format(Math.floor(diffInSeconds / 60), 'minute');
  } else if (absDiff < 86400) {
    return rtf.format(Math.floor(diffInSeconds / 3600), 'hour');
  } else if (absDiff < 2592000) {
    return rtf.format(Math.floor(diffInSeconds / 86400), 'day');
  } else if (absDiff < 31536000) {
    return rtf.format(Math.floor(diffInSeconds / 2592000), 'month');
  } else {
    return rtf.format(Math.floor(diffInSeconds / 31536000), 'year');
  }
};

export default formatDate;
