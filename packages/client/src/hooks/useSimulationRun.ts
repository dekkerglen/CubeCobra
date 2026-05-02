import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type {
  BuiltDeck,
  CardMeta,
  SimulationReport,
  SimulationRunData,
  SimulationRunEntry,
  SimulationSetupResponse,
  SimulationTimingBreakdown,
  SlimPool,
} from '@utils/datatypes/SimulationReport';

import {
  buildOracleRemapping,
  countOutOfVocabOracles,
  encodePools,
  loadDraftRecommender,
  loadDraftBot,
  localRecommend,
  reshapeEmbeddings,
  WebGLInferenceError,
} from '../utils/draftBot';
import {
  buildClientSimulationSetup,
  ClientSimulationSetupError,
  fetchCubeForClientSimulation,
} from '../utils/draftSimulatorSetup';
import {
  assignArchetypeLabels,
  buildClusterRecommendationInput,
  CLUSTER_NEG_SAMPLES,
  computeSkeletons,
  KNN_K_DIVISOR,
  LEIDEN_RES_DIVISOR,
  loadArchetypeData,
} from '../utils/draftSimulatorClustering';
import { type ClusteringCache, getStoragePressureNotice, patchClusteringCache, SCORING_ALGORITHM_VERSION } from '../utils/draftSimulatorLocalStorage';

type ExtendedRequestInit = RequestInit & { timeout?: number };

interface PersistResult {
  runs: SimulationRunEntry[];
  persisted: boolean;
}

interface UseSimulationRunArgs {
  csrfFetch: (input: RequestInfo, init?: ExtendedRequestInit) => Promise<Response>;
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
  ) => Promise<SimulationReport>;
  nextLowerGpuBatchSize: (batchSize: number) => number | null;
  onResetViewSelection: () => void;
  onSimulationStart: () => void;
  onSetCurrentRunSetup: (setup: SimulationSetupResponse | null) => void;
  onSetStorageNotice: (notice: string | null) => void;
  onPersistCompletedRun: (
    entry: SimulationRunEntry,
    runData: SimulationRunData,
    clusterCache?: ClusteringCache,
  ) => Promise<PersistResult>;
}

const RECOMMENDATION_CONCURRENCY = 2;

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }
}

function getOverallSimProgress(
  simPhase: 'setup' | 'loadmodel' | 'sim' | 'deckbuild' | 'cluster' | 'save' | null,
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
    case 'cluster':
      return 96;
    case 'save':
      return 98;
    default:
      return 0;
  }
}

async function precomputeClusterRecommendations(
  skeletons: ClusteringCache['skeletons'],
  runData: SimulationRunData,
  decks: BuiltDeck[],
  signal: AbortSignal,
): Promise<ClusteringCache['skeletons']> {
  throwIfAborted(signal);
  await loadDraftRecommender();
  throwIfAborted(signal);
  const remapping = buildOracleRemapping(runData.cardMeta);
  const recommendedSkeletons: ClusteringCache['skeletons'] = [];
  for (let start = 0; start < skeletons.length; start += RECOMMENDATION_CONCURRENCY) {
    throwIfAborted(signal);
    const batch = skeletons.slice(start, start + RECOMMENDATION_CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(async (skeleton) => {
        throwIfAborted(signal);
        const { seedOracles } = buildClusterRecommendationInput(
          skeleton,
          runData.slimPools,
          runData.cardMeta,
          decks,
        );
        if (seedOracles.length === 0) return { ...skeleton, recommendedAdds: [] };
        const { adds } = await localRecommend(seedOracles, remapping);
        throwIfAborted(signal);
        return {
          ...skeleton,
          recommendedAdds: adds.filter((item) => !runData.cardMeta[item.oracle]).slice(0, 120),
        };
      }),
    );
    recommendedSkeletons.push(...batchResults);
  }
  return recommendedSkeletons;
}

