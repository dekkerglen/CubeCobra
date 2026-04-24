import { useCallback, useEffect, useRef, useState } from 'react';

import type { ArchetypeSkeleton, BuiltDeck, SimulationRunData } from '@utils/datatypes/SimulationReport';

import {
  buildOracleRemapping,
  countOutOfVocabOracles,
  encodePools,
  loadDraftBot,
  reshapeEmbeddings,
} from '../utils/draftBot';
import { computeSkeletons } from '../utils/draftSimulatorClustering';
import { type ClusteringCache, patchClusteringCache } from '../utils/draftSimulatorLocalStorage';

type EmbeddingCacheValue = number[][] | Record<string, number[]> | null;

const KNN_K_DIVISOR = 16;
const LEIDEN_RES_DIVISOR = 400;

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
  const [minClusterSize, setMinClusterSize] = useState(3);
  const [pendingMinClusterSize, setPendingMinClusterSize] = useState(3);
  const [pcaDims, setPcaDims] = useState(20);
  const [pendingPcaDims, setPendingPcaDims] = useState(20);
  const [minPts, setMinPts] = useState(3);
  const [pendingMinPts, setPendingMinPts] = useState(3);
  const [knnK, setKnnK] = useState(50);
  const [pendingKnnK, setPendingKnnK] = useState(50);
  const [negSamples, setNegSamples] = useState(20);
  const [pendingNegSamples, setPendingNegSamples] = useState(20);
  const [clusterMode, setClusterMode] = useState<'umap' | 'graph' | 'leiden' | 'nmf'>('leiden');
  const [clusterSeed, setClusterSeed] = useState(0);
  const [resolution, setResolution] = useState(1.0);
  const [pendingResolution, setPendingResolution] = useState(1.0);
  const [numTopics, setNumTopics] = useState(0);
  const [pendingNumTopics, setPendingNumTopics] = useState(0);
  const [distanceMetric, setDistanceMetric] = useState<'euclidean' | 'cosine'>('cosine');
  const [useHybridEmbeddings, setUseHybridEmbeddings] = useState(false);
  const [hybridWeight, setHybridWeight] = useState(5.0);
  const [pendingHybridWeight, setPendingHybridWeight] = useState(5.0);

  const [skeletons, setSkeletons] = useState<ArchetypeSkeleton[]>([]);
  const [umapCoords, setUmapCoords] = useState<{ x: number; y: number }[]>([]);
  const [clusterMethod, setClusterMethod] = useState<string>('hdbscan (umap)');
  const [clusteringInProgress, setClusteringInProgress] = useState(false);
  const [poolEmbeddings, setPoolEmbeddings] = useState<number[][] | null>(null);
  const [poolArchetypeLabels, setPoolArchetypeLabels] = useState<Map<number, string> | null>(null);
  const [poolEmbeddingsFailed, setPoolEmbeddingsFailed] = useState(false);
  const [oovWarningPct, setOovWarningPct] = useState<number | null>(null);

  const hydratedClusterSourceKey = useRef<string | null>(null);
  const archetypeDataRef = useRef<{ centers: { clusterId: number; center: number[] }[]; annotations: Record<string, string> } | null>(null);

  const poolArchetypeLabelsLoading = displayRunData !== null && poolArchetypeLabels === null && !poolEmbeddingsFailed;
  const hasDecksForSource = !!(displayRunData && activeDecks && activeDecks.length === displayRunData.slimPools.length);
  const clusteringSourceKey = [
    selectedTs ?? 'unsaved',
    displayRunData?.generatedAt ?? 'none',
    displayRunData?.slimPools.length ?? 0,
    hasDecksForSource ? 'decks' : 'picks',
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
      setClusterMethod(loadedClusterCache.clusterMethod);
      setKnnK(loadedClusterCache.knnK);
      setPendingKnnK(loadedClusterCache.knnK);
      setResolution(loadedClusterCache.resolution);
      setPendingResolution(loadedClusterCache.resolution);
      setPoolArchetypeLabels(
        loadedClusterCache.poolArchetypeLabels ? new Map(loadedClusterCache.poolArchetypeLabels) : null,
      );
      return;
    }
    hydratedClusterSourceKey.current = null;
    setSkeletons([]);
    setUmapCoords([]);
    setClusterMethod('hdbscan (umap)');
    setPoolArchetypeLabels(null);
  }, [loadedClusterCache, clusteringSourceKey]);

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
      setPoolArchetypeLabels(null);
      return;
    }
    let cancelled = false;
    (async () => {
      if (!archetypeDataRef.current) {
        try {
          const resp = await fetch('/api/archetypes');
          if (!resp.ok) return;
          archetypeDataRef.current = await resp.json();
        } catch {
          return;
        }
      }
      if (cancelled || !archetypeDataRef.current) return;
      const { centers, annotations } = archetypeDataRef.current;

      const labels = new Map<number, string>();
      for (let pi = 0; pi < poolEmbeddings.length; pi++) {
        const emb = poolEmbeddings[pi]!;
        const embNorm = Math.sqrt(emb.reduce((s, v) => s + v * v, 0)) || 1;
        let bestSim = -Infinity;
        let bestClusterId = -1;
        for (const { clusterId, center } of centers) {
          let dot = 0;
          const cNorm = Math.sqrt(center.reduce((s, v) => s + v * v, 0)) || 1;
          for (let d = 0; d < emb.length; d++) dot += emb[d]! * (center[d] ?? 0);
          const sim = dot / (embNorm * cNorm);
          if (sim > bestSim) {
            bestSim = sim;
            bestClusterId = clusterId;
          }
        }
        const label = annotations[String(bestClusterId)];
        if (label) labels.set(pi, label);
      }
      if (!cancelled) {
        setPoolArchetypeLabels(labels);
        if (selectedTs) {
          void patchClusteringCache(cubeId, selectedTs, { poolArchetypeLabels: [...labels.entries()] });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [poolEmbeddings, selectedTs, cubeId]);

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
    const timer = setTimeout(() => {
      const result = computeSkeletons(
        displayRunData.slimPools,
        displayRunData.cardMeta,
        minClusterSize,
        poolEmbeddings,
        activeDecks,
        pcaDims,
        minPts,
        clusterMode,
        knnK,
        negSamples,
        resolution,
        numTopics,
        distanceMetric,
        useHybridEmbeddings,
        hybridWeight,
      );
      setSkeletons(result.skeletons);
      setUmapCoords(result.umapCoords);
      setClusterMethod(result.clusterMethod);
      hydratedClusterSourceKey.current = null;
      setClusteringInProgress(false);
      if (selectedTs) {
        void patchClusteringCache(cubeId, selectedTs, {
          skeletons: result.skeletons,
          umapCoords: result.umapCoords,
          clusterMethod: result.clusterMethod,
          knnK,
          resolution,
        });
      }
    }, 20);

    return () => clearTimeout(timer);
  }, [
    displayRunData,
    minClusterSize,
    pcaDims,
    minPts,
    clusterMode,
    knnK,
    negSamples,
    clusteringSourceKey,
    activeDecks,
    poolEmbeddings,
    poolEmbeddingsFailed,
    resolution,
    numTopics,
    distanceMetric,
    useHybridEmbeddings,
    hybridWeight,
    selectedTs,
    cubeId,
  ]);

  const queueRecluster = useCallback(() => {
    setClusterSeed((seed) => seed + 1);
  }, []);

  const applyPendingClusteringSettings = useCallback(() => {
    setKnnK(pendingKnnK);
    setPcaDims(pendingPcaDims);
    setNegSamples(pendingNegSamples);
    setMinClusterSize(pendingMinClusterSize);
    setMinPts(pendingMinPts);
    setResolution(pendingResolution);
    setNumTopics(pendingNumTopics);
    setHybridWeight(pendingHybridWeight);
    setClusterSeed((seed) => seed + 1);
  }, [
    pendingKnnK,
    pendingPcaDims,
    pendingNegSamples,
    pendingMinClusterSize,
    pendingMinPts,
    pendingResolution,
    pendingNumTopics,
    pendingHybridWeight,
  ]);

  return {
    pendingMinClusterSize,
    setPendingMinClusterSize,
    pendingPcaDims,
    setPendingPcaDims,
    pendingMinPts,
    setPendingMinPts,
    pendingKnnK,
    setPendingKnnK,
    pendingNegSamples,
    setPendingNegSamples,
    clusterMode,
    setClusterMode,
    pendingResolution,
    setPendingResolution,
    pendingNumTopics,
    setPendingNumTopics,
    distanceMetric,
    setDistanceMetric,
    useHybridEmbeddings,
    setUseHybridEmbeddings,
    pendingHybridWeight,
    setPendingHybridWeight,
    skeletons,
    umapCoords,
    clusterMethod,
    clusteringInProgress,
    poolArchetypeLabels,
    poolArchetypeLabelsLoading,
    oovWarningPct,
    queueRecluster,
    applyPendingClusteringSettings,
  };
}
