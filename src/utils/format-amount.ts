import { formatNumber } from './format-number';

/**
 * Format an amount using the current locale
 * This is a wrapper around formatNumber for backward compatibility
 */
const formatAmount = (
  amount: number,
  {
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
  }: { minimumFractionDigits?: number; maximumFractionDigits?: number } = {}
) => {
  return formatNumber(amount, {
    minimumFractionDigits,
    maximumFractionDigits,
  });
};

export default formatAmount;
