// Retraining stage 2: turns the public export into the training data for one run.
//
// Reads s3://<ML_EXPORT_BUCKET>/export/ and writes s3://<ML_RUNS_BUCKET>/ml/runs/<ML_RUN_ID>/data/:
//   vocab.json                    card index -> oracle id (the export's indexToOracleMap, as a list)
//   isLand.json                   1 for lands, by card index (used by the draft head's land penalty)
//   cards.json                    per card index: { oracle, name, type, cmc, tags } (oracle tags, for
//                                 archetype topics, from the card catalog in DATA_BUCKET)
//   oracleFrequency.json          training cubes containing each card
//   correlations.bin              int32 little-endian card x card mainboard co-occurrence counts
//                                 from training decks, row-major
//   {train,test}/cubes/NNNN.json  [[card, ...], ...]
//   {train,test}/decks/NNNN.json  [{ mainboard, sideboard }, ...]
//   {train,test}/picks/NNNN.json  [{ pool, pack, pick }, ...]
//   manifest.json                 TrainingDataManifest
//
// Only drafts from the last WINDOW_YEARS years and cubes updated within it are kept (see config.ts).
import dotenv from 'dotenv';
import path from 'path';

import 'module-alias/register';
dotenv.config({ path: path.join(__dirname, '..', '..', '..', '.env') });

import { getMostReasonableById, getVersionsByOracleId } from '@server/serverutils/carddb';
import { updateCardbase } from '@server/serverutils/updatecards';
import { runPrefix, SplitCounts, TrainingDataManifest } from '@utils/ml/modelBundle';
import fs from 'fs';
import os from 'os';

import { MIN_MAINBOARD, mlExportBucket, mlRunId, mlRunsBucket, SHARD_SIZE, TEST_PERCENT, WINDOW_YEARS } from './config';
import { getJobsBucket } from '../utils/s3';
import { listKeys, readJson, uploadDirectory } from './s3';
import {
  cleanCube,
  cleanDeck,
  cleanPick,
  ExportedDeck,
  ExportedPick,
  isTestRecord,
  windowStartFor,
} from './trainingData';

type Split = 'train' | 'test';
type Kind = 'cubes' | 'decks' | 'picks';

class ShardWriter {
  private buffer: unknown[] = [];
  private shard = 0;
  public count = 0;

  constructor(private readonly dir: string) {
    fs.mkdirSync(dir, { recursive: true });
  }

  add(record: unknown) {
    this.buffer.push(record);
    this.count += 1;
    if (this.buffer.length >= SHARD_SIZE) this.flush();
  }

  flush() {
    if (this.buffer.length === 0) return;
    fs.writeFileSync(path.join(this.dir, `${String(this.shard).padStart(4, '0')}.json`), JSON.stringify(this.buffer));
    this.shard += 1;
    this.buffer = [];
  }
}

// Export batch files are numbered (decks/0.json, decks/1.json, ...); process them in order so a
// rerun produces identical shards.
const sortedBatchKeys = async (bucket: string, prefix: string): Promise<string[]> => {
  const batchNumber = (key: string) => parseInt(path.basename(key, '.json'), 10);
  return (await listKeys(bucket, prefix))
    .filter((key) => key.endsWith('.json'))
    .sort((a, b) => batchNumber(a) - batchNumber(b));
};

const writeInt32File = (filePath: string, values: Int32Array) => {
  const fd = fs.openSync(filePath, 'w');
  const chunk = 16 * 1024 * 1024;
  for (let start = 0; start < values.length; start += chunk) {
    const end = Math.min(start + chunk, values.length);
    fs.writeSync(fd, Buffer.from(values.buffer, values.byteOffset + start * 4, (end - start) * 4));
  }
  fs.closeSync(fd);
};

