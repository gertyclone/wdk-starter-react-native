import { useWallet } from '@tetherto/wdk-react-native-provider';
import React, { useEffect, useRef } from 'react';
import { pricingService } from '@/services/pricing-service';
import {
  clearAllHistoricalPriceData,
  syncHistoricalPrices,
  type TransactionLike,
} from '@/services/historical-price-storage';

const shouldClearPrices =
  typeof process !== 'undefined' &&
  process.env.EXPO_PUBLIC_CLEAR_PRICES === 'true';

/**
 * When the wallet is unlocked and transactions are loaded, computes earliest
 * date per token from activity, stores it in AsyncStorage, fetches historical
 * prices from that date to now (or appends new data since last launch), and
 * stores the series in AsyncStorage.
 * If EXPO_PUBLIC_CLEAR_PRICES is true, clears all stored historical data first
 * so it is reloaded from the API (100 days from today at midnight).
 */
export function HistoricalPriceSync() {
  const { wallet, isUnlocked, transactions } = useWallet();
  const hasSyncedRef = useRef(false);

  useEffect(() => {
    if (!wallet || !isUnlocked || !transactions?.list || transactions.isLoading) {
      return;
    }
    if (hasSyncedRef.current) return;
    hasSyncedRef.current = true;

    const run = async () => {
      try {
        if (shouldClearPrices) {
          await clearAllHistoricalPriceData();
          console.log('[HistoricalPriceSync] Cleared historical price data (EXPO_PUBLIC_CLEAR_PRICES=true), reloading from API');
        }
        await pricingService.initialize();
        const list = transactions.list as TransactionLike[];
        await syncHistoricalPrices(list, pricingService);
      } catch (err) {
        console.warn('[HistoricalPriceSync]', err);
        hasSyncedRef.current = false;
      }
    };

    run();
  }, [wallet, isUnlocked, transactions?.list, transactions?.isLoading]);

  return null;
}
