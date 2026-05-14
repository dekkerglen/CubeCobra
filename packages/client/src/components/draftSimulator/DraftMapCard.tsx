/* eslint-disable camelcase */
import React, { useCallback, useMemo } from 'react';

import type { CardDetails } from '@utils/datatypes/Card';
import type {
  ArchetypeSkeleton,
  BuiltDeck,
  CardMeta,
  CardStats,
  LockPair,
  RankedCards,
  SimulationRunData,
  SkeletonCard,
  SlimPool,
} from '@utils/datatypes/SimulationReport';

import { Card, CardBody, CardHeader } from '../base/Card';
import { Flexbox } from '../base/Layout';
import Link from '../base/Link';
import Text from '../base/Text';
import withAutocard from '../WithAutocard';
import DraftMapScatter, { type DraftMapColorMode, type DraftMapPoint } from './DraftMapScatter';
import ClusterDetailPanel, { LinkedCardImage, SkeletonCardImage } from './ClusterDetailPanel';
import ColorProfileDetailPanel from './ColorProfileDetailPanel';
import {
  CardTypeShareLegend,
  DeckColorShareChart,
  DeckColorShareLegend,
  ManaCurveShareChart,
  CardTypeShareChart,
  EloDistributionChart,
} from './SimulatorCharts';
import Input from '../base/Input';

const AutocardLink = withAutocard(Link);

const SIM_PREVIEW_CARD_W = 140;

function autocardDetails(oracleId: string, name: string, imageUrl?: string): Partial<CardDetails> {
  const idUrl = encodeURIComponent(oracleId);
  return {
    oracle_id: oracleId,
    scryfall_id: oracleId,
    name,
    full_name: name,
    image_normal: imageUrl || `/tool/cardimage/${idUrl}`,
  };
}

/** Number input that lets the user type freely; commits/clamps only on blur or Enter. */
const NumericInput: React.FC<{
  value: number;
  min: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  className?: string;
}> = ({ value, min, max, step, onChange, disabled, className }) => {
  const [draft, setDraft] = React.useState(String(value));
  const isFloat = step !== undefined && step % 1 !== 0;
  const prevValueRef = React.useRef(value);
  React.useEffect(() => {
    if (prevValueRef.current !== value) {
      prevValueRef.current = value;
      setDraft(String(value));
    }
  }, [value]);

  const commit = () => {
    const parsed = isFloat ? parseFloat(draft) : parseInt(draft, 10);
    const clamped = isNaN(parsed) ? value : Math.max(min, max !== undefined ? Math.min(max, parsed) : parsed);
    prevValueRef.current = clamped;
    setDraft(String(clamped));
    if (clamped !== value) onChange(clamped);
  };

  return (
    <Input
      type="number"
      min={min}
      max={max}
      step={step}
      value={draft}
      disabled={disabled}
      className={className}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
        const nextDraft = e.target.value;
        setDraft(nextDraft);
        const parsed = isFloat ? parseFloat(nextDraft) : parseInt(nextDraft, 10);
        if (!isNaN(parsed) && parsed >= min && (max === undefined || parsed <= max)) {
          prevValueRef.current = parsed;
          if (parsed !== value) onChange(parsed);
        }
      }}
      onBlur={commit}
      onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit();
        }
      }}
    />
  );
};

export interface MapSelectedCardInfo {
  cardImages: { oracleId: string; name: string; imageUrl: string }[];
  name: string; // joined display name
  pickRate?: number; // only set for single-card selection
  avgPickPosition?: number;
  onClear: () => void;
}

