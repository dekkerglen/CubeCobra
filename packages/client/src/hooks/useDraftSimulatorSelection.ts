/* eslint-disable */
import { useMemo } from 'react';

import type {
  BuiltDeck,
  CardStats,
  LockPair,
  SimulatedPool,
  SimulationRunData,
  SkeletonCard,
} from '@utils/datatypes/SimulationReport';

import { getColorPathAnchorPicks } from '../utils/draftSimulatorColorPath';
import type {
  DraftSimulatorBottomTab,
  DraftSimulatorDerivedData,
  DraftSimulatorFilterPreview,
  DraftSimulatorSelectionState,
} from './draftSimulatorHookTypes';

const LOCK_CANDIDATE_LIMIT = 12;

function intersectPoolSets(sets: Set<number>[]): Set<number> | null {
  if (sets.length === 0) return null;
  const [first, ...rest] = sets;
  const intersection = new Set<number>(first);
  for (const value of [...intersection]) {
    if (!rest.every((set) => set.has(value))) intersection.delete(value);
  }
  return intersection;
}

function buildActiveFilterPreview({
  displayRunData: runData,
  activeFilterPoolIndexSet,
  scopedPools,
  activeDecks: scopedDecks,
  displayedPools: scopedDisplayedPools,
  selectedCards,
}: {
  displayRunData: SimulationRunData;
  activeFilterPoolIndexSet: Set<number>;
  scopedPools: SimulatedPool[];
  activeDecks: BuiltDeck[] | null;
  displayedPools: SimulatedPool[];
  selectedCards: CardStats[];
}): DraftSimulatorFilterPreview | null {
  const isBasicLand = (oracleId: string) =>
    (runData.cardMeta[oracleId]?.type ?? '').toLowerCase().includes('basic land');

  const matchingPoolIndices = scopedPools.map((pool) => pool.poolIndex);
  if (matchingPoolIndices.length === 0) return null;

  const selectedFilterOracleIds = new Set(selectedCards.map((card) => card.oracle_id));
  const poolCounts = new Map<string, number>();
  const sideboardOnlyCounts = new Map<string, number>();
  const poolOracleSets = new Map<number, Set<string>>();
  const hasDeckData = !!scopedDecks && scopedDecks.length === scopedDisplayedPools.length;

  for (const poolIndex of matchingPoolIndices) {
    const pool = scopedDisplayedPools[poolIndex];
    if (!pool) continue;
    // Use mainboard counts when deck builds are available so this matches the
    // algorithm used for skeleton.coreCards (`scoreClusterSkeleton`). Falling
    // back to raw picks only when builds are absent.
    const sourceOracles = hasDeckData
      ? (scopedDecks![poolIndex]?.mainboard ?? [])
      : pool.picks.map((pick) => pick.oracle_id);
    const poolOracleSet = new Set(
      sourceOracles.filter((oracleId) => oracleId && !isBasicLand(oracleId) && !selectedFilterOracleIds.has(oracleId)),
    );
    poolOracleSets.set(poolIndex, poolOracleSet);
    for (const oracleId of poolOracleSet) {
      poolCounts.set(oracleId, (poolCounts.get(oracleId) ?? 0) + 1);
    }

    if (hasDeckData) {
      const deck = scopedDecks?.[poolIndex];
      if (!deck) continue;
      for (const oracleId of new Set(deck.sideboard)) {
        if (!oracleId || isBasicLand(oracleId) || selectedFilterOracleIds.has(oracleId)) continue;
        if (!deck.mainboard.includes(oracleId)) {
          sideboardOnlyCounts.set(oracleId, (sideboardOnlyCounts.get(oracleId) ?? 0) + 1);
        }
      }
    }
  }

  const toSkeletonCard = ([oracleId, count]: [string, number]): SkeletonCard => ({
    oracle_id: oracleId,
    name: runData.cardMeta[oracleId]?.name || oracleId,
    imageUrl: runData.cardMeta[oracleId]?.imageUrl ?? '',
    fraction: count / matchingPoolIndices.length,
  });

  const sortedCommon = [...poolCounts.entries()].map(toSkeletonCard).sort((a, b) => b.fraction - a.fraction);
  const commonCards = {
    default: sortedCommon.slice(0, 12),
    excludingFixing: sortedCommon.filter((c) => !runData.cardMeta[c.oracle_id]?.isManaFixingLand).slice(0, 12),
  };

  const lockCandidates = [...poolCounts.entries()]
    .map(toSkeletonCard)
    .sort((a, b) => b.fraction - a.fraction)
    .slice(0, LOCK_CANDIDATE_LIMIT);
  const lockPairs: LockPair[] = [];
  for (let ai = 0; ai < lockCandidates.length; ai++) {
    for (let bi = ai + 1; bi < lockCandidates.length; bi++) {
      const a = lockCandidates[ai]!;
      const b = lockCandidates[bi]!;
      let both = 0;
      for (const poolIndex of matchingPoolIndices) {
        const picks = poolOracleSets.get(poolIndex);
        if (picks?.has(a.oracle_id) && picks.has(b.oracle_id)) both++;
      }
      lockPairs.push({
        oracle_id_a: a.oracle_id,
        oracle_id_b: b.oracle_id,
        nameA: a.name,
        nameB: b.name,
        imageUrlA: a.imageUrl,
        imageUrlB: b.imageUrl,
        coOccurrenceRate: both / matchingPoolIndices.length,
      });
    }
  }
  lockPairs.sort((a, b) => b.coOccurrenceRate - a.coOccurrenceRate);

  const sideboardCards = [...sideboardOnlyCounts.entries()]
    .map(toSkeletonCard)
    .filter((card) => card.fraction >= 0.15)
    .sort((a, b) => b.fraction - a.fraction)
    .slice(0, 5);

  return { commonCards, supportCards: [], sideboardCards, lockPairs: lockPairs.slice(0, 5) };
}

