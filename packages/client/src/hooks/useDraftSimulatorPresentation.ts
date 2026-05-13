import { useCallback, useMemo } from 'react';

import type {
  CardStats,
} from '@utils/datatypes/SimulationReport';

import { archetypeFullName } from '../utils/draftSimulatorThemes';
import type {
  DraftSimulatorDerivedData,
  DraftSimulatorSelectionSetters,
  DraftSimulatorSelectionState,
} from './draftSimulatorHookTypes';

interface FilterChipItem {
  key: string;
  label: string;
  detail?: string;
  onClear: () => void;
}

interface UseDraftSimulatorPresentationArgs {
  data: DraftSimulatorDerivedData;
  state: Pick<DraftSimulatorSelectionState, 'selectedSkeletonId' | 'selectedArchetype' | 'focusedPoolIndex'>;
  setters: DraftSimulatorSelectionSetters;
  selectedCards: CardStats[];
  selectedDeckCards: CardStats[];
  selectedCard: CardStats | null;
  activeFilterPoolIndexSet: Set<number> | null;
  selectedPools: DraftSimulatorDerivedData['displayedPools'];
  getSkeletonDisplayName: (skeleton: DraftSimulatorDerivedData['skeletons'][number], poolArchetypeLabels?: Map<number, string> | null, skeletonColorProfiles?: Map<number, string>) => string;
  buildDraftBreakdownRowSummary: (
    pool: DraftSimulatorDerivedData['displayedPools'][number],
    deck: NonNullable<DraftSimulatorDerivedData['activeDecks']>[number] | null,
    cardMeta: NonNullable<DraftSimulatorDerivedData['displayRunData']>['cardMeta'],
  ) => {
    themes: string[];
    creatureCount: number;
    nonCreatureCount: number;
    landCount: number;
    avgMv: number;
  };
}

