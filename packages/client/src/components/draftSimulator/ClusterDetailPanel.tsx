/* eslint-disable camelcase */
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { isManaFixingLand } from '@utils/cardutil';
import type CardType from '@utils/datatypes/Card';
import type { CardDetails } from '@utils/datatypes/Card';
import type {
  ArchetypeSkeleton,
  BuiltDeck,
  CardMeta,
  RankedCards,
  SkeletonCard,
  SlimPool,
} from '@utils/datatypes/SimulationReport';

import Text from '../base/Text';
import Link from '../base/Link';
import { Flexbox } from '../base/Layout';
import withAutocard from '../WithAutocard';
import { CSRFContext } from '../../contexts/CSRFContext';
import {
  buildOracleRemapping,
  loadDraftRecommender,
  localRecommend,
} from '../../utils/draftBot';
import { buildClusterRecommendationInput } from '../../utils/draftSimulatorClustering';
import { archetypeFullName } from '../../utils/draftSimulatorThemes';
import {
  COLOR_KEYS,
  CardTypeShareLegend,
  DeckColorShareChart,
  DeckColorShareLegend,
  ManaCurveShareChart,
  CardTypeShareChart,
  EloDistributionChart,
  getDeckShareColors,
  normalizeColorOrder,
} from './SimulatorCharts';

const AutocardLink = withAutocard(Link);

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


export const SkeletonCardImage: React.FC<{ card: SkeletonCard; size?: number; onCardClick?: (oracleId: string) => void }> = React.memo(({ card, size, onCardClick }) => (
  <AutocardLink
    href={`/tool/card/${encodeURIComponent(card.oracle_id)}`}
    className="relative block hover:opacity-95"
    style={size ? { width: size } : undefined}
    title={`${card.name} — ${(card.fraction * 100).toFixed(0)}% of pools`}
    card={{ details: autocardDetails(card.oracle_id, card.name, card.imageUrl) } as any}
    onClick={onCardClick ? (e: React.MouseEvent) => {
      if (window.matchMedia('(pointer: coarse)').matches) {
        e.preventDefault();
        onCardClick(card.oracle_id);
      }
    } : undefined}
  >
    {card.imageUrl ? (
      <img
        src={card.imageUrl}
        alt={card.name}
        className="w-full rounded border border-border shadow-sm"
        style={{ imageRendering: 'auto' }}
      />
    ) : (
      <div
        className="w-full flex items-center justify-center text-xs text-text-secondary bg-bg-accent rounded border border-border p-1 text-center shadow-sm"
        style={{ aspectRatio: '488 / 680' }}
      >
        {card.name}
      </div>
    )}
    <div
      className="absolute bottom-1 right-1 bg-black/70 text-white font-bold rounded px-1 py-0.5 leading-tight shadow-sm"
      style={{ fontSize: 9 }}
    >
      {(card.fraction * 100).toFixed(0)}%
    </div>
  </AutocardLink>
));

export const LinkedCardImage: React.FC<{ oracleId: string; name: string; imageUrl: string; size: number; onCardClick?: (oracleId: string) => void }> = ({
  oracleId,
  name,
  imageUrl,
  size,
  onCardClick,
}) => (
  <AutocardLink
    href={`/tool/card/${encodeURIComponent(oracleId)}`}
    className="relative flex-shrink-0 block hover:opacity-95"
    style={{ width: size }}
    card={{ details: autocardDetails(oracleId, name, imageUrl) } as any}
    onClick={onCardClick ? (e: React.MouseEvent) => {
      if (window.matchMedia('(pointer: coarse)').matches) {
        e.preventDefault();
        onCardClick(oracleId);
      }
    } : undefined}
  >
    <img src={imageUrl} alt={name} className="w-full rounded border border-border shadow-sm" />
  </AutocardLink>
);