export function computeDraftMapPoints(
  slimPools: SlimPool[],
  displayedPools: { poolIndex: number; archetype: string; draftIndex: number; seatIndex: number }[],
  skeletons: ArchetypeSkeleton[],
  umapCoords: { x: number; y: number }[],
  poolArchetypeLabels: Map<number, string> | null,
  skeletonColorProfiles: Map<number, string>,
  getSkeletonDisplayName: (
    skeleton: ArchetypeSkeleton,
    poolArchetypeLabels: Map<number, string> | null | undefined,
    skeletonColorProfiles?: Map<number, string>,
  ) => string,
): DraftMapPoint[] {
  if (!umapCoords || slimPools.length === 0 || umapCoords.length !== slimPools.length) return [];

  const clusterByPoolIndex = new Map<number, { clusterId: number; clusterIndex: number; label: string }>();
  skeletons.forEach((skeleton, index) => {
    const label = getSkeletonDisplayName(skeleton, poolArchetypeLabels, skeletonColorProfiles);
    for (const poolIndex of skeleton.poolIndices) {
      clusterByPoolIndex.set(poolIndex, {
        clusterId: skeleton.clusterId,
        clusterIndex: index,
        label,
      });
    }
  });

  return slimPools.map((pool, poolIndex) => {
    const coord = umapCoords[poolIndex]!;
    const cluster = clusterByPoolIndex.get(poolIndex);
    return {
      x: coord.x,
      y: coord.y,
      poolIndex,
      draftIndex: pool.draftIndex,
      seatIndex: pool.seatIndex,
      clusterId: cluster?.clusterId ?? null,
      clusterIndex: cluster?.clusterIndex ?? null,
      clusterLabel: cluster?.label ?? 'Unclustered',
      archetype: displayedPools[poolIndex]?.archetype ?? pool.archetype,
    };
  });
}

