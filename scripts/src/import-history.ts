/**
 * import-history.ts — Reconstruct ALL-TIME OHLCV candles for CASH/USD
 * by scraping every swap event from the LiquidSwap CASH/APT pool on Aptos.
 *
 * Data sources:
 *   1. Aptos REST API — all SwapEvents from the LiquidSwap EventsStore
 *   2. Aptos REST API — transaction timestamps (by version)
 *   3. CoinGecko — APT/USD daily prices to convert CASH/APT → CASH/USD
 *
 * Output: apps/trading/public/data/cash-historical-candles.json
 *
 * Usage:
 *   pnpm --filter @cash/scripts import-history
 */

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";

// ============================================================
// Constants
// ============================================================

const APTOS_API = "https://api.mainnet.aptoslabs.com/v1";

/** LiquidSwap resource account that holds the EventsStore. */
const RESOURCE_ACCOUNT =
  "0x61d2c22a6cb7831bee0f48363b0eec92369357aece0d1142062f7d5d85c7bef8";

/** Full event handle type for swap events. */
const EVENT_HANDLE =
  "0x163df34fccbf003ce219d3f1d9e70d140b60622cb9dd47599c25fb2f797ba6e::liquidity_pool::EventsStore<0x61ed8b048636516b4eaf4c74250fa4f9440d9c3e163d96aeb863fe658a4bdc67::CASH::CASH, 0x1::aptos_coin::AptosCoin, 0x163df34fccbf003ce219d3f1d9e70d140b60622cb9dd47599c25fb2f797ba6e::curves::Uncorrelated>";

const FIELD_NAME = "swap_handle";

/** Token decimals. */
const CASH_DECIMALS = 6;
const APT_DECIMALS = 8;

/** Events per page (Aptos REST API max). */
const PAGE_SIZE = 100;

/** Concurrent requests for event fetching. */
const CONCURRENCY = 10;

/** Output path. */
const OUTPUT_PATH = join(
  dirname(new URL(import.meta.url).pathname),
  "../../apps/trading/public/data/cash-historical-candles.json",
);

// ============================================================
// Types
// ============================================================

interface SwapEvent {
  version: string;
  sequence_number: string;
  data: {
    x_in: string;   // CASH in (6 decimals)
    x_out: string;  // CASH out (6 decimals)
    y_in: string;   // APT in (8 decimals)
    y_out: string;  // APT out (8 decimals)
  };
}

interface ParsedSwap {
  version: number;
  seq: number;
  cashAmount: number;  // human units
  aptAmount: number;   // human units
  priceApt: number;    // APT per CASH
  timestampMs: number; // filled in later
}

interface DailyCandle {
  timestamp: number;  // ms, start of UTC day
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;     // USD volume
}

// ============================================================
// Helpers
// ============================================================

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchJson<T>(url: string, retries = 3): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url);
      if (res.status === 429) {
        const wait = Math.pow(2, i + 1) * 1000;
        console.warn(`  429 rate limited, waiting ${wait}ms...`);
        await sleep(wait);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      return (await res.json()) as T;
    } catch (err) {
      if (i === retries - 1) throw err;
      await sleep(1000 * (i + 1));
    }
  }
  throw new Error("unreachable");
}

// ============================================================
// Step 1: Fetch all swap events
// ============================================================

