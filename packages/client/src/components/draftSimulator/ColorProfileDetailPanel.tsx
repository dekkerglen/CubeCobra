/* eslint-disable camelcase */
import React, { useContext, useEffect, useMemo, useState } from 'react';

import { isManaFixingLand } from '@utils/cardutil';
import type CardType from '@utils/datatypes/Card';
import type { CardDetails } from '@utils/datatypes/Card';
import type {
  ArchetypeSkeleton,
  BuiltDeck,
  CardMeta,
  SkeletonCard,
  SlimPool,
} from '@utils/datatypes/SimulationReport';

import Link from '../base/Link';
import Text from '../base/Text';
import withAutocard from '../WithAutocard';
import { CSRFContext } from '../../contexts/CSRFContext';
import { buildOracleRemapping, loadDraftRecommender, localRecommend } from '../../utils/draftBot';
import { buildClusterRecommendationInput } from '../../utils/draftSimulatorClustering';
import { archetypeFullName } from '../../utils/draftSimulatorThemes';
import {
  CardTypeShareChart,
  CardTypeShareLegend,
  DeckColorShareChart,
  DeckColorShareLegend,
  EloDistributionChart,
  ManaCurveShareChart,
} from './SimulatorCharts';
import { SkeletonCardImage } from './ClusterDetailPanel';

const AutocardLink = withAutocard(Link);

type ColorProfileRecommendation = { oracle: string; rating: number; details: CardDetails };

const CARD_TABS = [
  { key: 'staples', label: 'Staples' },
  { key: 'distinct', label: 'Distinct' },
  { key: 'exemplary', label: 'Exemplary Deck' },
  { key: 'recommendations', label: 'Recommendations' },
] as const;

type CardTab = typeof CARD_TABS[number]['key'];

function isBasicLandOracle(oracleId: string, cardMeta: Record<string, CardMeta>): boolean {
  const type = cardMeta[oracleId]?.type ?? '';
  return type.includes('Basic') && type.includes('Land');
}

function isFixingOracle(oracleId: string, cardMeta: Record<string, CardMeta>): boolean {
  return !!cardMeta[oracleId]?.isManaFixingLand;
}

