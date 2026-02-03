import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getBalanceAsOfTimestamp,
  type TransactionForBalance,
} from './historical-price-storage';

const STORAGE_KEY_BTC_DAILY_BALANCE = 'wdk_btc_daily_balance';
const DAY_MS = 24 * 60 * 60 * 1000;

/** Midnight UTC (ms) for the day containing tsMs. */
function dayMidnightMs(tsMs: number): number {
  return Math.floor(tsMs / DAY_MS) * DAY_MS;
}

/** Format timestamp (ms) as YYYY-MM-DD (UTC). */
function formatDateKey(tsMs: number): string {
  const d = new Date(tsMs);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export type BtcDailyBalanceTable = Record<string, number>;

/**
 * Build a table of BTC balance by day from first BTC activity through today.
 * Each day gets the balance at end of that day (receive increases, spend decreases).
 * Days with no activity repeat the prior day's balance via replay.
 * walletAddresses must match wallet UI: Object.values(addresses).map(addr => addr?.toLowerCase()).
 */
export function buildBtcDailyBalanceTable(
  transactions: TransactionForBalance[],
  walletAddresses: (string | undefined)[]
): BtcDailyBalanceTable {
  const btcTx = transactions.filter(
    (tx) => (tx.token ?? '').toLowerCase() === 'btc'
  );
  if (btcTx.length === 0) {
    const today = dayMidnightMs(Date.now());
    const key = formatDateKey(today);
    return { [key]: 0 };
  }

  const nowMs = Date.now();
  const todayMidnightMs = dayMidnightMs(nowMs);
  const firstTsMs = Math.min(
    ...btcTx.map((tx) =>
      tx.timestamp < 1e12 ? tx.timestamp * 1000 : tx.timestamp
    )
  );
  const firstDayMidnightMs = dayMidnightMs(firstTsMs);

  const table: BtcDailyBalanceTable = {};
  for (
    let dayMs = firstDayMidnightMs;
    dayMs <= todayMidnightMs;
    dayMs += DAY_MS
  ) {
    const endOfDayMs = dayMs + DAY_MS - 1;
    const bal = getBalanceAsOfTimestamp(
      transactions,
      walletAddresses,
      endOfDayMs
    );
    const key = formatDateKey(dayMs);
    table[key] = bal.btc ?? 0;
  }
  return table;
}

export async function saveBtcDailyBalanceTable(
  table: BtcDailyBalanceTable
): Promise<void> {
  await AsyncStorage.setItem(
    STORAGE_KEY_BTC_DAILY_BALANCE,
    JSON.stringify(table)
  );
}

export async function loadBtcDailyBalanceTable(): Promise<BtcDailyBalanceTable> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_BTC_DAILY_BALANCE);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * Build the table from current transactions, save to AsyncStorage, then return
 * the table (for logging). Call when BTC button is pressed.
 */
export async function buildSaveAndReturnBtcDailyBalanceTable(
  transactions: TransactionForBalance[],
  walletAddresses: (string | undefined)[]
): Promise<BtcDailyBalanceTable> {
  const table = buildBtcDailyBalanceTable(transactions, walletAddresses);
  await saveBtcDailyBalanceTable(table);
  return table;
}