async function fetchAllSwapEvents(): Promise<SwapEvent[]> {
  const encodedHandle = encodeURIComponent(EVENT_HANDLE);
  const baseUrl = `${APTOS_API}/accounts/${RESOURCE_ACCOUNT}/events/${encodedHandle}/${FIELD_NAME}`;

  // First, get the total count by fetching the latest event
  const probe = await fetchJson<SwapEvent[]>(`${baseUrl}?start=0&limit=1`);
  if (probe.length === 0) throw new Error("No swap events found");

  // Fetch last event to get total count
  // Actually, let's just paginate until we get an empty page
  console.log("Fetching all swap events from Aptos...");

  const allEvents: SwapEvent[] = [];
  let start = 0;
  let totalFetched = 0;

  while (true) {
    // Fetch multiple pages concurrently
    const batch: Promise<SwapEvent[]>[] = [];
    for (let i = 0; i < CONCURRENCY; i++) {
      const offset = start + i * PAGE_SIZE;
      batch.push(
        fetchJson<SwapEvent[]>(`${baseUrl}?start=${offset}&limit=${PAGE_SIZE}`)
          .catch(() => [] as SwapEvent[]),
      );
    }

    const results = await Promise.all(batch);
    let gotData = false;

    for (const events of results) {
      if (events.length > 0) {
        allEvents.push(...events);
        gotData = true;
      }
    }

    totalFetched += results.reduce((s, r) => s + r.length, 0);
    start += CONCURRENCY * PAGE_SIZE;

    if (!gotData) break;

    // Log progress every 10K events
    if (totalFetched % 10000 < CONCURRENCY * PAGE_SIZE) {
      console.log(`  ${totalFetched.toLocaleString()} events fetched...`);
    }

    // Small delay to be nice to the API
    await sleep(100);
  }

  // Deduplicate by sequence_number (concurrent fetches might overlap)
  const seen = new Set<string>();
  const unique = allEvents.filter((e) => {
    if (seen.has(e.sequence_number)) return false;
    seen.add(e.sequence_number);
    return true;
  });

  // Sort by sequence_number
  unique.sort((a, b) => Number(a.sequence_number) - Number(b.sequence_number));

  console.log(`  Total unique events: ${unique.length.toLocaleString()}`);
  return unique;
}

// ============================================================
// Step 2: Parse swap events into price data
// ============================================================

function parseSwapEvents(events: SwapEvent[]): ParsedSwap[] {
  const swaps: ParsedSwap[] = [];

  for (const e of events) {
    const xIn = Number(e.data.x_in) / Math.pow(10, CASH_DECIMALS);
    const xOut = Number(e.data.x_out) / Math.pow(10, CASH_DECIMALS);
    const yIn = Number(e.data.y_in) / Math.pow(10, APT_DECIMALS);
    const yOut = Number(e.data.y_out) / Math.pow(10, APT_DECIMALS);

    let cashAmount: number;
    let aptAmount: number;

    if (yIn > 0 && xOut > 0) {
      // Buy CASH: APT in → CASH out
      cashAmount = xOut;
      aptAmount = yIn;
    } else if (xIn > 0 && yOut > 0) {
      // Sell CASH: CASH in → APT out
      cashAmount = xIn;
      aptAmount = yOut;
    } else {
      continue; // Skip zero-value events
    }

    if (cashAmount <= 0 || aptAmount <= 0) continue;

    const priceApt = aptAmount / cashAmount;

    swaps.push({
      version: Number(e.version),
      seq: Number(e.sequence_number),
      cashAmount,
      aptAmount,
      priceApt,
      timestampMs: 0, // filled in step 3
    });
  }

  return swaps;
}

// ============================================================
// Step 3: Resolve timestamps via sampling + interpolation
// ============================================================

/**
 * For daily candles, we don't need every swap's exact timestamp.
 * Sample every SAMPLE_INTERVAL-th swap, resolve those versions,
 * then linearly interpolate the rest. This reduces ~157K API calls
 * to ~1,600 — finishing in ~1 minute instead of 1 hour.
 */
const SAMPLE_INTERVAL = 100;