export default function useDraftSimulatorPresentation({
  data: { displayRunData, activeDecks, displayedPools, skeletons, poolArchetypeLabels, skeletonColorProfiles },
  state: { selectedSkeletonId, selectedArchetype, focusedPoolIndex },
  setters: { setSelectedCardOracles, setSelectedDeckCardOracles, setSelectedArchetype, setSelectedSkeletonId, setFocusedPoolIndex },
  selectedCards,
  selectedDeckCards,
  selectedCard,
  activeFilterPoolIndexSet,
  selectedPools,
  getSkeletonDisplayName,
  buildDraftBreakdownRowSummary,
}: UseDraftSimulatorPresentationArgs) {
  const activeFilterChips = useMemo(() => {
    const chips: string[] = [];
    if (selectedSkeletonId !== null) {
      const sk = skeletons.find((s) => s.clusterId === selectedSkeletonId);
      if (sk) {
        const skIdx = skeletons.indexOf(sk);
        chips.push(`Cluster: ${skIdx + 1}`);
      }
    }
    if (selectedArchetype) chips.push(`Deck Color: ${archetypeFullName(selectedArchetype)}`);
    for (const c of selectedCards) chips.push(`In Pool: ${c.name}`);
    for (const c of selectedDeckCards) chips.push(`In Deck: ${c.name}`);
    return chips;
  }, [selectedSkeletonId, selectedArchetype, selectedCards, selectedDeckCards, skeletons]);

  const activeFilterSummary = useMemo(
    () => (activeFilterChips.length > 0 ? activeFilterChips.join(' · ') : null),
    [activeFilterChips],
  );

  const scopeOnlySummary = useMemo(() => {
    const nonCard = activeFilterChips.filter((c) => !c.startsWith('In Pool:') && !c.startsWith('In Deck:'));
    return nonCard.length > 0 ? nonCard.join(' · ') : null;
  }, [activeFilterChips]);

  const filterChipItems = useMemo(() => {
    const chips: FilterChipItem[] = [];
    for (const selectedCardEntry of selectedCards) {
      chips.push({
        key: `pool-${selectedCardEntry.oracle_id}`,
        label: selectedCardEntry.name,
        detail: 'In Pool',
        onClear: () =>
          setSelectedCardOracles((current) => current.filter((oracleId) => oracleId !== selectedCardEntry.oracle_id)),
      });
    }
    for (const selectedCardEntry of selectedDeckCards) {
      chips.push({
        key: `deck-${selectedCardEntry.oracle_id}`,
        label: selectedCardEntry.name,
        detail: 'In Deck',
        onClear: () =>
          setSelectedDeckCardOracles((current) => current.filter((oracleId) => oracleId !== selectedCardEntry.oracle_id)),
      });
    }
    if (selectedSkeletonId !== null) {
      const sk = skeletons.find((s) => s.clusterId === selectedSkeletonId);
      if (sk) {
        chips.push({
          key: `cluster-${sk.clusterId}`,
          label: getSkeletonDisplayName(sk, poolArchetypeLabels, skeletonColorProfiles),
          detail: 'Cluster',
          onClear: () => setSelectedSkeletonId(null),
        });
      }
    }
    if (selectedArchetype) {
      chips.push({
        key: `archetype-${selectedArchetype}`,
        label: archetypeFullName(selectedArchetype),
        detail: 'Color',
        onClear: () => setSelectedArchetype(null),
      });
    }
    if (focusedPoolIndex !== null) {
      const focusedPool = displayedPools.find((pool) => pool.poolIndex === focusedPoolIndex);
      if (focusedPool) {
        chips.push({
          key: `focus-${focusedPoolIndex}`,
          label: `Draft ${focusedPool.draftIndex + 1} · Seat ${focusedPool.seatIndex + 1}`,
          detail: 'Selected Deck',
          onClear: () => setFocusedPoolIndex(null),
        });
      }
    }
    return chips;
  }, [
    selectedCards,
    selectedDeckCards,
    selectedSkeletonId,
    selectedArchetype,
    focusedPoolIndex,
    displayedPools,
    skeletons,
    poolArchetypeLabels,
    skeletonColorProfiles,
    setSelectedArchetype,
    setSelectedCardOracles,
    setSelectedSkeletonId,
    setFocusedPoolIndex,
    getSkeletonDisplayName,
  ]);

  const selectedCardScopeLabel = useMemo(() => {
    if (selectedCards.length === 0) return null;
    const scopeParts: string[] = [];
    if (selectedSkeletonId !== null) {
      const sk = skeletons.find((s) => s.clusterId === selectedSkeletonId);
      if (sk) scopeParts.push(getSkeletonDisplayName(sk, poolArchetypeLabels, skeletonColorProfiles));
    }
    if (selectedArchetype) scopeParts.push(archetypeFullName(selectedArchetype));
    return scopeParts.length > 0 ? scopeParts.join(' · ') : null;
  }, [selectedCards.length, selectedSkeletonId, selectedArchetype, skeletons, poolArchetypeLabels, skeletonColorProfiles, getSkeletonDisplayName]);

  const detailedViewTitle = useMemo(() => {
    if (selectedCards.length === 1 && selectedCard)
      return `${selectedCard.name}${selectedCardScopeLabel ? ` in ${selectedCardScopeLabel}` : ''}`;
    if (selectedCards.length === 2)
      return `${selectedCards[0]!.name} + ${selectedCards[1]!.name}${selectedCardScopeLabel ? ` in ${selectedCardScopeLabel}` : ''}`;
    if (selectedCards.length > 2) return `${selectedCards.length} cards`;
    if (selectedSkeletonId !== null) {
      const sk = skeletons.find((s) => s.clusterId === selectedSkeletonId);
      return sk ? getSkeletonDisplayName(sk, poolArchetypeLabels, skeletonColorProfiles) : 'Detailed View';
    }
    if (selectedArchetype) return archetypeFullName(selectedArchetype);
    return 'No filter selected';
  }, [
    selectedCard,
    selectedCards,
    selectedCardScopeLabel,
    selectedSkeletonId,
    selectedArchetype,
    skeletons,
    poolArchetypeLabels,
    skeletonColorProfiles,
    getSkeletonDisplayName,
  ]);

  const detailedViewSubtitle = useMemo(() => {
    const matchingPools = activeFilterPoolIndexSet?.size ?? displayRunData?.slimPools.length ?? 0;
    if (selectedCards.length > 0) return `In ${selectedPools.length} draft pool${selectedPools.length !== 1 ? 's' : ''}`;
    if (selectedSkeletonId !== null || selectedArchetype)
      return `${matchingPools} matching draft pool${matchingPools !== 1 ? 's' : ''}`;
    return 'Select a color profile, archetype cluster, or card above to narrow the view.';
  }, [activeFilterPoolIndexSet, displayRunData, selectedCards.length, selectedPools.length, selectedSkeletonId, selectedArchetype]);

  const clearActiveFilter = useCallback(() => {
    setSelectedCardOracles([]);
    setSelectedDeckCardOracles([]);
    setSelectedArchetype(null);
    setSelectedSkeletonId(null);
    setFocusedPoolIndex(null);
  }, [setFocusedPoolIndex, setSelectedArchetype, setSelectedCardOracles, setSelectedDeckCardOracles, setSelectedSkeletonId]);

  const downloadDraftBreakdownCsv = useCallback((pools: DraftSimulatorDerivedData['displayedPools'], label: string) => {
    if (!displayRunData) return;
    const { cardMeta } = displayRunData;
    const hasDeckBuilds = !!activeDecks && activeDecks.length === displayRunData.slimPools.length;
    const header = ['Draft', 'Seat', 'Colors', 'Themes', 'Creatures', 'Noncreatures', 'Lands', 'Avg MV', 'Mainboard', 'Sideboard'];
    const rows = pools.map((pool) => {
      const deck = hasDeckBuilds ? (activeDecks![pool.poolIndex] ?? null) : null;
      const summary = buildDraftBreakdownRowSummary(pool, deck, cardMeta);
      const resolveName = (oracleId: string) => cardMeta[oracleId]?.name ?? oracleId;
      const mainboard = (deck?.mainboard ?? pool.picks.map((p: DraftSimulatorDerivedData['displayedPools'][number]['picks'][number]) => p.oracle_id)).map(resolveName).join(', ');
      const sideboard = (deck?.sideboard ?? []).map(resolveName).join(', ');
      return [
        pool.draftIndex + 1,
        pool.seatIndex + 1,
        archetypeFullName(pool.archetype),
        summary.themes.join(', '),
        summary.creatureCount,
        summary.nonCreatureCount,
        summary.landCount,
        summary.avgMv.toFixed(2),
        mainboard,
        sideboard,
      ];
    });
    const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${displayRunData.cubeName}-${displayRunData.numDrafts}drafts-breakdown-${label}.csv`.replace(/\s+/g, '-');
    a.click();
    URL.revokeObjectURL(url);
  }, [displayRunData, activeDecks, buildDraftBreakdownRowSummary]);

  const downloadCardStatsCsv = useCallback((stats: CardStats[], label: string) => {
    if (!displayRunData) return;
    const header = ['Name', 'Color Identity', 'Times Seen', 'Times Picked', 'Pick Rate', 'Avg Pick Position', 'Wheel Count', 'P1P1 Count', 'Elo'];
    const rows = stats.map((c) => [
      c.name,
      c.colorIdentity.join(''),
      c.timesSeen,
      c.timesPicked,
      c.pickRate.toFixed(3),
      c.avgPickPosition.toFixed(2),
      c.wheelCount,
      c.p1p1Count,
      c.elo,
    ]);
    const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${displayRunData.cubeName}-${displayRunData.numDrafts}drafts-${label}.csv`.replace(/\s+/g, '-');
    a.click();
    URL.revokeObjectURL(url);
  }, [displayRunData]);

  const cardStatsTitle = useMemo(() => {
    return 'Card Stats';
  }, []);

  const filteredPoolScopeSuffix = useMemo(() => {
    const scopeLabel = (() => {
      if (selectedSkeletonId !== null) {
        const sk = skeletons.find((s) => s.clusterId === selectedSkeletonId);
        return sk ? getSkeletonDisplayName(sk, poolArchetypeLabels, skeletonColorProfiles) : null;
      }
      if (selectedArchetype) return archetypeFullName(selectedArchetype);
      return null;
    })();

    const joinNames = (names: string[]) => {
      if (names.length === 0) return null;
      if (names.length === 1) return names[0]!;
      if (names.length === 2) return `${names[0]} and ${names[1]}`;
      return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
    };

    const poolNames = joinNames(selectedCards.map((c) => c.name));
    const deckNames = joinNames(selectedDeckCards.map((c) => c.name));

    if (!scopeLabel && !poolNames && !deckNames) return null;
    if (!poolNames && !deckNames) return `for ${scopeLabel ? `${scopeLabel} Draft Pools` : 'Draft Pools'}`;

    // When only deck filters are active use "Draft Decks", otherwise "Draft Pools"
    const poolsWord = poolNames ? 'Pools' : 'Decks';
    const base = scopeLabel ? `${scopeLabel} Draft ${poolsWord}` : `Draft ${poolsWord}`;

    const parts: string[] = [];
    if (poolNames) parts.push(`that include ${poolNames}`);
    if (deckNames) parts.push(`${poolNames ? 'Decks ' : ''}that include ${deckNames}`);
    return `for ${base} ${parts.join(' and ')}`;
  }, [
    selectedSkeletonId,
    selectedArchetype,
    selectedCards,
    selectedDeckCards,
    skeletons,
    poolArchetypeLabels,
    skeletonColorProfiles,
    getSkeletonDisplayName,
  ]);

  const scopedCardStatsTitle = useMemo(
    () => `${cardStatsTitle}${filteredPoolScopeSuffix ? ` ${filteredPoolScopeSuffix}` : ''}`,
    [cardStatsTitle, filteredPoolScopeSuffix],
  );
  const draftBreakdownTitle = useMemo(
    () => `Draft Breakdown${filteredPoolScopeSuffix ? ` ${filteredPoolScopeSuffix}` : ''}`,
    [filteredPoolScopeSuffix],
  );
  const sideboardTitle = useMemo(
    () => `Common Sideboard Cards${filteredPoolScopeSuffix ? ` ${filteredPoolScopeSuffix}` : ''}`,
    [filteredPoolScopeSuffix],
  );
  const pairingsTitle = useMemo(
    () => `Common Card Pairings${filteredPoolScopeSuffix ? ` ${filteredPoolScopeSuffix}` : ''}`,
    [filteredPoolScopeSuffix],
  );
  const overperformersTitleSuffix = useMemo(() => filteredPoolScopeSuffix, [filteredPoolScopeSuffix]);

  return {
    activeFilterSummary,
    scopeOnlySummary,
    filterChipItems,
    selectedCardScopeLabel,
    detailedViewTitle,
    detailedViewSubtitle,
    clearActiveFilter,
    downloadDraftBreakdownCsv,
    downloadCardStatsCsv,
    cardStatsTitle,
    scopedCardStatsTitle,
    draftBreakdownTitle,
    sideboardTitle,
    pairingsTitle,
    overperformersTitleSuffix,
  };
}
