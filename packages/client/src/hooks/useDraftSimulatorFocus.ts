import { useMemo } from 'react';

import type { CardStats } from '@utils/datatypes/SimulationReport';

import type {
  DraftSimulatorDerivedData,
  DraftSimulatorSelectionState,
} from './draftSimulatorHookTypes';

interface UseDraftSimulatorFocusArgs {
  data: Pick<DraftSimulatorDerivedData, 'displayRunData' | 'displayedPools' | 'activeDecks'>;
  state: Pick<
    DraftSimulatorSelectionState,
    'selectedSkeletonId' | 'focusedPoolIndex' | 'focusedPoolViewMode'
  >;
  activeFilterPoolIndexSet: Set<number> | null;
  selectedCards: CardStats[];
  selectedCard: CardStats | null;
  selectedCardStats: CardStats | null;
}

export default function useDraftSimulatorFocus({
  data: { displayRunData, displayedPools, activeDecks },
  state: { selectedSkeletonId, focusedPoolIndex, focusedPoolViewMode },
  activeFilterPoolIndexSet,
  selectedCards,
  selectedCard,
  selectedCardStats,
}: UseDraftSimulatorFocusArgs) {
  const selectedPools = useMemo(
    () =>
      selectedCards.length > 0
        ? displayedPools.filter((p) => !activeFilterPoolIndexSet || activeFilterPoolIndexSet.has(p.poolIndex))
        : [],
    [selectedCards.length, displayedPools, activeFilterPoolIndexSet],
  );

  const focusedPool = useMemo(
    () => (focusedPoolIndex === null ? null : (displayedPools.find((pool) => pool.poolIndex === focusedPoolIndex) ?? null)),
    [displayedPools, focusedPoolIndex],
  );

  const focusedDeck = useMemo(
    () => (focusedPool ? (activeDecks?.[focusedPool.poolIndex] ?? null) : null),
    [focusedPool, activeDecks],
  );

  const focusedDeckAvailable = !!focusedDeck && (focusedDeck.mainboard.length > 0 || focusedDeck.sideboard.length > 0);
  const focusedFullPickOrderAvailable = !!displayRunData?.setupData;

  const effectiveFocusedPoolViewMode = useMemo(
    () =>
      (focusedPoolViewMode === 'deck' && !focusedDeckAvailable) ||
      (focusedPoolViewMode === 'fullPickOrder' && !focusedFullPickOrderAvailable)
        ? 'pool'
        : focusedPoolViewMode,
    [focusedPoolViewMode, focusedDeckAvailable, focusedFullPickOrderAvailable],
  );

  const showDraftMapScopePanel = selectedSkeletonId !== null || activeFilterPoolIndexSet !== null || selectedCards.length > 0;
  const mapPanelHasBoth = selectedCards.length > 0 && (selectedSkeletonId !== null || activeFilterPoolIndexSet !== null);
  const draftMapScopeSeatCount = activeFilterPoolIndexSet?.size ?? displayRunData?.slimPools.length ?? 0;
  const draftMapScopeSubtitle = activeFilterPoolIndexSet
    ? `${draftMapScopeSeatCount} matching seat${draftMapScopeSeatCount !== 1 ? 's' : ''}`
    : `${draftMapScopeSeatCount} total seat${draftMapScopeSeatCount !== 1 ? 's' : ''}`;

  const statsForScope = activeFilterPoolIndexSet ? selectedCardStats : (selectedCardStats ?? selectedCard);

  return {
    selectedPools,
    focusedPool,
    focusedDeck,
    focusedDeckAvailable,
    focusedFullPickOrderAvailable,
    effectiveFocusedPoolViewMode,
    showDraftMapScopePanel,
    mapPanelHasBoth,
    draftMapScopeSeatCount,
    draftMapScopeSubtitle,
    statsForScope,
  };
}
