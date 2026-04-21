import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

import 'dotenv/config';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(currentDir, '..', '..', 'data');
const REDUCED_PATH = path.join(DATA_DIR, 'reduced', 'reduced.ndjson');
const CLUSTERS_PATH = path.join(DATA_DIR, 'clusters', 'clusters.ndjson');
const EMBEDDINGS_PATH = path.join(DATA_DIR, 'embeddings', 'embeddings.ndjson');
const EXPORTS_DIR = path.join(DATA_DIR, 'exports');
const SERVER_PRIVATE = path.join(currentDir, '..', '..', '..', '..', 'packages', 'server', 'private');
const APP_DIR = path.join(DATA_DIR, 'app');

async function main() {
  fs.mkdirSync(APP_DIR, { recursive: true });

  // --- Pass 1: Load reduced points (deckId -> index, x[], y[]) ---
  console.log('Loading reduced points...');
  const deckIdToIndex = new Map<string, number>();
  const xs: number[] = [];
  const ys: number[] = [];

  const rl1 = readline.createInterface({ input: fs.createReadStream(REDUCED_PATH), crlfDelay: Infinity });
  for await (const line of rl1) {
    if (line.length === 0) continue;
    const { deckId, x, y } = JSON.parse(line);
    const idx = xs.length;
    deckIdToIndex.set(deckId, idx);
    xs.push(x);
    ys.push(y);
    if (xs.length % 500000 === 0) console.log(`  ${xs.length} points...`);
  }
  const count = xs.length;
  console.log(`Loaded ${count} points.`);

  // --- Pass 2: Load cluster assignments ---
  console.log('Loading cluster assignments...');
  const clusters = new Uint16Array(count); // supports up to 65535 clusters
  const clusterDeckIds = new Map<number, string[]>(); // clusterId -> deckIds (sample)
  const clusterCounts = new Map<number, number>();

  const rl2 = readline.createInterface({ input: fs.createReadStream(CLUSTERS_PATH), crlfDelay: Infinity });
  for await (const line of rl2) {
    if (line.length === 0) continue;
    const { deckId, clusterId } = JSON.parse(line);
    const idx = deckIdToIndex.get(deckId);
    if (idx === undefined) continue;
    clusters[idx] = clusterId;

    clusterCounts.set(clusterId, (clusterCounts.get(clusterId) || 0) + 1);
    const samples = clusterDeckIds.get(clusterId) || [];
    if (samples.length < 20) {
      samples.push(deckId);
      clusterDeckIds.set(clusterId, samples);
    }
  }
  console.log(`Loaded clusters for ${count} points.`);

  // --- Compute numClusters early (needed for binary header) ---
  const numClusters = Math.max(...clusterCounts.keys()) + 1;

  // --- Write binary points file ---
  // Format: [uint32 count] [uint32 numClusters] [float32 x * count] [float32 y * count] [uint16 cluster * count]
  console.log('Writing points.bin...');
  const headerBuf = Buffer.alloc(8);
  headerBuf.writeUInt32LE(count, 0);
  headerBuf.writeUInt32LE(numClusters, 4);

  const xBuf = Buffer.alloc(count * 4);
  const yBuf = Buffer.alloc(count * 4);
  for (let i = 0; i < count; i += 1) {
    xBuf.writeFloatLE(xs[i], i * 4);
    yBuf.writeFloatLE(ys[i], i * 4);
  }

  const clusterBuf = Buffer.alloc(count * 2);
  for (let i = 0; i < count; i += 1) {
    clusterBuf.writeUInt16LE(clusters[i], i * 2);
  }

  const fd = fs.openSync(path.join(APP_DIR, 'points.bin'), 'w');
  fs.writeSync(fd, headerBuf);
  fs.writeSync(fd, xBuf);
  fs.writeSync(fd, yBuf);
  fs.writeSync(fd, clusterBuf);
  fs.closeSync(fd);
  console.log(`Wrote points.bin (${(8 + count * 10) / 1024 / 1024} MB)`);

  // --- Write deckIds (needed for click-to-link) ---
  // Store as newline-delimited plain text (index-aligned with points.bin)
  console.log('Writing deckIds.txt...');
  const deckIds = new Array<string>(count);
  for (const [deckId, idx] of deckIdToIndex) {
    deckIds[idx] = deckId;
  }
  fs.writeFileSync(path.join(APP_DIR, 'deckIds.txt'), deckIds.join('\n'));

  // --- Write cluster summaries (placeholder, updated below with top cards) ---

  // --- Pass 3: Compute cluster centers (128-dim mean embeddings) ---
  console.log('Computing cluster centers from embeddings...');
  const dim = 128;
  const centerSums = Array.from({ length: numClusters }, () => new Float64Array(dim));
  const centerCounts = new Array(numClusters).fill(0);

  const rl3 = readline.createInterface({ input: fs.createReadStream(EMBEDDINGS_PATH), crlfDelay: Infinity });
  let embCount = 0;
  for await (const line of rl3) {
    if (line.length === 0) continue;
    const { deckId, embedding } = JSON.parse(line);
    const idx = deckIdToIndex.get(deckId);
    if (idx === undefined) continue;
    const c = clusters[idx];
    for (let d = 0; d < dim; d++) centerSums[c][d] += embedding[d];
    centerCounts[c] += 1;
    embCount += 1;
    if (embCount % 500000 === 0) console.log(`  ${embCount} embeddings...`);
  }

  const clusterCenters: { clusterId: number; center: number[] }[] = [];
  for (let c = 0; c < numClusters; c += 1) {
    if (centerCounts[c] === 0) continue;
    const center = Array.from(centerSums[c]).map((v) => v / centerCounts[c]);
    clusterCenters.push({ clusterId: c, center });
  }
  fs.writeFileSync(path.join(APP_DIR, 'clusterCenters.json'), JSON.stringify(clusterCenters));
  console.log(`Wrote ${clusterCenters.length} cluster centers.`);

  // --- Build oracle ID -> card name mapping ---
  console.log('Loading card name mappings...');
  const oracleToId: Record<string, string[]> = JSON.parse(
    fs.readFileSync(path.join(SERVER_PRIVATE, 'oracleToId.json'), 'utf8'),
  );
  const carddict: Record<string, { name: string }> = JSON.parse(
    fs.readFileSync(path.join(SERVER_PRIVATE, 'carddict.json'), 'utf8'),
  );
  const oracleToName = new Map<string, string>();
  for (const [oracleId, scryfallIds] of Object.entries(oracleToId)) {
    if (scryfallIds.length > 0) {
      const card = carddict[scryfallIds[0]];
      if (card) oracleToName.set(oracleId, card.name);
    }
  }
  console.log(`Mapped ${oracleToName.size} oracle IDs to card names.`);

  // --- Load export indexToOracleMap ---
  const exportIndexToOracle: Record<string, string> = JSON.parse(
    fs.readFileSync(path.join(EXPORTS_DIR, 'indexToOracleMap.json'), 'utf8'),
  );
  const numOracles = Object.keys(exportIndexToOracle).length;

  // --- Pass 4: Build per-cluster oracle vectors from deck exports ---
  console.log('Building per-cluster oracle vectors from deck exports...');
  // clusterOracleVecs[clusterId][oracleIndex] = count of decks containing that card
  const clusterOracleVecs = Array.from({ length: numClusters }, () => new Uint32Array(numOracles));

  const decksDir = path.join(EXPORTS_DIR, 'decks');
  const deckFiles = fs
    .readdirSync(decksDir)
    .filter((f) => f.endsWith('.json'))
    .sort((a, b) => parseInt(a) - parseInt(b));

  const seenIds = new Set<string>();
  let deckCount = 0;
  for (const file of deckFiles) {
    const batch = JSON.parse(fs.readFileSync(path.join(decksDir, file), 'utf8'));
    for (const deck of batch) {
      if (seenIds.has(deck.id)) continue;
      seenIds.add(deck.id);
      const idx = deckIdToIndex.get(deck.id);
      if (idx === undefined) continue;
      const c = clusters[idx];
      // Count each unique card once per deck (presence, not quantity)
      const seen = new Set<number>();
      for (const cardIdx of deck.mainboard) {
        if (!seen.has(cardIdx)) {
          seen.add(cardIdx);
          clusterOracleVecs[c][cardIdx] += 1;
        }
      }
      deckCount += 1;
      if (deckCount % 500000 === 0) console.log(`  ${deckCount} decks processed...`);
    }
  }
  console.log(`Processed ${deckCount} decks.`);

  // --- Compute global play rates for synergy calculation ---
  const globalPlayRate = new Float64Array(numOracles);
  for (let o = 0; o < numOracles; o++) {
    let total = 0;
    for (let c = 0; c < numClusters; c++) total += clusterOracleVecs[c][o];
    globalPlayRate[o] = total / deckCount;
  }

  // --- Write cluster oracle vectors and compute top cards per cluster ---
  console.log('Computing top cards per cluster...');
  const clusterCardProfiles: Record<string, { oracleId: string; name: string; density: number; synergy: number }[]> =
    {};

  for (let c = 0; c < numClusters; c++) {
    const cCount = clusterCounts.get(c) || 0;
    if (cCount === 0) continue;

    // Compute density (play rate within cluster) and synergy for each card
    const cards: { oracleIndex: number; density: number; synergy: number }[] = [];
    for (let o = 0; o < numOracles; o++) {
      if (clusterOracleVecs[c][o] === 0) continue;
      const density = clusterOracleVecs[c][o] / cCount;
      const synergy = density - globalPlayRate[o];
      cards.push({ oracleIndex: o, density, synergy });
    }

    // Sort by synergy (most defining cards first)
    cards.sort((a, b) => b.synergy - a.synergy);

    clusterCardProfiles[String(c)] = cards.slice(0, 40).map((card) => {
      const oracleId = exportIndexToOracle[String(card.oracleIndex)] || 'unknown';
      const name = oracleToName.get(oracleId) || oracleId;
      return {
        oracleId,
        name,
        density: Math.round(card.density * 1000) / 1000,
        synergy: Math.round(card.synergy * 1000) / 1000,
        globalRate: Math.round(globalPlayRate[card.oracleIndex] * 1000) / 1000,
      };
    });
  }

  // --- Write full oracle vectors per cluster ---
  console.log('Writing clusterOracleVectors.json...');
  const oracleVecOut: Record<string, number[]> = {};
  for (let c = 0; c < numClusters; c += 1) {
    if ((clusterCounts.get(c) || 0) === 0) continue;
    const cCount = clusterCounts.get(c)!;
    oracleVecOut[String(c)] = Array.from(clusterOracleVecs[c]).map((v) => Math.round((v / cCount) * 10000) / 10000);
  }
  fs.writeFileSync(path.join(APP_DIR, 'clusterOracleVectors.json'), JSON.stringify(oracleVecOut));
  console.log('Wrote clusterOracleVectors.json');

  // --- Write cluster summaries with top cards ---
  console.log('Writing clusterSummaries.json...');
  const summaries = [];
  for (let c = 0; c < numClusters; c++) {
    summaries.push({
      clusterId: c,
      count: clusterCounts.get(c) || 0,
      sampleDeckIds: clusterDeckIds.get(c) || [],
      topCards: clusterCardProfiles[String(c)] || [],
    });
  }
  summaries.sort((a, b) => b.count - a.count);
  fs.writeFileSync(path.join(APP_DIR, 'clusterSummaries.json'), JSON.stringify(summaries, null, 2));

  // --- Initialize annotations file if it doesn't exist ---
  const annotationsPath = path.join(APP_DIR, 'annotations.json');
  if (!fs.existsSync(annotationsPath)) {
    const annotations: Record<string, string> = {};
    for (let c = 0; c < numClusters; c++) {
      annotations[String(c)] = '';
    }
    fs.writeFileSync(annotationsPath, JSON.stringify(annotations, null, 2));
    console.log('Created annotations.json');
  } else {
    console.log('annotations.json already exists, skipping.');
  }

  console.log('Done. App data ready.');
}

main().catch((err) => {
  console.error('Prepare app data failed:', err);
  process.exit(1);
});
