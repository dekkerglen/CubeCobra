import fs from 'fs';
import { kmeans } from 'ml-kmeans';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

import 'dotenv/config';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const REDUCED_DIR = path.join(currentDir, '..', '..', 'data', 'reduced');
const OUTPUT_DIR = path.join(currentDir, '..', '..', 'data', 'clusters');
const DEFAULT_K = 10;

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const k = parseInt(process.env.K_CLUSTERS || String(DEFAULT_K), 10);

  // Stream-load 2D points from NDJSON
  const reducedPath = path.join(REDUCED_DIR, 'reduced.ndjson');
  const deckIds: string[] = [];
  const data: number[][] = [];

  const rl = readline.createInterface({ input: fs.createReadStream(reducedPath), crlfDelay: Infinity });
  for await (const line of rl) {
    if (line.length === 0) continue;
    const { deckId, x, y } = JSON.parse(line);
    deckIds.push(deckId);
    data.push([x, y]);
    if (data.length % 500000 === 0) console.log(`  Loaded ${data.length} points...`);
  }

  console.log(`Loaded ${data.length} 2D points. Clustering with k=${k}...`);

  if (data.length < k) {
    console.error(`Not enough points (${data.length}) for k=${k} clusters.`);
    process.exit(1);
  }

  // Run k-means
  const result = kmeans(data, k, { initialization: 'kmeans++', maxIterations: 300 });

  // Stream-write NDJSON output
  const outPath = path.join(OUTPUT_DIR, 'clusters.ndjson');
  const outStream = fs.createWriteStream(outPath);

  const counts: Record<number, number> = {};
  for (let i = 0; i < deckIds.length; i += 1) {
    const clusterId = result.clusters[i];
    outStream.write(JSON.stringify({ deckId: deckIds[i], clusterId }) + '\n');
    counts[clusterId] = (counts[clusterId] || 0) + 1;
  }

  await new Promise<void>((resolve) => {
    outStream.on('error', (err) => {
      console.warn('Stream close warning:', err.message);
      resolve();
    });
    outStream.end(() => resolve());
  });

  console.log(`Done. Wrote ${deckIds.length} cluster assignments to ${outPath}`);

  // Print cluster distribution
  console.log('Cluster distribution:');
  for (const [id, count] of Object.entries(counts).sort((a, b) => Number(a[0]) - Number(b[0]))) {
    console.log(`  Cluster ${id}: ${count} decks`);
  }
}

main().catch((err) => {
  console.error('Clustering failed:', err);
  process.exit(1);
});
