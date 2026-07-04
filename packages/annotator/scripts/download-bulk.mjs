// Prerequisite step: download Scryfall's "All Cards" bulk export (gzipped JSONL)
// and un-gzip it to data/scryfall/all-cards.jsonl. Skips the download if a full
// copy already exists; pass --force to re-download.
//
//   node scripts/download-bulk.mjs [--force]

import { ensureBulk } from './lib.mjs';

const force = process.argv.includes('--force');
ensureBulk({ force })
  .then((p) => console.log(`bulk ready: ${p}`))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
