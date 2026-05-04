/* eslint-disable no-plusplus */
import React, { useEffect, useMemo, useState } from 'react';

import type {
  ArchetypeSkeleton,
  BuiltDeck,
  CardMeta,
  SimulatedPickCard,
  SimulatedPool,
  SimulationRunData,
} from '@utils/datatypes/SimulationReport';

import Input from '../base/Input';
import { Flexbox } from '../base/Layout';
import Text from '../base/Text';
import { RowColorShare, COLOR_KEYS, MANA_CURVE_BUCKETS, MTG_COLORS } from './SimulatorCharts';
import { CMC_COLS } from './SimDeckView';
import { archetypeFullName } from '../../utils/draftSimulatorThemes';
import { getPoolMainCards, inferDraftThemes } from '../../utils/draftSimulatorThemes';

const POOL_PAGE_SIZE = 10;

type DraftBreakdownSortKey = 'draft' | 'seat' | 'color' | 'creatures' | 'avgMv';
type DeckLocationFilter = 'all' | 'deck' | 'sideboard';

interface DraftBreakdownRowSummary {
  pool: SimulatedPool;
  deck: BuiltDeck | null;
  colors: string;
  themes: string[];
  highlights: SimulatedPickCard[];
  creatureCount: number;
  nonCreatureCount: number;
  landCount: number;
  creatureCurveCounts: number[];
  nonCreatureCurveCounts: number[];
  avgMv: number;
}

function getColorProfileCodes(colorPair: string): string[] {
  const letters = colorPair.split('').filter((c) => c in MTG_COLORS && c !== 'C' && c !== 'M');
  return letters.length === 0 ? ['C'] : letters;
}

export function getDraftComposition(
  pool: SimulatedPool,
  deck: BuiltDeck | null,
  cardMeta: Record<string, CardMeta>,
): Pick<
  DraftBreakdownRowSummary,
  'creatureCount' | 'nonCreatureCount' | 'landCount' | 'creatureCurveCounts' | 'nonCreatureCurveCounts' | 'avgMv'
> {
  const creatureCurveCounts = Array.from({ length: CMC_COLS }, () => 0);
  const nonCreatureCurveCounts = Array.from({ length: CMC_COLS }, () => 0);
  let creatureCount = 0;
  let nonCreatureCount = 0;
  let landCount = 0;
  let totalMv = 0;
  let mvCount = 0;

  for (const oracleId of getPoolMainCards(pool, deck, cardMeta)) {
    const meta = cardMeta[oracleId];
    const typeLower = (meta?.type ?? '').toLowerCase();
    if (typeLower.includes('land')) {
      landCount++;
      continue;
    }

    const cmc = Math.max(0, Math.floor(meta?.cmc ?? 0));
    const bucket = Math.min(CMC_COLS - 1, cmc);
    if (typeLower.includes('creature')) {
      creatureCount++;
      creatureCurveCounts[bucket]!++;
    } else {
      nonCreatureCount++;
      nonCreatureCurveCounts[bucket]!++;
    }
    totalMv += meta?.cmc ?? 0;
    mvCount++;
  }

  return {
    creatureCount,
    nonCreatureCount,
    landCount,
    creatureCurveCounts,
    nonCreatureCurveCounts,
    avgMv: mvCount > 0 ? totalMv / mvCount : 0,
  };
}