interface UseDraftSimulatorSelectionArgs {
  data: DraftSimulatorDerivedData;
  state: Pick<
    DraftSimulatorSelectionState,
    | 'selectedCardOracles'
    | 'selectedDeckCardOracles'
    | 'selectedSideboardCardOracles'
    | 'selectedP1P1CardOracles'
    | 'selectedFirstColorPickOracles'
    | 'selectedSecondColorPickOracles'
    | 'selectedSkeletonId'
    | 'selectedArchetype'
  >;
  filteredCardStatsCache: { current: Map<string, CardStats[]> };
  computeFilteredCardStats: (
    setup: NonNullable<DraftSimulatorDerivedData['currentRunSetup']>,
    runData: SimulationRunData,
    poolIndexSet: Set<number>,
  ) => CardStats[];
  bottomTab: DraftSimulatorBottomTab;
  pairingsExcludeLands: boolean;
}

export default function useDraftSimulatorSelection({
  data: { displayRunData, currentRunSetup, displayedPools, activeDecks, skeletons },
  state: {
    selectedCardOracles,
    selectedDeckCardOracles,
    selectedSideboardCardOracles,
    selectedP1P1CardOracles,
    selectedFirstColorPickOracles,
    selectedSecondColorPickOracles,
    selectedSkeletonId,
    selectedArchetype,
  },
  filteredCardStatsCache,
  computeFilteredCardStats,
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

  const selectedDeckCards = useMemo(
    () =>
      displayRunData
        ? selectedDeckCardOracles
            .map((oracle) => displayRunData.cardStats.find((c) => c.oracle_id === oracle) ?? null)
            .filter((c): c is CardStats => !!c)
        : [],
    [displayRunData, selectedDeckCardOracles],
  );

  const selectedSideboardCards = useMemo(
    () =>
      displayRunData
        ? selectedSideboardCardOracles
            .map((oracle) => displayRunData.cardStats.find((c) => c.oracle_id === oracle) ?? null)
            .filter((c): c is CardStats => !!c)
        : [],
    [displayRunData, selectedSideboardCardOracles],
  );

  const selectedP1P1Cards = useMemo(
    () =>
      displayRunData
        ? selectedP1P1CardOracles
            .map((oracle) => displayRunData.cardStats.find((c) => c.oracle_id === oracle) ?? null)
            .filter((c): c is CardStats => !!c)
        : [],
    [displayRunData, selectedP1P1CardOracles],
  );

  const selectedFirstColorPickCards = useMemo(
    () =>
      displayRunData
        ? selectedFirstColorPickOracles
            .map((oracle) => displayRunData.cardStats.find((c) => c.oracle_id === oracle) ?? null)
            .filter((c): c is CardStats => !!c)
        : [],
    [displayRunData, selectedFirstColorPickOracles],
  );

  const selectedSecondColorPickCards = useMemo(
    () =>
      displayRunData
        ? selectedSecondColorPickOracles
            .map((oracle) => displayRunData.cardStats.find((c) => c.oracle_id === oracle) ?? null)
            .filter((c): c is CardStats => !!c)
        : [],
    [displayRunData, selectedSecondColorPickOracles],
  );

  // oracle_id → pool indices where that card was taken p1p1 (pack 0, pick 1)
  const p1p1CardPoolIndices = useMemo<Map<string, number[]>>(() => {
    if (!displayRunData) return new Map();
    const map = new Map<string, number[]>();
    for (let i = 0; i < displayRunData.slimPools.length; i++) {
      const p1p1Pick = displayRunData.slimPools[i]!.picks.find(
        (p) => p.packNumber === 0 && p.pickNumber === 1,
      );
      if (p1p1Pick) {
        const entry = map.get(p1p1Pick.oracle_id);
        if (entry) entry.push(i);
        else map.set(p1p1Pick.oracle_id, [i]);
      }
    }
    return map;
  }, [displayRunData]);


  // oracle_id → pool indices where that card is in the mainboard
  const deckCardPoolIndices = useMemo<Map<string, number[]>>(() => {
    if (!activeDecks) return new Map();
    const map = new Map<string, number[]>();
    for (let i = 0; i < activeDecks.length; i++) {
      for (const oracleId of activeDecks[i]!.mainboard) {
        const entry = map.get(oracleId);
        if (entry) entry.push(i);
        else map.set(oracleId, [i]);
      }
    }
    return map;
  }, [activeDecks]);

  // oracle_id → pool indices where that card is in the sideboard
  const sideboardCardPoolIndices = useMemo<Map<string, number[]>>(() => {
    if (!activeDecks) return new Map();
    const map = new Map<string, number[]>();
    for (let i = 0; i < activeDecks.length; i++) {
      for (const oracleId of new Set(activeDecks[i]!.sideboard)) {
        const entry = map.get(oracleId);
        if (entry) entry.push(i);
        else map.set(oracleId, [i]);
      }
    }
    return map;
  }, [activeDecks]);

  // poolIndex → oracle IDs of the picks that established the deck's first and second final colors
  const poolColorAnchors = useMemo<Map<number, { first: string | null; second: string | null }>>(() => {
    const map = new Map<number, { first: string | null; second: string | null }>();
    if (!displayRunData) return map;
    for (const pool of displayedPools) {
      const deck = activeDecks?.[pool.poolIndex] ?? null;
      const { firstColorAnchorPick, secondColorBridgePick } = getColorPathAnchorPicks(pool, deck, displayRunData.cardMeta);
      map.set(pool.poolIndex, {
        first: firstColorAnchorPick?.oracle_id ?? null,
        second: secondColorBridgePick?.oracle_id ?? null,
      });
    }
    return map;
  }, [displayRunData, displayedPools, activeDecks]);

  const firstColorPickPoolIndices = useMemo<Map<string, number[]>>(() => {
    const map = new Map<string, number[]>();
    for (const [poolIndex, anchors] of poolColorAnchors) {
      if (!anchors.first) continue;
      const entry = map.get(anchors.first);
      if (entry) entry.push(poolIndex);
      else map.set(anchors.first, [poolIndex]);
    }
    return map;
  }, [poolColorAnchors]);

  const secondColorPickPoolIndices = useMemo<Map<string, number[]>>(() => {
    const map = new Map<string, number[]>();
    for (const [poolIndex, anchors] of poolColorAnchors) {
      if (!anchors.second) continue;
      const entry = map.get(anchors.second);
      if (entry) entry.push(poolIndex);
      else map.set(anchors.second, [poolIndex]);
    }
    return map;
  }, [poolColorAnchors]);

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

    for (const oracleId of selectedDeckCardOracles) {
      const poolIndices = deckCardPoolIndices.get(oracleId);
      if (poolIndices) filterSets.push(new Set<number>(poolIndices));
    }

    for (const oracleId of selectedSideboardCardOracles) {
      const poolIndices = sideboardCardPoolIndices.get(oracleId);
      if (poolIndices) filterSets.push(new Set<number>(poolIndices));
    }

    for (const card of selectedP1P1Cards) {
      const indices = p1p1CardPoolIndices.get(card.oracle_id);
      if (indices) filterSets.push(new Set<number>(indices));
    }

    for (const oracleId of selectedFirstColorPickOracles) {
      const indices = firstColorPickPoolIndices.get(oracleId);
      if (indices) filterSets.push(new Set<number>(indices));
    }

    for (const oracleId of selectedSecondColorPickOracles) {
      const indices = secondColorPickPoolIndices.get(oracleId);
      if (indices) filterSets.push(new Set<number>(indices));
    }

    return intersectPoolSets(filterSets);
  }, [
    selectedArchetype,
    selectedSkeletonId,
    selectedCards,
    selectedDeckCardOracles,
    selectedSideboardCardOracles,
    selectedP1P1Cards,
    selectedFirstColorPickOracles,
    selectedSecondColorPickOracles,
    deckCardPoolIndices,
    sideboardCardPoolIndices,
    p1p1CardPoolIndices,
    firstColorPickPoolIndices,
    secondColorPickPoolIndices,
    skeletons,
    displayedPools,
  ]);

  // oracle_id → number of pools where the card established the deck's first / second color
  const firstColorPickCounts = useMemo<Map<string, number>>(
    () => new Map([...firstColorPickPoolIndices].map(([oracle, indices]) => [oracle, indices.length])),
    [firstColorPickPoolIndices],
  );
  const secondColorPickCounts = useMemo<Map<string, number>>(
    () => new Map([...secondColorPickPoolIndices].map(([oracle, indices]) => [oracle, indices.length])),
    [secondColorPickPoolIndices],
  );

  const filteredDecks = useMemo(() => {
    if (!activeDecks) return null;
    if (!activeFilterPoolIndexSet) return activeDecks;
    return activeDecks.filter((_, idx) => activeFilterPoolIndexSet.has(idx));
  }, [activeDecks, activeFilterPoolIndexSet]);

  const deckInclusionPct = useMemo<Map<string, number>>(() => {
    if (!filteredDecks || filteredDecks.length === 0) return new Map();
    const mainboardCounts = new Map<string, number>();
    const poolCounts = new Map<string, number>();
    for (const deck of filteredDecks) {
      for (const oracleId of deck.mainboard) {
        mainboardCounts.set(oracleId, (mainboardCounts.get(oracleId) ?? 0) + 1);
        poolCounts.set(oracleId, (poolCounts.get(oracleId) ?? 0) + 1);
      }
      for (const oracleId of deck.sideboard) {
        poolCounts.set(oracleId, (poolCounts.get(oracleId) ?? 0) + 1);
      }
    }
    const result = new Map<string, number>();
    for (const [oracleId, inDeck] of mainboardCounts) {
      const inPool = poolCounts.get(oracleId) ?? inDeck;
      result.set(oracleId, inDeck / inPool);
    }
    return result;
  }, [filteredDecks]);

  const inDeckOracles = useMemo<Set<string> | null>(
    () => (filteredDecks ? new Set(deckInclusionPct.keys()) : null),
    [filteredDecks, deckInclusionPct],
  );

  const inSideboardOracles = useMemo<Set<string> | null>(() => {
    if (!filteredDecks) return null;
    const sideboardOracles = new Set<string>();
    for (const deck of filteredDecks) for (const oracleId of deck.sideboard) sideboardOracles.add(oracleId);
    return sideboardOracles;
  }, [filteredDecks]);

  const visibleCardStats = useMemo(() => {
    if (!displayRunData) return [];
    if (!activeFilterPoolIndexSet) return displayRunData.cardStats;
    if (currentRunSetup) {
      const cacheKey = [...activeFilterPoolIndexSet].sort((a, b) => a - b).join(',');
      const cached = filteredCardStatsCache.current.get(cacheKey);
      if (cached) return cached;
      const result = computeFilteredCardStats(currentRunSetup, displayRunData, activeFilterPoolIndexSet);
      if (filteredCardStatsCache.current.size >= 32) {
        filteredCardStatsCache.current.delete(filteredCardStatsCache.current.keys().next().value!);
      }
      filteredCardStatsCache.current.set(cacheKey, result);
      return result;
    }
    return displayRunData.cardStats.filter((c) => c.poolIndices.some((i) => activeFilterPoolIndexSet.has(i)));
  }, [displayRunData, activeFilterPoolIndexSet, currentRunSetup, filteredCardStatsCache, computeFilteredCardStats]);

  const selectedCard = selectedCards.length === 1 ? (selectedCards[0] ?? null) : null;
  const selectedCardStats = useMemo(
    () =>
      selectedCard ? (visibleCardStats.find((c) => c.oracle_id === selectedCard.oracle_id) ?? selectedCard) : null,
    [visibleCardStats, selectedCard],
  );

  const visiblePoolCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const cardStat of visibleCardStats) counts.set(cardStat.oracle_id, cardStat.poolIndices.length);
    return counts;
  }, [visibleCardStats]);

  // Deck counts scoped to the active filter — analogous to visiblePoolCounts but for mainboards
  const visibleDeckCounts = useMemo(() => {
    const counts = new Map<string, number>();
    if (!filteredDecks) return counts;
    for (const deck of filteredDecks) {
      for (const oracleId of deck.mainboard) {
        counts.set(oracleId, (counts.get(oracleId) ?? 0) + 1);
      }
    }
    return counts;
  }, [filteredDecks]);

  // Sideboard counts scoped to the active filter — analogous to visibleDeckCounts but for sideboards
  const visibleSideboardCounts = useMemo(() => {
    const counts = new Map<string, number>();
    if (!filteredDecks) return counts;
    for (const deck of filteredDecks) {
      for (const oracleId of new Set(deck.sideboard)) {
        counts.set(oracleId, (counts.get(oracleId) ?? 0) + 1);
      }
    }
    return counts;
  }, [filteredDecks]);

  const hasApproximateFilteredStats = !!(activeFilterPoolIndexSet && !currentRunSetup);

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
  }, [displayRunData, activeFilterPoolIndexSet, scopedPools, activeDecks, displayedPools, selectedCards]);

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
      const mb = [...new Set(deck.mainboard)]
        .filter((o) => !isBasicLand(o) && (!pairingsExcludeLands || !isLand(o)))
        .sort();
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
    selectedDeckCards,
    selectedSideboardCards,
    selectedP1P1Cards,
    selectedCard,
    selectedFirstColorPickCards,
    selectedSecondColorPickCards,
    firstColorPickCounts,
    secondColorPickCounts,
    activeFilterPoolIndexSet,
    filteredDecks,
    deckInclusionPct,
    deckCardPoolIndices,
    sideboardCardPoolIndices,
    visibleDeckCounts,
    visibleSideboardCounts,
    inDeckOracles,
    inSideboardOracles,
    visibleCardStats,
    selectedCardStats,
    visiblePoolCounts,
    hasApproximateFilteredStats,
    scopedPools,
    activeFilterPreview,
    topSideboardCards,
    topCardPairings,
  };
}
