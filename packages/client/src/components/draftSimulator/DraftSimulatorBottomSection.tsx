import React from 'react';

import type {
  ArchetypeEntry,
  ArchetypeSkeleton,
  BuiltDeck,
  CardMeta,
  CardStats,
  SimulatedPool,
  SimulationRunData,
} from '@utils/datatypes/SimulationReport';

import { Card, CardBody, CardHeader } from '../base/Card';
import { Col, Flexbox, Row } from '../base/Layout';
import Text from '../base/Text';
import ArchetypeChart from './ArchetypeChart';
import CardStatsTable from './CardStatsTable';
import DraftVsEloTable from './DraftVsEloTable';
import type { FilterChipItem } from './DraftSimulatorFilterBar';
import DraftBreakdownTable from './DraftBreakdownTable';
import ArchetypeSkeletonSection from './ArchetypeSkeletonSection';
import type {
  DraftSimulatorBottomTab,
} from '../../hooks/draftSimulatorHookTypes';
import { archetypeFullName } from '../../utils/draftSimulatorThemes';

const BOTTOM_TABS: { key: DraftSimulatorBottomTab; label: string }[] = [
  { key: 'archetypes', label: 'Archetypes' },
  { key: 'deckColor', label: 'Deck Color Distribution' },
  { key: 'cardStats', label: 'Card Stats' },
  { key: 'draftBreakdown', label: 'Draft Breakdown' },
  { key: 'sideboardAndPairings', label: 'Sideboard & Pairings' },
  { key: 'overperformers', label: 'Over/Underperformers' },
];

export const FilterChipButtons: React.FC<{
  chips: FilterChipItem[];
  includeFocus?: boolean;
}> = ({ chips, includeFocus = false }) => (
  <>
    {chips
      .filter((chip) => includeFocus || !chip.key.startsWith('focus-'))
      .map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={chip.onClear}
          className="inline-flex items-center gap-1 rounded bg-link/10 border border-link/20 px-2 py-0.5 text-xs text-link hover:bg-link/20"
          title={`Clear ${chip.label}`}
        >
          {chip.label}
          <span className="opacity-60">×</span>
        </button>
      ))}
  </>
);

type SideboardEntry = { oracle_id: string; count: number; pct: number };
type PairingEntry = {
  oracle_id_a?: string;
  oracle_id_b?: string;
  count: number;
  pct: number;
  rawPct: number;
};