export function getDraftHighlights(
  pool: SimulatedPool,
  deck: BuiltDeck | null,
  cardMeta: Record<string, CardMeta>,
): SimulatedPickCard[] {
  const picksByOracle = new Map(pool.picks.map((pick) => [pick.oracle_id, pick]));
  const seen = new Set<string>();
  const cards = getPoolMainCards(pool, deck, cardMeta)
    .filter((oracleId) => {
      if (seen.has(oracleId)) return false;
      seen.add(oracleId);
      const typeLower = (cardMeta[oracleId]?.type ?? '').toLowerCase();
      return !typeLower.includes('basic land');
    })
    .sort((a, b) => (cardMeta[b]?.elo ?? 0) - (cardMeta[a]?.elo ?? 0))
    .slice(0, 8);

  return cards.map((oracleId) => {
    const meta = cardMeta[oracleId];
    return (
      picksByOracle.get(oracleId) ?? {
        oracle_id: oracleId,
        name: meta?.name ?? oracleId,
        imageUrl: meta?.imageUrl ?? '',
        packNumber: 0,
        pickNumber: 0,
      }
    );
  });
}

export function buildDraftBreakdownRowSummary(
  pool: SimulatedPool,
  deck: BuiltDeck | null,
  cardMeta: Record<string, CardMeta>,
  clusterThemes?: Map<number, { tag: string; lift: number }[]>,
  tagAllowlist?: Set<string>,
): DraftBreakdownRowSummary {
  const composition = getDraftComposition(pool, deck, cardMeta);
  return {
    pool,
    deck,
    colors: pool.archetype,
    themes: inferDraftThemes(pool, deck, cardMeta, clusterThemes, tagAllowlist),
    highlights: getDraftHighlights(pool, deck, cardMeta),
    ...composition,
  };
}

export const ColorPips: React.FC<{ colors: string }> = React.memo(({ colors }) => (
  <span className="inline-flex items-center" style={{ gap: 3 }} title={archetypeFullName(colors)}>
    {getColorProfileCodes(colors).map((color) => (
      <span
        key={color}
        className="inline-flex items-center justify-center text-[10px] font-extrabold"
        style={{
          width: 24,
          height: 24,
          borderRadius: 6,
          background: MTG_COLORS[color]?.bg ?? MTG_COLORS.C!.bg,
          color: 'rgba(17,24,39,0.85)',
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.22), 0 1px 2px rgba(0,0,0,0.12)',
          flexShrink: 0,
        }}
      >
        {color}
      </span>
    ))}
  </span>
));

