import { useMemo } from 'react';

import type {
  ArchetypeSkeleton,
  BuiltDeck,
  CardStats,
  LockPair,
  SimulatedPool,
  SimulationRunData,
  SimulationSetupResponse,
  SkeletonCard,
} from '@utils/datatypes/SimulationReport';

interface UseDraftSimulatorSelectionArgs {
  displayRunData: SimulationRunData | null;
  currentRunSetup: Pick<SimulationSetupResponse, 'initialPacks' | 'packSteps' | 'numSeats'> | null;
  displayedPools: SimulatedPool[];
  activeDecks: BuiltDeck[] | null;
  selectedCardOracles: string[];
  selectedSkeletonId: number | null;
  selectedArchetype: string | null;
  skeletons: ArchetypeSkeleton[];
  filteredCardStatsCache: { current: Map<string, CardStats[]> };
  computeFilteredCardStats: (
    setup: Pick<SimulationSetupResponse, 'initialPacks' | 'packSteps' | 'numSeats'>,
    runData: SimulationRunData,
    poolIndexSet: Set<number>,
  ) => CardStats[];
  buildActiveFilterPreview: (args: {
    displayRunData: SimulationRunData;
    activeFilterPoolIndexSet: Set<number>;
    scopedPools: SimulatedPool[];
    activeDecks: BuiltDeck[] | null;
    displayedPools: SimulatedPool[];
    selectedCards: CardStats[];
  }) => {
    commonCards: SkeletonCard[];
    supportCards: SkeletonCard[];
    sideboardCards: SkeletonCard[];
    lockPairs: LockPair[];
  } | null;
  bottomTab: 'archetypes' | 'deckColor' | 'cardStats' | 'draftBreakdown' | 'overperformers' | 'sideboardAndPairings';
  pairingsExcludeLands: boolean;
}

