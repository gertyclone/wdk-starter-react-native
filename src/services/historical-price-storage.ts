import AsyncStorage from '@react-native-async-storage/async-storage';
import { AssetTicker } from '@tetherto/wdk-react-native-provider';

const STORAGE_KEY_EARLIEST_DATES = 'wdk_earliest_token_dates';
const STORAGE_KEY_HISTORICAL_PRICES = 'wdk_historical_prices';
const MAX_POINTS_PER_TOKEN = 200;
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Don't request prices older than this (API limit is 365 days; use 300 for safety). */
const MAX_REQUEST_DAYS_MS = 300 * 24 * 60 * 60 * 1000;

/** Midnight UTC (ms) for the day containing tsMs. */
function dayMidnightMs(tsMs: number): number {
  return Math.floor(tsMs / DAY_MS) * DAY_MS;
}

/**
 * Contiguous day ranges missing from existing data between startMs and today at midnight.
 * Returns [{ startMs, endMs }, ...] where each range is midnight-to-midnight (endMs is exclusive for the last day).
 */
function missingDayRanges(
  existing: HistoricalPricePoint[],
  startMs: number,
  todayMidnightMs: number
): Array<{ startMs: number; endMs: number }> {
  const haveDays = new Set<number>();
  for (const p of existing) {
    haveDays.add(dayMidnightMs(p.ts));
  }
  const rangeStartDay = dayMidnightMs(startMs);
  const rangeEndDay = todayMidnightMs;
  const ranges: Array<{ startMs: number; endMs: number }> = [];
  let gapStart: number | null = null;
  for (let dayMs = rangeStartDay; dayMs <= rangeEndDay; dayMs += DAY_MS) {
    const hasDay = haveDays.has(dayMs);
    if (!hasDay) {
      if (gapStart === null) gapStart = dayMs;
    } else {
      if (gapStart !== null) {
        const lastMissingDayMs = dayMs - DAY_MS;
        ranges.push({ startMs: gapStart, endMs: lastMissingDayMs + DAY_MS });
        gapStart = null;
      }
    }
  }
  if (gapStart !== null) {
    ranges.push({ startMs: gapStart, endMs: rangeEndDay + DAY_MS - 1 });
  }
  return ranges;
}

/** Listeners notified when historical prices are saved (e.g. after sync). */
const historicalPricesUpdatedListeners = new Set<() => void>();

/**
 * Subscribe to historical price updates (e.g. after sync completes).
 * Returns an unsubscribe function.
 */
export function onHistoricalPricesUpdated(callback: () => void): () => void {
  historicalPricesUpdatedListeners.add(callback);
  return () => historicalPricesUpdatedListeners.delete(callback);
}

function notifyHistoricalPricesUpdated(): void {
  historicalPricesUpdatedListeners.forEach((cb) => cb());
}

export interface HistoricalPricePoint {
  price: number;
  ts: number;
}

export interface TokenHistoricalPrices {
  lastUpdated: number;
  data: HistoricalPricePoint[];
}

export type EarliestDatesMap = Record<string, number>;
export type HistoricalPricesMap = Record<string, TokenHistoricalPrices>;

/** Transaction shape from wallet context (timestamp in seconds from indexer) */
export interface TransactionLike {
  token: string;
  timestamp: number;
}

/**
 * Compute earliest timestamp (ms) per token from activity/transactions.
 */
export function getEarliestDatesFromTransactions(
  transactions: TransactionLike[]
): EarliestDatesMap {
  const byToken = new Map<string, number>();
  for (const tx of transactions) {
    const token = tx.token?.toLowerCase();
    if (!token) continue;
    const tsMs = tx.timestamp < 1e12 ? tx.timestamp * 1000 : tx.timestamp;
    const existing = byToken.get(token);
    if (existing === undefined || tsMs < existing) {
      byToken.set(token, tsMs);
    }
  }
  return Object.fromEntries(byToken);
}

/**
 * Load earliest token dates from AsyncStorage.
 */
export async function loadEarliestDates(): Promise<EarliestDatesMap> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_EARLIEST_DATES);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * Save earliest token dates to AsyncStorage.
 */
export async function saveEarliestDates(dates: EarliestDatesMap): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY_EARLIEST_DATES, JSON.stringify(dates));
}

/**
 * Load historical price series per token from AsyncStorage.
 */
export async function loadHistoricalPrices(): Promise<HistoricalPricesMap> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_HISTORICAL_PRICES);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * Save historical price series to AsyncStorage.
 */
