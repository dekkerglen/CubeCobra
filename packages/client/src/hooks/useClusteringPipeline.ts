import { useCallback, useEffect, useRef, useState } from 'react';

import type { ArchetypeSkeleton, BuiltDeck, SimulationRunData } from '@utils/datatypes/SimulationReport';

import {
  buildOracleRemapping,
  countOutOfVocabOracles,
  encodePools,
  loadDraftBot,
  reshapeEmbeddings,
} from '../utils/draftBot';
import {
  assignArchetypeLabels,
  CLUSTER_NEG_SAMPLES,
  computeSkeletons,
  KNN_K_DIVISOR,
  LEIDEN_RES_DIVISOR,
  loadArchetypeData,
  rescoreSkeletons,
} from '../utils/draftSimulatorClustering';
import { type ClusteringCache, patchClusteringCache, SCORING_ALGORITHM_VERSION } from '../utils/draftSimulatorLocalStorage';

type EmbeddingCacheValue = number[][] | Record<string, number[]> | null;


interface UseClusteringPipelineArgs {
  cubeId: string;
  displayRunData: SimulationRunData | null;
  activeDecks: BuiltDeck[] | null;
  selectedTs: number | null;
  loadedClusterCache: ClusteringCache | null;
  embeddingsCache: { current: Map<string, EmbeddingCacheValue> };
}

