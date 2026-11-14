// How many decks would change archetype if the candidate were promoted, for the approval screen.
// Both versions' archetypes are tag topics (archetypes/ in their bundles); a live version without
// any (the legacy v3) has nothing to compare against.
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

type Labeler = (decks: string[][]) => (string | null)[];

const readJsonFile = <T>(file: string): T | null =>
  fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, 'utf8')) as T) : null;

const topicLabeler = (bundleDir: string): Labeler | null => {
  const topics = readJsonFile<ArchetypeTopicsFile>(path.join(bundleDir, ARCHETYPE_TOPICS_FILE));
  const names = readJsonFile<ArchetypeNamesFile>(path.join(bundleDir, ARCHETYPE_NAMES_FILE));
  if (!topics || !names) return null;
  return (decks) => decks.map((oracleIds) => classifyByTopics(oracleIds, topics, names));
};

/**
 * Labels every deck (oracle ids of its mainboard) with the live and the candidate archetypes.
 * A deck that gains or loses a label counts as changed.
 */
export const archetypeReport = (candidateDir: string, liveDir: string, decks: string[][]): ArchetypeReport => {
  const topics = readJsonFile<ArchetypeTopicsFile>(path.join(candidateDir, ARCHETYPE_TOPICS_FILE));
  const naming = readJsonFile<ArchetypeNamingOutcome>(path.join(candidateDir, ARCHETYPE_NAMING_FILE));
  const labelNew = topicLabeler(candidateDir);
  const labelLive = topicLabeler(liveDir);

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
