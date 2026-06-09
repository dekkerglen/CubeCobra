// Local (IndexedDB) storage for cube record-analysis runs — mirrors the draft
// simulator's run storage (draftSimulatorLocalStorage.ts). Each run is computed
// entirely client-side and persisted here; users keep a small history per cube.

import { Analytic, MatchupStat, PlayerAnalytic } from '@utils/datatypes/RecordAnalytic';
import { ArchetypeSkeleton } from '@utils/datatypes/SimulationReport';

export { getStoragePressureNotice } from './draftSimulatorLocalStorage';

// One recorded deck with its outcome + (once the model has run) its map position.
export interface AnalysisDeck {
  recordId: string;
  recordName: string;
  date: number;
  playerName: string;
  userId?: string;
  oracles: string[];
  matchWins: number;
  matchLosses: number;
  matchDraws: number;
  gameWins: number;
  gameLosses: number;
  gameDraws: number;
  trophy: boolean;
  clusterId: number | null;
  x: number;
  y: number;
  colors: string[]; // deck color identity codes (e.g. ['W','U']), >10% threshold
  archetype: string; // ML archetype label (e.g. 'Aggro'), '' if unavailable
}

// Archetype-vs-archetype matchups, keyed `${aClusterId}|${bClusterId}`: how decks
// of cluster A fared against decks of cluster B (a's wins/draws over `matches`).
export type ClusterMatchups = { [key: string]: { matches: number; wins: number; draws: number } };

// Color-vs-color matchups, keyed `${colorA}|${colorB}` (colors W/U/B/R/G, or
// C for colorless): how decks containing color A fared against decks containing
// color B. A multicolor deck contributes to every color it plays, so the same
// match counts toward several cells (a "contains this color" view, not "exactly").
export type ColorMatchups = { [key: string]: { matches: number; wins: number; draws: number } };

// Per-oracle card info captured from the records' drafts, so decks/charts render
// even for cards no longer in the live cube. Keyed by oracle id.
export interface RecordCardInfo {
  name: string;
  imageUrl: string;
  type: string;
  cmc: number;
  colorIdentity: string[];
}

export interface RecordAnalysisRunData {
  ts: number;
  generatedAt: string;
  recordCount: number;
  deckCount: number;
  // per-card stats (keyed by oracle id), incl. match Elo
  cards: { [oracle: string]: Analytic };
  // synergy pairs (`oracleA|oracleB`) and directed matchups (`oracle|opponent`)
  pairs: { [pairKey: string]: Analytic };
  matchups: { [key: string]: MatchupStat };
  players: PlayerAnalytic[];
  decks: AnalysisDeck[];
  skeletons: ArchetypeSkeleton[];
  clusterMatchups: ClusterMatchups;
  // color-vs-color head-to-head (independent of the ML clustering, so present
  // even when the archetype map fails to build)
  colorMatchups: ColorMatchups;
  cardImages: { [oracle: string]: RecordCardInfo };
  clusterMethod: string;
  clustered: boolean; // true once the archetype map (ML model) has been computed
}

// Lightweight metadata for the run-history strip.
export interface RecordAnalysisRunEntry {
  ts: number;
  generatedAt: string;
  recordCount: number;
  deckCount: number;
  clustered: boolean;
}

export const RECORD_ANALYSIS_HISTORY_LIMIT = 5;

const DB_NAME = 'cubecobra-record-analysis';
const DB_VERSION = 1;
const STORE = 'runs';

const storageKey = (cubeId: string, ts: number): string => `${cubeId}:${ts}`;

const entryOf = (runData: RecordAnalysisRunData): RecordAnalysisRunEntry => ({
  ts: runData.ts,
  generatedAt: runData.generatedAt,
  recordCount: runData.recordCount,
  deckCount: runData.deckCount,
  clustered: runData.clustered,
});

interface DbRecord {
  key: string;
  cubeId: string;
  ts: number;
  runData: RecordAnalysisRunData;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in this browser'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'key' });
        store.createIndex('cubeId', 'cubeId', { unique: false });
      }
    };
    request.onerror = () => reject(request.error ?? new Error('Failed to open record-analysis store'));
    request.onsuccess = () => resolve(request.result);
  });
}

// All runs for a cube, newest first, capped at the history limit.
export async function readRuns(cubeId: string): Promise<RecordAnalysisRunData[]> {
  const db = await openDb();
  try {
    return await new Promise<RecordAnalysisRunData[]>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const request = tx.objectStore(STORE).index('cubeId').getAll(cubeId);
      request.onerror = () => reject(request.error ?? new Error('Failed to read record-analysis runs'));
      request.onsuccess = () => {
        const runs = (request.result as DbRecord[])
          .filter((r) => !!r?.runData && typeof r.ts === 'number')
          .sort((a, b) => b.ts - a.ts)
          .slice(0, RECORD_ANALYSIS_HISTORY_LIMIT)
          .map((r) => r.runData);
        resolve(runs);
      };
    });
  } finally {
    db.close();
  }
}

async function writeRuns(cubeId: string, runs: RecordAnalysisRunData[]): Promise<void> {
  const ordered = [...runs].sort((a, b) => b.ts - a.ts).slice(0, RECORD_ANALYSIS_HISTORY_LIMIT);
  const keep = new Set(ordered.map((r) => storageKey(cubeId, r.ts)));
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const existingReq = store.index('cubeId').getAll(cubeId);
      existingReq.onsuccess = () => {
        for (const r of ordered) {
          store.put({ key: storageKey(cubeId, r.ts), cubeId, ts: r.ts, runData: r } satisfies DbRecord);
        }
        for (const record of existingReq.result as DbRecord[]) {
          if (!keep.has(record.key)) store.delete(record.key);
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Failed to write record-analysis runs'));
    });
  } finally {
    db.close();
  }
}

// Persist a freshly-computed run, dropping the oldest beyond the limit.
export async function persistRun(
  cubeId: string,
  runData: RecordAnalysisRunData,
): Promise<{ runs: RecordAnalysisRunEntry[]; persisted: boolean }> {
  const existing = await readRuns(cubeId);
  const next = [runData, ...existing.filter((r) => r.ts !== runData.ts)];
  try {
    await writeRuns(cubeId, next);
    return { runs: next.slice(0, RECORD_ANALYSIS_HISTORY_LIMIT).map(entryOf), persisted: true };
  } catch {
    try {
      await writeRuns(cubeId, [runData]);
      return { runs: [entryOf(runData)], persisted: true };
    } catch {
      return { runs: existing.map(entryOf), persisted: false };
    }
  }
}

export async function deleteRun(cubeId: string, ts: number): Promise<RecordAnalysisRunData[]> {
  const remaining = (await readRuns(cubeId)).filter((r) => r.ts !== ts);
  await writeRuns(cubeId, remaining);
  return remaining;
}

export async function clearRuns(cubeId: string): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const req = store.index('cubeId').getAll(cubeId);
      req.onsuccess = () => {
        for (const record of req.result as DbRecord[]) store.delete(record.key);
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Failed to clear record-analysis runs'));
    });
  } finally {
    db.close();
  }
}

export { entryOf as recordAnalysisEntryOf };
