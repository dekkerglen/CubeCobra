import { useCallback, useMemo, useRef, useState } from 'react';

import type {
  BuiltDeck,
  CardMeta,
  SimulationRunData,
  SimulationRunEntry,
  SimulationSetupResponse,
  SimulationTimingBreakdown,
  SlimPool,
} from '@utils/datatypes/SimulationReport';

import { loadDraftBot, WebGLInferenceError } from '../utils/draftBot';
import { getStoragePressureNotice } from '../utils/draftSimulatorLocalStorage';

interface PersistResult {
  runs: SimulationRunEntry[];
  persisted: boolean;
}

interface UseSimulationRunArgs {
  csrfFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  cubeId: string;
  numDrafts: number;
  numSeats: number;
  gpuBatchSize: number;
  selectedFormatId: number;
  buildAllDecks: (
    slimPools: SlimPool[],
    setup: SimulationSetupResponse,
    signal?: AbortSignal,
    batchSize?: number,
  ) => Promise<{ decks: BuiltDeck[]; basicCardMeta: Record<string, CardMeta> } | null>;
  runClientSimulation: (
    setup: SimulationSetupResponse,
    numDrafts: number,
    onProgress: (pct: number) => void,
    signal?: AbortSignal,
    gpuBatchSize?: number,
  ) => Promise<any>;
  nextLowerGpuBatchSize: (batchSize: number) => number | null;
  onResetViewSelection: () => void;
  onSimulationStart: () => void;
  onSetCurrentRunSetup: (setup: SimulationSetupResponse | null) => void;
  onSetStorageNotice: (notice: string | null) => void;
  onPersistCompletedRun: (entry: SimulationRunEntry, runData: SimulationRunData) => Promise<PersistResult>;
}

function getOverallSimProgress(
  simPhase: 'setup' | 'loadmodel' | 'sim' | 'deckbuild' | 'save' | null,
  modelLoadProgress: number,
  simProgress: number,
): number {
  switch (simPhase) {
    case 'setup':
      return 5;
    case 'loadmodel':
      return 5 + Math.round((modelLoadProgress / 100) * 15);
    case 'sim':
      return 20 + Math.round((simProgress / 100) * 70);
    case 'deckbuild':
      return 92;
    case 'save':
      return 98;
    default:
      return 0;
  }
}