export const DraftMapScopePanel: React.FC<{
  title: string;
  subtitle: string;
  commonCards?: RankedCards;
  deckBuilds: BuiltDeck[] | null;
  cardMeta: Record<string, CardMeta>;
  selectedCardInfo?: MapSelectedCardInfo;
  matchingCount: number;
  excludeManaFixingLands: boolean;
}> = ({ title, subtitle, commonCards, deckBuilds, cardMeta, selectedCardInfo, matchingCount, excludeManaFixingLands }) => {
  const commonCardList = commonCards
    ? excludeManaFixingLands
      ? commonCards.excludingFixing
      : commonCards.default
    : [];
  const showHeader = !!selectedCardInfo || !!title || !!subtitle;
  return (
  <div className="flex flex-col gap-5">
    {showHeader && (
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 pt-2">
          <div><Text semibold className="text-lg leading-snug">
            {selectedCardInfo
              ? (title ? `${selectedCardInfo.name} in ${title}` : selectedCardInfo.name)
              : title}
          </Text></div>
          {subtitle ? <div className="mt-1"><Text xs className="text-text-secondary">{subtitle}</Text></div> : null}
          {selectedCardInfo && (selectedCardInfo.pickRate !== undefined || (selectedCardInfo.avgPickPosition ?? 0) > 0) && (
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              {selectedCardInfo.pickRate !== undefined && (
                <span className="text-sm text-text-secondary/50">Pick rate <span className="text-text-secondary/80">{(selectedCardInfo.pickRate * 100).toFixed(1)}%</span></span>
              )}
              {(selectedCardInfo.avgPickPosition ?? 0) > 0 && (
                <span className="text-sm text-text-secondary/50">Avg pos <span className="text-text-secondary/80">{selectedCardInfo.avgPickPosition!.toFixed(1)}</span></span>
              )}
            </div>
          )}
        </div>
        {selectedCardInfo && (
          <button
            type="button"
            onClick={selectedCardInfo.onClear}
            className="px-2 py-0.5 rounded text-xs font-medium border bg-bg text-text-secondary border-border hover:bg-bg-active flex-shrink-0"
          >
            ✕
          </button>
        )}
      </div>
    )}
    {matchingCount === 0 ? (
      <Text sm className="text-text-secondary">No pools match all active filters. Try removing a card or changing the scope.</Text>
    ) : (
      <>
        {(selectedCardInfo?.cardImages.length || commonCardList.length > 0) ? (
          <div className="flex flex-col gap-3">
            {selectedCardInfo && selectedCardInfo.cardImages.length > 0 && (
              <div className="grid grid-cols-6 gap-1.5">
                {selectedCardInfo.cardImages.map((img) => (
                  <AutocardLink
                    key={img.oracleId}
                    href={`/tool/card/${encodeURIComponent(img.oracleId)}`}
                    className="block hover:opacity-95"
                    card={{ details: autocardDetails(img.oracleId, img.name, img.imageUrl) } as any}
                  >
                    <img src={img.imageUrl} alt={img.name} className="w-full rounded border-2 border-primary shadow-sm" />
                  </AutocardLink>
                ))}
              </div>
            )}
            {commonCardList.length > 0 && (
              <div>
                <Text xs className="text-text-secondary font-medium uppercase tracking-wider mb-1.5">Most common cards in matching pools</Text>
                <div className="grid grid-cols-6 gap-1.5">
                  {commonCardList.slice(0, selectedCardInfo ? 6 : 12).map((card) => (
                    <SkeletonCardImage key={card.oracle_id} card={card} />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
        <div className="flex flex-col gap-4 md:flex-row md:flex-wrap">
          <div className="flex-1 min-w-0">
            <Text xs className="text-text-secondary font-medium uppercase tracking-wider mb-1.5">Deck Color Share</Text>
            <div className="hidden md:block">
              <DeckColorShareChart deckBuilds={deckBuilds} cardMeta={cardMeta} />
            </div>
            <div className="md:hidden">
              <DeckColorShareLegend deckBuilds={deckBuilds} cardMeta={cardMeta} />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <Text xs className="text-text-secondary font-medium uppercase tracking-wider mb-1.5">Card Types</Text>
            <div className="hidden md:block">
              <CardTypeShareChart deckBuilds={deckBuilds} cardMeta={cardMeta} />
            </div>
            <div className="md:hidden">
              <CardTypeShareLegend deckBuilds={deckBuilds} cardMeta={cardMeta} />
            </div>
          </div>
          <div className="flex-1 min-w-0 flex flex-col gap-4">
            <div>
              <Text xs className="text-text-secondary font-medium uppercase tracking-wider mb-1.5">Mana Curve Share</Text>
              <ManaCurveShareChart deckBuilds={deckBuilds} cardMeta={cardMeta} />
            </div>
            <div>
              <Text xs className="text-text-secondary font-medium uppercase tracking-wider mb-1.5">Elo Distribution</Text>
              <EloDistributionChart deckBuilds={deckBuilds} cardMeta={cardMeta} />
            </div>
          </div>
        </div>
      </>
    )}
  </div>
  );
};

const DraftMapCard: React.FC<{
  skeletons: ArchetypeSkeleton[];
  showAdvancedClustering: boolean;
  pendingKnnK: number;
  setPendingKnnK: (v: number) => void;
  pendingResolution: number;
  setPendingResolution: (v: number) => void;
  clusteringInProgress: boolean;
  clusteringPhase: string | null;
  applyPendingClusteringSettings: () => void;
  draftMapPoints: DraftMapPoint[];
  showDraftMapScopePanel: boolean;
  activeFilterPoolIndexSet: Set<number> | null;
  draftMapColorMode: DraftMapColorMode;
  setDraftMapColorMode: React.Dispatch<React.SetStateAction<DraftMapColorMode>>;
  focusedPoolIndex: number | null;
  setFocusedPoolIndex: React.Dispatch<React.SetStateAction<number | null>>;
  setSelectedSkeletonId: React.Dispatch<React.SetStateAction<number | null>>;
  selectedSkeletonId: number | null;
  setSelectedArchetype: React.Dispatch<React.SetStateAction<string | null>>;
  setDraftBreakdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  mapPanelHasBoth: boolean;
  selectedCards: CardStats[];
  selectedDeckCards: CardStats[];
  displayRunData: SimulationRunData;
  selectedCard: CardStats | null;
  selectedCardStats: CardStats | null;
  statsForScope: CardStats | null;
  selectedCardScopeLabel: string | null;
  detailedViewTitle: string;
  detailedViewSubtitle: string;
  activeFilterPreview: {
    commonCards: RankedCards;
    supportCards: SkeletonCard[];
    sideboardCards: SkeletonCard[];
    lockPairs: LockPair[];
  } | null;
  activeDecks: BuiltDeck[] | null;
  clusterThemesByClusterId: Map<number, string[]>;
  poolArchetypeLabels: Map<number, string> | null;
  colorPairTopArchetypes: Map<string, string[]>;
  activeFilterSummary: string | null;
  scopeOnlySummary: string | null;
  filteredDecks: BuiltDeck[] | null;
  draftMapScopeSubtitle: string;
  draftMapScopeSeatCount: number;
  onClearSelectedCards: () => void;
  onClearSelectedDeckCards: () => void;
  cubeOracleSet: Set<string>;
  excludeManaFixingLands: boolean;
  setExcludeManaFixingLands: (v: boolean) => void;
  onInspectPool: (poolIndex: number) => void;
  selectedArchetype: string | null;
  selectedColorPoolIndices: number[];
  selectedColorDeckBuilds: BuiltDeck[] | null;
  onToggleSelectedCard: (oracleId: string) => void;
}> = ({
  skeletons,
  showAdvancedClustering,
  pendingKnnK,
  setPendingKnnK,
  pendingResolution,
  setPendingResolution,
  clusteringInProgress,
  clusteringPhase,
  applyPendingClusteringSettings,
  draftMapPoints,
  showDraftMapScopePanel,
  activeFilterPoolIndexSet,
  draftMapColorMode,
  setDraftMapColorMode,
  focusedPoolIndex,
  setFocusedPoolIndex,
  setSelectedSkeletonId,
  selectedSkeletonId,
  setSelectedArchetype,
  setDraftBreakdownOpen,
  mapPanelHasBoth,
  selectedCards,
  selectedDeckCards,
  displayRunData,
  selectedCard,
  selectedCardStats,
  statsForScope,
  selectedCardScopeLabel,
  detailedViewTitle,
  detailedViewSubtitle,
  activeFilterPreview,
  activeDecks,
  clusterThemesByClusterId,
  poolArchetypeLabels,
  colorPairTopArchetypes,
  activeFilterSummary,
  scopeOnlySummary,
  filteredDecks,
  draftMapScopeSubtitle,
  draftMapScopeSeatCount,
  onClearSelectedCards,
  onClearSelectedDeckCards,
  cubeOracleSet,
  excludeManaFixingLands,
  setExcludeManaFixingLands,
  onInspectPool,
  selectedArchetype,
  selectedColorPoolIndices,
  selectedColorDeckBuilds,
  onToggleSelectedCard,
}) => {
  const focusedPoolSummary = useMemo(() => {
    if (focusedPoolIndex === null) return null;
    const focusedPool = displayRunData.slimPools[focusedPoolIndex];
    if (!focusedPool) return null;
    return {
      draftIndex: focusedPool.draftIndex + 1,
      seatIndex: focusedPool.seatIndex + 1,
    };
  }, [displayRunData.slimPools, focusedPoolIndex]);

  const handleSelectMapPoint = useCallback(
    (point: DraftMapPoint) => {
      setFocusedPoolIndex(point.poolIndex);
      setSelectedSkeletonId(point.clusterId);
      setSelectedArchetype(null);
      setDraftBreakdownOpen(true);
    },
    [setFocusedPoolIndex, setSelectedSkeletonId, setSelectedArchetype, setDraftBreakdownOpen],
  );

  return (
    <Card className="border-border">
      <CardHeader>
        <div className="flex flex-col gap-2 w-full">
          <div className="flex flex-row flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <div className="flex flex-row items-baseline gap-3">
              <Text semibold>Draft Map{skeletons.length > 0 ? ` · ${skeletons.length} clusters` : ''}</Text>
            </div>
            <div className="flex flex-row items-center gap-2">
              {focusedPoolSummary && (
                <button
                  type="button"
                  onClick={() => onInspectPool(focusedPoolIndex!)}
                  className="px-2 py-1 text-xs font-medium rounded border border-border bg-bg-accent hover:bg-bg-active text-text-secondary"
                >
                  View selected deck: Draft {focusedPoolSummary.draftIndex} Seat {focusedPoolSummary.seatIndex}
                </button>
              )}
              <div className="inline-flex rounded border border-border overflow-hidden">
                <button type="button" onClick={() => setDraftMapColorMode('cluster')}
                  className={['px-2 py-1 text-xs font-medium transition-colors border-r border-border', draftMapColorMode === 'cluster' ? 'bg-link text-white' : 'bg-bg-accent hover:bg-bg-active text-text-secondary'].join(' ')}>
                  Cluster
                </button>
                <button type="button" onClick={() => setDraftMapColorMode('deckColor')}
                  className={['px-2 py-1 text-xs font-medium transition-colors', draftMapColorMode === 'deckColor' ? 'bg-link text-white' : 'bg-bg-accent hover:bg-bg-active text-text-secondary'].join(' ')}>
                  Deck Color
                </button>
              </div>
            </div>
          </div>
          {showAdvancedClustering && (
            <>
              <p className="text-xs text-text-secondary leading-snug max-w-2xl">
                <span>
                  Uses Leiden community detection on the draft similarity graph. <strong>Resolution</strong> controls
                  granularity; higher values produce more, smaller clusters. <span className="opacity-60"><strong>Neighbors (k)</strong> controls graph connectivity; higher values produce smoother boundaries.</span>
                </span>
              </p>
              <div className="flex flex-row flex-wrap items-end gap-3">
                <div className="flex flex-col gap-0.5">
                  <label className="text-[11px] font-medium text-text-secondary">Neighbors (k)</label>
                  <NumericInput min={5} max={200} value={pendingKnnK} onChange={setPendingKnnK} className="w-20" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <label className="text-[11px] font-medium text-text-secondary">Resolution</label>
                  <NumericInput min={0.1} max={10} step={0.1} value={pendingResolution} onChange={setPendingResolution} className="w-20" />
                </div>
                <button type="button" disabled={clusteringInProgress} onClick={() => { setSelectedSkeletonId(null); setFocusedPoolIndex(null); applyPendingClusteringSettings(); }}
                  className={['ml-auto self-end px-3 py-1.5 rounded text-xs font-semibold border transition-colors whitespace-nowrap', clusteringInProgress ? 'bg-bg-accent border-border text-text-secondary cursor-wait' : 'bg-link border-link text-white hover:opacity-90'].join(' ')}>
                  {clusteringInProgress ? (
                    <span className="flex items-center gap-1.5">
                      <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      {clusteringPhase ?? 'Clustering…'}
                    </span>
                  ) : 'Update clusters'}
                </button>
              </div>
            </>
          )}
        </div>
      </CardHeader>
      <CardBody>
        <div className="grid grid-cols-2 gap-6 items-start">
          <div className={`relative ${showDraftMapScopePanel ? '' : 'col-span-2'}`}
            style={{ aspectRatio: '1 / 1', width: showDraftMapScopePanel ? '100%' : 'calc(50% - 0.75rem)', ...(!showDraftMapScopePanel ? { margin: '0 auto' } : {}) }}>
            {clusteringInProgress && (
              <div className={`${draftMapPoints.length === 0 ? '' : 'absolute inset-0 bg-bg/60 backdrop-blur-sm'} z-10 flex items-center justify-center rounded`}
                style={draftMapPoints.length === 0 ? { aspectRatio: '1 / 1' } : undefined}>
                <div className="flex flex-col items-center gap-2">
                  <svg className="animate-spin h-8 w-8 text-link" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <Text xs className="text-text-secondary">{clusteringPhase ?? 'Clustering…'}</Text>
                </div>
              </div>
            )}
            {!clusteringInProgress && draftMapPoints.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center rounded border border-dashed border-border bg-bg-accent/30">
                <div className="flex flex-col items-center gap-1.5 px-4 text-center">
                  <Text sm semibold className="text-text-secondary">
                    Draft map unavailable
                  </Text>
                  <Text xs className="text-text-secondary/70">
                    Try reclustering this run.
                  </Text>
                </div>
              </div>
            )}
            {draftMapPoints.length > 0 && (
              <DraftMapScatter
                points={draftMapPoints}
                selectedPoolIndex={focusedPoolIndex}
                activePoolIndexSet={activeFilterPoolIndexSet}
                colorMode={draftMapColorMode}
                onSelectPoint={handleSelectMapPoint}
              />
            )}
          </div>
          {showDraftMapScopePanel && (() => {
            const hasAnyCardFilter = selectedCards.length > 0 || selectedDeckCards.length > 0;

            // Build a combined display name: "X in pool and Y in deck" / "X and Y in deck" / etc.
            const buildCardFilterLabel = (): string => {
              const poolNames = selectedCards.map((c) => c.name);
              const deckNames = selectedDeckCards.map((c) => c.name);
              const joinNames = (names: string[]) =>
                names.length === 1 ? names[0]! : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
              if (poolNames.length > 0 && deckNames.length > 0)
                return `${joinNames(poolNames)} in pool and ${joinNames(deckNames)} in deck`;
              if (deckNames.length > 0) return `${joinNames(deckNames)} in deck`;
              return `${joinNames(poolNames)} in pool`;
            };

            const allCardImages = [
              ...selectedCards.map((c) => ({ oracleId: c.oracle_id, name: c.name, imageUrl: displayRunData.cardMeta[c.oracle_id]?.imageUrl ?? '' })),
              ...selectedDeckCards.map((c) => ({ oracleId: c.oracle_id, name: c.name, imageUrl: displayRunData.cardMeta[c.oracle_id]?.imageUrl ?? '' })),
            ].filter((img) => img.imageUrl);

            const cardInfo: MapSelectedCardInfo | undefined = mapPanelHasBoth && hasAnyCardFilter
              ? {
                  cardImages: allCardImages,
                  name: buildCardFilterLabel(),
                  pickRate: selectedCards.length === 1 && selectedDeckCards.length === 0 ? (statsForScope?.pickRate ?? selectedCard?.pickRate) : undefined,
                  avgPickPosition: selectedCards.length === 1 && selectedDeckCards.length === 0 ? (statsForScope?.avgPickPosition ?? selectedCard?.avgPickPosition) : undefined,
                  onClear: () => { onClearSelectedCards(); onClearSelectedDeckCards(); },
                }
              : undefined;
            return (
              <div className="min-w-0 flex flex-col gap-3">
                {!mapPanelHasBoth && hasAnyCardFilter && (
                  <div className="rounded-lg border border-border bg-bg-accent/40 px-3 py-2.5">
                    <Flexbox direction="row" gap="3" alignItems="start" className="min-w-0">
                      {allCardImages.length > 0 && (
                        <div className="flex flex-row gap-1 flex-shrink-0">
                          {allCardImages.map((img) => (
                            <LinkedCardImage
                              key={img.oracleId}
                              oracleId={img.oracleId}
                              name={img.name}
                              imageUrl={img.imageUrl}
                              size={SIM_PREVIEW_CARD_W}
                            />
                          ))}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <Text semibold className="leading-snug">
                          {buildCardFilterLabel()}
                        </Text>
                        {selectedCardScopeLabel && (
                          <div className="mt-0.5">
                            <Text xs className="text-text-secondary/80">{detailedViewTitle}</Text>
                          </div>
                        )}
                        <div className="mt-0.5">
                          <Text xs className="text-text-secondary/60">{detailedViewSubtitle}</Text>
                        </div>
                        {statsForScope && selectedCards.length === 1 && selectedDeckCards.length === 0 && (
                          <Flexbox direction="row" gap="3" alignItems="center" className="flex-wrap mt-1.5">
                            <span className="text-xs text-text-secondary/50 font-medium">
                              Pick rate <span className="text-text-secondary/80">{`${(statsForScope.pickRate * 100).toFixed(1)}%`}</span>
                            </span>
                            <span className="text-xs text-text-secondary/50 font-medium">
                              Avg position <span className="text-text-secondary/80">{statsForScope.avgPickPosition > 0 ? statsForScope.avgPickPosition.toFixed(1) : '—'}</span>
                            </span>
                          </Flexbox>
                        )}
                      </div>
                      <button type="button" className="flex-shrink-0 text-xs text-text-secondary hover:text-text" onClick={() => { onClearSelectedCards(); onClearSelectedDeckCards(); }}>
                        ✕
                      </button>
                    </Flexbox>
                  </div>
                )}
                {selectedSkeletonId !== null ? (() => {
                  const sk = skeletons.find((s) => s.clusterId === selectedSkeletonId);
                  const skIdx = skeletons.indexOf(sk!);
                  const clusterDecks = sk && activeDecks ? sk.poolIndices.map((i) => activeDecks[i]).filter(Boolean) : null;
                  return sk ? (
                    <ClusterDetailPanel
                      skeleton={sk}
                      clusterIndex={skIdx}
                      totalPools={displayRunData.slimPools.length}
                      clusterDeckBuilds={clusterDecks}
                      cubeOracleSet={cubeOracleSet}
                      cardMeta={displayRunData.cardMeta}
                      slimPools={displayRunData.slimPools}
                      deckBuilds={activeDecks}
                      themes={clusterThemesByClusterId.get(sk.clusterId)}
                      poolArchetypeLabels={poolArchetypeLabels}
                      excludeManaFixingLands={excludeManaFixingLands}
                      setExcludeManaFixingLands={setExcludeManaFixingLands}
                      onOpenPool={(poolIndex) => {
                        onInspectPool(poolIndex);
                      }}
                      onClose={() => {
                        setSelectedSkeletonId(null);
                        setFocusedPoolIndex(null);
                      }}
                    />
                  ) : null;
                })() : selectedArchetype && selectedColorPoolIndices.length > 0 ? (
                  <ColorProfileDetailPanel
                    colorPair={selectedArchetype}
                    poolIndices={selectedColorPoolIndices}
                    totalPools={displayRunData.slimPools.length}
                    subsetDeckBuilds={selectedColorDeckBuilds}
                    cubeOracleSet={cubeOracleSet}
                    cardMeta={displayRunData.cardMeta}
                    slimPools={displayRunData.slimPools}
                    deckBuilds={activeDecks}
                    topArchetypeLabels={colorPairTopArchetypes.get(selectedArchetype)}
                    excludeManaFixingLands={excludeManaFixingLands}
                    setExcludeManaFixingLands={setExcludeManaFixingLands}
                    onOpenPool={(poolIndex) => {
                      onInspectPool(poolIndex);
                    }}
                    onCardClick={onToggleSelectedCard}
                    onClose={() => {
                      setSelectedArchetype(null);
                      setFocusedPoolIndex(null);
                    }}
                  />
                ) : activeFilterPoolIndexSet !== null && (
                  <DraftMapScopePanel
                    title={cardInfo ? (scopeOnlySummary ?? '') : (activeFilterSummary ?? 'All draft pools')}
                    subtitle={draftMapScopeSubtitle}
                    commonCards={activeFilterPreview?.commonCards}
                    deckBuilds={filteredDecks}
                    cardMeta={displayRunData.cardMeta}
                    selectedCardInfo={cardInfo}
                    matchingCount={draftMapScopeSeatCount}
                    excludeManaFixingLands={excludeManaFixingLands}
                  />
                )}
              </div>
            );
          })()}
        </div>
      </CardBody>
    </Card>
  );
};

export default DraftMapCard;