export default function useClusteringPipeline({
  cubeId,
  displayRunData,
  activeDecks,
  selectedTs,
  loadedClusterCache,
  embeddingsCache,
}: UseClusteringPipelineArgs) {
  const [knnK, setKnnK] = useState(50);
  const [pendingKnnK, setPendingKnnK] = useState(50);
  const [clusterSeed, setClusterSeed] = useState(0);
  const [resolution, setResolution] = useState(1.0);
  const [pendingResolution, setPendingResolution] = useState(1.0);

  const [skeletons, setSkeletons] = useState<ArchetypeSkeleton[]>([]);
  const [umapCoords, setUmapCoords] = useState<{ x: number; y: number }[]>([]);
  const [clusteringInProgress, setClusteringInProgress] = useState(false);
  const [poolEmbeddings, setPoolEmbeddings] = useState<number[][] | null>(null);
  const [poolArchetypeLabels, setPoolArchetypeLabels] = useState<Map<number, string> | null>(null);
  const [poolEmbeddingsFailed, setPoolEmbeddingsFailed] = useState(false);
  const [oovWarningPct, setOovWarningPct] = useState<number | null>(null);

  const hydratedClusterSourceKey = useRef<string | null>(null);
  // Tracks which runSourceKey produced the current poolArchetypeLabels so we
  // skip recomputation when they were already loaded from cache for that run.
  const archetypeLabelsSourceKey = useRef<string | null>(null);

  const poolArchetypeLabelsLoading = displayRunData !== null && poolArchetypeLabels === null && !poolEmbeddingsFailed;
  const hasDecksForSource = !!(displayRunData && activeDecks && activeDecks.length === displayRunData.slimPools.length);

  const clusteringPhase: string | null = clusteringInProgress
    ? poolEmbeddings === null && !poolEmbeddingsFailed
      ? 'Embedding pools…'
      : poolArchetypeLabelsLoading
      ? 'Identifying archetypes…'
      : 'Clustering drafts…'
    : null;
  const runSourceKey = [
    selectedTs ?? 'unsaved',
    displayRunData?.generatedAt ?? 'none',
    displayRunData?.slimPools.length ?? 0,
    hasDecksForSource ? 'decks' : 'picks',
  ].join(':');
  const clusteringSourceKey = [
    runSourceKey,
    clusterSeed,
  ].join(':');

  useEffect(() => {
    if (!displayRunData) return;
    const n = displayRunData.slimPools.length;
    const autoK = Math.min(50, Math.max(5, Math.round(n / KNN_K_DIVISOR)));
    const autoRes = parseFloat(Math.min(2.0, Math.max(0.5, n / LEIDEN_RES_DIVISOR)).toFixed(2));
    setKnnK(autoK);
    setPendingKnnK(autoK);
    setResolution(autoRes);
    setPendingResolution(autoRes);
  }, [displayRunData]);

  useEffect(() => {
    if (loadedClusterCache?.skeletons && loadedClusterCache?.umapCoords) {
      hydratedClusterSourceKey.current = clusteringSourceKey;
      setSkeletons(loadedClusterCache.skeletons);
      setUmapCoords(loadedClusterCache.umapCoords);
      setKnnK(loadedClusterCache.knnK);
      setPendingKnnK(loadedClusterCache.knnK);
      setResolution(loadedClusterCache.resolution);
      setPendingResolution(loadedClusterCache.resolution);
      const cachedLabels = loadedClusterCache.poolArchetypeLabels
        ? new Map(loadedClusterCache.poolArchetypeLabels)
        : null;
      setPoolArchetypeLabels(cachedLabels);
      archetypeLabelsSourceKey.current = cachedLabels ? runSourceKey : null;
      return;
    }
    hydratedClusterSourceKey.current = null;
    setSkeletons([]);
    setUmapCoords([]);
    setPoolArchetypeLabels(null);
    archetypeLabelsSourceKey.current = null;
  }, [loadedClusterCache, runSourceKey]);

  // After hydrating from cache, refresh per-cluster card scoring if any skeleton
  // lacks the latest variant fields or still uses the legacy flat-array shape
  // (pre-RankedCards). Reuses cached cluster assignments, so this is cheap — no
  // k-NN/UMAP/Leiden rerun.
  useEffect(() => {
    if (!displayRunData || skeletons.length === 0) return;
    if (poolEmbeddings === null && !poolEmbeddingsFailed) return;
    const cacheVersion = loadedClusterCache?.scoringVersion ?? 0;
    const stale =
      cacheVersion < SCORING_ALGORITHM_VERSION ||
      skeletons.some(
        (s) =>
          s.identityCards === undefined ||
          Array.isArray(s.coreCards) ||
          !Array.isArray(s.coreCards?.default),
      );
    if (!stale) return;
    try {
      const refreshed = rescoreSkeletons(
        displayRunData.slimPools,
        displayRunData.cardMeta,
        poolEmbeddings,
        activeDecks,
        skeletons,
      );
      setSkeletons(refreshed);
      if (selectedTs) {
        void patchClusteringCache(cubeId, selectedTs, {
          skeletons: refreshed,
          scoringVersion: SCORING_ALGORITHM_VERSION,
        });
      }
    } catch (error) {
      console.error('Failed to refresh cached cluster scoring:', error);
    }
  }, [skeletons, displayRunData, poolEmbeddings, poolEmbeddingsFailed, activeDecks, selectedTs, cubeId, loadedClusterCache]);

  useEffect(() => {
    if (!displayRunData || displayRunData.slimPools.length === 0 || !selectedTs) {
      setPoolEmbeddings(null);
      setPoolEmbeddingsFailed(false);
      return;
    }
    setPoolEmbeddingsFailed(false);
    const hasDecks = !!(activeDecks && activeDecks.length === displayRunData.slimPools.length);
    const cacheKey = `${selectedTs}-${hasDecks ? 'decks' : 'picks'}`;
    if (embeddingsCache.current.has(cacheKey)) {
      setPoolEmbeddings(embeddingsCache.current.get(cacheKey) as number[][] | null);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        await loadDraftBot();
        const remapping = buildOracleRemapping(displayRunData.cardMeta);
        const oovCount = countOutOfVocabOracles(displayRunData.cardMeta);
        const oovPct = oovCount / Math.max(1, Object.keys(displayRunData.cardMeta).length);
        if (!cancelled) setOovWarningPct(oovPct > 0.1 ? oovPct : null);
        const pools = displayRunData.slimPools.map((pool, i) =>
          hasDecks ? activeDecks![i]!.mainboard : pool.picks.map((p) => p.oracle_id),
        );
        const flat = await encodePools(pools, remapping);
        if (!cancelled) {
          const result = reshapeEmbeddings(flat, pools.length);
          embeddingsCache.current.set(cacheKey, result);
          setPoolEmbeddings(result);
        }
      } catch {
        if (!cancelled) {
          embeddingsCache.current.set(cacheKey, null);
          setPoolEmbeddings(null);
          setPoolEmbeddingsFailed(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [displayRunData, activeDecks, selectedTs, embeddingsCache]);

  useEffect(() => {
    if (!poolEmbeddings || poolEmbeddings.length === 0) {
      // Don't clear labels that are already valid for this run (e.g. restored from cache
      // while embeddings were skipped because everything was cached).
      if (archetypeLabelsSourceKey.current !== runSourceKey) {
        setPoolArchetypeLabels(null);
        archetypeLabelsSourceKey.current = null;
      }
      return;
    }
    // Skip if labels were already loaded from cache (or computed) for this exact run.
    if (archetypeLabelsSourceKey.current === runSourceKey) return;
    let cancelled = false;
    (async () => {
      const archetypeData = await loadArchetypeData();
      if (cancelled || !archetypeData) return;
      const labels = assignArchetypeLabels(poolEmbeddings, archetypeData);
      if (!cancelled) {
        setPoolArchetypeLabels(labels);
        archetypeLabelsSourceKey.current = runSourceKey;
        if (selectedTs) {
          void patchClusteringCache(cubeId, selectedTs, { poolArchetypeLabels: [...labels.entries()] });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [poolEmbeddings, runSourceKey, selectedTs, cubeId]);

  useEffect(() => {
    if (!displayRunData || displayRunData.slimPools.length === 0) {
      setSkeletons([]);
      setUmapCoords([]);
      setClusteringInProgress(false);
      return;
    }

    if (hydratedClusterSourceKey.current === clusteringSourceKey) {
      setClusteringInProgress(false);
      return;
    }

    if (poolEmbeddings === null && !poolEmbeddingsFailed) {
      setClusteringInProgress(true);
      return;
    }

    setClusteringInProgress(true);
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let idleId: number | null = null;
    const runClustering = () => {
      const result = computeSkeletons(
        displayRunData.slimPools,
        displayRunData.cardMeta,
        poolEmbeddings,
        activeDecks,
        knnK,
        CLUSTER_NEG_SAMPLES,
        resolution,
      );
      setSkeletons(result.skeletons);
      setUmapCoords(result.umapCoords);
      hydratedClusterSourceKey.current = null;
      setClusteringInProgress(false);
      if (selectedTs) {
        void patchClusteringCache(cubeId, selectedTs, {
          skeletons: result.skeletons,
          umapCoords: result.umapCoords,
          clusterMethod: result.clusterMethod,
          knnK,
          resolution,
          scoringVersion: SCORING_ALGORITHM_VERSION,
        });
      }
    };

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      idleId = window.requestIdleCallback(runClustering, { timeout: 500 });
    } else {
      timeoutId = setTimeout(runClustering, 20);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (idleId !== null && typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleId);
      }
    };
  }, [
    displayRunData,
    knnK,
    clusteringSourceKey,
    activeDecks,
    poolEmbeddings,
    poolEmbeddingsFailed,
    resolution,
    selectedTs,
    cubeId,
  ]);

  const applyPendingClusteringSettings = useCallback(() => {
    setKnnK(pendingKnnK);
    setResolution(pendingResolution);
    setClusterSeed((seed) => seed + 1);
  }, [pendingKnnK, pendingResolution]);

  return {
    pendingKnnK,
    setPendingKnnK,
    pendingResolution,
    setPendingResolution,
    skeletons,
    umapCoords,
    clusteringInProgress,
    clusteringPhase,
    poolArchetypeLabels,
    poolArchetypeLabelsLoading,
    oovWarningPct,
    applyPendingClusteringSettings,
  };
}