async function resolveTimestamps(swaps: ParsedSwap[]): Promise<void> {
  if (swaps.length === 0) return;

  console.log("Resolving timestamps (sampled + interpolated)...");

  // Collect sample versions: first, last, and every SAMPLE_INTERVAL-th
  const sampleIndices: number[] = [0];
  for (let i = SAMPLE_INTERVAL; i < swaps.length; i += SAMPLE_INTERVAL) {
    sampleIndices.push(i);
  }
  if (sampleIndices[sampleIndices.length - 1] !== swaps.length - 1) {
    sampleIndices.push(swaps.length - 1);
  }

  const sampleVersions = sampleIndices.map((i) => ({
    idx: i,
    version: swaps[i].version,
  }));

  console.log(`  Resolving ${sampleVersions.length} sample points...`);

  // Resolve sample timestamps concurrently
  for (let i = 0; i < sampleVersions.length; i += CONCURRENCY) {
    const batch = sampleVersions.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map((s) =>
        fetchJson<{ timestamp: string }>(
          `${APTOS_API}/transactions/by_version/${s.version}`,
        ).then((tx) => ({
          idx: s.idx,
          ts: Number(tx.timestamp) / 1000, // microseconds → ms
        }))
          .catch(() => ({ idx: s.idx, ts: 0 })),
      ),
    );

    for (const r of results) {
      if (r.ts > 0) swaps[r.idx].timestampMs = r.ts;
    }

    if ((i + CONCURRENCY) % 200 < CONCURRENCY) {
      console.log(`  ${Math.min(i + CONCURRENCY, sampleVersions.length)} / ${sampleVersions.length} samples resolved`);
    }

    await sleep(30);
  }

  console.log(`  All samples resolved. Interpolating...`);

  // Linear interpolation between resolved samples
  let prevResolved = -1;
  for (let i = 0; i < swaps.length; i++) {
    if (swaps[i].timestampMs > 0) {
      // Fill gap between prevResolved and i
      if (prevResolved >= 0 && i - prevResolved > 1) {
        const t0 = swaps[prevResolved].timestampMs;
        const t1 = swaps[i].timestampMs;
        const gap = i - prevResolved;
        for (let j = prevResolved + 1; j < i; j++) {
          const frac = (j - prevResolved) / gap;
          swaps[j].timestampMs = t0 + frac * (t1 - t0);
        }
      }
      prevResolved = i;
    }
  }

  // Fill any trailing unresolved
  if (prevResolved >= 0) {
    for (let i = prevResolved + 1; i < swaps.length; i++) {
      swaps[i].timestampMs = swaps[prevResolved].timestampMs;
    }
  }

  const resolved = swaps.filter((s) => s.timestampMs > 0).length;
  console.log(`  ${resolved.toLocaleString()} / ${swaps.length.toLocaleString()} swaps timestamped`);
}

// ============================================================
// Step 4: Fetch APT/USD daily prices from OKX (free, no key, full history)
// ============================================================

async function fetchAptUsdPrices(): Promise<Map<string, number>> {
  console.log("Fetching APT/USDT daily prices from OKX...");

  const priceMap = new Map<string, number>();

  // OKX returns 100 candles per request, paginate backward using `after` (oldest ts)
  // Pool created Sept 29, 2024 — fetch from a bit before that
  const poolCreation = new Date("2024-09-01T00:00:00Z").getTime();
  let after = Date.now(); // Start from now, paginate backward

  while (after > poolCreation) {
    const url = `https://www.okx.com/api/v5/market/history-candles?instId=APT-USDT&bar=1D&limit=100&after=${after}`;
    const data = await fetchJson<{
      data: [string, string, string, string, string, string, string, string, string][];
    }>(url);

    if (!data.data || data.data.length === 0) break;

    for (const candle of data.data) {
      // OKX format: [ts, open, high, low, close, vol, volCcy, volCcyQuote, confirm]
      const ts = Number(candle[0]);
      const close = Number(candle[4]);
      const day = new Date(ts).toISOString().slice(0, 10);
      priceMap.set(day, close);
    }

    // Paginate: `after` = oldest timestamp in this batch
    const oldest = Math.min(...data.data.map((c) => Number(c[0])));
    after = oldest;

    await sleep(200); // Rate limit courtesy
  }

  console.log(`  Got ${priceMap.size} days of APT/USDT prices`);
  return priceMap;
}

// ============================================================
// Step 5: Build daily OHLCV candles
// ============================================================

