// Caches Magic set symbols (Scryfall's per-set icon_svg_uri) into the R2 bucket
// at sets/{code}.svg so the frontend serves them from our CDN instead of
// hotlinking Scryfall. Runs as a tail step of the card-update job.
//
// A small state file (sets/_synced.json) records which codes we've already
// uploaded, so a normal run only fetches symbols for sets that are new since
// last time — the vast majority of runs upload nothing. On first run (empty
// state) it back-fills every set. No-ops cleanly when R2 isn't configured.
import { SetInfo } from '@utils/datatypes/SetInfo';

import { getJson, putJson, putObject, R2_BUCKET, r2Configured } from './utils/r2';
import { SCRYFALL_HEADERS } from './utils/scryfall';

const STATE_KEY = 'sets/_synced.json';
// Symbols effectively never change; match the card-image cache policy.
const SVG_CACHE_CONTROL = 'public, max-age=31536000, immutable';
const CONCURRENCY = 8;
const SVG_HEADERS = { 'User-Agent': SCRYFALL_HEADERS['User-Agent'] };

// The Scryfall icon_svg_uri we need to fetch from, distinct from the (possibly
// R2-rewritten) icon URL baked into setdict. Callers pass both.
export interface SetSymbolSource {
  code: string;
  iconUri: string; // Scryfall's icon_svg_uri
}

async function runPool<T>(items: T[], n: number, worker: (item: T) => Promise<void>): Promise<void> {
  let i = 0;
  const next = (): T | undefined => {
    const item = items[i];
    i += 1;
    return item;
  };
  const runners = Array.from({ length: Math.min(n, items.length) }, async () => {
    for (let item = next(); item !== undefined; item = next()) {
      await worker(item);
    }
  });
  await Promise.all(runners);
}

// Build the fetch list from the job's setdict. We store the raw Scryfall icon on
// SetInfo only when SET_SYMBOL_BASE_URL is unset; when it IS set the baked icon
// points at R2, so we take the source URI separately from the ScryfallSet.
export async function syncSetSymbols(sources: SetSymbolSource[]): Promise<number> {
  if (!r2Configured()) {
    console.log('R2 not configured — skipping set symbol sync.');
    return 0;
  }

  const synced = (await getJson<string[]>(STATE_KEY)) ?? [];
  const have = new Set(synced);
  const todo = sources.filter((s) => s.iconUri && !have.has(s.code));

  if (todo.length === 0) {
    console.log(`Set symbols: nothing new (${sources.length} sets already cached).`);
    return 0;
  }

  console.log(`Bucket ${R2_BUCKET}, syncing ${todo.length} new set symbols...`);

  let written = 0;
  await runPool(todo, CONCURRENCY, async (s) => {
    try {
      const res = await fetch(s.iconUri, { headers: SVG_HEADERS });
      if (!res.ok) {
        console.warn(`Set symbol ${s.code}: HTTP ${res.status} from ${s.iconUri}`);
        return;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      await putObject(`sets/${s.code}.svg`, buf, 'image/svg+xml', SVG_CACHE_CONTROL);
      have.add(s.code);
      written += 1;
    } catch (err) {
      console.warn(`Set symbol ${s.code} failed:`, err instanceof Error ? err.message : err);
    }
  });

  await putJson(STATE_KEY, Array.from(have));
  console.log(`Set symbols: uploaded ${written} new (of ${todo.length} attempted).`);
  return written;
}

// Helper for callers that already hold the job's setdict plus the raw Scryfall
// icon URIs (keyed by code). Sets whose icon we couldn't source are skipped.
export const toSymbolSources = (
  setdict: Record<string, SetInfo>,
  scryfallIconByCode: Record<string, string>,
): SetSymbolSource[] =>
  Object.keys(setdict)
    .map((code) => ({ code, iconUri: scryfallIconByCode[code] ?? '' }))
    .filter((s) => s.iconUri);
