import type {
  ArchetypeSkeleton,
  SimulationRunData,
  SimulationRunEntry,
} from '@utils/datatypes/SimulationReport';

export const LOCAL_SIM_HISTORY_LIMIT = 5;
const LOCAL_SIM_STORAGE_VERSION = 1;
const LOCAL_SIM_DB_NAME = 'cubecobra-draft-simulator';
const LOCAL_SIM_DB_VERSION = 1;
const LOCAL_SIM_STORE_NAME = 'runs';

// Bump when scoring algorithms change so caches from older code paths are
// detected as stale and rescored on hydration. Caches missing this field are
// implicitly version 0.
export const SCORING_ALGORITHM_VERSION = 1;

export interface ClusteringCache {
  scoringVersion?: number; // see SCORING_ALGORITHM_VERSION
  skeletons: ArchetypeSkeleton[];
  umapCoords: { x: number; y: number }[];
  clusterMethod: string;
  knnK: number;
  resolution: number;
  poolArchetypeLabels?: [number, string][];
}

export interface LocalSimulationStore {
  version: number;
  runs: { entry: SimulationRunEntry; runData: SimulationRunData; clusterCache?: ClusteringCache; clusterCachePending?: boolean }[];
}

interface IndexedDbSimulationRunRecord {
  key: string;
  cubeId: string;
  ts: number;
  entry: SimulationRunEntry;
  runData: SimulationRunData;
  clusterCache?: ClusteringCache;
  clusterCachePending?: boolean;
}

const localSimulationStorageKey = (cubeId: string, ts: number): string => `${cubeId}:${ts}`;

async function openLocalSimulationDb(): Promise<IDBDatabase> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    throw new Error('IndexedDB is not available in this browser');
  }
  return await new Promise((resolve, reject) => {
    const request = window.indexedDB.open(LOCAL_SIM_DB_NAME, LOCAL_SIM_DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(LOCAL_SIM_STORE_NAME)) {
        const store = db.createObjectStore(LOCAL_SIM_STORE_NAME, { keyPath: 'key' });
        store.createIndex('cubeId', 'cubeId', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

export async function readLocalSimulationStore(cubeId: string): Promise<LocalSimulationStore> {
  const db = await openLocalSimulationDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(LOCAL_SIM_STORE_NAME, 'readonly');
      const store = tx.objectStore(LOCAL_SIM_STORE_NAME);
      const request = store.index('cubeId').getAll(cubeId);
      request.onerror = () => reject(request.error ?? new Error('Failed to load local simulation history'));
      request.onsuccess = () => {
        const runs = (request.result as IndexedDbSimulationRunRecord[])
          .filter(
            (run): run is IndexedDbSimulationRunRecord =>
              !!run &&
              run.cubeId === cubeId &&
              typeof run.entry?.ts === 'number' &&
              typeof run.entry?.generatedAt === 'string' &&
              !!run.runData &&
              typeof run.runData.numDrafts === 'number',
          )
          .sort((a, b) => b.ts - a.ts)
          .slice(0, LOCAL_SIM_HISTORY_LIMIT)
          .map((run) => ({
            entry: run.entry,
            runData: run.runData,
            clusterCache: run.clusterCache,
            clusterCachePending: !!run.clusterCachePending,
          }));
        resolve({ version: LOCAL_SIM_STORAGE_VERSION, runs });
      };
    });
  } finally {
    db.close();
  }
}

export async function writeLocalSimulationStore(
  cubeId: string,
  runs: { entry: SimulationRunEntry; runData: SimulationRunData; clusterCache?: ClusteringCache; clusterCachePending?: boolean }[],
): Promise<void> {
  const nextRuns = [...runs].sort((a, b) => b.entry.ts - a.entry.ts);
  const desiredKeys = new Set(
    nextRuns.slice(0, LOCAL_SIM_HISTORY_LIMIT).map((run) => localSimulationStorageKey(cubeId, run.entry.ts)),
  );
  const db = await openLocalSimulationDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(LOCAL_SIM_STORE_NAME, 'readwrite');
      const store = tx.objectStore(LOCAL_SIM_STORE_NAME);
      const existingReq = store.index('cubeId').getAll(cubeId);
      existingReq.onerror = () => reject(existingReq.error ?? new Error('Failed to write local simulation history'));
      existingReq.onsuccess = () => {
        const existing = existingReq.result as IndexedDbSimulationRunRecord[];
        for (const run of nextRuns.slice(0, LOCAL_SIM_HISTORY_LIMIT)) {
          store.put({
            key: localSimulationStorageKey(cubeId, run.entry.ts),
            cubeId,
            ts: run.entry.ts,
            entry: run.entry,
            runData: run.runData,
            clusterCache: run.clusterCache,
            clusterCachePending: !!run.clusterCachePending,
          } satisfies IndexedDbSimulationRunRecord);
        }
        for (const record of existing) {
          if (!desiredKeys.has(record.key)) {
            store.delete(record.key);
          }
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Failed to write local simulation history'));
    });
  } finally {
    db.close();
  }
}