/** Panel shown to the right of the Draft Map when a cluster is selected. */
const ClusterDetailPanel: React.FC<{
  skeleton: ArchetypeSkeleton;
  clusterIndex: number;
  totalPools: number;
  clusterDeckBuilds: BuiltDeck[] | null;
  cubeOracleSet: Set<string>;
  cardMeta: Record<string, CardMeta>;
  slimPools: SlimPool[];
  deckBuilds?: BuiltDeck[] | null;
  themes?: string[];
  poolArchetypeLabels?: Map<number, string> | null;
  excludeManaFixingLands: boolean;
  setExcludeManaFixingLands: (v: boolean) => void;
  onOpenPool: (poolIndex: number) => void;
  onCardClick?: (oracleId: string) => void;
  onClose: () => void;
}> = ({ skeleton, clusterIndex, totalPools, clusterDeckBuilds, cubeOracleSet, cardMeta, slimPools, deckBuilds, themes, poolArchetypeLabels, excludeManaFixingLands, setExcludeManaFixingLands, onOpenPool, onCardClick, onClose }) => {
  const { csrfFetch } = useContext(CSRFContext);

  // Compute actual color profile from deck color shares (≥10% threshold)
  const colorProfile = useMemo(() => {
    if (!clusterDeckBuilds || clusterDeckBuilds.length === 0) return normalizeColorOrder(skeleton.colorProfile);
    const shares: Record<string, number> = Object.fromEntries(COLOR_KEYS.map((k) => [k, 0]));
    for (const deck of clusterDeckBuilds) {
      for (const oracle of deck.mainboard) {
        const colors = getDeckShareColors(oracle, cardMeta).filter((c) => c !== 'C');
        if (colors.length === 0) continue;
        const share = 1 / colors.length;
        for (const c of colors) shares[c] = (shares[c] ?? 0) + share;
      }
    }
    const total = COLOR_KEYS.reduce((s, k) => s + (shares[k] ?? 0), 0);
    if (total === 0) return 'C';
    const significant = COLOR_KEYS.filter((k) => (shares[k] ?? 0) / total >= 0.1);
    return significant.length > 0 ? significant.join('') : 'C';
  }, [clusterDeckBuilds, cardMeta, skeleton.colorProfile]);

  const CARD_TABS = [
    { key: 'staples', label: 'Staples', title: 'Cards drafted most often across decks in this cluster' },
    { key: 'identity', label: 'Identity', title: 'Cards most representative of this cluster — appear in >5% of cluster decks, sorted by closeness to the cluster centroid' },
    { key: 'exemplary', label: 'Exemplary Deck', title: 'A real deck from this cluster chosen to best match the cluster\u2019s representative high-priority card bucket' },
    { key: 'recommendations', label: 'Recommendations', title: 'Use the cluster as a local recommender seed and suggest cards that would strengthen it' },
  ] as const;
  type CardTab = typeof CARD_TABS[number]['key'];
  const [cardTab, setCardTab] = useState<CardTab>('staples');

  // Greedy co-occurrence chain: each card is chosen because it appears alongside
  // ALL previously selected cards as often as possible.
  const hasDecks = deckBuilds && deckBuilds.length === slimPools.length;

  const exemplaryDeck = useMemo(() => {
    if (cardTab !== 'exemplary' || !hasDecks) return null;

    const representativeWeights = new Map<string, number>();
    const representativeTopN = 12;

    for (const poolIndex of skeleton.poolIndices) {
      const deck = deckBuilds?.[poolIndex];
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

    let best:
      | {
          poolIndex: number;
          deck: BuiltDeck;
          score: number;
          overlap: number;
          topCards: string[];
        }
      | null = null;

    for (const poolIndex of skeleton.poolIndices) {
      const deck = deckBuilds?.[poolIndex];
      if (!deck) continue;
      const mainboardSet = new Set(deck.mainboard);
      let score = 0;
      let overlap = 0;
      for (const [oracle, weight] of representativeWeights) {
        if (!mainboardSet.has(oracle)) continue;
        score += weight;
        overlap += 1;
      }

      const topCards =
        deck.deckbuildRatings && deck.deckbuildRatings.length > 0
          ? deck.deckbuildRatings.filter((entry) => mainboardSet.has(entry.oracle)).slice(0, 8).map((entry) => entry.oracle)
          : deck.mainboard.slice(0, 8);

      if (!best || score > best.score || (score === best.score && overlap > best.overlap)) {
        best = { poolIndex, deck, score, overlap, topCards };
      }
    }

    return best;
  }, [cardTab, cardMeta, deckBuilds, hasDecks, skeleton.poolIndices]);

  const recommendationInput = useMemo(
    () => buildClusterRecommendationInput(skeleton, slimPools, cardMeta, deckBuilds),
    [skeleton, slimPools, cardMeta, deckBuilds],
  );
  const recommendationInputOracles = useMemo(() => recommendationInput.seedOracles, [recommendationInput]);
  const recommendationInputThreshold = useMemo(
    () => (cardTab === 'recommendations' ? recommendationInput.minSeedCount : 0),
    [cardTab, recommendationInput],
  );

  type ClusterRecommendation = { oracle: string; rating: number; details: CardDetails };
  const [clusterRecommendations, setClusterRecommendations] = useState<ClusterRecommendation[]>([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [recommendationsError, setRecommendationsError] = useState<string | null>(null);

  const pickList = useCallback(
    (r: RankedCards | SkeletonCard[] | undefined): SkeletonCard[] => {
      if (!r) return [];
      // Legacy cached skeletons may still hold a flat SkeletonCard[] from before
      // RankedCards landed. Treat those as the "default" list — rescoreSkeletons
      // will replace them with the new shape on the next render.
      if (Array.isArray(r)) return r;
      return excludeManaFixingLands ? r.excludingFixing : r.default;
    },
    [excludeManaFixingLands],
  );
  const visibleCommonCards = pickList(skeleton.coreCards);
  const visibleIdentityCards = pickList(skeleton.identityCards);

  const visibleClusterRecommendations = useMemo(() => {
    const list = excludeManaFixingLands
      ? clusterRecommendations.filter((item) => !isManaFixingLand(item.details))
      : clusterRecommendations;
    return list.slice(0, 24);
  }, [clusterRecommendations, excludeManaFixingLands]);

  useEffect(() => {
    let cancelled = false;

    if (cardTab !== 'recommendations') {
      return () => {
        cancelled = true;
      };
    }
    if (recommendationInputOracles.length === 0) {
      setClusterRecommendations([]);
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
        const resolvedAdds = skeleton.recommendedAdds
          ? skeleton.recommendedAdds
          : (() => {
              throw new Error('missing-precomputed-recommendations');
            })();
        if (cancelled) return;
        if (resolvedAdds.length === 0) {
          setClusterRecommendations([]);
          setRecommendationsLoading(false);
          return;
        }

        const candidateOracles = resolvedAdds.slice(0, 120).map((item) => item.oracle);
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

        const filtered = resolvedAdds
          .filter((item) => !cubeOracleSet.has(item.oracle))
          .map((item) => ({ ...item, details: detailsByOracle.get(item.oracle) }))
          .filter(
            (item): item is ClusterRecommendation =>
              !!item.details &&
              !item.details.isToken &&
              !(item.details.type?.includes('Basic') && item.details.type?.includes('Land')),
          );

        setClusterRecommendations(filtered);
      } catch (err) {
        if (cancelled) return;
        if (!(err instanceof Error) || err.message !== 'missing-precomputed-recommendations') {
          console.error('Failed to load cluster recommendations:', err);
          setClusterRecommendations([]);
          setRecommendationsError('Unable to generate recommendations for this cluster.');
          return;
        }

        try {
          await loadDraftRecommender();
          const remapping = buildOracleRemapping(cardMeta);
          const { adds } = await localRecommend(recommendationInputOracles, remapping);
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
              (item): item is ClusterRecommendation =>
                !!item.details &&
                !item.details.isToken &&
                !(item.details.type?.includes('Basic') && item.details.type?.includes('Land')),
            );

          setClusterRecommendations(filtered);
        } catch (fallbackErr) {
          if (cancelled) return;
          console.error('Failed to load cluster recommendations:', fallbackErr);
          setClusterRecommendations([]);
          setRecommendationsError('Unable to generate recommendations for this cluster.');
        }
      } finally {
        if (!cancelled) setRecommendationsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cardMeta, cardTab, csrfFetch, cubeOracleSet, recommendationInputOracles, skeleton.recommendedAdds]);

  const colorCodes = COLOR_KEYS.filter((c) => colorProfile.includes(c));
  const pct = totalPools > 0 ? ((skeleton.poolCount / totalPools) * 100).toFixed(1) : '0';

  // Top Gwen archetype labels within this cluster
  const clusterArchetypes = useMemo(() => {
    if (!poolArchetypeLabels) return [];
    const counts = new Map<string, number>();
    for (const pi of skeleton.poolIndices) {
      const label = poolArchetypeLabels.get(pi);
      if (label) counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [poolArchetypeLabels, skeleton.poolIndices]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 pt-2">
          <div>
            <div><Text semibold className="text-lg leading-snug">
              {clusterArchetypes.length > 0
                ? `${colorProfile && colorProfile !== 'C' ? `${colorProfile} ` : ''}${clusterArchetypes[0]![0]}`
                : archetypeFullName(colorProfile)}
            </Text></div>
            <div><Text xs className="text-text-secondary">
              Cluster {clusterIndex + 1} · {skeleton.poolCount} seats · {pct}%
            </Text></div>
          </div>
          {themes && themes.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {themes.map((theme) => (
                <span
                  key={theme}
                  className="inline-flex text-[10px] bg-bg-accent border border-border/60 rounded px-1.5 py-0.5 text-text-secondary"
                >
                  {theme}
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
                title={tab.title}
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
        {cardTab === 'staples' && (
          <div className="flex flex-col gap-3">
            <div className="flex justify-end">
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
            {visibleCommonCards.length > 0 ? (
              <div className="grid grid-cols-4 md:grid-cols-6 gap-1.5">
                {visibleCommonCards.slice(0, 12).map((card) => (
                  <SkeletonCardImage key={card.oracle_id} card={card} onCardClick={onCardClick} />
                ))}
              </div>
            ) : (
              <Text sm className="text-text-secondary">No common cards remain after filtering.</Text>
            )}
          </div>
        )}
        {cardTab === 'identity' && (
          <div className="flex flex-col gap-3">
            <div className="flex justify-end">
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
            {visibleIdentityCards.length > 0 ? (
              <div className="grid grid-cols-4 md:grid-cols-6 gap-1.5">
                {visibleIdentityCards.slice(0, 12).map((card) => (
                  <SkeletonCardImage key={card.oracle_id} card={card} onCardClick={onCardClick} />
                ))}
              </div>
            ) : (
              <Text sm className="text-text-secondary">
                {(skeleton.identityCards?.default.length ?? 0) === 0
                  ? 'No identity cards found for this cluster.'
                  : 'No identity cards remain after filtering.'}
              </Text>
            )}
          </div>
        )}
        {cardTab === 'exemplary' && (
          <div className="flex flex-col gap-3">
            {exemplaryDeck ? (
              <div className="rounded-lg border border-link/30 bg-link/5 px-4 py-4 flex flex-col items-center gap-2 text-center">
                <Text semibold lg className="text-text">
                  Draft {slimPools[exemplaryDeck.poolIndex]!.draftIndex + 1} · Seat {slimPools[exemplaryDeck.poolIndex]!.seatIndex + 1}
                </Text>
                <Text xs className="text-text-secondary">
                  Matches {exemplaryDeck.overlap} representative cards from the cluster bucket.
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
            )}
          </div>
        )}
        {cardTab === 'recommendations' && (
          <div className="flex flex-col gap-4">
            <div className="rounded border border-border/60 bg-bg-accent/30 p-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <Text xs className="text-text-secondary">
                  Using {recommendationInputOracles.length} cluster cards as the seed set.
                  {recommendationInputThreshold > 0
                    ? ` Seed cards appear in at least ${recommendationInputThreshold} decks when possible.`
                    : ''}
                </Text>
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
            </div>
            <div>
              <Text xs className="text-text-secondary font-medium uppercase tracking-wider mb-1.5">
                Recommended Additions
              </Text>
              {recommendationsLoading ? (
                <Text sm className="text-text-secondary">Generating recommendations…</Text>
              ) : recommendationsError ? (
                <Text sm className="text-text-secondary">{recommendationsError}</Text>
              ) : visibleClusterRecommendations.length > 0 ? (
                <div className="grid grid-cols-4 md:grid-cols-6 gap-1.5">
                  {visibleClusterRecommendations.map((item) => (
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
                  {clusterRecommendations.length > 0
                    ? 'No recommendations remain after filtering.'
                    : 'No recommendations returned for this cluster.'}
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
            <DeckColorShareChart deckBuilds={clusterDeckBuilds} cardMeta={cardMeta} />
          </div>
          <div className="md:hidden">
            <DeckColorShareLegend deckBuilds={clusterDeckBuilds} cardMeta={cardMeta} />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <Text xs className="text-text-secondary font-medium uppercase tracking-wider mb-1.5">Card Types</Text>
          <div className="hidden md:block">
            <CardTypeShareChart deckBuilds={clusterDeckBuilds} cardMeta={cardMeta} />
          </div>
          <div className="md:hidden">
            <CardTypeShareLegend deckBuilds={clusterDeckBuilds} cardMeta={cardMeta} />
          </div>
        </div>
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          <div>
            <Text xs className="text-text-secondary font-medium uppercase tracking-wider mb-1.5">Mana Curve Share</Text>
            <ManaCurveShareChart deckBuilds={clusterDeckBuilds} cardMeta={cardMeta} />
          </div>
          <div>
            <Text xs className="text-text-secondary font-medium uppercase tracking-wider mb-1.5">Elo Distribution</Text>
            <EloDistributionChart deckBuilds={clusterDeckBuilds} cardMeta={cardMeta} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClusterDetailPanel;
