import { useCallback, useEffect, useState } from 'react';

import {
  clearRuns,
  deleteRun,
  persistRun,
  PLAYTEST_ANALYSIS_HISTORY_LIMIT,
  playtestAnalysisEntryOf,
  PlaytestAnalysisRunData,
  PlaytestAnalysisRunEntry,
  readRuns,
} from '../utils/playtestAnalysisStorage';

// Run history for the playtest-analysis dashboard, mirroring the record-analysis
// history hook: load past runs from IndexedDB, switch between them, delete, clear,
// and persist a freshly-computed run.
export default function useLocalPlaytestAnalysisHistory(cubeId: string) {
  const [runs, setRuns] = useState<PlaytestAnalysisRunEntry[]>([]);
  const [displayRun, setDisplayRun] = useState<PlaytestAnalysisRunData | null>(null);
  const [selectedTs, setSelectedTs] = useState<number | null>(null);
  const [loadingRun, setLoadingRun] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // Load history on mount; auto-select the most recent run.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await readRuns(cubeId);
        if (cancelled) return;
        setRuns(stored.map(playtestAnalysisEntryOf));
        if (stored[0]) {
          setDisplayRun(stored[0]);
          setSelectedTs(stored[0].ts);
        }
        setHistoryError(null);
      } catch (err) {
        if (!cancelled) setHistoryError(err instanceof Error ? err.message : 'Failed to load saved analyses');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cubeId]);

  const handleLoadRun = useCallback(
    async (ts: number) => {
      if (ts === selectedTs && displayRun) return;
      setLoadingRun(true);
      try {
        const stored = await readRuns(cubeId);
        const run = stored.find((r) => r.ts === ts);
        if (run) {
          setDisplayRun(run);
          setSelectedTs(ts);
        }
      } finally {
        setLoadingRun(false);
      }
    },
    [cubeId, selectedTs, displayRun],
  );

  const handleDeleteRun = useCallback(
    async (ts: number) => {
      const remaining = await deleteRun(cubeId, ts);
      setRuns(remaining.map(playtestAnalysisEntryOf));
      if (selectedTs === ts) {
        setDisplayRun(remaining[0] ?? null);
        setSelectedTs(remaining[0]?.ts ?? null);
      }
    },
    [cubeId, selectedTs],
  );

  const handleClearHistory = useCallback(async () => {
    await clearRuns(cubeId);
    setRuns([]);
    setDisplayRun(null);
    setSelectedTs(null);
  }, [cubeId]);

  // Persist a completed run and make it the selected one (optimistic).
  const handlePersistCompletedRun = useCallback(
    async (runData: PlaytestAnalysisRunData) => {
      setDisplayRun(runData);
      setSelectedTs(runData.ts);
      setRuns((current) =>
        [playtestAnalysisEntryOf(runData), ...current.filter((r) => r.ts !== runData.ts)].slice(
          0,
          PLAYTEST_ANALYSIS_HISTORY_LIMIT,
        ),
      );
      const result = await persistRun(cubeId, runData);
      setRuns(result.runs);
      return result;
    },
    [cubeId],
  );

  return {
    runs,
    displayRun,
    setDisplayRun,
    selectedTs,
    loadingRun,
    historyError,
    handleLoadRun,
    handleDeleteRun,
    handleClearHistory,
    handlePersistCompletedRun,
  };
}