export const TinyCurve: React.FC<{ creatureCounts: number[]; nonCreatureCounts: number[] }> = ({
  creatureCounts,
  nonCreatureCounts,
}) => {
  const max = Math.max(...creatureCounts, ...nonCreatureCounts, 1);
  const title = MANA_CURVE_BUCKETS.map(
    (bucket, index) =>
      `${bucket.label}: ${creatureCounts[index] ?? 0} creatures, ${nonCreatureCounts[index] ?? 0} noncreatures`,
  ).join(' · ');
  return (
    <div className="flex w-fit flex-col gap-px" title={title}>
      <div className="flex h-5 items-end gap-0.5">
        {MANA_CURVE_BUCKETS.map((bucket, index) => {
          const count = creatureCounts[index] ?? 0;
          return (
            <span
              key={bucket.key}
              className="w-2 rounded-sm bg-green-500/80"
              style={{
                height: `${Math.max(2, (count / max) * 18)}px`,
                opacity: count > 0 ? 1 : 0.2,
              }}
            />
          );
        })}
      </div>
      <div className="h-px bg-border" />
      <div className="flex h-5 items-start gap-0.5">
        {MANA_CURVE_BUCKETS.map((bucket, index) => {
          const count = nonCreatureCounts[index] ?? 0;
          return (
            <span
              key={bucket.key}
              className="w-2 rounded-sm bg-link/70"
              style={{
                height: `${Math.max(2, (count / max) * 18)}px`,
                opacity: count > 0 ? 1 : 0.2,
              }}
            />
          );
        })}
      </div>
    </div>
  );
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const DraftBreakdownTable: React.FC<{
  pools: SimulatedPool[];
  deckBuilds: BuiltDeck[] | null;
  cardMeta: Record<string, CardMeta>;
  runData: SimulationRunData;
  skeletons?: ArchetypeSkeleton[];
  highlightOracle?: string;
  showLocationFilter?: boolean;
  focusedPoolIndex?: number | null;
  onSelectPool?: (poolIndex: number | null) => void;
  onInspectPool?: (poolIndex: number) => void;
  poolArchetypeLabels?: Map<number, string> | null;
  poolArchetypeLabelsLoading?: boolean;
  clusterThemes?: Map<number, { tag: string; lift: number }[]>;
  clusterTagAllowlist?: Set<string>;
}> = ({
  pools,
  deckBuilds,
  cardMeta,
  runData,
  skeletons,
  highlightOracle,
  showLocationFilter = false,
  focusedPoolIndex = null,
  onSelectPool,
  onInspectPool,
  poolArchetypeLabels,
  poolArchetypeLabelsLoading = false,
  clusterThemes: clusterThemesProp,
  clusterTagAllowlist: clusterTagAllowlistProp,
}) => {
  const hasDeck = !!deckBuilds && deckBuilds.length > 0;
  const [selectedPool, setSelectedPool] = useState<number | null>(pools[0]?.poolIndex ?? null);
  const [sortKey, setSortKey] = useState<DraftBreakdownSortKey>('draft');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [colorFilter, setColorFilter] = useState('all');
  const [archetypeFilter, setArchetypeFilter] = useState('');
  const [seatFilter, setSeatFilter] = useState('');
  const [draftFilter, setDraftFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState<DeckLocationFilter>('all');
  const [poolPage, setPoolPage] = useState(1);

  // Use parent-provided themes (computed over all pools) when available; avoids filtered-view degradation.
  const clusterThemes = clusterThemesProp;
  const clusterTagAllowlist = clusterTagAllowlistProp;

  const summaries = useMemo(
    () =>
      pools.map((pool) =>
        buildDraftBreakdownRowSummary(pool, deckBuilds?.[pool.poolIndex] ?? null, cardMeta, clusterThemes, clusterTagAllowlist),
      ),
    [pools, deckBuilds, cardMeta, clusterThemes, clusterTagAllowlist],
  );

  const filtered = summaries.filter((summary) => {
    const pool = summary.pool;
    if (showLocationFilter && highlightOracle && deckBuilds && locationFilter !== 'all') {
      const deck = deckBuilds[pool.poolIndex];
      if (!deck) return true;
      if (locationFilter === 'deck' && !deck.mainboard.includes(highlightOracle)) return false;
      if (locationFilter === 'sideboard' && !deck.sideboard.includes(highlightOracle)) return false;
    }
    if (colorFilter !== 'all' && !getColorProfileCodes(pool.archetype).includes(colorFilter)) return false;
    if (archetypeFilter) {
      const q = archetypeFilter.toLowerCase();
      const themes = summary.themes.map((t) => t.toLowerCase());
      if (!themes.some((t) => t.split(/[\s-]+/).some((word) => word.startsWith(q)))) return false;
    }
    if (seatFilter && pool.seatIndex + 1 !== Number(seatFilter)) return false;
    if (draftFilter && pool.draftIndex + 1 !== Number(draftFilter)) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    let av: number | string;
    let bv: number | string;
    if (sortKey === 'draft') {
      av = a.pool.draftIndex;
      bv = b.pool.draftIndex;
    } else if (sortKey === 'seat') {
      av = a.pool.seatIndex;
      bv = b.pool.seatIndex;
    } else if (sortKey === 'color') {
      av = a.colors;
      bv = b.colors;
    } else if (sortKey === 'creatures') {
      av = a.creatureCount;
      bv = b.creatureCount;
    } else {
      av = a.avgMv;
      bv = b.avgMv;
    }
    const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const totalPoolPages = Math.max(1, Math.ceil(sorted.length / POOL_PAGE_SIZE));
  const currentPage = Math.min(poolPage, totalPoolPages);
  const pagedPools = sorted.slice((currentPage - 1) * POOL_PAGE_SIZE, currentPage * POOL_PAGE_SIZE);

  useEffect(() => {
    setSelectedPool(pools[0]?.poolIndex ?? null);
    setPoolPage(1);
  }, [pools]);
  useEffect(() => {
    if (focusedPoolIndex === null) return;
    if (pools.some((pool) => pool.poolIndex === focusedPoolIndex)) setSelectedPool(focusedPoolIndex);
  }, [focusedPoolIndex, pools]);
  useEffect(() => {
    setPoolPage(1);
  }, [colorFilter, archetypeFilter, seatFilter, draftFilter, locationFilter, sortKey, sortDir]);
  useEffect(() => {
    if (poolPage > totalPoolPages) setPoolPage(totalPoolPages);
  }, [poolPage, totalPoolPages]);

  const handleSort = (key: DraftBreakdownSortKey) => {
    if (sortKey === key) setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir(key === 'color' ? 'asc' : 'desc');
    }
  };
  const renderSortHeader = (label: string, key: DraftBreakdownSortKey, className = 'text-left') => (
    <th scope="col" className={`px-3 py-2 text-xs font-semibold text-text-secondary ${className}`}>
      <button
        type="button"
        className="w-full rounded px-1 py-0.5 text-inherit hover:bg-bg-active"
        onClick={() => handleSort(key)}
      >
        {label}
        {sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
      </button>
    </th>
  );

  return (
    <Flexbox direction="col" gap="3">
      <div>
      {/* Toolbar — visually attached to the table */}
      <div className="flex flex-wrap items-center gap-2 rounded-t-lg border border-border bg-bg-accent px-3 py-2">
        {showLocationFilter && hasDeck && (
          <div className="flex items-center gap-1">
            {(['all', 'deck', 'sideboard'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setLocationFilter(v)}
                className={[
                  'px-2 py-1 rounded text-xs font-medium border',
                  locationFilter === v
                    ? 'bg-link text-white border-link'
                    : 'bg-bg text-text-secondary border-border hover:bg-bg-active',
                ].join(' ')}
              >
                {v === 'all' ? 'In pool' : v === 'deck' ? 'In deck' : 'In sideboard'}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-1">
          {['all', ...COLOR_KEYS, 'C'].map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => setColorFilter(color)}
              className={[
                'h-7 rounded px-2 text-xs font-semibold border',
                colorFilter === color
                  ? 'bg-link text-white border-link'
                  : 'bg-bg text-text-secondary border-border hover:bg-bg-active',
              ].join(' ')}
            >
              {color === 'all' ? 'All' : color}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <Input
            type="text"
            placeholder="Theme"
            value={archetypeFilter}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setArchetypeFilter(e.target.value)}
            className="w-32"
          />
          <Input
            type="number"
            placeholder="Seat"
            value={seatFilter}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSeatFilter(e.target.value)}
            className="w-20"
          />
          <Input
            type="number"
            placeholder="Draft"
            value={draftFilter}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDraftFilter(e.target.value)}
            className="w-20"
          />
        </div>
      </div>

      {/* Mobile list */}
      <div className="divide-y divide-border rounded-b border border-t-0 border-border bg-bg md:hidden">
        {pagedPools.map((summary) => {
          const isSelected = selectedPool === summary.pool.poolIndex;
          const artImages = summary.highlights
            .slice(0, 5)
            .filter((c) => c.imageUrl)
            .map((c) => ({ ...c, imageUrl: c.imageUrl.replace('/normal/', '/art_crop/') }));
          return (
            <button
              key={summary.pool.poolIndex}
              type="button"
              className={[
                'block w-full px-3 py-3 text-left hover:bg-bg-active border-l-2',
                isSelected ? 'bg-link/5 border-link' : 'border-transparent',
              ].join(' ')}
              onClick={() => { setSelectedPool(summary.pool.poolIndex); onSelectPool?.(summary.pool.poolIndex); onInspectPool?.(summary.pool.poolIndex); }}
            >
              <div className="flex flex-col gap-2">
                <Flexbox direction="row" justify="between" alignItems="start" className="gap-2">
                  <div className="min-w-0 flex-1">
                    <Text sm semibold className="block">
                      Draft {summary.pool.draftIndex + 1} · Seat {summary.pool.seatIndex + 1}
                    </Text>
                    <div className="mt-0.5">
                      {poolArchetypeLabels ? (
                        <span className="text-[11px] font-medium">
                          {summary.colors && summary.colors !== 'C' && (
                            <span className="text-text-secondary mr-1">{summary.colors}</span>
                          )}
                          <span className="text-link">{poolArchetypeLabels.get(summary.pool.poolIndex) ?? '—'}</span>
                        </span>
                      ) : poolArchetypeLabelsLoading ? (
                        <span className="inline-block h-3 w-24 animate-pulse rounded bg-bg-accent" />
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {poolArchetypeLabelsLoading && <span className="inline-block h-3 w-16 animate-pulse rounded bg-bg-accent" />}
                    {artImages.length > 0 && (
                      <div className="flex gap-0.5 ml-1">
                        {artImages.map((c) => (
                          <div key={c.oracle_id} className="flex-shrink-0 overflow-hidden rounded" style={{ width: 48, height: 48 }} title={c.name}>
                            <img src={c.imageUrl} alt={c.name} className="w-full h-full object-cover object-center" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Flexbox>
                {summary.themes.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {summary.themes.map((theme) => (
                      <span key={theme} className="rounded bg-bg-accent px-1.5 py-0.5 text-[11px] text-text-secondary">
                        {theme}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-b border border-t-0 border-border bg-bg md:block">
        <table className="min-w-full text-base" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: 150 }} />
            <col style={{ width: 200 }} />
            <col style={{ width: 180 }} />
            <col style={{ width: 340 }} />

            <col style={{ width: 200 }} />
            <col style={{ width: 160 }} />
            <col />
          </colgroup>
          <thead className="sticky top-0 z-10">
            <tr className="border-b-2 border-border bg-bg-accent">
              {renderSortHeader('Draft · Seat', 'draft')}
              <th scope="col" className="px-3 py-2 text-left text-xs font-semibold text-text-secondary">
                Archetype
              </th>
              <th scope="col" className="px-3 py-2 text-left text-xs font-semibold text-text-secondary">
                Color share
              </th>
              <th scope="col" className="px-3 py-2 text-left text-xs font-semibold text-text-secondary">
                Theme
              </th>
              {renderSortHeader('Composition', 'creatures')}
              {renderSortHeader('Curve', 'avgMv')}
              <th scope="col" className="px-3 py-2 text-left text-xs font-semibold text-text-secondary">
                Key cards
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {pagedPools.map((summary) => {
              const isSelected = selectedPool === summary.pool.poolIndex;
              const artImages = summary.highlights
                .slice(0, 8)
                .filter((c) => c.imageUrl)
                .map((c) => ({ ...c, imageUrl: c.imageUrl.replace('/normal/', '/art_crop/') }));
              return (
                <tr
                  key={summary.pool.poolIndex}
                  className={[
                    'cursor-pointer transition-colors duration-100',
                    isSelected
                      ? 'border-l-[3px] border-l-link'
                      : 'border-l-[3px] border-l-transparent hover:bg-bg-active',
                  ].join(' ')}
                  style={isSelected ? { background: 'rgb(var(--link) / 0.07)', boxShadow: 'inset 3px 0 0 rgb(var(--link))' } : undefined}
                  onClick={() => { setSelectedPool(summary.pool.poolIndex); onSelectPool?.(summary.pool.poolIndex); onInspectPool?.(summary.pool.poolIndex); }}
                >
                  <td className="px-3 py-4 tabular-nums">
                    <span className={isSelected ? 'font-bold text-text' : 'font-semibold text-text'}>
                      D{summary.pool.draftIndex + 1}
                    </span>
                    <span className="text-text-secondary"> · S{summary.pool.seatIndex + 1}</span>
                  </td>
                  <td className="px-3 py-4">
                    {poolArchetypeLabels ? (
                      <span className="text-xs font-medium text-link">
                        {summary.colors && summary.colors !== 'C' && `${summary.colors} `}
                        {poolArchetypeLabels.get(summary.pool.poolIndex) ?? '—'}
                      </span>
                    ) : poolArchetypeLabelsLoading ? (
                      <span className="inline-block h-3 w-28 animate-pulse rounded bg-bg-accent" />
                    ) : null}
                  </td>
                  <td className="px-3 py-4">
                    <RowColorShare deck={summary.deck} cardMeta={cardMeta} />
                  </td>
                  <td className="px-3 py-4">
                    <div className="flex flex-wrap gap-1">
                      {summary.themes.map((theme) => (
                        <span
                          key={theme}
                          className="inline-flex items-center rounded bg-bg-accent px-2 text-xs font-semibold text-text-secondary"
                          style={{ height: 22 }}
                        >
                          {theme}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-4">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="inline-flex items-center gap-1 rounded-full px-2 tabular-nums" style={{ height: 22, fontSize: 12, background: '#dbeafe', color: '#3b82f6' }}>
                        <span className="font-bold" style={{ color: '#1d4ed8' }}>{summary.creatureCount}</span>
                        <span style={{ opacity: 0.75 }}>C</span>
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full px-2 tabular-nums" style={{ height: 22, fontSize: 12, background: '#f1f5f9', color: '#64748b' }}>
                        <span className="font-bold" style={{ color: '#334155' }}>{summary.nonCreatureCount}</span>
                        <span style={{ opacity: 0.75 }}>NC</span>
                      </span>
                      {summary.landCount > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full px-2 tabular-nums" style={{ height: 22, fontSize: 12, background: '#fef3c7', color: '#92400e' }}>
                          <span className="font-bold" style={{ color: '#78350f' }}>{summary.landCount}</span>
                          <span style={{ opacity: 0.75 }}>L</span>
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-4">
                    <TinyCurve
                      creatureCounts={summary.creatureCurveCounts}
                      nonCreatureCounts={summary.nonCreatureCurveCounts}
                    />
                  </td>
                  <td className="py-1.5 pr-2 pl-6">
                    <div className="flex gap-0.5">
                      {artImages.slice(0, 6).map((c) => (
                        <div
                          key={c.oracle_id}
                          className="flex-shrink-0 overflow-hidden"
                          style={{
                            width: 52,
                            height: 52,
                            borderRadius: 7,
                            border: '1px solid rgba(17,24,39,0.08)',
                          }}
                          title={c.name}
                        >
                          <img src={c.imageUrl} alt={c.name} className="w-full h-full object-cover object-center" />
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      </div>{/* end toolbar+table wrapper */}

      {sorted.length === 0 && (
        <Text sm className="text-text-secondary">
          No pools match the current filters.
        </Text>
      )}

      <div className="flex items-center justify-between gap-2 pt-1">
        <Text xs className="text-text-secondary">
          {sorted.length} seats · page {currentPage} of {totalPoolPages}
        </Text>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPoolPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1 rounded-md text-xs font-semibold border bg-bg text-text-secondary border-border hover:bg-bg-active disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ← Prev
          </button>
          <button
            type="button"
            onClick={() => setPoolPage((p) => Math.min(totalPoolPages, p + 1))}
            disabled={currentPage === totalPoolPages}
            className="px-3 py-1 rounded-md text-xs font-semibold border bg-bg text-text-secondary border-border hover:bg-bg-active disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next →
          </button>
        </div>
      </div>

    </Flexbox>
  );
};

export default DraftBreakdownTable;