function buildRankedCards(
  poolIndices: number[],
  slimPools: SlimPool[],
  cardMeta: Record<string, CardMeta>,
  deckBuilds?: BuiltDeck[] | null,
): SkeletonCard[] {
  const hasDecks = !!(deckBuilds && deckBuilds.length === slimPools.length);
  const counts = new Map<string, number>();
  const total = poolIndices.length || 1;

  for (const poolIndex of poolIndices) {
    const cards = hasDecks
      ? deckBuilds?.[poolIndex]?.mainboard ?? []
      : slimPools[poolIndex]?.picks.map((pick) => pick.oracle_id) ?? [];
    for (const oracle of new Set(cards)) {
      if (isBasicLandOracle(oracle, cardMeta)) continue;
      counts.set(oracle, (counts.get(oracle) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([oracle_id, count]) => ({
      oracle_id,
      name: cardMeta[oracle_id]?.name ?? oracle_id,
      imageUrl: cardMeta[oracle_id]?.imageUrl ?? '',
      fraction: count / total,
    }))
    .filter((card) => card.fraction > 0)
    .sort((a, b) => b.fraction - a.fraction || a.name.localeCompare(b.name));
}

function buildDistinctCards(
  poolIndices: number[],
  slimPools: SlimPool[],
  cardMeta: Record<string, CardMeta>,
  deckBuilds?: BuiltDeck[] | null,
): SkeletonCard[] {
  const hasDecks = !!(deckBuilds && deckBuilds.length === slimPools.length);
  const subsetSet = new Set(poolIndices);
  const subsetCounts = new Map<string, number>();
  const globalCounts = new Map<string, number>();
  const subsetTotal = poolIndices.length || 1;
  const globalTotal = slimPools.length || 1;
  const eps = 1e-6;

  for (let poolIndex = 0; poolIndex < slimPools.length; poolIndex++) {
    const cards = hasDecks
      ? deckBuilds?.[poolIndex]?.mainboard ?? []
      : slimPools[poolIndex]?.picks.map((pick) => pick.oracle_id) ?? [];
    for (const oracle of new Set(cards)) {
      if (isBasicLandOracle(oracle, cardMeta)) continue;
      globalCounts.set(oracle, (globalCounts.get(oracle) ?? 0) + 1);
      if (subsetSet.has(poolIndex)) subsetCounts.set(oracle, (subsetCounts.get(oracle) ?? 0) + 1);
    }
  }

  const coreIds = new Set(buildRankedCards(poolIndices, slimPools, cardMeta, deckBuilds).slice(0, 12).map((card) => card.oracle_id));
  const otherTotal = Math.max(1, globalTotal - subsetTotal);

  return [...subsetCounts.entries()]
    .map(([oracle_id, subsetCount]) => {
      const fraction = subsetCount / subsetTotal;
      const otherCount = (globalCounts.get(oracle_id) ?? subsetCount) - subsetCount;
      const otherFraction = otherCount / otherTotal;
      const lift = fraction / (otherFraction + eps);
      const score = fraction * Math.log1p(lift);
      return {
        oracle_id,
        name: cardMeta[oracle_id]?.name ?? oracle_id,
        imageUrl: cardMeta[oracle_id]?.imageUrl ?? '',
        fraction,
        score,
      };
    })
    .filter((card) => card.fraction > 0.1 && !coreIds.has(card.oracle_id))
    .sort((a, b) => b.score - a.score || b.fraction - a.fraction)
    .map(({ score: _score, ...card }) => card);
}

const ColorProfileDetailPanel: React.FC<{
  colorPair: string;
  poolIndices: number[];
  totalPools: number;
  subsetDeckBuilds: BuiltDeck[] | null;
  cubeOracleSet: Set<string>;
  cardMeta: Record<string, CardMeta>;
  slimPools: SlimPool[];
  deckBuilds?: BuiltDeck[] | null;
  topArchetypeLabels?: string[];
  excludeManaFixingLands: boolean;
  setExcludeManaFixingLands: (v: boolean) => void;
  onOpenPool: (poolIndex: number) => void;
  onCardClick?: (oracleId: string) => void;
  onClose: () => void;
}> = ({
  colorPair,
  poolIndices,
  totalPools,
  subsetDeckBuilds,
  cubeOracleSet,
  cardMeta,
  slimPools,
  deckBuilds,
  topArchetypeLabels,
  excludeManaFixingLands,
  setExcludeManaFixingLands,
  onOpenPool,
  onCardClick,
  onClose,
}) => {
  const { csrfFetch } = useContext(CSRFContext);
  const [cardTab, setCardTab] = useState<CardTab>('staples');
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [recommendationsError, setRecommendationsError] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<ColorProfileRecommendation[]>([]);

  const commonCards = useMemo(() => buildRankedCards(poolIndices, slimPools, cardMeta, deckBuilds), [poolIndices, slimPools, cardMeta, deckBuilds]);
  const distinctCards = useMemo(
    () => buildDistinctCards(poolIndices, slimPools, cardMeta, deckBuilds),
    [poolIndices, slimPools, cardMeta, deckBuilds],
  );

  const pseudoSkeleton = useMemo(
    () =>
      ({
        clusterId: -1,
        colorProfile: colorPair,
        poolCount: poolIndices.length,
        poolIndices,
        coreCards: { default: commonCards, excludingFixing: commonCards.filter((card) => !isFixingOracle(card.oracle_id, cardMeta)) },
        distinctCards: {
          default: distinctCards,
          excludingFixing: distinctCards.filter((card) => !isFixingOracle(card.oracle_id, cardMeta)),
        },
        occasionalCards: [],
        sideboardCards: [],
        lockPairs: [],
      } as ArchetypeSkeleton),
    [colorPair, poolIndices, commonCards, distinctCards, cardMeta],
  );

  const visibleCommonCards = useMemo(
    () => (excludeManaFixingLands ? pseudoSkeleton.coreCards.excludingFixing : pseudoSkeleton.coreCards.default),
    [excludeManaFixingLands, pseudoSkeleton],
  );
  const visibleDistinctCards = useMemo(
    () =>
      excludeManaFixingLands
        ? pseudoSkeleton.distinctCards?.excludingFixing ?? []
        : pseudoSkeleton.distinctCards?.default ?? [],
    [excludeManaFixingLands, pseudoSkeleton],
  );

  const exemplaryDeck = useMemo(() => {
    if (cardTab !== 'exemplary' || !deckBuilds || deckBuilds.length !== slimPools.length) return null;

    const representativeWeights = new Map<string, number>();
    const representativeTopN = 12;

    for (const poolIndex of poolIndices) {
      const deck = deckBuilds[poolIndex];
      if (!deck) continue;
      const mainboardSet = new Set(deck.mainboard);
      const ranked =
        deck.deckbuildRatings && deck.deckbuildRatings.length > 0
          ? deck.deckbuildRatings.filter((entry) => mainboardSet.has(entry.oracle)).slice(0, representativeTopN)
          : deck.mainboard.slice(0, representativeTopN).map((oracle, index) => ({ oracle, rating: representativeTopN - index }));

      ranked.forEach((entry, index) => {
        const rankWeight = (representativeTopN - index) / representativeTopN;
        representativeWeights.set(entry.oracle, (representativeWeights.get(entry.oracle) ?? 0) + rankWeight);
      });
    }

    let best: { poolIndex: number; deck: BuiltDeck; score: number; overlap: number } | null = null;
    for (const poolIndex of poolIndices) {
      const deck = deckBuilds[poolIndex];
      if (!deck) continue;
      const mainboardSet = new Set(deck.mainboard);
      let score = 0;
      let overlap = 0;
      for (const [oracle, weight] of representativeWeights) {
        if (!mainboardSet.has(oracle)) continue;
        score += weight;
        overlap += 1;
      }
      if (!best || score > best.score || (score === best.score && overlap > best.overlap)) {
        best = { poolIndex, deck, score, overlap };
      }
    }
    return best;
  }, [cardTab, deckBuilds, slimPools.length, poolIndices]);

  const recommendationInput = useMemo(
    () => buildClusterRecommendationInput(pseudoSkeleton, slimPools, cardMeta, deckBuilds),
    [pseudoSkeleton, slimPools, cardMeta, deckBuilds],
  );

  useEffect(() => {
    let cancelled = false;
    if (cardTab !== 'recommendations') return () => { cancelled = true; };
    if (recommendationInput.seedOracles.length === 0) {
      setRecommendations([]);
      setRecommendationsError(null);
      setRecommendationsLoading(false);
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      setRecommendationsLoading(true);
      setRecommendationsError(null);
      try {
        await loadDraftRecommender();
        const remapping = buildOracleRemapping(cardMeta);
        const { adds } = await localRecommend(recommendationInput.seedOracles, remapping);
        if (cancelled) return;

        const candidateOracles = adds.slice(0, 120).map((item) => item.oracle);
        const response = await csrfFetch('/cube/api/getdetailsforcards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cards: candidateOracles }),
        });
        if (!response.ok) throw new Error(`Failed to load recommendation details: ${response.status}`);
        const data = await response.json();
        if (cancelled) return;

        const detailsByOracle = new Map<string, CardDetails>();
        const detailsList: CardDetails[] = Array.isArray(data?.details) ? data.details : [];
        for (const details of detailsList) {
          if (details?.oracle_id) detailsByOracle.set(details.oracle_id, details);
        }

        const filtered = adds
          .filter((item) => !cubeOracleSet.has(item.oracle))
          .map((item) => ({ ...item, details: detailsByOracle.get(item.oracle) }))
          .filter(
            (item): item is ColorProfileRecommendation =>
              !!item.details &&
              !item.details.isToken &&
              !(item.details.type?.includes('Basic') && item.details.type?.includes('Land')),
          );

        setRecommendations(filtered);
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to load color profile recommendations:', err);
        setRecommendations([]);
        setRecommendationsError('Unable to generate recommendations for this color profile.');
      } finally {
        if (!cancelled) setRecommendationsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [cardTab, recommendationInput.seedOracles, cardMeta, cubeOracleSet, csrfFetch]);

  const visibleRecommendations = useMemo(
    () =>
      (excludeManaFixingLands
        ? recommendations.filter((item) => !isManaFixingLand(item.details))
        : recommendations
      ).slice(0, 24),
    [recommendations, excludeManaFixingLands],
  );

  const pct = totalPools > 0 ? ((poolIndices.length / totalPools) * 100).toFixed(1) : '0';

  return (
    <div className="rounded-lg border border-border bg-bg px-4 py-4 flex flex-col gap-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 pt-2">
          <div>
            <div><Text semibold className="text-lg leading-snug">{archetypeFullName(colorPair)}</Text></div>
            <div><Text xs className="text-text-secondary">{poolIndices.length} seats · {pct}%</Text></div>
          </div>
          {topArchetypeLabels && topArchetypeLabels.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {topArchetypeLabels.map((label) => (
                <span
                  key={label}
                  className="inline-flex text-[10px] bg-bg-accent border border-border/60 rounded px-1.5 py-0.5 text-text-secondary"
                >
                  {label}
                </span>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="px-2 py-0.5 rounded text-xs font-medium border bg-bg text-text-secondary border-border hover:bg-bg-active flex-shrink-0"
        >
          ✕
        </button>
      </div>

      <div>
        <div className="mb-3 overflow-x-auto border-b border-border">
          <div className="flex min-w-max flex-row">
            {CARD_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setCardTab(tab.key)}
                className={[
                  'flex-shrink-0 whitespace-nowrap px-3 py-1.5 text-xs font-medium border-b-2 -mb-px transition-colors',
                  cardTab === tab.key
                    ? 'border-link text-link'
                    : 'border-transparent text-text-secondary hover:text-text hover:border-border',
                ].join(' ')}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {(cardTab === 'staples' || cardTab === 'distinct' || cardTab === 'recommendations') && (
          <div className="flex justify-end mb-3">
            <label className="inline-flex items-center gap-2 text-xs text-text-secondary">
              <input
                type="checkbox"
                checked={excludeManaFixingLands}
                onChange={(event) => setExcludeManaFixingLands(event.target.checked)}
                title="Hides duals, shocks, triomes, fetches, Mana Confluence, Evolving Wilds, etc. Utility lands like Wasteland and Mutavault still appear."
              />
              Hide mana-fixing lands
            </label>
          </div>
        )}

        {cardTab === 'staples' && (
          visibleCommonCards.length > 0 ? (
            <div className="grid grid-cols-4 md:grid-cols-6 gap-1.5">
              {visibleCommonCards.slice(0, 12).map((card) => (
                <SkeletonCardImage key={card.oracle_id} card={card} onCardClick={onCardClick} />
              ))}
            </div>
          ) : (
            <Text sm className="text-text-secondary">No staple cards remain after filtering.</Text>
          )
        )}

        {cardTab === 'distinct' && (
          visibleDistinctCards.length > 0 ? (
            <div className="grid grid-cols-4 md:grid-cols-6 gap-1.5">
              {visibleDistinctCards.slice(0, 12).map((card) => (
                <SkeletonCardImage key={card.oracle_id} card={card} onCardClick={onCardClick} />
              ))}
            </div>
          ) : (
            <Text sm className="text-text-secondary">No distinct cards found for this color profile.</Text>
          )
        )}

        {cardTab === 'exemplary' && (
          exemplaryDeck ? (
            <div className="rounded-lg border border-link/30 bg-link/5 px-4 py-4 flex flex-col items-center gap-2 text-center">
              <Text semibold lg className="text-text">
                Draft {slimPools[exemplaryDeck.poolIndex]!.draftIndex + 1} · Seat {slimPools[exemplaryDeck.poolIndex]!.seatIndex + 1}
              </Text>
              <Text xs className="text-text-secondary">
                Matches {exemplaryDeck.overlap} representative cards from this color bucket.
              </Text>
              <button
                type="button"
                onClick={() => onOpenPool(exemplaryDeck.poolIndex)}
                className="mt-1 px-4 py-2 rounded-md text-sm font-semibold bg-link text-white border border-link hover:bg-link-active"
              >
                View Exemplary Deck
              </button>
            </div>
          ) : (
            <Text sm className="text-text-secondary">Deck builds are required to show an exemplary deck.</Text>
          )
        )}

        {cardTab === 'recommendations' && (
          <div className="flex flex-col gap-4">
            <div className="rounded border border-border/60 bg-bg-accent/30 p-3">
              <Text xs className="text-text-secondary">
                Using {recommendationInput.seedOracles.length} cards from this color profile as the seed set.
                {recommendationInput.minSeedCount > 0
                  ? ` Seed cards appear in at least ${recommendationInput.minSeedCount} decks when possible.`
                  : ''}
              </Text>
            </div>
            <div>
              <Text xs className="text-text-secondary font-medium uppercase tracking-wider mb-1.5">
                Recommended Additions
              </Text>
              {recommendationsLoading ? (
                <Text sm className="text-text-secondary">Generating recommendations…</Text>
              ) : recommendationsError ? (
                <Text sm className="text-text-secondary">{recommendationsError}</Text>
              ) : visibleRecommendations.length > 0 ? (
                <div className="grid grid-cols-4 md:grid-cols-6 gap-1.5">
                  {visibleRecommendations.map((item) => (
                    <AutocardLink
                      key={item.oracle}
                      href={`/tool/card/${encodeURIComponent(item.oracle)}`}
                      className="relative block hover:opacity-95"
                      title={item.details.name}
                      card={{ cardID: item.oracle, details: item.details } as CardType}
                    >
                      <img
                        src={item.details.image_normal || `/tool/cardimage/${encodeURIComponent(item.oracle)}`}
                        alt={item.details.name}
                        className="w-full rounded border border-border shadow-sm"
                        style={{ imageRendering: 'auto' }}
                      />
                    </AutocardLink>
                  ))}
                </div>
              ) : (
                <Text sm className="text-text-secondary">
                  {recommendations.length > 0
                    ? 'No recommendations remain after filtering.'
                    : 'No recommendations returned for this color profile.'}
                </Text>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:flex-wrap">
        <div className="flex-1 min-w-0">
          <Text xs className="text-text-secondary font-medium uppercase tracking-wider mb-1.5">Deck Color Share</Text>
          <div className="hidden md:block">
            <DeckColorShareChart deckBuilds={subsetDeckBuilds} cardMeta={cardMeta} />
          </div>
          <div className="md:hidden">
            <DeckColorShareLegend deckBuilds={subsetDeckBuilds} cardMeta={cardMeta} />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <Text xs className="text-text-secondary font-medium uppercase tracking-wider mb-1.5">Card Types</Text>
          <div className="hidden md:block">
            <CardTypeShareChart deckBuilds={subsetDeckBuilds} cardMeta={cardMeta} />
          </div>
          <div className="md:hidden">
            <CardTypeShareLegend deckBuilds={subsetDeckBuilds} cardMeta={cardMeta} />
          </div>
        </div>
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          <div>
            <Text xs className="text-text-secondary font-medium uppercase tracking-wider mb-1.5">Mana Curve Share</Text>
            <ManaCurveShareChart deckBuilds={subsetDeckBuilds} cardMeta={cardMeta} />
          </div>
          <div>
            <Text xs className="text-text-secondary font-medium uppercase tracking-wider mb-1.5">Elo Distribution</Text>
            <EloDistributionChart deckBuilds={subsetDeckBuilds} cardMeta={cardMeta} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ColorProfileDetailPanel;
