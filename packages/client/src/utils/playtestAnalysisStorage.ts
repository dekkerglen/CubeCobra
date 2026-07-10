// Local (IndexedDB) storage for cube playtest-analysis runs — mirrors the record
// analysis store (recordAnalysisStorage.ts). Each run downloads every human draft's
// pick data fresh, aggregates it entirely in the browser, and is persisted here so
// users keep a small history per cube.

import { ArchetypeSkeleton } from '@utils/datatypes/SimulationReport';

import { RecordCardInfo } from './recordAnalysisStorage';

export { getStoragePressureNotice } from './draftSimulatorLocalStorage';
export type { RecordCardInfo } from './recordAnalysisStorage';

// One human draft's pick, dictionary-encoded against the run's `oracles` array:
// picked oracle, the pack it was seen in (includes the pick), pack number (0-based)
// and pick position within the pack (1-based). This is what lets the card-stat
// table recompute Seen / Pick Rate / Wheels / P1P1 for any subset of decks.
export interface PlaytestPick {
  o: number;
  seen: number[];
  pk: number;
  pip: number;
}

// One analyzed human deck with (once the model has run) its archetype + map spot.
export interface PlaytestDeck {
  draftId: string;
  date: number;
  seats: number; // seats in the source draft (for wheel detection)
  mainboard: string[]; // oracle ids
  sideboard: string[]; // oracle ids
  clusterId: number | null;
  x: number;
  y: number;
  colors: string[]; // deck color identity codes (e.g. ['W','U']), >10% threshold
  archetype: string; // ML archetype label (e.g. 'Aggro'), '' if unavailable
}

export interface PlaytestAnalysisRunData {
  ts: number;
  generatedAt: string;
  draftCount: number; // human decks analyzed
  pickCount: number; // total picks across all decks
  capped: boolean; // true when the download hit the most-recent-N cap
  // Oracle-id dictionary; `perPick` indices reference this array.
  oracles: string[];
  // Per-deck pick sequences (indexed to `decks`), used to (re)compute card stats.
  perPick: PlaytestPick[][];
  decks: PlaytestDeck[];
  skeletons: ArchetypeSkeleton[];
  clusterMethod: string;
  clustered: boolean; // true once the archetype map (ML model) has been computed
  // Per-oracle card info captured from the drafts, so cards no longer in the live
  // cube still render (keyed by oracle id).
  cardImages: { [oracle: string]: RecordCardInfo };
}

// Lightweight metadata for the run-history strip.
export interface PlaytestAnalysisRunEntry {
  ts: number;
  generatedAt: string;
  draftCount: number;
  pickCount: number;
  clustered: boolean;
  capped: boolean;
}

export const PLAYTEST_ANALYSIS_HISTORY_LIMIT = 5;

const DB_NAME = 'cubecobra-playtest-analysis';
const DB_VERSION = 1;
const STORE = 'runs';

const storageKey = (cubeId: string, ts: number): string => `${cubeId}:${ts}`;

const entryOf = (runData: PlaytestAnalysisRunData): PlaytestAnalysisRunEntry => ({
  ts: runData.ts,
  generatedAt: runData.generatedAt,
  draftCount: runData.draftCount,
  pickCount: runData.pickCount,
  clustered: runData.clustered,
  capped: runData.capped,
});

interface DbRecord {
  key: string;
  cubeId: string;
  ts: number;
  runData: PlaytestAnalysisRunData;
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
    request.onerror = () => reject(request.error ?? new Error('Failed to open playtest-analysis store'));
    request.onsuccess = () => resolve(request.result);
  });
}

// All runs for a cube, newest first, capped at the history limit.
export async function readRuns(cubeId: string): Promise<PlaytestAnalysisRunData[]> {
  const db = await openDb();
  try {
    return await new Promise<PlaytestAnalysisRunData[]>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const request = tx.objectStore(STORE).index('cubeId').getAll(cubeId);
      request.onerror = () => reject(request.error ?? new Error('Failed to read playtest-analysis runs'));
      request.onsuccess = () => {
        const runs = (request.result as DbRecord[])
          .filter((r) => !!r?.runData && typeof r.ts === 'number')
          .sort((a, b) => b.ts - a.ts)
          .slice(0, PLAYTEST_ANALYSIS_HISTORY_LIMIT)
          .map((r) => r.runData);
        resolve(runs);
      };
    });
  } finally {
    db.close();
  }
}

async function writeRuns(cubeId: string, runs: PlaytestAnalysisRunData[]): Promise<void> {
  const ordered = [...runs].sort((a, b) => b.ts - a.ts).slice(0, PLAYTEST_ANALYSIS_HISTORY_LIMIT);
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
      tx.onerror = () => reject(tx.error ?? new Error('Failed to write playtest-analysis runs'));
    });
  } finally {
    db.close();
  }
}

// Persist a freshly-computed run, dropping the oldest beyond the limit.
export async function persistRun(
  cubeId: string,
  runData: PlaytestAnalysisRunData,
): Promise<{ runs: PlaytestAnalysisRunEntry[]; persisted: boolean }> {
  const existing = await readRuns(cubeId);
  const next = [runData, ...existing.filter((r) => r.ts !== runData.ts)];
  try {
    await writeRuns(cubeId, next);
    return { runs: next.slice(0, PLAYTEST_ANALYSIS_HISTORY_LIMIT).map(entryOf), persisted: true };
  } catch {
    try {
      await writeRuns(cubeId, [runData]);
      return { runs: [entryOf(runData)], persisted: true };
    } catch {
      return { runs: existing.map(entryOf), persisted: false };
    }
  }
}

export async function deleteRun(cubeId: string, ts: number): Promise<PlaytestAnalysisRunData[]> {
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
      tx.onerror = () => reject(tx.error ?? new Error('Failed to clear playtest-analysis runs'));
    });
  } finally {
    db.close();
  }
}

export { entryOf as playtestAnalysisEntryOf };