export async function saveHistoricalPrices(
  prices: HistoricalPricesMap
): Promise<void> {
  await AsyncStorage.setItem(
    STORAGE_KEY_HISTORICAL_PRICES,
    JSON.stringify(prices)
  );
}

/**
 * Clear all historical price data from AsyncStorage (prices and earliest dates).
 * When EXPO_PUBLIC_CLEAR_PRICES is true, call this before sync so data is
 * reloaded from the API from 365 days ago.
 */
export async function clearAllHistoricalPriceData(): Promise<void> {
  await AsyncStorage.multiRemove([
    STORAGE_KEY_HISTORICAL_PRICES,
    STORAGE_KEY_EARLIEST_DATES,
  ]);
}

/**
 * Merge new price points into existing series, sort by ts, dedupe, cap size.
 */
export function mergePriceSeries(
  existing: HistoricalPricePoint[],
  newPoints: HistoricalPricePoint[]
): HistoricalPricePoint[] {
  const byTs = new Map<number, number>();
  for (const p of existing) byTs.set(p.ts, p.price);
  for (const p of newPoints) byTs.set(p.ts, p.price);
  const merged = Array.from(byTs.entries())
    .map(([ts, price]) => ({ ts, price }))
    .sort((a, b) => a.ts - b.ts);
  if (merged.length <= MAX_POINTS_PER_TOKEN) return merged;
  return downscaleToMax(merged, MAX_POINTS_PER_TOKEN);
}

function downscaleToMax(
  sorted: HistoricalPricePoint[],
  max: number
): HistoricalPricePoint[] {
  if (sorted.length <= max) return sorted;
  const step = sorted.length / max;
  const result: HistoricalPricePoint[] = [];
  for (let i = 0; i < max; i++) {
    const idx = Math.min(Math.floor(i * step), sorted.length - 1);
    result.push(sorted[idx]);
  }
  return result;
}

/**
 * AssetTicker to Bitfinex/API symbol (uppercase).
 */
export function assetTickerToSymbol(ticker: AssetTicker): string {
  return ticker.toUpperCase();
}

/**
 * Tokens we fetch historical data for (skip stablecoins if not needed for chart).
 */
export const HISTORICAL_PRICE_TOKENS: AssetTicker[] = [
  AssetTicker.BTC,
  AssetTicker.XAUT,
  // USDT/USAT are stable; optionally add if Bitfinex has series
];

export interface PricingServiceLike {
  getHistoricalPrice(opts: {
    from: AssetTicker;
    to: string;
    start?: number;
    end?: number;
    apiFromSymbol?: string;
  }): Promise<HistoricalPricePoint[]>;
}

/**
 * Sync earliest token dates from activity and historical price data.
 * - Computes earliest date per token from transactions, merges with stored dates, saves.
 * - For each token: only requests day ranges missing from stored data (from start through today at midnight), merges, saves.
 */
export async function syncHistoricalPrices(
  transactions: TransactionLike[],
  pricingService: PricingServiceLike
): Promise<void> {
  const nowMs = Date.now();
  const todayMidnightMs = dayMidnightMs(nowMs);
  const oneYearAgoMs = nowMs - ONE_YEAR_MS;
  const requestCutoffMs = nowMs - MAX_REQUEST_DAYS_MS;

  const fromActivity = getEarliestDatesFromTransactions(transactions);
  const storedDates = await loadEarliestDates();
  const mergedDates: EarliestDatesMap = { ...storedDates };
  for (const [token, ms] of Object.entries(fromActivity)) {
    const existing = mergedDates[token];
    if (existing === undefined || ms < existing) {
      mergedDates[token] = ms;
    }
  }
  await saveEarliestDates(mergedDates);

  const storedPrices = await loadHistoricalPrices();
  const updatedPrices: HistoricalPricesMap = { ...storedPrices };

  for (const ticker of HISTORICAL_PRICE_TOKENS) {
    const tokenKey = ticker.toLowerCase();
    const earliestMs = mergedDates[tokenKey] ?? oneYearAgoMs;
    const startMs = Math.max(earliestMs, requestCutoffMs);
    const existing = storedPrices[tokenKey]?.data ?? [];

    if (startMs >= todayMidnightMs + DAY_MS) continue;

    const ranges = missingDayRanges(existing, startMs, todayMidnightMs);
    if (ranges.length === 0) {
      continue;
    }

    let merged = existing;
    for (const range of ranges) {
      try {
        console.log('[HistoricalPrice] fetching missing range', {
          ticker,
          start: range.startMs,
          end: range.endMs,
          startDate: new Date(range.startMs).toISOString(),
          endDate: new Date(range.endMs).toISOString(),
        });
        const newPoints = await pricingService.getHistoricalPrice({
          from: ticker,
          to: 'USD',
          start: range.startMs,
          end: range.endMs,
        });
        merged = mergePriceSeries(merged, newPoints);
      } catch (err) {
        console.warn(`[HistoricalPrice] Failed to fetch ${ticker} range ${range.startMs}-${range.endMs}:`, err);
      }
    }
    updatedPrices[tokenKey] = {
      lastUpdated: nowMs,
      data: merged,
    };
  }

  await saveHistoricalPrices(updatedPrices);
  notifyHistoricalPricesUpdated();
}