function buildDailyCandles(
  swaps: ParsedSwap[],
  aptUsd: Map<string, number>,
): DailyCandle[] {
  console.log("Building daily OHLCV candles...");

  // Group swaps by UTC day
  const dayMap = new Map<string, ParsedSwap[]>();

  for (const swap of swaps) {
    if (swap.timestampMs <= 0) continue;
    const day = new Date(swap.timestampMs).toISOString().slice(0, 10);
    if (!dayMap.has(day)) dayMap.set(day, []);
    dayMap.get(day)!.push(swap);
  }

  const candles: DailyCandle[] = [];

  // Get sorted list of all days with data
  const sortedDays = [...dayMap.keys()].sort();

  // We need APT/USD for each day. If missing, try nearest available.
  function getAptPrice(day: string): number {
    if (aptUsd.has(day)) return aptUsd.get(day)!;
    // Try nearby days
    const d = new Date(day);
    for (let offset = 1; offset <= 7; offset++) {
      const prev = new Date(d.getTime() - offset * 86400000).toISOString().slice(0, 10);
      const next = new Date(d.getTime() + offset * 86400000).toISOString().slice(0, 10);
      if (aptUsd.has(prev)) return aptUsd.get(prev)!;
      if (aptUsd.has(next)) return aptUsd.get(next)!;
    }
    return 0;
  }

  for (const day of sortedDays) {
    const daySwaps = dayMap.get(day)!;
    const aptPrice = getAptPrice(day);
    if (aptPrice <= 0) continue;

    // Sort by sequence number within the day
    daySwaps.sort((a, b) => a.seq - b.seq);

    // Convert APT prices to USD
    const usdPrices = daySwaps.map((s) => s.priceApt * aptPrice);
    const volumes = daySwaps.map((s) => s.cashAmount * s.priceApt * aptPrice);

    const dayStart = new Date(day + "T00:00:00Z").getTime();

    candles.push({
      timestamp: dayStart,
      open: usdPrices[0],
      high: Math.max(...usdPrices),
      low: Math.min(...usdPrices),
      close: usdPrices[usdPrices.length - 1],
      volume: volumes.reduce((a, b) => a + b, 0),
    });
  }

  candles.sort((a, b) => a.timestamp - b.timestamp);
  return candles;
}

// ============================================================
// Main
// ============================================================

async function main(): Promise<void> {
  console.log("=============================================");
  console.log("  CASH On-Chain Historical OHLCV Importer");
  console.log("=============================================\n");

  const startTime = Date.now();

  // Step 1: Fetch all swap events
  const events = await fetchAllSwapEvents();

  // Step 2: Parse into swap data
  const swaps = parseSwapEvents(events);
  console.log(`Parsed ${swaps.length.toLocaleString()} valid swaps\n`);

  // Step 3: Resolve timestamps
  await resolveTimestamps(swaps);

  // Step 4: Fetch APT/USD prices
  const aptUsd = await fetchAptUsdPrices();

  // Step 5: Build candles
  const candles = buildDailyCandles(swaps, aptUsd);

  // Stats
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nResults:`);
  console.log(`  Total daily candles: ${candles.length}`);
  if (candles.length > 0) {
    const first = candles[0];
    const last = candles[candles.length - 1];
    console.log(`  Date range: ${new Date(first.timestamp).toISOString().slice(0, 10)} → ${new Date(last.timestamp).toISOString().slice(0, 10)}`);
    console.log(`  Price range: $${Math.min(...candles.map((c) => c.low)).toFixed(8)} — $${Math.max(...candles.map((c) => c.high)).toFixed(8)}`);
  }
  console.log(`  Elapsed: ${elapsed}s`);

  // Save
  const outDir = dirname(OUTPUT_PATH);
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  writeFileSync(OUTPUT_PATH, JSON.stringify(candles, null, 2), "utf-8");
  console.log(`\n✓ Saved to ${OUTPUT_PATH}\n`);
}

main().catch((err: unknown) => {
  console.error("Import failed:", err);
  process.exit(1);
});
