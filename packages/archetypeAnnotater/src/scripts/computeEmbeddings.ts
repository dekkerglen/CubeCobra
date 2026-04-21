import util from 'util';

import 'dotenv/config';

// Polyfill for util.isNullOrUndefined removed in Node 22+ but required by tfjs-node
if (!(util as any).isNullOrUndefined) {
  (util as any).isNullOrUndefined = (val: unknown) => val === null || val === undefined;
}

import { loadGraphModel, tensor, tidy } from '@tensorflow/tfjs-node';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(currentDir, '..', '..', 'data', 'exports');
const OUTPUT_DIR = path.join(currentDir, '..', '..', 'data', 'embeddings');
const MODEL_DIR = path.join(currentDir, '..', '..', '..', '..', 'packages', 'recommenderService', 'model');
const BATCH_SIZE = 500;

interface DeckExport {
  id: string;
  cube: string;
  owner: string;
  mainboard: number[];
  sideboard: number[];
  basics: number[];
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Load the oracle mapping from the model directory
  const indexToOracleMap: Record<string, string> = JSON.parse(
    fs.readFileSync(path.join(MODEL_DIR, 'indexToOracleMap.json'), 'utf8'),
  );
  const oracleToIndex = Object.fromEntries(
    Object.entries(indexToOracleMap).map(([key, value]) => [value, parseInt(key, 10)]),
  );
  const numOracles = Object.keys(oracleToIndex).length;

  // Also load the export mapping for converting deck indices -> oracle IDs
  const exportIndexToOracle: Record<string, string> = JSON.parse(
    fs.readFileSync(path.join(DATA_DIR, 'indexToOracleMap.json'), 'utf8'),
  );

  // Load encoder model
  console.log('Loading encoder model...');
  const encoder = await loadGraphModel(`file://${path.join(MODEL_DIR, 'encoder', 'model.json')}`);
  console.log('Encoder loaded.');

  const encodeIndices = (indices: number[]): number[] => {
    const vec = new Array(numOracles).fill(0);
    for (const idx of indices) {
      if (idx >= 0 && idx < numOracles) vec[idx] = 1;
    }
    return vec;
  };

  // Load all deck batch files
  const decksDir = path.join(DATA_DIR, 'decks');
  const deckFiles = fs
    .readdirSync(decksDir)
    .filter((f) => f.endsWith('.json'))
    .sort((a, b) => parseInt(a) - parseInt(b));

  console.log(`Found ${deckFiles.length} deck batch files.`);

  // Collect all decks, deduplicating by id (keep first occurrence = seat 0 / human seat)
  const seenIds = new Set<string>();
  const allDecks: DeckExport[] = [];

  for (const file of deckFiles) {
    const batch: DeckExport[] = JSON.parse(fs.readFileSync(path.join(decksDir, file), 'utf8'));
    for (const deck of batch) {
      if (!seenIds.has(deck.id)) {
        seenIds.add(deck.id);
        allDecks.push(deck);
      }
    }
  }

  console.log(`Total unique decks (first seat only): ${allDecks.length}`);

  // Process in batches
  let processed = 0;
  let skipped = 0;

  // Open output file for streaming NDJSON (one JSON object per line)
  const outPath = path.join(OUTPUT_DIR, 'embeddings.ndjson');
  const outStream = fs.createWriteStream(outPath);
  let totalWritten = 0;

  for (let i = 0; i < allDecks.length; i += BATCH_SIZE) {
    const batch = allDecks.slice(i, i + BATCH_SIZE);

    // Convert each deck's mainboard export indices -> oracle IDs -> model indices
    const batchInputs: { deckId: string; modelIndices: number[] }[] = [];
    for (const deck of batch) {
      const modelIndices = deck.mainboard
        .map((idx) => exportIndexToOracle[String(idx)])
        .filter((id): id is string => id !== undefined)
        .map((oracleId) => oracleToIndex[oracleId])
        .filter((idx): idx is number => idx !== undefined);

      if (modelIndices.length === 0) {
        skipped += 1;
        continue;
      }
      batchInputs.push({ deckId: deck.id, modelIndices });
    }

    if (batchInputs.length === 0) {
      processed += batch.length;
      continue;
    }

    // Build vectors and run through encoder
    const vectors = batchInputs.map((b) => encodeIndices(b.modelIndices));

    const embeddings: number[][] = tidy(() => {
      const inputTensor = tensor(vectors);
      const result = encoder.predict(inputTensor) as any;
      return result.arraySync();
    });

    for (let j = 0; j < batchInputs.length; j += 1) {
      outStream.write(JSON.stringify({ deckId: batchInputs[j].deckId, embedding: embeddings[j] }) + '\n');
      totalWritten += 1;
    }

    processed += batch.length;
    if (processed % 5000 === 0 || processed === allDecks.length) {
      console.log(`Progress: ${processed}/${allDecks.length} (${totalWritten} encoded, ${skipped} skipped)`);
    }
  }

  // Close the stream
  await new Promise<void>((resolve) => {
    outStream.on('error', (err) => {
      console.warn('Stream close warning (data already flushed):', err.message);
      resolve();
    });
    outStream.end(() => resolve());
  });
  console.log(`Done. Wrote ${totalWritten} embeddings to ${outPath}`);
}

main().catch((err) => {
  console.error('Embedding computation failed:', err);
  process.exit(1);
});