export async function persistSimulationRun(
  cubeId: string,
  entry: SimulationRunEntry,
  runData: SimulationRunData,
  clusterCache?: ClusteringCache,
): Promise<{ runs: SimulationRunEntry[]; persisted: boolean }> {
  const store = await readLocalSimulationStore(cubeId);
  const nextStoredRuns = [
    { entry, runData, clusterCache, clusterCachePending: false },
    ...store.runs.filter((run) => run.entry.ts !== entry.ts),
  ];
  const nextEntries = nextStoredRuns
    .sort((a, b) => b.entry.ts - a.entry.ts)
    .slice(0, LOCAL_SIM_HISTORY_LIMIT)
    .map((run) => run.entry);
  try {
    await writeLocalSimulationStore(cubeId, nextStoredRuns);
    return { runs: nextEntries, persisted: true };
  } catch {
    try {
      await writeLocalSimulationStore(cubeId, [{ entry, runData, clusterCache, clusterCachePending: !clusterCache }]);
      return { runs: [entry], persisted: true };
    } catch {
      return { runs: store.runs.map((run) => run.entry), persisted: false };
    }
  }
}

export async function clearLocalSimulationStore(cubeId: string): Promise<void> {
  await writeLocalSimulationStore(cubeId, []);
}

export async function patchClusteringCache(cubeId: string, ts: number, patch: Partial<ClusteringCache>): Promise<boolean> {
  const db = await openLocalSimulationDb();
  try {
    return await new Promise<boolean>((resolve, reject) => {
      const tx = db.transaction(LOCAL_SIM_STORE_NAME, 'readwrite');
      const store = tx.objectStore(LOCAL_SIM_STORE_NAME);
      const req = store.get(localSimulationStorageKey(cubeId, ts));
      req.onsuccess = () => {
        const record = req.result as IndexedDbSimulationRunRecord | undefined;
        const base = record?.clusterCache;
        const merged = { ...base, ...patch } as ClusteringCache;
        if (record && merged.skeletons && merged.umapCoords) {
          store.put({ ...record, clusterCache: merged, clusterCachePending: false });
        }
      };
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error ?? new Error('Failed to patch clustering cache'));
    });
  } catch (error) {
    console.warn('Failed to patch clustering cache', { cubeId, ts, patchKeys: Object.keys(patch), error });
    return false;
  } finally {
    db.close();
  }
}

export async function getStoragePressureNotice(): Promise<string | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return null;
  try {
    const estimate = await navigator.storage.estimate();
    if (!estimate.quota || estimate.usage === undefined) return null;
    const remaining = estimate.quota - estimate.usage;
    const remainingMb = remaining / 1024 / 1024;
    const usedRatio = estimate.usage / estimate.quota;
    if (remainingMb < 100 || usedRatio > 0.85) {
      return `Local browser storage is getting tight (${Math.max(0, Math.round(remainingMb))} MB estimated free). Old simulator runs may need to be cleared if saves start failing.`;
    }
  } catch {
    return null;
  }
  return null;
}
