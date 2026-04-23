import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  SimulationRunData,
  SimulationRunEntry,
  SimulationSetupResponse,
} from '@utils/datatypes/SimulationReport';

import {
  type ClusteringCache,
  clearLocalSimulationStore,
  persistSimulationRun,
  readLocalSimulationStore,
  writeLocalSimulationStore,
} from '../utils/draftSimulatorLocalStorage';

export type CurrentRunSetup = Pick<SimulationSetupResponse, 'initialPacks' | 'packSteps' | 'numSeats'> | null;

interface UseLocalSimulationHistoryArgs {
  cubeId: string;
  onResetViewSelection: () => void;
  onResetSessionCaches: () => void;
}

const setupFromRunData = (runData: SimulationRunData): CurrentRunSetup => runData.setupData ?? null;

export default function useLocalSimulationHistory({
  cubeId,
  onResetViewSelection,
  onResetSessionCaches,
}: UseLocalSimulationHistoryArgs) {
  const [runs, setRuns] = useState<SimulationRunEntry[]>([]);
  const [displayRunData, setDisplayRunData] = useState<SimulationRunData | null>(null);
  const [currentRunSetup, setCurrentRunSetup] = useState<CurrentRunSetup>(null);
  const [selectedTs, setSelectedTs] = useState<number | null>(null);
  const [loadingRun, setLoadingRun] = useState(false);
  const [historyLoadError, setHistoryLoadError] = useState<string | null>(null);
  const [loadRunError, setLoadRunError] = useState<string | null>(null);
  const [storageNotice, setStorageNotice] = useState<string | null>(null);
  const [loadedClusterCache, setLoadedClusterCache] = useState<ClusteringCache | null>(null);

  const loadRunInFlight = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const store = await readLocalSimulationStore(cubeId);
        if (cancelled) return;
        const nextRuns = store.runs.map((run) => run.entry);
        setRuns(nextRuns);
        if (store.runs[0]) {
          setDisplayRunData(store.runs[0].runData);
          setCurrentRunSetup(setupFromRunData(store.runs[0].runData));
          setSelectedTs(store.runs[0].entry.ts);
          setLoadedClusterCache(store.runs[0].clusterCache ?? null);
        } else {
          setDisplayRunData(null);
          setCurrentRunSetup(null);
          setSelectedTs(null);
          setLoadedClusterCache(null);
        }
        setHistoryLoadError(null);
      } catch (err) {
        if (cancelled) return;
        setHistoryLoadError(err instanceof Error ? err.message : 'Failed to load local simulation history');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cubeId]);

  const handleLoadRun = useCallback(
    async (ts: number) => {
      if (ts === selectedTs && displayRunData) return;
      if (loadRunInFlight.current) return;
      loadRunInFlight.current = true;
      setLoadingRun(true);
      setLoadRunError(null);
      onResetViewSelection();
      onResetSessionCaches();
      try {
        const store = await readLocalSimulationStore(cubeId);
        const run = store.runs.find((entry) => entry.entry.ts === ts);
        if (!run) {
          setLoadRunError('Run not found in local storage');
        } else {
          setDisplayRunData(run.runData);
          setCurrentRunSetup(setupFromRunData(run.runData));
          setSelectedTs(ts);
          setLoadedClusterCache(run.clusterCache ?? null);
        }
      } catch (err) {
        setLoadRunError(err instanceof Error ? err.message : 'Failed to load run');
      } finally {
        setLoadingRun(false);
        loadRunInFlight.current = false;
      }
    },
    [
      cubeId,
      selectedTs,
      displayRunData,
      onResetViewSelection,
      onResetSessionCaches,
    ],
  );

  const handleDeleteRun = useCallback(
    async (ts: number) => {
      const store = await readLocalSimulationStore(cubeId);
      const nextStoredRuns = store.runs.filter((run) => run.entry.ts !== ts);
      await writeLocalSimulationStore(cubeId, nextStoredRuns);
      const nextRuns = nextStoredRuns.map((run) => run.entry);
      setRuns(nextRuns);
      onResetViewSelection();
      if (selectedTs === ts) {
        setDisplayRunData(nextStoredRuns[0]?.runData ?? null);
        setCurrentRunSetup(nextStoredRuns[0] ? setupFromRunData(nextStoredRuns[0].runData) : null);
        setSelectedTs(nextRuns[0]?.ts ?? null);
        setLoadedClusterCache(nextStoredRuns[0]?.clusterCache ?? null);
      }
    },
    [cubeId, selectedTs, onResetViewSelection],
  );

  const handleClearHistory = useCallback(async () => {
    await clearLocalSimulationStore(cubeId);
    setRuns([]);
    setDisplayRunData(null);
    setCurrentRunSetup(null);
    setSelectedTs(null);
    setStorageNotice(null);
    setLoadedClusterCache(null);
    onResetViewSelection();
  }, [cubeId, onResetViewSelection]);

  const handlePersistCompletedRun = useCallback(
    async (entry: SimulationRunEntry, runData: SimulationRunData) => {
      const persistResult = await persistSimulationRun(cubeId, entry, runData);
      setRuns(persistResult.runs);
      setDisplayRunData(runData);
      setCurrentRunSetup(setupFromRunData(runData));
      setSelectedTs(entry.ts);
      return persistResult;
    },
    [cubeId],
  );

  return {
    runs,
    displayRunData,
    currentRunSetup,
    selectedTs,
    loadedClusterCache,
    loadingRun,
    historyLoadError,
    loadRunError,
    storageNotice,
    setCurrentRunSetup,
    setStorageNotice,
    handleLoadRun,
    handleDeleteRun,
    handleClearHistory,
    handlePersistCompletedRun,
  };
}
