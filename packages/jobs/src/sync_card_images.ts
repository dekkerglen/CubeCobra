// Incremental card-image sync: pulls images that Scryfall has (re-)rendered
// since our last run into the R2 bucket, keeping our self-hosted set current so
// we never hotlink Scryfall on the frontend.
//
// Flow:
//   1. Read the watermark (newest image_updated_at we've processed) from R2.
//   2. Page GET /cards/manifest?lang=en&order=imageupdated (descending), taking
//      entries newer than the watermark and stopping at the first older one.
//   3. For each changed card, download normal (grid, webp), small (thumb, webp)
//      and art_crop (jpg -> convert) for both faces, and upsert into R2 at
//      cardimages/{scryfall_id}/{normal|small|art_crop}[_back].webp.
//   4. Advance the watermark.
//
// The one-time snapshot import was dated 2026-06-29, which seeds the watermark
// on first run. Scryfall permits backend image downloads (only frontend
// hotlinking is going away), which is exactly what this job does.
import dotenv from 'dotenv';
import sharp from 'sharp';

import { getJson, putJson, putObject, R2_BUCKET, r2Configured } from './utils/r2';
import { SCRYFALL_HEADERS } from './utils/scryfall';

dotenv.config();

const MANIFEST_API = 'https://api.scryfall.com/cards/manifest';
const CDN = 'https://cards.scryfall.io';
const SYNC_STATE_KEY = 'cardimages/_sync-state.json';
// Date of the one-time snapshot import; used only when no state exists in R2.
const DEFAULT_WATERMARK = '2026-06-29T00:00:00Z';
const WEBP_QUALITY = 80;
const CONCURRENCY = 16;
// Long-lived cache to match the static assets (1 year). Card images can change
// in place when Scryfall re-renders art, so a re-render won't reach clients who
// already cached it until this expires — acceptable since re-renders are rare and
// cosmetic. For instant propagation you'd move to versioned URLs (see notes).
const IMAGE_CACHE_CONTROL = 'public, max-age=31536000, immutable';
const IMAGE_HEADERS = { 'User-Agent': SCRYFALL_HEADERS['User-Agent'] };

interface ManifestEntry {
  id: string;
  name: string;
  lang: string;
  image_updated_at: string | null;
}

interface SyncState {
  watermark: string; // newest image_updated_at fully processed (ISO 8601 UTC)
  updatedAt: string;
  lastRunUpserted: number;
}

// grid/thumb are already webp; art_crop is only offered as jpg and is converted.
// Each is fetched for both faces — single-faced cards simply 404 on /back/.
const VARIANTS = [
  { cdnDir: 'grid', ext: 'webp', out: 'normal', convert: false },
  { cdnDir: 'thumb', ext: 'webp', out: 'small', convert: false },
  { cdnDir: 'art_crop', ext: 'jpg', out: 'art_crop', convert: true },
];

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

// Page the manifest (sorted newest-image-first) until we cross the watermark.
async function collectChanged(watermarkMs: number): Promise<ManifestEntry[]> {
  const changed: ManifestEntry[] = [];
  let page = 1;
  let done = false;
  while (!done) {
    const res = await fetch(`${MANIFEST_API}?lang=en&order=imageupdated&page=${page}`, { headers: SCRYFALL_HEADERS });
    if (!res.ok) throw new Error(`manifest page ${page} failed: ${res.status}`);
    const body = (await res.json()) as { data: ManifestEntry[]; has_more: boolean };
    for (const e of body.data) {
      if (!e.image_updated_at) continue;
      if (new Date(e.image_updated_at).getTime() > watermarkMs) {
        changed.push(e);
      } else {
        // Descending order: the first old entry means the rest are older too.
        done = true;
        break;
      }
    }
    if (!done && !body.has_more) done = true;
    page += 1;
    if (!done) await sleep(100); // be polite to the API between pages
  }
  return changed;
}

async function fetchImage(url: string): Promise<Buffer | null> {
  const res = await fetch(url, { headers: IMAGE_HEADERS });
  if (res.status === 404) return null; // face/variant doesn't exist
  if (!res.ok) throw new Error(`download failed ${res.status}: ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

async function upsertCard(id: string): Promise<number> {
  const a = id[0];
  const b = id[1];
  let written = 0;
  for (const face of ['front', 'back'] as const) {
    const suffix = face === 'back' ? '_back' : '';
    for (const v of VARIANTS) {
      const src = `${CDN}/${v.cdnDir}/${face}/${a}/${b}/${id}.${v.ext}`;
      let buf: Buffer | null;
      try {
        buf = await fetchImage(src);
      } catch (e) {
        console.error((e as Error).message);
        continue;
      }
      if (!buf) continue;
      if (v.convert) buf = await sharp(buf).webp({ quality: WEBP_QUALITY }).toBuffer();
      await putObject(`cardimages/${id}/${v.out}${suffix}.webp`, buf, 'image/webp', IMAGE_CACHE_CONTROL);
      written += 1;
    }
  }
  return written;
}

async function runPool<T>(items: T[], n: number, worker: (item: T) => Promise<void>): Promise<void> {
  let i = 0;
  const runners = Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) await worker(items[i++]!);
  });
  await Promise.all(runners);
}

// Sync images updated since the stored watermark into R2. Returns the counts so
// callers (e.g. update_cards) can record them on the card-update task. No-ops
// (returns zeros) when R2 isn't configured, so stages not cut over to R2 are safe.
export async function syncCardImages(): Promise<{ cardsUpserted: number; imagesReplaced: number }> {
  if (!r2Configured()) {
    console.log('R2 not configured — skipping card image sync.');
    return { cardsUpserted: 0, imagesReplaced: 0 };
  }

  const state = (await getJson<SyncState>(SYNC_STATE_KEY)) ?? {
    watermark: DEFAULT_WATERMARK,
    updatedAt: '',
    lastRunUpserted: 0,
  };
  console.log(`Bucket ${R2_BUCKET}, watermark ${state.watermark}`);

  console.log('Scanning Scryfall manifest for image updates...');
  const changed = await collectChanged(new Date(state.watermark).getTime());
  console.log(`${changed.length} cards with new images since watermark`);

  if (changed.length === 0) {
    console.log('Nothing to do.');
    return { cardsUpserted: 0, imagesReplaced: 0 };
  }

  // Descending order means the newest is first, but max defensively regardless.
  const newWatermark = changed.reduce(
    (max, e) => (e.image_updated_at! > max ? e.image_updated_at! : max),
    state.watermark,
  );

  let totalWritten = 0;
  let processed = 0;
  await runPool(changed, CONCURRENCY, async (entry) => {
    totalWritten += await upsertCard(entry.id);
    processed += 1;
    if (processed % 200 === 0) console.log(`  ${processed}/${changed.length} cards, ${totalWritten} files`);
  });

  await putJson(SYNC_STATE_KEY, {
    watermark: newWatermark,
    updatedAt: new Date().toISOString(),
    lastRunUpserted: changed.length,
  });

  console.log(`DONE. upserted ${changed.length} cards, ${totalWritten} files. New watermark ${newWatermark}`);
  return { cardsUpserted: changed.length, imagesReplaced: totalWritten };
}

// Standalone entry point: `npm run sync-card-images`.
if (require.main === module) {
  syncCardImages()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