export default function useDraftSimulatorSelection({
  displayRunData,
  currentRunSetup,
  displayedPools,
  activeDecks,
  selectedCardOracles,
  selectedSkeletonId,
  selectedArchetype,
  skeletons,
  filteredCardStatsCache,
  computeFilteredCardStats,
  buildActiveFilterPreview,
  bottomTab,
  pairingsExcludeLands,
}: UseDraftSimulatorSelectionArgs) {
  const selectedCards = useMemo(
    () =>
      displayRunData
        ? selectedCardOracles
            .map((oracle) => displayRunData.cardStats.find((c) => c.oracle_id === oracle) ?? null)
            .filter((c): c is CardStats => !!c)
        : [],
    [displayRunData, selectedCardOracles],
  );

  const activeFilterPoolIndexSet = useMemo(() => {
    const filterSets: Set<number>[] = [];

    if (selectedSkeletonId !== null) {
      const skeleton = skeletons.find((s) => s.clusterId === selectedSkeletonId);
      if (skeleton) filterSets.push(new Set<number>(skeleton.poolIndices));
    }

    if (selectedArchetype) {
      const colorSet = new Set<number>();
      for (const pool of displayedPools) {
        if (pool.archetype === selectedArchetype) colorSet.add(pool.poolIndex);
      }
      filterSets.push(colorSet);
    }

    for (const selectedCardEntry of selectedCards) {
      filterSets.push(new Set<number>(selectedCardEntry.poolIndices));
    }

    if (filterSets.length === 0) return null;

    const [first, ...rest] = filterSets;
    const intersection = new Set<number>(first);
    for (const value of [...intersection]) {
      if (!rest.every((set) => set.has(value))) intersection.delete(value);
    }
    return intersection;
  }, [selectedArchetype, selectedSkeletonId, selectedCards, skeletons, displayedPools]);

  const filteredDecks = useMemo(() => {
    if (!activeDecks) return null;
    if (!activeFilterPoolIndexSet) return activeDecks;
    return activeDecks.filter((_, idx) => activeFilterPoolIndexSet.has(idx));
  }, [activeDecks, activeFilterPoolIndexSet]);

  const visibleCardStats = useMemo(() => {
    if (!displayRunData) return [];
    if (!activeFilterPoolIndexSet) return displayRunData.cardStats;
    if (currentRunSetup) {
      const cacheKey = [...activeFilterPoolIndexSet].sort((a, b) => a - b).join(',');
      const cached = filteredCardStatsCache.current.get(cacheKey);
      if (cached) return cached;
      const result = computeFilteredCardStats(currentRunSetup, displayRunData, activeFilterPoolIndexSet);
      filteredCardStatsCache.current.set(cacheKey, result);
      return result;
    }
    return displayRunData.cardStats.filter((c) => c.poolIndices.some((i) => activeFilterPoolIndexSet.has(i)));
  }, [displayRunData, activeFilterPoolIndexSet, currentRunSetup, filteredCardStatsCache, computeFilteredCardStats]);

  const selectedCard = selectedCards.length === 1 ? (selectedCards[0] ?? null) : null;
  const selectedCardStats = useMemo(
    () => (selectedCard ? (visibleCardStats.find((c) => c.oracle_id === selectedCard.oracle_id) ?? selectedCard) : null),
    [visibleCardStats, selectedCard],
  );

  const visiblePoolCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const cardStat of visibleCardStats) counts.set(cardStat.oracle_id, cardStat.poolIndices.length);
    return counts;
  }, [visibleCardStats]);

  const scopedPools = useMemo(
    () => displayedPools.filter((p) => !activeFilterPoolIndexSet || activeFilterPoolIndexSet.has(p.poolIndex)),
    [displayedPools, activeFilterPoolIndexSet],
  );

  const activeFilterPreview = useMemo(() => {
    if (!displayRunData || !activeFilterPoolIndexSet) return null;
    return buildActiveFilterPreview({
      displayRunData,
      activeFilterPoolIndexSet,
      scopedPools,
      activeDecks,
      displayedPools,
      selectedCards,
    });
  }, [displayRunData, activeFilterPoolIndexSet, scopedPools, activeDecks, displayedPools, selectedCards, buildActiveFilterPreview]);

  const topSideboardCards = useMemo(() => {
    if (bottomTab !== 'sideboardAndPairings') return [];
    if (!filteredDecks || filteredDecks.length === 0) return [];
    const counts = new Map<string, number>();
    const total = filteredDecks.length;
    for (const deck of filteredDecks) {
      for (const oracleId of new Set(deck.sideboard)) {
        counts.set(oracleId, (counts.get(oracleId) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .map(([oracle_id, count]) => ({ oracle_id, count, pct: count / total }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 50);
  }, [bottomTab, filteredDecks]);

  const topCardPairings = useMemo(() => {
    if (bottomTab !== 'sideboardAndPairings') return [];
    if (!filteredDecks || filteredDecks.length === 0) return [];
    const pairCounts = new Map<string, number>();
    const cardCounts = new Map<string, number>();
    const isBasicLand = (oracleId: string) => /\bBasic\b/.test(displayRunData?.cardMeta[oracleId]?.type ?? '');
    const isLand = (oracleId: string) => /\bLand\b/.test(displayRunData?.cardMeta[oracleId]?.type ?? '');
    for (const deck of filteredDecks) {
      const mb = [...new Set(deck.mainboard)].filter((o) => !isBasicLand(o) && (!pairingsExcludeLands || !isLand(o))).sort();
      for (const o of mb) cardCounts.set(o, (cardCounts.get(o) ?? 0) + 1);
      for (let i = 0; i < mb.length; i++) {
        for (let j = i + 1; j < mb.length; j++) {
          const [a, b] = mb[i]! < mb[j]! ? [mb[i]!, mb[j]!] : [mb[j]!, mb[i]!];
          const key = `${a}\x00${b}`;
          pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
        }
      }
    }
    const total = filteredDecks.length;
    return [...pairCounts.entries()]
      .map(([key, count]) => {
        const [oracle_id_a, oracle_id_b] = key.split('\x00');
        const minCardCount = Math.min(cardCounts.get(oracle_id_a!) ?? 1, cardCounts.get(oracle_id_b!) ?? 1);
        return { oracle_id_a, oracle_id_b, count, pct: count / minCardCount, rawPct: count / total };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 50);
  }, [bottomTab, filteredDecks, pairingsExcludeLands, displayRunData]);

  return {
    selectedCards,
    selectedCard,
    activeFilterPoolIndexSet,
    filteredDecks,
    visibleCardStats,
    selectedCardStats,
    visiblePoolCounts,
    scopedPools,
    activeFilterPreview,
    topSideboardCards,
    topCardPairings,
  };
}
