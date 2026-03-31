/**
 * import-history.ts — Fetch historical OHLCV data from GeckoTerminal API
 * for the LiquidSwap CASH/APT pool and save as a static JSON file.
 *
 * GeckoTerminal API endpoint:
 *   GET /networks/aptos/pools/{pool_address}/ohlcv/{timeframe}
 *
 * Pool: CASH/APT on LiquidSwap (created Sept 2024)
 * Output: web/data/historical-candles.json
 *
 * Rate limit: max 30 requests/min with exponential backoff on 429.
 *
 * Usage:
 *   npx tsx scripts/src/import-history.ts
 */

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";

// ============================================================
// Constants
// ============================================================

const GECKOTERMINAL_API = "https://api.geckoterminal.com/api/v2";

/** The full LiquidSwap CASH/APT pool address on Aptos. */
const POOL_ADDRESS =
  "0x163df34fccbf003ce219d3f1d9e70d140b60622cb9dd47599c25fb2f797ba6e::liquidity_pool::LiquidityPool<0x61ed8b048636516b4eaf4c74250fa4f9440d9c3e163d96aeb863fe658a4bdc67::CASH::CASH, 0x1::aptos_coin::AptosCoin, 0x163df34fccbf003ce219d3f1d9e70d140b60622cb9dd47599c25fb2f797ba6e::curves::Uncorrelated>";

/** Max candles per API request (GeckoTerminal limit). */
const PAGE_LIMIT = 1000;

/** Timeframe to fetch — daily candles for full history. */
const TIMEFRAME = "day";

/** Max requests per minute (GeckoTerminal free tier). */
const MAX_REQUESTS_PER_MIN = 30;

/** Delay between requests (ms) to stay under rate limit. */
const REQUEST_DELAY_MS = Math.ceil(60_000 / MAX_REQUESTS_PER_MIN) + 100; // ~2.1s

/** Max retries on rate limit (429) or transient errors. */
const MAX_RETRIES = 5;

/** Pool creation date (Sept 29, 2024) — stop pagination here. */
const POOL_CREATION_TS = Math.floor(new Date("2024-09-29T00:00:00Z").getTime() / 1000);

/** Output path relative to the repo root. */
const OUTPUT_PATH = join(dirname(new URL(import.meta.url).pathname), "../../web/data/historical-candles.json");

// ============================================================
// Types
// ============================================================

/** Raw OHLCV tuple from GeckoTerminal: [timestamp, open, high, low, close, volume]. */
type RawOHLCV = [number, number, number, number, number, number];

/** Output candle format. */
interface HistoricalCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** GeckoTerminal OHLCV API response shape. */
interface OHLCVResponse {
  data: {
    attributes: {
      ohlcv_list: RawOHLCV[];
    };
  };
}

// ============================================================
// Helpers
// ============================================================

/** Sleep for the given number of milliseconds. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch a single page of OHLCV data from GeckoTerminal.
 * Retries on 429 rate limit with exponential backoff.
 */
async function fetchOHLCVPage(
  beforeTimestamp?: number,
): Promise<RawOHLCV[]> {
  const encodedPool = encodeURIComponent(POOL_ADDRESS);
  let url = `${GECKOTERMINAL_API}/networks/aptos/pools/${encodedPool}/ohlcv/${TIMEFRAME}?currency=usd&limit=${PAGE_LIMIT}`;

  if (beforeTimestamp !== undefined) {
    url += `&before_timestamp=${beforeTimestamp}`;
  }

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const res = await fetch(url);

    if (res.status === 429) {
      const backoff = Math.pow(2, attempt + 1) * 1000;
      console.warn(`  ⚠ Rate limited (429). Waiting ${backoff / 1000}s before retry ${attempt + 1}/${MAX_RETRIES}...`);
      await sleep(backoff);
      continue;
    }

    if (!res.ok) {
      const body = await res.text();
      if (res.status >= 500 && attempt < MAX_RETRIES - 1) {
        const backoff = Math.pow(2, attempt + 1) * 1000;
        console.warn(`  ⚠ Server error (${res.status}). Waiting ${backoff / 1000}s before retry...`);
        await sleep(backoff);
        continue;
      }
      throw new Error(`GeckoTerminal API error ${res.status}: ${body}`);
    }

    const json = (await res.json()) as OHLCVResponse;
    return json.data.attributes.ohlcv_list;
  }

  throw new Error(`Failed after ${MAX_RETRIES} retries`);
}

