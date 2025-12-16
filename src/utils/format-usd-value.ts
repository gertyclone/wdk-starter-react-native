import { formatUSD } from './format-currency';
import { formatNumber } from './format-number';

/**
 * Format USD value with optional symbol
 * Uses localized currency formatting
 */
const formatUSDValue = (usdValue: number, includeSymbol: boolean = true): string => {
  if (usdValue === 0) {
    const formatted = formatNumber(usdValue, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return includeSymbol ? formatUSD(usdValue) : formatted;
  }
  
  if (usdValue < 0.01) {
    const formatted = '< ' + formatNumber(0.01, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    // For very small values, show "< 0.01" format
    if (includeSymbol) {
      // Format as currency but replace the number part
      const currencyFormatted = formatUSD(0.01);
      return currencyFormatted.replace('0.01', formatted.replace('< ', ''));
    }
    return formatted;
  }
  
  return includeSymbol ? formatUSD(usdValue) : formatNumber(usdValue, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export default formatUSDValue;
