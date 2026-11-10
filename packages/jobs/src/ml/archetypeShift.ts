// How many decks would change archetype if the candidate were promoted, for the approval screen.
// The candidate's archetypes are tag topics (archetypes/ in its bundle). The live version's are
// topics too, except for v3, whose hand-labeled embedding centers ship with the server.
import { type ClusterCenter, nearestClusterId } from '@utils/drafting/archetype';
import {
  type ArchetypeNamesFile,
  type ArchetypeNamingOutcome,
  type ArchetypeTopicsFile,
  classifyByTopics,
} from '@utils/drafting/topicArchetypes';
import {
  ARCHETYPE_NAMES_FILE,
  ARCHETYPE_NAMING_FILE,
  ARCHETYPE_TOPICS_FILE,
  type ArchetypeReport,
} from '@utils/ml/modelBundle';
import fs from 'fs';
import path from 'path';

import { encodeRows, LoadedModel } from './modelFiles';

type Labeler = (decks: string[][]) => (string | null)[];

// The jobs image (server dist) and a source checkout.
const STATIC_ARCHETYPE_DIRS = [
  path.join(__dirname, '..', '..', '..', '..', 'server', 'dist', 'server', 'src', 'static'),
  path.join(__dirname, '..', '..', '..', 'server', 'src', 'static'),
];

const readJsonFile = <T>(file: string): T | null =>
  fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, 'utf8')) as T) : null;

const topicLabeler = (bundleDir: string): Labeler | null => {
  const topics = readJsonFile<ArchetypeTopicsFile>(path.join(bundleDir, ARCHETYPE_TOPICS_FILE));
  const names = readJsonFile<ArchetypeNamesFile>(path.join(bundleDir, ARCHETYPE_NAMES_FILE));
  if (!topics || !names) return null;
  return (decks) => decks.map((oracleIds) => classifyByTopics(oracleIds, topics, names));
};

/** v3: encode each deck with the live encoder and take the nearest hand-labeled center. */
const centersLabeler = (live: LoadedModel): Labeler => {
  const dir = STATIC_ARCHETYPE_DIRS.find((d) => fs.existsSync(path.join(d, 'clusterCenters.json')));
  if (!dir) throw new Error('No static archetype centers found for the live model');
  const centers = readJsonFile<ClusterCenter[]>(path.join(dir, 'clusterCenters.json'))!;
  const annotations = readJsonFile<Record<string, string>>(path.join(dir, 'annotations.json')) ?? {};
  return (decks) => {
    const rows = decks.map((oracleIds) =>
      [...new Set(oracleIds)].flatMap((oracleId) => {
        const index = live.oracleToIndex.get(oracleId);
        return index === undefined ? [] : [index];
      }),
    );
    return encodeRows(live, rows).map(
      (embedding) => annotations[String(nearestClusterId(Array.from(embedding), centers))] ?? null,
    );
  };
};

/**
 * Labels every deck (oracle ids of its mainboard) with the live and the candidate archetypes.
 * A deck that gains or loses a label counts as changed.
 */
export const archetypeReport = (
  candidateDir: string,
  live: LoadedModel | null,
  liveDir: string,
  decks: string[][],
): ArchetypeReport => {
  const topics = readJsonFile<ArchetypeTopicsFile>(path.join(candidateDir, ARCHETYPE_TOPICS_FILE));
  const naming = readJsonFile<ArchetypeNamingOutcome>(path.join(candidateDir, ARCHETYPE_NAMING_FILE));
  const labelNew = topicLabeler(candidateDir);
  const labelLive = topicLabeler(liveDir) ?? (live ? centersLabeler(live) : null);

  let changed = 0;
  if (labelNew && labelLive && decks.length > 0) {
    const before = labelLive(decks);
    const after = labelNew(decks);
    changed = before.filter((label, i) => label !== after[i]).length;
  }
  const sampleSize = labelNew && labelLive ? decks.length : 0;
  return {
    topicCount: topics?.topics.length ?? 0,
    naming,
    sampleSize,
    shiftShare: sampleSize === 0 ? 0 : changed / sampleSize,
    createdAt: Date.now(),
  };
};
