// Retraining stage 7: carries the hand-assigned archetype labels over to the new encoder, whose
// embedding space differs from the live one, so nobody has to relabel clusters after a retrain.
//
// For a fixed sample of training decks: label each with the live model (live encoder + live
// centers), embed it with the new encoder, and make each archetype's new center the mean of the
// (normalized) new embeddings of the decks that carried its label. Writes the new centers and the
// unchanged labels into the run's bundle, and ml/runs/<runId>/archetypes.json (ArchetypeReport)
// with the share of decks whose archetype changed.
import dotenv from 'dotenv';
import path from 'path';

import 'module-alias/register';
dotenv.config({ path: path.join(__dirname, '..', '..', '..', '.env') });

import { archetypeForEmbedding, ClusterCenter, nearestClusterId } from '@utils/drafting/archetype';
import { ARCHETYPE_ANNOTATIONS_FILE, ARCHETYPE_CENTERS_FILE, ArchetypeReport, runPrefix } from '@utils/ml/modelBundle';
import fs from 'fs';
import os from 'os';

import { ARCHETYPE_SAMPLE, mlLiveBucket, mlRunId, mlRunsBucket } from './config';
import { encodeRows, loadModel, LoadedModel } from './modelFiles';
import { downloadPrefix, downloadServedModel, listKeys, readJson, writeJson } from './s3';
import { CleanDeck } from './trainingData';

// Versions built before the pipeline (v3) have no archetypes in their bundle; their centers ship
// with the server. Paths cover the jobs image (server dist) and a source checkout.
const STATIC_ARCHETYPE_DIRS = [
  path.join(__dirname, '..', '..', '..', '..', 'server', 'dist', 'server', 'src', 'static'),
  path.join(__dirname, '..', '..', '..', 'server', 'src', 'static'),
];

const loadLiveArchetypes = (liveDir: string): { centers: ClusterCenter[]; annotations: Record<string, string> } => {
  const candidates = [
    { centers: path.join(liveDir, ARCHETYPE_CENTERS_FILE), annotations: path.join(liveDir, ARCHETYPE_ANNOTATIONS_FILE) },
    ...STATIC_ARCHETYPE_DIRS.map((dir) => ({
      centers: path.join(dir, 'clusterCenters.json'),
      annotations: path.join(dir, 'annotations.json'),
    })),
  ];
  const found = candidates.find((c) => fs.existsSync(c.centers) && fs.existsSync(c.annotations));
  if (!found) throw new Error('No archetype centers found for the live model');
  console.log(`Live archetypes from ${path.dirname(found.centers)}`);
  return {
    centers: JSON.parse(fs.readFileSync(found.centers, 'utf8')),
    annotations: JSON.parse(fs.readFileSync(found.annotations, 'utf8')),
  };
};

const normalize = (vector: Float32Array): Float32Array => {
  let norm = 0;
  for (const value of vector) norm += value * value;
  norm = Math.sqrt(norm);
  return norm === 0 ? vector : vector.map((value) => value / norm);
};

/** Unique mainboard oracle indices, as the site classifies decks. */
const mainboards = async (bucket: string, prefix: string, limit: number): Promise<number[][]> => {
  const out: number[][] = [];
  for (const split of ['train', 'test']) {
    const keys = (await listKeys(bucket, `${prefix}data/${split}/decks/`)).sort();
    for (const key of keys) {
      for (const deck of (await readJson<CleanDeck[]>(bucket, key)) || []) {
        out.push([...new Set(deck.mainboard)]);
        if (out.length >= limit) return out;
      }
    }
  }
  return out;
};

/** The live model ignores cards it doesn't know, as the recommender does at runtime. */
const toVocabulary = (cards: number[], from: LoadedModel, to: LoadedModel): number[] =>
  cards.flatMap((card) => {
    const index = to.oracleToIndex.get(from.indexToOracle[card] ?? '');
    return index === undefined ? [] : [index];
  });

(async () => {
  const runId = mlRunId();
  const runsBucket = mlRunsBucket();
  const prefix = runPrefix(runId);
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), `ml-archetypes-${runId}-`));

  const candidateDir = path.join(workDir, 'candidate');
  if ((await downloadPrefix(runsBucket, `${prefix}bundle/`, candidateDir)) === 0) {
    throw new Error(`No bundle at s3://${runsBucket}/${prefix}bundle/`);
  }
  const candidate = await loadModel(candidateDir, runId);

  const liveDir = path.join(workDir, 'live');
  const liveVersion = await downloadServedModel(mlLiveBucket(), liveDir);
  if (!liveVersion) throw new Error('No live model to carry archetype labels from');
  const live = await loadModel(liveDir, liveVersion);
  const { centers: liveCenters, annotations } = loadLiveArchetypes(liveDir);

  const decks = (await mainboards(runsBucket, prefix, ARCHETYPE_SAMPLE)).filter((deck) => deck.length > 0);
  console.log(`Embedding ${decks.length} decks with ${liveVersion} and ${runId}`);

  const liveEmbeddings = encodeRows(
    live,
    decks.map((deck) => toVocabulary(deck, candidate, live)),
  );
  const newEmbeddings = encodeRows(candidate, decks).map(normalize);
  const liveClusters = liveEmbeddings.map((embedding) => nearestClusterId(Array.from(embedding), liveCenters));

  const dim = newEmbeddings[0]?.length ?? 0;
  const sums = new Map<number, Float64Array>();
  const counts = new Map<number, number>();
  liveClusters.forEach((clusterId, i) => {
    if (clusterId < 0) return;
    const sum = sums.get(clusterId) ?? new Float64Array(dim);
    newEmbeddings[i]!.forEach((value, j) => {
      sum[j] = sum[j]! + value;
    });
    sums.set(clusterId, sum);
    counts.set(clusterId, (counts.get(clusterId) ?? 0) + 1);
  });

  const newCenters: ClusterCenter[] = liveCenters
    .filter(({ clusterId }) => counts.has(clusterId))
    .map(({ clusterId }) => ({
      clusterId,
      center: Array.from(sums.get(clusterId)!, (value) => value / counts.get(clusterId)!),
    }));
  const droppedClusters = liveCenters.map((c) => c.clusterId).filter((clusterId) => !counts.has(clusterId));

  let changed = 0;
  newEmbeddings.forEach((embedding, i) => {
    const before = annotations[String(liveClusters[i])] ?? null;
    const after = archetypeForEmbedding(Array.from(embedding), newCenters, annotations);
    if (before !== after) changed += 1;
  });

  const report: ArchetypeReport = {
    sampleSize: decks.length,
    shiftShare: decks.length === 0 ? 0 : changed / decks.length,
    clusterCount: newCenters.length,
    droppedClusters,
    createdAt: Date.now(),
  };
  console.log(JSON.stringify(report, null, 2));
  if (newCenters.length === 0) throw new Error('No archetype centers could be carried over');

  await writeJson(runsBucket, `${prefix}bundle/${ARCHETYPE_CENTERS_FILE}`, newCenters);
  await writeJson(runsBucket, `${prefix}bundle/${ARCHETYPE_ANNOTATIONS_FILE}`, annotations);
  await writeJson(runsBucket, `${prefix}archetypes.json`, report);
  fs.rmSync(workDir, { recursive: true, force: true });
  process.exit(0);
})().catch((error) => {
  console.error('Carrying archetypes over failed:', error);
  process.exit(1);
});