/**
 * Convert raw OHLCV tuple to our output format.
 * Timestamps from API are in seconds — convert to milliseconds.
 */
function toCandle(raw: RawOHLCV): HistoricalCandle {
  return {
    timestamp: raw[0] * 1000, // Convert to milliseconds
    open: raw[1],
    high: raw[2],
    low: raw[3],
    close: raw[4],
    volume: raw[5],
  };
}

// ============================================================
// Main
// ============================================================

async function main(): Promise<void> {
  console.log("=============================================");
  console.log("  CASH/APT Historical OHLCV Import");
  console.log("=============================================");
  console.log("");
  console.log(`Pool:      ${POOL_ADDRESS.slice(0, 20)}...`);
  console.log(`Timeframe: ${TIMEFRAME}`);
  console.log(`Currency:  USD`);
  console.log(`Output:    ${OUTPUT_PATH}`);
  console.log("");

  const allCandles: HistoricalCandle[] = [];
  let beforeTimestamp: number | undefined;
  let pageNum = 0;
  const seenTimestamps = new Set<number>();

  while (true) {
    pageNum++;
    const label = beforeTimestamp
      ? `before ${new Date(beforeTimestamp * 1000).toISOString().slice(0, 10)}`
      : "latest";
    console.log(`→ Page ${pageNum}: Fetching ${label}...`);

    const rawCandles = await fetchOHLCVPage(beforeTimestamp);

    if (rawCandles.length === 0) {
      console.log("  No more data. Done.");
      break;
    }

    // Deduplicate and convert
    let added = 0;
    for (const raw of rawCandles) {
      if (!seenTimestamps.has(raw[0])) {
        seenTimestamps.add(raw[0]);
        allCandles.push(toCandle(raw));
        added++;
      }
    }

    console.log(`  Got ${rawCandles.length} candles (${added} new).`);

    // Find the oldest timestamp in this batch to paginate backward
    const oldestTs = Math.min(...rawCandles.map((c) => c[0]));

    // Stop if we've reached before the pool creation
    if (oldestTs <= POOL_CREATION_TS) {
      console.log("  Reached pool creation date. Done.");
      break;
    }

    // Stop if we got fewer candles than page limit (last page)
    if (rawCandles.length < PAGE_LIMIT) {
      console.log("  Last page (fewer candles than limit). Done.");
      break;
    }

    // Set before_timestamp for next page
    beforeTimestamp = oldestTs;

    // Rate limit delay
    console.log(`  Waiting ${REQUEST_DELAY_MS}ms...`);
    await sleep(REQUEST_DELAY_MS);
  }

  // Sort by timestamp ascending
  allCandles.sort((a, b) => a.timestamp - b.timestamp);

  console.log("");
  console.log(`Total candles: ${allCandles.length}`);

  if (allCandles.length > 0) {
    const first = allCandles[0];
    const last = allCandles[allCandles.length - 1];
    console.log(`Date range: ${new Date(first.timestamp).toISOString().slice(0, 10)} → ${new Date(last.timestamp).toISOString().slice(0, 10)}`);
    console.log(`Price range: $${Math.min(...allCandles.map((c) => c.low)).toFixed(8)} — $${Math.max(...allCandles.map((c) => c.high)).toFixed(8)}`);
  }

  // Ensure output directory exists
  const outDir = dirname(OUTPUT_PATH);
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  // Write JSON
  writeFileSync(OUTPUT_PATH, JSON.stringify(allCandles, null, 2), "utf-8");

  console.log("");
  console.log(`✓ Saved to ${OUTPUT_PATH}`);
  console.log("");
}

main().catch((err: unknown) => {
  console.error("Import failed:", err);
  process.exit(1);
});
