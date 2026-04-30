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
import { buildClusterRecommendationInput, computeSkeletons } from '../utils/draftSimulatorClustering';
import { type ClusteringCache, getStoragePressureNotice, SCORING_ALGORITHM_VERSION } from '../utils/draftSimulatorLocalStorage';

type ExtendedRequestInit = RequestInit & { timeout?: number };

interface PersistResult {
  runs: SimulationRunEntry[];
  persisted: boolean;
}

const KNN_K_DIVISOR = 16;
const LEIDEN_RES_DIVISOR = 400;
const CLUSTER_NEG_SAMPLES = 20;

let archetypeDataPromise: Promise<{ centers: { clusterId: number; center: number[] }[]; annotations: Record<string, string> } | null> | null =
  null;

async function loadArchetypeData(): Promise<{ centers: { clusterId: number; center: number[] }[]; annotations: Record<string, string> } | null> {
  if (!archetypeDataPromise) {
    archetypeDataPromise = (async () => {
      try {
        const resp = await fetch('/api/archetypes');
        if (!resp.ok) return null;
        return await resp.json();
      } catch {
        return null;
      }
    })();
  }
  return archetypeDataPromise;
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
  onSetClusterCachePending: (pending: boolean) => void;
  onPersistCompletedRun: (
    entry: SimulationRunEntry,
    runData: SimulationRunData,
    clusterCache?: ClusteringCache,
  ) => Promise<PersistResult>;
  onPersistClusterCache: (ts: number, clusterCache: ClusteringCache) => Promise<void> | void;
}

const CLUSTERING_SAVE_BUDGET_MS = 5000;

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
  onSetClusterCachePending,
  onPersistCompletedRun,
  onPersistClusterCache,
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
      let clusteringTimedOut = false;
      const precomputeClusterRecommendations = async (skeletons: ClusteringCache['skeletons']) => {
        await loadDraftRecommender();
        const remapping = buildOracleRemapping(runData.cardMeta);
        return Promise.all(
          skeletons.map(async (skeleton) => {
            const { seedOracles } = buildClusterRecommendationInput(
              skeleton,
              runData.slimPools,
              runData.cardMeta,
              deckResult.decks,
            );
            if (seedOracles.length === 0) return { ...skeleton, recommendedAdds: [] };
            const { adds } = await localRecommend(seedOracles, remapping);
            return {
              ...skeleton,
              recommendedAdds: adds.filter((item) => !runData.cardMeta[item.oracle]).slice(0, 120),
            };
          }),
        );
      };
      const buildClusterCache = async (): Promise<{ clusterCache?: ClusteringCache; clusteringNotice: string | null }> => {
        setSimPhase('cluster');
        const remapping = buildOracleRemapping(runData.cardMeta);
        const oovCount = countOutOfVocabOracles(runData.cardMeta);
        const oovPct = oovCount / Math.max(1, Object.keys(runData.cardMeta).length);
        const pools = runData.slimPools.map((_, i) => deckResult.decks[i]!.mainboard);
        const flat = await encodePools(pools, remapping);
        const poolEmbeddings = reshapeEmbeddings(flat, pools.length);
        const n = runData.slimPools.length;
        const knnK = Math.min(50, Math.max(5, Math.round(n / KNN_K_DIVISOR)));
        const resolution = parseFloat(Math.min(2.0, Math.max(0.5, n / LEIDEN_RES_DIVISOR)).toFixed(2));
        const clusteringResult = computeSkeletons(
          runData.slimPools,
          runData.cardMeta,
          poolEmbeddings,
          deckResult.decks,
          knnK,
          CLUSTER_NEG_SAMPLES,
          resolution,
        );

        let poolArchetypeLabels: [number, string][] | undefined;
        const archetypeData = await loadArchetypeData();
        if (archetypeData) {
          const labels = new Map<number, string>();
          for (let pi = 0; pi < poolEmbeddings.length; pi++) {
            const emb = poolEmbeddings[pi]!;
            const embNorm = Math.sqrt(emb.reduce((s, v) => s + v * v, 0)) || 1;
            let bestSim = -Infinity;
            let bestClusterId = -1;
            for (const { clusterId, center } of archetypeData.centers) {
              let dot = 0;
              const cNorm = Math.sqrt(center.reduce((s, v) => s + v * v, 0)) || 1;
              for (let d = 0; d < emb.length; d++) dot += emb[d]! * (center[d] ?? 0);
              const sim = dot / (embNorm * cNorm);
              if (sim > bestSim) {
                bestSim = sim;
                bestClusterId = clusterId;
              }
            }
            const label = archetypeData.annotations[String(bestClusterId)];
            if (label) labels.set(pi, label);
          }
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
      };

      const clusteringPromise = buildClusterCache();
      try {
        const timedResult = await Promise.race([
          clusteringPromise,
          new Promise<null>((resolve) => setTimeout(() => resolve(null), CLUSTERING_SAVE_BUDGET_MS)),
        ]);
        if (timedResult) {
          clusterCache = timedResult.clusterCache;
          clusteringNotice = timedResult.clusteringNotice;
        } else {
          clusteringTimedOut = true;
        }
      } catch (err) {
        console.error('Failed to precompute clustering cache during run:', err);
        clusteringNotice = 'Draft simulation completed, but cluster data will still need to be computed when the run is opened.';
        onSetClusterCachePending(false);
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
      void onPersistCompletedRun(entry, runData, clusterCache)
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

      if (clusteringTimedOut) {
        void clusteringPromise
          .then(async (result) => {
            if (!result.clusterCache || controller.signal.aborted) return;
            await onPersistClusterCache(entry.ts, result.clusterCache);
            void precomputeClusterRecommendations(result.clusterCache.skeletons)
              .then(async (recommendedSkeletons) => {
                if (controller.signal.aborted) return;
                await onPersistClusterCache(entry.ts, { ...result.clusterCache!, skeletons: recommendedSkeletons });
              })
              .catch((err) => {
                console.error('Failed to finish cluster recommendations in background:', err);
              });
          })
          .catch((err) => {
            console.error('Failed to finish clustering cache in background:', err);
            onSetClusterCachePending(false);
          });
      } else if (clusterCache) {
        void precomputeClusterRecommendations(clusterCache.skeletons)
          .then(async (recommendedSkeletons) => {
            if (controller.signal.aborted) return;
            await onPersistClusterCache(entry.ts, { ...clusterCache!, skeletons: recommendedSkeletons });
          })
          .catch((err) => {
            console.error('Failed to precompute cluster recommendations in background:', err);
          });
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
    onSetClusterCachePending,
    onResetViewSelection,
    onSetCurrentRunSetup,
    onPersistCompletedRun,
    onPersistClusterCache,
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