const DraftSimulatorBottomSection: React.FC<{
  mobileLayout?: boolean;
  bottomTab: DraftSimulatorBottomTab;
  setBottomTab: React.Dispatch<React.SetStateAction<DraftSimulatorBottomTab>>;
  displayRunData: SimulationRunData;
  clusteringInProgress: boolean;
  clusteringPhase: string | null;
  skeletons: ArchetypeSkeleton[];
  selectedSkeletonId: number | null;
  setSelectedSkeletonId: React.Dispatch<React.SetStateAction<number | null>>;
  clusterThemesByClusterId: Map<number, string[]>;
  poolArchetypeLabels: Map<number, string> | null;
  poolArchetypeLabelsLoading: boolean;
  skeletonColorProfiles: Map<number, string>;
  selectedArchetype: string | null;
  setSelectedArchetype: React.Dispatch<React.SetStateAction<string | null>>;
  displayedArchetypeDistribution: ArchetypeEntry[];
  colorPairTopArchetypes: Map<string, string[]>;
  clearActiveFilter: () => void;
  activeFilterPoolIndexSet: Set<number> | null;
  hasApproximateFilteredStats: boolean;
  scopedCardStatsTitle: string;
  draftBreakdownTitle: string;
  sideboardTitle: string;
  pairingsTitle: string;
  overperformersTitleSuffix: string | null;
  downloadCardStatsCsv: (stats: CardStats[], label: string) => void;
  visibleCardStats: CardStats[];
  handleToggleSelectedCard: (oracleId: string) => void;
  selectedCardOracles: string[];
  handleToggleSelectedDeckCard: (oracleId: string) => void;
  selectedDeckCardOracles: string[];
  deckCardPoolIndices: Map<string, number[]>;
  visibleDeckCounts: Map<string, number>;
  inDeckOracles: Set<string> | null;
  inSideboardOracles: Set<string> | null;
  deckInclusionPct: Map<string, number>;
  visiblePoolCounts: Map<string, number>;
  cardStatsRef: React.RefObject<HTMLDivElement>;
  detailedViewRef: React.RefObject<HTMLDivElement>;
  downloadDraftBreakdownCsv: (pools: SimulatedPool[], label: string) => void;
  displayedPools: SimulatedPool[];
  activeDecks: BuiltDeck[] | null;
  simPhase: 'setup' | 'loadmodel' | 'sim' | 'deckbuild' | 'cluster' | 'save' | null;
  selectedCard: CardStats | null;
  focusedPoolIndex: number | null;
  setFocusedPoolIndex: React.Dispatch<React.SetStateAction<number | null>>;
  onInspectPool: (poolIndex: number) => void;
  allPoolClusterThemes?: Map<number, { tag: string; lift: number }[]>;
  allPoolTagAllowlist?: Set<string>;
  topSideboardCards: SideboardEntry[];
  topCardPairings: PairingEntry[];
  pairingsExcludeLands: boolean;
  setPairingsExcludeLands: React.Dispatch<React.SetStateAction<boolean>>;
  excludeManaFixingLands: boolean;
  status: 'idle' | 'running' | 'completed' | 'failed';
  renderAutocardNameLink: (oracleId: string, name: string, imageUrl?: string) => React.ReactNode;
}> = ({
  mobileLayout = false,
  bottomTab,
  setBottomTab,
  displayRunData,
  clusteringInProgress,
  clusteringPhase,
  skeletons,
  selectedSkeletonId,
  setSelectedSkeletonId,
  clusterThemesByClusterId,
  poolArchetypeLabels,
  poolArchetypeLabelsLoading,
  skeletonColorProfiles,
  selectedArchetype,
  setSelectedArchetype,
  displayedArchetypeDistribution,
  colorPairTopArchetypes,
  clearActiveFilter,
  activeFilterPoolIndexSet,
  hasApproximateFilteredStats,
  scopedCardStatsTitle,
  draftBreakdownTitle,
  sideboardTitle,
  pairingsTitle,
  overperformersTitleSuffix,
  downloadCardStatsCsv,
  visibleCardStats,
  handleToggleSelectedCard,
  selectedCardOracles,
  handleToggleSelectedDeckCard,
  selectedDeckCardOracles,
  deckCardPoolIndices,
  visibleDeckCounts,
  inDeckOracles,
  inSideboardOracles,
  deckInclusionPct,
  visiblePoolCounts,
  cardStatsRef,
  detailedViewRef,
  downloadDraftBreakdownCsv,
  displayedPools,
  activeDecks,
  simPhase,
  selectedCard,
  focusedPoolIndex,
  setFocusedPoolIndex,
  onInspectPool,
  allPoolClusterThemes,
  allPoolTagAllowlist,
  topSideboardCards,
  topCardPairings,
  pairingsExcludeLands,
  setPairingsExcludeLands,
  excludeManaFixingLands,
  status,
  renderAutocardNameLink,
}) => {
  const visibleTabs = BOTTOM_TABS;

  return (
  <div className="simSection simSectionBottomTabs flex flex-col gap-0 pt-3 border-t border-border">
    {activeFilterPoolIndexSet !== null && activeFilterPoolIndexSet.size === 0 && (
      <div className="rounded-lg border border-yellow-500 bg-yellow-500/10 px-4 py-3 mb-3 flex items-center justify-between gap-3">
        <Text sm className="text-text">
          No draft pools match the current combination of filters.
        </Text>
        <button
          type="button"
          className="text-xs text-text border border-yellow-500 rounded px-2 py-0.5 hover:bg-yellow-500/20 flex-shrink-0"
          onClick={clearActiveFilter}
        >
          Clear filters
        </button>
      </div>
    )}
    {mobileLayout ? (
      <div className="mb-4 grid grid-cols-2 gap-1.5 border-b border-border pb-4">
        {visibleTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setBottomTab(tab.key)}
            className={[
              'rounded px-3 py-2 text-sm font-medium text-center transition-colors border',
              bottomTab === tab.key
                ? 'bg-link/10 border-link/40 text-link'
                : 'border-border bg-bg text-text-secondary hover:bg-bg-active hover:text-text',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>
    ) : (
      <div className="mb-4 overflow-x-auto border-b border-border">
        <div className="flex min-w-max flex-row items-stretch gap-0">
          {visibleTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setBottomTab(tab.key)}
              className={[
                'flex-shrink-0 whitespace-nowrap px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                bottomTab === tab.key
                  ? 'border-link text-link'
                  : 'border-transparent text-text-secondary hover:text-text hover:border-border',
              ].join(' ')}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    )}
    {bottomTab === 'archetypes' && (
      <div className="flex flex-col gap-4">
        {clusteringInProgress ? (
          <div className="flex flex-col gap-3 py-2">
            {clusteringPhase && (
              <Text xs className="text-text-secondary text-center">{clusteringPhase}</Text>
            )}
            {[100, 80, 90, 70, 85].map((w, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-10 w-10 flex-shrink-0 animate-pulse rounded-full bg-bg-accent" />
                <div className="flex flex-col gap-1.5 flex-1">
                  <div className="h-3 animate-pulse rounded bg-bg-accent" style={{ width: `${w}%` }} />
                  <div className="h-2.5 animate-pulse rounded bg-bg-accent" style={{ width: `${w * 0.6}%` }} />
                </div>
              </div>
            ))}
          </div>
        ) : skeletons.length > 0 ? (
          <ArchetypeSkeletonSection
            skeletons={skeletons}
            totalPools={displayRunData.slimPools.length}
            selectedSkeletonId={selectedSkeletonId}
            onSelectSkeleton={(id) => {
              setSelectedSkeletonId(id);
              setSelectedArchetype(null);
            }}
            clusterThemesByClusterId={clusterThemesByClusterId}
            poolArchetypeLabels={poolArchetypeLabels}
            poolArchetypeLabelsLoading={poolArchetypeLabelsLoading}
            skeletonColorProfiles={skeletonColorProfiles}
            excludeManaFixingLands={excludeManaFixingLands}
          />
        ) : (
          <Text sm className="text-text-secondary">
            No archetypes found. Try lowering the minimum cluster size.
          </Text>
        )}
      </div>
    )}
    {bottomTab === 'deckColor' && (
      <div className="flex flex-col gap-4">
        <Card className="border-border">
          <CardHeader>
            <Flexbox direction="row" justify="between" alignItems="center" className="flex-wrap gap-2">
              <div>
                <Text semibold>Deck Color Distribution</Text>
                <div className="mt-0.5">
                  <Text xs className="text-text-secondary">
                    Click a row to filter stats by color profile
                  </Text>
                </div>
              </div>
              {selectedArchetype && (
                <Flexbox direction="row" gap="2" alignItems="center">
                  <span className="text-xs bg-link/20 text-link border border-link/30 rounded px-2 py-0.5">
                    {archetypeFullName(selectedArchetype)}
                  </span>
                  <button
                    type="button"
                    className="text-xs text-text-secondary hover:text-text border border-border rounded px-2 py-0.5 hover:bg-bg-active"
                    onClick={() => setSelectedArchetype(null)}
                  >
                    ✕ Clear
                  </button>
                </Flexbox>
              )}
            </Flexbox>
          </CardHeader>
          <CardBody>
            <ArchetypeChart
              archetypeDistribution={displayedArchetypeDistribution}
              selectedArchetype={selectedArchetype}
              onSelect={(cp) => {
                setSelectedArchetype(cp);
                setSelectedSkeletonId(null);
              }}
              topArchetypesByColor={colorPairTopArchetypes}
            />
          </CardBody>
        </Card>
      </div>
    )}
    {bottomTab === 'cardStats' && (
      <div ref={cardStatsRef} className="flex flex-col gap-5">
        {hasApproximateFilteredStats && (
          <div className="rounded-lg border border-yellow-500 bg-yellow-500/10 px-4 py-3">
            <Text sm className="text-text">
              Exact card-stat filtering isn't available for this run — re-simulate to get precise per-filter stats.
              Deck and draft breakdowns are filtered correctly; card-level stats reflect the full run.
            </Text>
          </div>
        )}
        <Card className="border-border">
          <CardHeader>
            <Flexbox direction="row" gap="2" alignItems="center" justify="between" className="flex-wrap">
              <Text semibold>{scopedCardStatsTitle}</Text>
              <div className="flex items-center gap-2 flex-shrink-0">
                {activeFilterPoolIndexSet && (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-text-secondary hover:bg-bg-active hover:text-text"
                    onClick={() => downloadCardStatsCsv(visibleCardStats, 'filtered')}
                    title="Download filtered card stats as CSV"
                  >
                    ↓ Export (filtered)
                  </button>
                )}
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-text-secondary hover:bg-bg-active hover:text-text"
                  onClick={() => downloadCardStatsCsv(displayRunData.cardStats, 'all')}
                  title="Download all card stats as CSV"
                >
                  ↓ Export
                </button>
              </div>
            </Flexbox>
          </CardHeader>
          <CardBody>
            <CardStatsTable
              cardStats={visibleCardStats}
              cardMeta={displayRunData.cardMeta}
              onSelectCard={handleToggleSelectedCard}
              selectedCardOracles={selectedCardOracles}
              onSelectDeckCard={handleToggleSelectedDeckCard}
              selectedDeckCardOracles={selectedDeckCardOracles}
              visibleDeckCounts={visibleDeckCounts}
              inDeckOracles={inDeckOracles}

              deckInclusionPct={deckInclusionPct}
              visiblePoolCounts={visiblePoolCounts}
              totalScopedPools={activeFilterPoolIndexSet?.size ?? displayRunData.slimPools.length}
              renderCardLink={renderAutocardNameLink}
              onPageChange={() => cardStatsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            />
          </CardBody>
        </Card>
      </div>
    )}
    {bottomTab === 'draftBreakdown' && (
      <div ref={detailedViewRef} className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <Text semibold>{draftBreakdownTitle}</Text>
          <div className="flex items-center gap-2 flex-shrink-0">
            {activeFilterPoolIndexSet && (
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-text-secondary hover:bg-bg-active hover:text-text"
                onClick={() =>
                  downloadDraftBreakdownCsv(displayedPools.filter((p) => activeFilterPoolIndexSet.has(p.poolIndex)), 'filtered')
                }
                title="Download filtered draft breakdown as CSV"
              >
                ↓ Export (filtered)
              </button>
            )}
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-text-secondary hover:bg-bg-active hover:text-text"
              onClick={() => downloadDraftBreakdownCsv(displayedPools, 'all')}
              title="Download all draft breakdown as CSV"
            >
              ↓ Export
            </button>
          </div>
        </div>
        <DraftBreakdownTable
          pools={activeFilterPoolIndexSet !== null ? displayedPools.filter((p) => activeFilterPoolIndexSet.has(p.poolIndex)) : displayedPools}
          deckBuilds={activeDecks}
          cardMeta={displayRunData.cardMeta}
          runData={displayRunData}
          skeletons={skeletons}
          highlightOracle={selectedCard?.oracle_id}
          showLocationFilter={!!selectedCard}
          focusedPoolIndex={focusedPoolIndex}
          onSelectPool={setFocusedPoolIndex}
          onInspectPool={onInspectPool}
          poolArchetypeLabels={poolArchetypeLabels}
          poolArchetypeLabelsLoading={poolArchetypeLabelsLoading}
          clusterThemes={allPoolClusterThemes}
          clusterTagAllowlist={allPoolTagAllowlist}
        />
      </div>
                )}
                {bottomTab === 'overperformers' && (
                  <div className="flex flex-col gap-4">
                    <DraftVsEloTable
                      cardStats={visibleCardStats}
                      inDeckOracles={inDeckOracles}
                      titleSuffix={overperformersTitleSuffix}
                      renderCardLink={(oracleId, name) => renderAutocardNameLink(oracleId, name)}
                    />
                  </div>
                )}
    {bottomTab === 'sideboardAndPairings' && (
      <Row className="gap-4">
        <Col xs={12} md={6}>
          <div className="h-full rounded border border-border bg-bg">
            <div className="border-b border-border bg-bg-accent/50 px-3 py-2 flex flex-col gap-0.5">
              <Text semibold>{sideboardTitle}</Text>
              <Text xs className="text-text-secondary">Cards most often left in the sideboard across matching pools.</Text>
            </div>
            {topSideboardCards.length === 0 ? (
              <div className="px-3 py-3">
                <Text sm className="text-text-secondary">
                  {simPhase === 'deckbuild' || (!activeDecks && status === 'running')
                    ? 'Building decks…'
                    : 'No sideboard data available for the current filter.'}
                </Text>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border text-sm" style={{ tableLayout: 'fixed' }}>
                  <colgroup>
                    <col />
                    <col style={{ width: 60 }} />
                    <col style={{ width: 72 }} />
                  </colgroup>
                  <thead className="bg-bg-accent/50 border-b border-border">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-text-secondary">Card</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-text-secondary">Pools</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-text-secondary">%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {topSideboardCards.map((entry) => {
                      const meta = displayRunData.cardMeta[entry.oracle_id];
                      return (
                        <tr key={entry.oracle_id} className="hover:bg-bg-accent/40">
                          <td className="px-3 py-2 font-medium text-text truncate">
                            {meta ? renderAutocardNameLink(entry.oracle_id, meta.name, meta.imageUrl) : entry.oracle_id}
                          </td>
                          <td className="px-3 py-2 text-right text-text-secondary">{entry.count}</td>
                          <td className="px-3 py-2 text-right text-text-secondary">{(entry.pct * 100).toFixed(1)}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Col>
        <Col xs={12} md={6}>
          <div className="h-full rounded border border-border bg-bg">
            <div className="border-b border-border bg-bg-accent/50 px-3 py-2 flex items-start justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <Text semibold>{pairingsTitle}</Text>
                <Text xs className="text-text-secondary">Pairs of cards most often drafted together into the same deck.</Text>
              </div>
              <label className="flex items-center gap-1.5 text-xs text-text-secondary cursor-pointer select-none flex-shrink-0 pt-0.5">
                <input
                  type="checkbox"
                  checked={pairingsExcludeLands}
                  onChange={(e) => setPairingsExcludeLands(e.target.checked)}
                  className="rounded"
                />
                Exclude lands
              </label>
            </div>
            {topCardPairings.length === 0 ? (
              <div className="px-3 py-3">
                <Text sm className="text-text-secondary">
                  {simPhase === 'deckbuild' || (!activeDecks && status === 'running')
                    ? 'Building decks…'
                    : 'No pairing data available for the current filter.'}
                </Text>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border text-sm" style={{ tableLayout: 'fixed' }}>
                  <colgroup>
                    <col style={{ width: 48 }} />
                    <col />
                    <col style={{ width: 48 }} />
                    <col />
                    <col style={{ width: 60 }} />
                    <col style={{ width: 80 }} />
                    <col style={{ width: 80 }} />
                  </colgroup>
                  <thead className="bg-bg-accent/50 border-b border-border">
                    <tr>
                      <th className="px-2 py-2" />
                      <th className="px-3 py-2 text-left text-xs font-semibold text-text-secondary">Card A</th>
                      <th className="px-2 py-2" />
                      <th className="px-3 py-2 text-left text-xs font-semibold text-text-secondary">Card B</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-text-secondary">Pools</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-text-secondary" title="% of decks containing both cards">% decks</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-text-secondary" title="% of decks with the rarer card that also have the other">Given rarer</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {topCardPairings.map((entry) => {
                      const metaA = displayRunData.cardMeta[entry.oracle_id_a ?? ''];
                      const metaB = displayRunData.cardMeta[entry.oracle_id_b ?? ''];
                      const artA = metaA?.imageUrl?.replace('/normal/', '/art_crop/') ?? '';
                      const artB = metaB?.imageUrl?.replace('/normal/', '/art_crop/') ?? '';
                      return (
                        <tr key={`${entry.oracle_id_a}|${entry.oracle_id_b}`} className="hover:bg-bg-accent/40">
                          <td className="px-2 py-1">
                            {artA && (
                              <div className="overflow-hidden rounded" style={{ width: 36, height: 36 }}>
                                <img src={artA} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2 font-medium text-text truncate">
                            {metaA ? renderAutocardNameLink(entry.oracle_id_a!, metaA.name, metaA.imageUrl) : entry.oracle_id_a}
                          </td>
                          <td className="px-2 py-1">
                            {artB && (
                              <div className="overflow-hidden rounded" style={{ width: 36, height: 36 }}>
                                <img src={artB} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2 font-medium text-text truncate">
                            {metaB ? renderAutocardNameLink(entry.oracle_id_b!, metaB.name, metaB.imageUrl) : entry.oracle_id_b}
                          </td>
                          <td className="px-3 py-2 text-right text-text-secondary">{entry.count}</td>
                          <td className="px-3 py-2 text-right text-text-secondary">{(entry.rawPct * 100).toFixed(1)}%</td>
                          <td className="px-3 py-2 text-right text-text-secondary">{(entry.pct * 100).toFixed(1)}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Col>
      </Row>
    )}
  <Text xs className="text-text-secondary text-right mt-4">
      Generated {new Date(displayRunData.generatedAt).toLocaleString()}
    </Text>
  </div>
  );
};

export default DraftSimulatorBottomSection;