const ONE_YEAR_MS_EXPORT = 365 * 24 * 60 * 60 * 1000;

/** Token display colors for chart lines (hex) */
export const TOKEN_CHART_COLORS: Record<string, string> = {
  btc: '#F7931A',
  xaut: '#D4AF37',
  usdt: '#26A17B',
  usat: '#2775CA',
};

export interface ChartDataset {
  data: number[];
  color: (opacity?: number) => string;
  strokeWidth?: number;
}

export interface PriceChartData {
  labels: string[];
  datasets: ChartDataset[];
  legend: string[];
}

/**
 * Build LineChart-ready data from stored historical prices.
 * - Restricts to last year of data.
 * - Builds a unified timeline (sorted unique timestamps); each token gets a value at each timestamp (nearest prior price).
 * - Labels are formatted dates; sample to avoid crowding (e.g. first, last, and a few in between).
 */
function toMs(ts: number): number {
  return ts < 1e12 ? ts * 1000 : ts;
}

/** Token keys used for the price line chart (BTC and XAUT only). */
const CHART_TOKEN_KEYS = ['btc', 'xaut'] as const;

export function buildPriceChartData(
  stored: HistoricalPricesMap,
  maxPoints = 80
): PriceChartData | null {
  const tokenKeys = CHART_TOKEN_KEYS.filter((k) => stored[k]?.data?.length);
  if (tokenKeys.length === 0) return null;

  const nowMs = Date.now();
  const oneYearAgoMs = nowMs - ONE_YEAR_MS_EXPORT;
  const allTs: number[] = [];
  for (const key of tokenKeys) {
    for (const p of stored[key].data) {
      const tsMs = toMs(p.ts);
      allTs.push(tsMs);
    }
  }
  const uniqueTs = Array.from(new Set(allTs)).sort((a, b) => a - b);
  if (uniqueTs.length === 0) return null;

  let sortedTs =
    uniqueTs.length <= maxPoints
      ? uniqueTs
      : (() => {
          const step = (uniqueTs.length - 1) / (maxPoints - 1);
          const out: number[] = [];
          for (let i = 0; i < maxPoints; i++) {
            const idx =
              i === maxPoints - 1 ? uniqueTs.length - 1 : Math.round(i * step);
            out.push(uniqueTs[idx]);
          }
          return out;
        })();

  if (sortedTs.length === 1) {
    sortedTs = [sortedTs[0], sortedTs[0] + DAY_MS];
  }

  const labels = sortedTs.map((ts) => {
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  });

  const datasets: ChartDataset[] = [];
  const legend: string[] = [];

  for (const tokenKey of tokenKeys) {
    const rawPoints = stored[tokenKey].data
      .map((p) => ({ ...p, tsMs: toMs(p.ts) }))
      .filter((p) => p.tsMs >= oneYearAgoMs)
      .sort((a, b) => a.tsMs - b.tsMs);
    if (rawPoints.length === 0) continue;

    const data = sortedTs.map((ts) => {
      let i = 0;
      while (i < rawPoints.length && rawPoints[i].tsMs <= ts) i++;
      if (i === 0) return rawPoints[0].price;
      if (i >= rawPoints.length) return rawPoints[rawPoints.length - 1].price;
      const a = rawPoints[i - 1];
      const b = rawPoints[i];
      const t = (ts - a.tsMs) / (b.tsMs - a.tsMs);
      return a.price * (1 - t) + b.price * t;
    });

    const hex = TOKEN_CHART_COLORS[tokenKey] ?? '#999';
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    datasets.push({
      data,
      color: (opacity = 1) => `rgba(${r},${g},${b},${opacity})`,
      strokeWidth: 2,
    });
    legend.push(tokenKey.toUpperCase());
  }

  if (datasets.length === 0) return null;
  return { labels, datasets, legend };
}