(async () => {
  const runId = mlRunId();
  const exportBucket = mlExportBucket();
  const runsBucket = mlRunsBucket();
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), `ml-data-${runId}-`));
  const outDir = path.join(workDir, 'data');
  const excluded: Record<string, number> = {};
  const exclude = (reason: string) => {
    excluded[reason] = (excluded[reason] || 0) + 1;
  };

  const exportManifest = await readJson<{ exportedAt: number }>(exportBucket, 'export/manifest.json');
  if (!exportManifest?.exportedAt) {
    throw new Error('export/manifest.json is missing; this export predates the retraining pipeline, rerun it');
  }
  const { exportedAt } = exportManifest;
  const windowStart = windowStartFor(exportedAt);
  console.log(
    `Run ${runId}: export from ${new Date(exportedAt).toISOString()}, keeping data since ${new Date(windowStart).toISOString()}`,
  );

  const indexToOracle = await readJson<Record<string, string>>(exportBucket, 'export/indexToOracleMap.json');
  if (!indexToOracle) throw new Error('export/indexToOracleMap.json is missing');
  const numCards = Object.keys(indexToOracle).length;
  const vocab = Array.from({ length: numCards }, (_, i) => {
    const oracle = indexToOracle[String(i)];
    if (!oracle) throw new Error(`indexToOracleMap has no entry for index ${i}`);
    return oracle;
  });

  const cardDict =
    (await readJson<Record<string, { name?: string | null; type?: string | null; cmc?: number | null }>>(
      exportBucket,
      'export/simpleCardDict.json',
    )) || {};
  const isLand = vocab.map((oracle) => ((cardDict[oracle]?.type || '').includes('Land') ? 1 : 0));

  // Oracle tags aren't in the export; they come from the card catalog the daily card update keeps
  // in DATA_BUCKET, so they're as of this run rather than the export date.
  await updateCardbase(path.join(workDir, 'cards'), getJobsBucket());
  const tagsFor = (oracle: string): string[] => {
    const versions = getVersionsByOracleId(oracle);
    const card = versions[0] ? getMostReasonableById(versions[0]) : null;
    return card?.oracle_tags ?? [];
  };
  const cards = vocab.map((oracle) => {
    const card = cardDict[oracle];
    return { oracle, name: card?.name ?? '', type: card?.type ?? '', cmc: card?.cmc ?? 0, tags: tagsFor(oracle) };
  });
  const taggedCards = cards.filter((card) => card.tags.length > 0).length;
  if (taggedCards === 0) {
    throw new Error('The card catalog has no oracle tags');
  }

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'vocab.json'), JSON.stringify(vocab));
  fs.writeFileSync(path.join(outDir, 'isLand.json'), JSON.stringify(isLand));
  fs.writeFileSync(path.join(outDir, 'cards.json'), JSON.stringify(cards));
  console.log(`${numCards} cards in the vocabulary, ${isLand.filter(Boolean).length} lands, ${taggedCards} tagged`);

  const writers = {} as Record<Split, Record<Kind, ShardWriter>>;
  for (const split of ['train', 'test'] as Split[]) {
    writers[split] = {
      cubes: new ShardWriter(path.join(outDir, split, 'cubes')),
      decks: new ShardWriter(path.join(outDir, split, 'decks')),
      picks: new ShardWriter(path.join(outDir, split, 'picks')),
    };
  }
  const splitFor = (id: string): Split => (isTestRecord(id) ? 'test' : 'train');

  // Cubes
  const cubes = await readJson<Array<{ id: string; cards: unknown[]; date_last_updated?: number }>>(
    exportBucket,
    'export/cubes.json',
  );
  if (!cubes) throw new Error('export/cubes.json is missing');
  const oracleFrequency = new Int32Array(numCards);
  for (const cube of cubes) {
    if (!cube.date_last_updated || cube.date_last_updated < windowStart) {
      exclude('cubeNotUpdatedInWindow');
      continue;
    }
    const cards = cleanCube(cube.cards || [], numCards);
    if (cards.length === 0) {
      exclude('cubeEmpty');
      continue;
    }
    const split = splitFor(cube.id);
    writers[split].cubes.add(cards);
    if (split === 'train') {
      for (const card of cards) oracleFrequency[card] = oracleFrequency[card]! + 1;
    }
  }
  console.log(`Cubes: ${writers.train.cubes.count} train, ${writers.test.cubes.count} test`);

  // Decks, plus mainboard co-occurrence counts from the training decks
  const correlations = new Int32Array(numCards * numCards);
  const deckKeys = await sortedBatchKeys(exportBucket, 'export/decks/');
  for (const [i, key] of deckKeys.entries()) {
    const decks = (await readJson<ExportedDeck[]>(exportBucket, key)) || [];
    for (const deck of decks) {
      if (deck.date === undefined) {
        throw new Error(`${key} has decks without dates; this export predates the retraining pipeline, rerun it`);
      }
      if (deck.date === null || deck.date < windowStart) {
        exclude('deckOutsideWindow');
        continue;
      }
      const clean = cleanDeck(deck, numCards);
      if (clean.mainboard.length < MIN_MAINBOARD) {
        exclude('deckTooSmall');
        continue;
      }
      const split = splitFor(deck.id);
      writers[split].decks.add(clean);
      if (split === 'train') {
        const main = [...new Set(clean.mainboard)];
        for (let a = 0; a < main.length; a += 1) {
          const cardA = main[a]!;
          for (let b = a + 1; b < main.length; b += 1) {
            const cardB = main[b]!;
            const ab = cardA * numCards + cardB;
            const ba = cardB * numCards + cardA;
            correlations[ab] = correlations[ab]! + 1;
            correlations[ba] = correlations[ba]! + 1;
          }
        }
      }
    }
    console.log(`Decks: processed batch ${i + 1} of ${deckKeys.length}`);
  }
  console.log(`Decks: ${writers.train.decks.count} train, ${writers.test.decks.count} test`);

  // Picks
  const pickKeys = await sortedBatchKeys(exportBucket, 'export/picks/');
  for (const [i, key] of pickKeys.entries()) {
    const picks = (await readJson<ExportedPick[]>(exportBucket, key)) || [];
    for (const pick of picks) {
      if (pick.date === undefined) {
        throw new Error(`${key} has picks without dates; this export predates the retraining pipeline, rerun it`);
      }
      if (pick.date === null || pick.date < windowStart) {
        exclude('pickOutsideWindow');
        continue;
      }
      const clean = cleanPick(pick, numCards);
      if (!clean) {
        exclude('pickUnusable');
        continue;
      }
      writers[splitFor(pick.draft)].picks.add(clean);
    }
    console.log(`Picks: processed batch ${i + 1} of ${pickKeys.length}`);
  }
  console.log(`Picks: ${writers.train.picks.count} train, ${writers.test.picks.count} test`);

  for (const split of ['train', 'test'] as Split[]) {
    for (const writer of Object.values(writers[split])) writer.flush();
  }
  const counts = (split: Split): SplitCounts => ({
    cubes: writers[split].cubes.count,
    decks: writers[split].decks.count,
    picks: writers[split].picks.count,
  });
  for (const split of ['train', 'test'] as Split[]) {
    for (const [kind, count] of Object.entries(counts(split))) {
      if (count === 0) throw new Error(`No ${split} ${kind} left after filtering`);
    }
  }

  fs.writeFileSync(path.join(outDir, 'oracleFrequency.json'), JSON.stringify(Array.from(oracleFrequency)));
  writeInt32File(path.join(outDir, 'correlations.bin'), correlations);

  const manifest: TrainingDataManifest = {
    runId,
    exportedAt,
    windowYears: WINDOW_YEARS,
    windowStart,
    testPercent: TEST_PERCENT,
    numCards,
    train: counts('train'),
    test: counts('test'),
    excluded,
    createdAt: Date.now(),
  };
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify(manifest, null, 2));

  const uploaded = await uploadDirectory(outDir, runsBucket, `${runPrefix(runId)}data/`);
  console.log(`Uploaded ${uploaded} files to s3://${runsBucket}/${runPrefix(runId)}data/`);
  fs.rmSync(workDir, { recursive: true, force: true });
  process.exit(0);
})().catch((error) => {
  console.error('Processing training data failed:', error);
  process.exit(1);
});
