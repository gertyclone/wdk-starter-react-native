import i18n from '@/i18n';
import parseWorkletError from './parse-worklet-error';

/**
 * Map common error patterns to translation keys
 */
const mapErrorToTranslationKey = (error: Error | string): string | null => {
  const errorMessage = typeof error === 'string' ? error : error.message?.toLowerCase() || '';
  
  // Network errors
  if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
    return 'errors:network.failed';
  }
  if (errorMessage.includes('timeout')) {
    return 'errors:network.timeout';
  }
  
  // Wallet errors
  if (errorMessage.includes('wallet') && errorMessage.includes('lock')) {
    return 'errors:wallet.locked';
  }
  if (errorMessage.includes('wallet') && errorMessage.includes('not found')) {
    return 'errors:wallet.notFound';
  }
  if (errorMessage.includes('unlock')) {
    return 'errors:wallet.unlockFailed';
  }
  
  // Transaction errors
  if (errorMessage.includes('transaction')) {
    return 'errors:transaction.failed';
  }
  if (errorMessage.includes('insufficient') || errorMessage.includes('balance')) {
    return 'errors:transaction.insufficientFunds';
  }
  if (errorMessage.includes('invalid address')) {
    return 'errors:transaction.invalidAddress';
  }
  if (errorMessage.includes('invalid amount')) {
    return 'errors:transaction.invalidAmount';
  }
  
  // Validation errors
  if (errorMessage.includes('required')) {
    return 'errors:validation.required';
  }
  if (errorMessage.includes('invalid format')) {
    return 'errors:validation.invalidFormat';
  }
  
  return null;
};

/**
 * Get a localized error message
 * @param error - The error object or string
 * @param fallbackMessage - Fallback message (can be a translation key or plain text)
 * @param fallbackKey - Optional translation key for fallback (e.g., 'errors:generic.unknown')
 */
const getErrorMessage = (
  error: unknown,
  fallbackMessage: string,
  fallbackKey?: string
): string => {
  // Try to parse worklet error first
  const workletError = parseWorkletError(error);
  if (workletError) {
    // Map worklet error code to translation if possible
    const translationKey = mapErrorToTranslationKey(workletError.message);
    if (translationKey) {
      return i18n.t(translationKey);
    }
    return workletError.message;
  }
  
  // Try to map error to translation key
  if (error instanceof Error) {
    const translationKey = mapErrorToTranslationKey(error);
    if (translationKey) {
      return i18n.t(translationKey);
    }
    // If error message looks like it might be a translation key, try it
    if (error.message.includes(':')) {
      try {
        return i18n.t(error.message);
      } catch {
        // Not a translation key, use as-is
      }
    }
    return error.message;
  }
  
  // Check if fallback is a translation key
  if (fallbackKey) {
    return i18n.t(fallbackKey);
  }
  
  // Check if fallbackMessage looks like a translation key
  if (fallbackMessage.includes(':')) {
    try {
      return i18n.t(fallbackMessage);
    } catch {
      // Not a translation key, use as-is
    }
  }
  
  return fallbackMessage;
};

export default getErrorMessage;