async function buildClusterCacheForRun(
  runData: SimulationRunData,
  decks: BuiltDeck[],
  signal: AbortSignal,
  onSetClusterPhase: () => void,
): Promise<{ clusterCache?: ClusteringCache; clusteringNotice: string | null }> {
  onSetClusterPhase();
  throwIfAborted(signal);
  const remapping = buildOracleRemapping(runData.cardMeta);
  const oovCount = countOutOfVocabOracles(runData.cardMeta);
  const oovPct = oovCount / Math.max(1, Object.keys(runData.cardMeta).length);
  const pools = runData.slimPools.map((_, i) => decks[i]!.mainboard);
  const flat = await encodePools(pools, remapping);
  throwIfAborted(signal);
  const poolEmbeddings = reshapeEmbeddings(flat, pools.length);
  const n = runData.slimPools.length;
  const knnK = Math.min(50, Math.max(5, Math.round(n / KNN_K_DIVISOR)));
  const resolution = parseFloat(Math.min(2.0, Math.max(0.5, n / LEIDEN_RES_DIVISOR)).toFixed(2));
  const clusteringResult = computeSkeletons(
    runData.slimPools,
    runData.cardMeta,
    poolEmbeddings,
    decks,
    knnK,
    CLUSTER_NEG_SAMPLES,
    resolution,
  );
  let poolArchetypeLabels: [number, string][] | undefined;
  const archetypeData = await loadArchetypeData();
  throwIfAborted(signal);
  if (archetypeData) {
    const labels = assignArchetypeLabels(poolEmbeddings, archetypeData);
    poolArchetypeLabels = [...labels.entries()];
  }
  const nextClusterCache: ClusteringCache = {
    skeletons: clusteringResult.skeletons,
    umapCoords: clusteringResult.umapCoords,
    clusterMethod: clusteringResult.clusterMethod,
    knnK,
    resolution,
    poolArchetypeLabels,
    scoringVersion: SCORING_ALGORITHM_VERSION,
  };
  return {
    clusterCache: nextClusterCache,
    clusteringNotice:
      oovPct > 0.1
        ? `${Math.round(oovPct * 100)}% of cards in this cube aren't in the ML model's training vocabulary. Clustering quality may be reduced for those cards.`
        : null,
  };
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
  const [simPhase, setSimPhase] = useState<'setup' | 'loadmodel' | 'sim' | 'deckbuild' | 'cluster' | 'save' | null>(null);
  const [modelLoadProgress, setModelLoadProgress] = useState(0);
  const [simProgress, setSimProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const simAbortRef = useRef<AbortController | null>(null);

  const isRunning = status === 'running';

  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [pendingNavigationHref, setPendingNavigationHref] = useState<string | null>(null);

  useEffect(() => {
    if (!isRunning) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isRunning]);

  useEffect(() => {
    if (!isRunning) return;
    const handleDocumentClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest('a');
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const href = anchor.href;
      if (!href) return;
      if (anchor.target && anchor.target !== '_self') return;
      if (anchor.hasAttribute('download')) return;
      const nextUrl = new URL(href, window.location.href);
      if (nextUrl.origin !== window.location.origin) return;
      if (nextUrl.href === window.location.href) return;
      event.preventDefault();
      setPendingNavigationHref(nextUrl.href);
      setLeaveModalOpen(true);
    };
    document.addEventListener('click', handleDocumentClick, true);
    return () => document.removeEventListener('click', handleDocumentClick, true);
  }, [isRunning]);

  const handleCancelLeave = useCallback(() => {
    setLeaveModalOpen(false);
    setPendingNavigationHref(null);
  }, []);

  const handleConfirmedLeave = useCallback(() => {
    if (!pendingNavigationHref) {
      setLeaveModalOpen(false);
      return;
    }
    simAbortRef.current?.abort();
    window.location.assign(pendingNavigationHref);
  }, [pendingNavigationHref]);

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
      let setupData: SimulationSetupResponse;
      try {
        const setupStart = performance.now();
        try {
          const fullCube = await fetchCubeForClientSimulation(csrfFetch, cubeId);
          throwIfAborted(controller.signal);
          setupData = await buildClientSimulationSetup(
            csrfFetch,
            fullCube,
            fullCube.cards,
            numDrafts,
            numSeats,
            selectedFormatId,
          );
        } catch (clientErr) {
          if (clientErr instanceof ClientSimulationSetupError && clientErr.fatal) {
            throw clientErr;
          }
          const setupRes = await csrfFetch(`/cube/api/simulatesetup/${encodeURIComponent(cubeId)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ numDrafts, numSeats, formatId: selectedFormatId }),
            signal: setupSignal,
          });
          const setupJson = await setupRes.json();
          if (!setupJson.success) {
            throw new ClientSimulationSetupError(setupJson.message ?? 'Failed to set up simulation', true);
          }
          setupData = setupJson;
        }
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
      throwIfAborted(controller.signal);
      if (!setupData) {
        setStatus('failed');
        setSimPhase(null);
        setErrorMsg('Failed to set up simulation');
        return;
      }

      setSimPhase('loadmodel');
      setModelLoadProgress(0);
      const modelLoadStart = performance.now();
      await loadDraftBot((pct) => setModelLoadProgress(pct));
      throwIfAborted(controller.signal);
      const recommenderWarmupPromise = loadDraftRecommender().catch((err) => {
        console.error('Failed to warm draft recommender during run:', err);
      });
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
      throwIfAborted(controller.signal);
      simulationMs = performance.now() - simulationStart;
      onSetCurrentRunSetup(setupData as SimulationSetupResponse);

      setSimPhase('deckbuild');
      const deckbuildStart = performance.now();
      const deckResult = await runWithGpuRetry(
        'Deckbuilding',
        (bs) => buildAllDecks(report.slimPools, setupData as SimulationSetupResponse, controller.signal, bs),
      );
      throwIfAborted(controller.signal);
      deckbuildMs = performance.now() - deckbuildStart;
      if (!deckResult) {
        setStatus('failed');
        setSimPhase(null);
        setErrorMsg('Deck building failed. The simulation ran successfully but decks could not be built.');
        return;
      }

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
      let clusterCache: ClusteringCache | undefined;
      let clusteringNotice: string | null = null;
      try {
        const result = await buildClusterCacheForRun(runData, deckResult.decks, controller.signal, () =>
          setSimPhase('cluster'),
        );
        throwIfAborted(controller.signal);
        clusterCache = result.clusterCache;
        clusteringNotice = result.clusteringNotice;
      } catch (err) {
        console.error('Failed to precompute clustering cache during run:', err);
        clusteringNotice = 'Draft simulation completed, but clustering could not be computed.';
      }

      setSimPhase('save');
      const saveStart = performance.now();
      runData.timings = {
        setupMs,
        modelLoadMs,
        simulationMs,
        deckbuildMs,
        saveMs: 0,
        totalMs: performance.now() - runStart,
      };
      const storagePressureNotice = await getStoragePressureNotice();
      throwIfAborted(controller.signal);
      saveMs = performance.now() - saveStart;
      runData.timings = {
        setupMs,
        modelLoadMs,
        simulationMs,
        deckbuildMs,
        saveMs,
        totalMs: performance.now() - runStart,
      };
      if (retryNotices.length > 0 || storagePressureNotice || clusteringNotice) {
        onSetStorageNotice([...retryNotices, storagePressureNotice, clusteringNotice].filter(Boolean).join(' '));
      } else {
        onSetStorageNotice(null);
      }
      const persistPromise = onPersistCompletedRun(entry, runData, clusterCache)
        .then((persistResult) => {
          if (!persistResult.persisted) {
            onSetStorageNotice('Results are shown below, but this browser did not have enough local storage to save them.');
          } else if (retryNotices.length > 0 || storagePressureNotice || clusteringNotice) {
            onSetStorageNotice([...retryNotices, storagePressureNotice, clusteringNotice].filter(Boolean).join(' '));
          } else {
            onSetStorageNotice(null);
          }
        })
        .catch(() => {
          onSetStorageNotice('Results are shown below, but local saving hit an error and may not have completed.');
        });

      setStatus('completed');
      setSimPhase(null);
      simAbortRef.current = null;

      if (clusterCache) {
        const capturedClusterCache = clusterCache;
        const capturedSignal = controller.signal;
        void Promise.all([recommenderWarmupPromise, persistPromise])
          .then(() => precomputeClusterRecommendations(capturedClusterCache.skeletons, runData, deckResult.decks, capturedSignal))
          .then((recommendedSkeletons) => {
            if (capturedSignal.aborted) return;
            void patchClusteringCache(cubeId, entry.ts, { skeletons: recommendedSkeletons });
          })
          .catch((err) => {
            console.error('Failed to precompute cluster recommendations in background:', err);
          });
      }
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
    leaveModalOpen,
    handleCancelLeave,
    handleConfirmedLeave,
    handleStart,
    handleCancel,
  };
}