export default function useSimulationRun({
  csrfFetch,
  cubeId,
  numDrafts,
  numSeats,
  gpuBatchSize,
  selectedFormatId,
  buildAllDecks,
  runClientSimulation,
  nextLowerGpuBatchSize,
  onResetViewSelection,
  onSimulationStart,
  onSetCurrentRunSetup,
  onSetStorageNotice,
  onPersistCompletedRun,
}: UseSimulationRunArgs) {
  const [status, setStatus] = useState<'idle' | 'running' | 'completed' | 'failed'>('idle');
  const [simPhase, setSimPhase] = useState<'setup' | 'loadmodel' | 'sim' | 'deckbuild' | 'save' | null>(null);
  const [modelLoadProgress, setModelLoadProgress] = useState(0);
  const [simProgress, setSimProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const simAbortRef = useRef<AbortController | null>(null);

  const isRunning = status === 'running';
  const overallSimProgress = useMemo(
    () => getOverallSimProgress(simPhase, modelLoadProgress, simProgress),
    [simPhase, modelLoadProgress, simProgress],
  );

  const handleCancel = useCallback(() => {
    simAbortRef.current?.abort();
    simAbortRef.current = null;
    setStatus('idle');
    setSimPhase(null);
    setSimProgress(0);
    setErrorMsg(null);
  }, []);

  const handleStart = useCallback(async () => {
    const controller = new AbortController();
    const runStart = performance.now();
    let setupMs = 0;
    let modelLoadMs = 0;
    let simulationMs = 0;
    let deckbuildMs = 0;
    let saveMs = 0;
    simAbortRef.current = controller;
    onSimulationStart();
    setStatus('running');
    setSimPhase('setup');
    setSimProgress(0);
    setErrorMsg(null);
    onSetStorageNotice(null);
    onResetViewSelection();
    try {
      const setupTimeout = new AbortController();
      const setupTimeoutId = setTimeout(() => setupTimeout.abort(), 120_000);
      const setupSignal = AbortSignal.any ? AbortSignal.any([controller.signal, setupTimeout.signal]) : setupTimeout.signal;
      let setupRes: Response;
      try {
        const setupStart = performance.now();
        setupRes = await csrfFetch(`/cube/api/simulatesetup/${encodeURIComponent(cubeId)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ numDrafts, numSeats, formatId: selectedFormatId }),
          signal: setupSignal,
        });
        setupMs = performance.now() - setupStart;
      } catch (fetchErr) {
        clearTimeout(setupTimeoutId);
        if (setupTimeout.signal.aborted) {
          setStatus('failed');
          setSimPhase(null);
          setErrorMsg(
            `Setup timed out after 120 s — the server took too long to generate ${numDrafts} drafts. Try a smaller number.`,
          );
          return;
        }
        throw fetchErr;
      }
      clearTimeout(setupTimeoutId);
      const setupData = await setupRes.json();
      if (!setupData.success) {
        setStatus('failed');
        setSimPhase(null);
        setErrorMsg(setupData.message ?? 'Failed to set up simulation');
        return;
      }

      setSimPhase('loadmodel');
      setModelLoadProgress(0);
      const modelLoadStart = performance.now();
      await loadDraftBot((pct) => setModelLoadProgress(pct));
      modelLoadMs = performance.now() - modelLoadStart;

      let effectiveGpuBatchSize = gpuBatchSize;
      const retryNotices: string[] = [];
      const runWithGpuRetry = async <T,>(
        label: string,
        fn: (batchSize: number) => Promise<T>,
        onRetry?: () => void,
      ): Promise<T> => {
        for (;;) {
          try {
            return await fn(effectiveGpuBatchSize);
          } catch (err) {
            if (!(err instanceof WebGLInferenceError)) throw err;
            const next = nextLowerGpuBatchSize(effectiveGpuBatchSize);
            if (!next) throw err;
            retryNotices.push(`${label} exceeded GPU memory at batch size ${effectiveGpuBatchSize}; retried at ${next}.`);
            effectiveGpuBatchSize = next;
            onRetry?.();
          }
        }
      };

      setSimPhase('sim');
      const simulationStart = performance.now();
      const report = await runWithGpuRetry(
        'Draft simulation',
        (bs) => runClientSimulation(setupData as SimulationSetupResponse, numDrafts, setSimProgress, controller.signal, bs),
        () => setSimProgress(0),
      );
      simulationMs = performance.now() - simulationStart;
      onSetCurrentRunSetup(setupData as SimulationSetupResponse);

      setSimPhase('deckbuild');
      const deckbuildStart = performance.now();
      const deckResult = await runWithGpuRetry(
        'Deckbuilding',
        (bs) => buildAllDecks(report.slimPools, setupData as SimulationSetupResponse, controller.signal, bs),
      );
      deckbuildMs = performance.now() - deckbuildStart;
      if (!deckResult) {
        setStatus('failed');
        setSimPhase(null);
        setErrorMsg('Deck building failed. The simulation ran successfully but decks could not be built.');
        return;
      }

      setSimPhase('save');
      const saveStart = performance.now();
      const { simulatedPools: _derived, ...runDataBase } = report;
      const mergedCardMeta = { ...runDataBase.cardMeta, ...deckResult.basicCardMeta };
      const timings: SimulationTimingBreakdown = {
        setupMs,
        modelLoadMs,
        simulationMs,
        deckbuildMs,
        saveMs: 0,
        totalMs: 0,
      };
      const runData = {
        ...runDataBase,
        cardMeta: mergedCardMeta,
        deckBuilds: deckResult.decks,
        setupData: report.setupData,
        timings,
      };
      const ts = Date.now();
      const entry: SimulationRunEntry = {
        ts,
        generatedAt: runData.generatedAt,
        numDrafts: runData.numDrafts,
        numSeats: runData.numSeats,
        convergenceScore: runData.convergenceScore ?? 0,
      };
      runData.timings = {
        setupMs,
        modelLoadMs,
        simulationMs,
        deckbuildMs,
        saveMs: 0,
        totalMs: performance.now() - runStart,
      };
      const storagePressureNotice = await getStoragePressureNotice();
      const persistResult = await onPersistCompletedRun(entry, runData);
      saveMs = performance.now() - saveStart;
      runData.timings = {
        setupMs,
        modelLoadMs,
        simulationMs,
        deckbuildMs,
        saveMs,
        totalMs: performance.now() - runStart,
      };
      if (!persistResult.persisted) {
        onSetStorageNotice('Results are shown below, but this browser did not have enough local storage to save them.');
      } else if (retryNotices.length > 0 || storagePressureNotice) {
        onSetStorageNotice([...retryNotices, storagePressureNotice].filter(Boolean).join(' '));
      }

      setStatus('completed');
      setSimPhase(null);
      simAbortRef.current = null;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setStatus('failed');
      setSimPhase(null);
      if (err instanceof WebGLInferenceError) {
        const draftSuggestion =
          numDrafts > 1 ? `reduce the draft count (currently ${numDrafts})` : 'run fewer seats or a smaller format';
        const batchSuggestion = gpuBatchSize > 16 ? ' or lower the GPU batch size' : '';
        setErrorMsg(
          `Your GPU ran out of memory during simulation. Try to ${draftSuggestion}${batchSuggestion}, then run it again.`,
        );
      } else {
        setErrorMsg(err instanceof Error ? err.message : 'Simulation failed');
      }
    }
  }, [
    csrfFetch,
    cubeId,
    numDrafts,
    numSeats,
    selectedFormatId,
    gpuBatchSize,
    nextLowerGpuBatchSize,
    runClientSimulation,
    buildAllDecks,
    onSimulationStart,
    onSetStorageNotice,
    onResetViewSelection,
    onSetCurrentRunSetup,
    onPersistCompletedRun,
  ]);

  return {
    status,
    simPhase,
    modelLoadProgress,
    simProgress,
    errorMsg,
    simAbortRef,
    isRunning,
    overallSimProgress,
    setStorageNotice: onSetStorageNotice,
    handleStart,
    handleCancel,
  };
}
