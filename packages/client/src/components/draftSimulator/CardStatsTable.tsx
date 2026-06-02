import React, { useEffect, useState } from 'react';

import type { CardMeta, CardStats } from '@utils/datatypes/SimulationReport';

import Input from '../base/Input';
import { Flexbox } from '../base/Layout';
import Text from '../base/Text';

type SortKey =
  | keyof CardStats
  | 'deckInclusion'
  | 'poolPct'
  | 'deckFilterCount'
  | 'sideboardFilterCount'
  | 'openerTakeRate'
  | 'pxp1TakeRate'
  | 'firstColorCount'
  | 'secondColorCount';

const CardStatsTable: React.FC<{
  cardStats: CardStats[];
  cardMeta?: Record<string, CardMeta>;
  onSelectCard: (id: string) => void;
  selectedCardOracles: string[];
  onSelectDeckCard: (id: string) => void;
  selectedDeckCardOracles: string[];
  onSelectSideboardCard: (id: string) => void;
  selectedSideboardCardOracles: string[];
  onSelectP1P1Card: (id: string) => void;
  selectedP1P1CardOracles: string[];
  onSelectFirstColorPick: (id: string) => void;
  selectedFirstColorPickOracles: string[];
  firstColorPickCounts: Map<string, number>;
  onSelectSecondColorPick: (id: string) => void;
  selectedSecondColorPickOracles: string[];
  secondColorPickCounts: Map<string, number>;
  visibleDeckCounts: Map<string, number>;
  visibleSideboardCounts: Map<string, number>;
  inDeckOracles: Set<string> | null;
  inSideboardOracles: Set<string> | null;
  deckInclusionPct: Map<string, number>;
  visiblePoolCounts: Map<string, number>;
  totalScopedPools: number;
  onPageChange?: () => void;
  renderCardLink: (oracleId: string, name: string, imageUrl?: string) => React.ReactNode;
}> = ({
  cardStats,
  cardMeta,
  onSelectCard,
  selectedCardOracles,
  onSelectDeckCard,
  selectedDeckCardOracles,
  onSelectSideboardCard,
  selectedSideboardCardOracles,
  onSelectP1P1Card,
  selectedP1P1CardOracles,
  onSelectFirstColorPick,
  selectedFirstColorPickOracles,
  firstColorPickCounts,
  onSelectSecondColorPick,
  selectedSecondColorPickOracles,
  secondColorPickCounts,
  visibleDeckCounts,
  visibleSideboardCounts,
  inDeckOracles,
  inSideboardOracles,
  deckInclusionPct,
  visiblePoolCounts,
  totalScopedPools,
  onPageChange,
  renderCardLink,
}) => {
  const PAGE_SIZE = 20;
  const defaultSortDir = (key: SortKey): 'asc' | 'desc' => (key === 'name' || key === 'avgPickPosition' ? 'asc' : 'desc');
  const [sortKey, setSortKey] = useState<SortKey>('avgPickPosition');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir(defaultSortDir(key));
    }
  };

  const filtered = cardStats.filter((cardStatsEntry) =>
    cardStatsEntry.name.toLowerCase().includes(filter.toLowerCase()),
  );

  const sorted = [...filtered].sort((a, b) => {
    let av: number | string;
    let bv: number | string;
    if (sortKey === 'deckInclusion') {
      av = deckInclusionPct.get(a.oracle_id) ?? 0;
      bv = deckInclusionPct.get(b.oracle_id) ?? 0;
    } else if (sortKey === 'poolPct') {
      av = totalScopedPools > 0 ? (visiblePoolCounts.get(a.oracle_id) ?? 0) / totalScopedPools : 0;
      bv = totalScopedPools > 0 ? (visiblePoolCounts.get(b.oracle_id) ?? 0) / totalScopedPools : 0;
    } else if (sortKey === 'deckFilterCount') {
      av = visibleDeckCounts.get(a.oracle_id) ?? 0;
      bv = visibleDeckCounts.get(b.oracle_id) ?? 0;
    } else if (sortKey === 'sideboardFilterCount') {
      av = visibleSideboardCounts.get(a.oracle_id) ?? 0;
      bv = visibleSideboardCounts.get(b.oracle_id) ?? 0;
    } else if (sortKey === 'openerTakeRate') {
      av = a.p1p1Seen > 0 ? a.p1p1Count / a.p1p1Seen : 0;
      bv = b.p1p1Seen > 0 ? b.p1p1Count / b.p1p1Seen : 0;
    } else if (sortKey === 'pxp1TakeRate') {
      av = (a.pxp1Seen ?? 0) > 0 ? (a.pxp1Count ?? 0) / (a.pxp1Seen ?? 1) : 0;
      bv = (b.pxp1Seen ?? 0) > 0 ? (b.pxp1Count ?? 0) / (b.pxp1Seen ?? 1) : 0;
    } else if (sortKey === 'firstColorCount') {
      av = firstColorPickCounts.get(a.oracle_id) ?? 0;
      bv = firstColorPickCounts.get(b.oracle_id) ?? 0;
    } else if (sortKey === 'secondColorCount') {
      av = secondColorPickCounts.get(a.oracle_id) ?? 0;
      bv = secondColorPickCounts.get(b.oracle_id) ?? 0;
    } else if (sortKey === 'avgPickPosition') {
      av = a.avgPickPosition > 0 ? a.avgPickPosition : Number.POSITIVE_INFINITY;
      bv = b.avgPickPosition > 0 ? b.avgPickPosition : Number.POSITIVE_INFINITY;
    } else {
      av = a[sortKey] as number | string;
      bv = b[sortKey] as number | string;
    }
    const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [filter, sortKey, sortDir, cardStats]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const numericSortCols = new Set<SortKey>([
    'elo',
    'timesSeen',
    'timesPicked',
    'pickRate',
    'avgPickPosition',
    'wheelCount',
    'p1p1Count',
    'p1p1Seen',
    'deckInclusion',
    'poolPct',
    'deckFilterCount',
    'sideboardFilterCount',
    'openerTakeRate',
    'pxp1TakeRate',
    'firstColorCount',
    'secondColorCount',
  ]);

  const renderSortHeader = (label: string, col: SortKey, tooltip?: string) => (
    <th
      className={[
        'px-3 py-2 text-xs font-medium uppercase tracking-wider whitespace-nowrap',
        numericSortCols.has(col) ? 'text-right' : 'text-left',
      ].join(' ')}
      aria-sort={sortKey === col ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
      scope="col"
    >
      <button
        type="button"
        className={[
          'w-full select-none rounded px-1 py-0.5 hover:bg-bg-active focus:outline-none focus:ring-2 focus:ring-link',
          numericSortCols.has(col) ? 'text-right' : 'text-left',
        ].join(' ')}
        title={tooltip}
        aria-label={tooltip ? `${label}. ${tooltip}` : `Sort by ${label}`}
        onClick={() => handleSort(col)}
      >
        {label}

        {sortKey === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
      </button>
    </th>
  );

  return (
    <Flexbox direction="col" gap="2">
      <Flexbox direction="row" gap="3" alignItems="center" className="flex-wrap">
        <div className="relative max-w-xs flex items-center">
          <Input
            type="text"
            placeholder="Filter by card name…"
            value={filter}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilter(e.target.value)}
            className="w-full pr-7"
          />
          {filter && (
            <button
              type="button"
              onClick={() => setFilter('')}
              aria-label="Clear card name filter"
              className="absolute right-2 text-text-secondary hover:text-text text-sm leading-none"
            >
              ✕
            </button>
          )}
        </div>
      </Flexbox>
      <div className="overflow-x-auto rounded border border-border bg-bg">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-bg-accent">
            <tr>
              {renderSortHeader('Card', 'name')}
              {renderSortHeader('Elo', 'elo')}
              {renderSortHeader('Seen', 'timesSeen', 'Times this card appeared in a live pack during the draft')}
              {renderSortHeader('Picked', 'timesPicked')}
              {renderSortHeader('Pick Rate', 'pickRate', 'When this card was seen in a pack, how often it was drafted')}
              {renderSortHeader('Avg Pick', 'avgPickPosition')}
              {renderSortHeader(
                'Wheels',
                'wheelCount',
                'Times this card was drafted after the pack went all the way around the table (position > seats)',
              )}
              {renderSortHeader(
                'Taken P1P1 %',
                'openerTakeRate',
                'Of opening packs in pack 1 that contained this card, how often it was the pick',
              )}
              {renderSortHeader(
                'Taken PXP1 %',
                'pxp1TakeRate',
                'Of first picks across all packs that contained this card, how often it was taken',
              )}
              {renderSortHeader(
                'Pool %',
                'poolPct',
                'How often this card appeared in a drafted pool within the current scope',
              )}
              {renderSortHeader(
                'Deck %',
                'deckInclusion',
                'Of pools that drafted this card, how often it made the main deck vs. sideboard',
              )}
              {renderSortHeader('P1P1', 'p1p1Count', 'Times this card was taken as the very first pick of pack 1')}
              {renderSortHeader('Color 1', 'firstColorCount', 'Pools where this card established the deck’s first color')}
              {renderSortHeader('Color 2', 'secondColorCount', 'Pools where this card bridged the deck into its second color')}
              {renderSortHeader('Pool', 'poolPct', 'How often this card appeared in a drafted pool within the current scope')}
              {renderSortHeader('Deck', 'deckFilterCount', 'How many pools put this card in the mainboard within the current scope')}
              {renderSortHeader(
                'Sideboard',
                'sideboardFilterCount',
                'How many pools put this card in the sideboard within the current scope',
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {pagedRows.map((cardStatsEntry) => {
              const inclPct = deckInclusionPct.get(cardStatsEntry.oracle_id);
              const isFilteredCard = selectedCardOracles.includes(cardStatsEntry.oracle_id);
              const isFilteredDeckCard = selectedDeckCardOracles.includes(cardStatsEntry.oracle_id);
              const isFilteredSideboardCard = selectedSideboardCardOracles.includes(cardStatsEntry.oracle_id);
              const isFilteredP1P1Card = selectedP1P1CardOracles.includes(cardStatsEntry.oracle_id);
              const isFilteredFirstColorCard = selectedFirstColorPickOracles.includes(cardStatsEntry.oracle_id);
              const isFilteredSecondColorCard = selectedSecondColorPickOracles.includes(cardStatsEntry.oracle_id);
              const firstColorCount = firstColorPickCounts.get(cardStatsEntry.oracle_id) ?? 0;
              const secondColorCount = secondColorPickCounts.get(cardStatsEntry.oracle_id) ?? 0;
              const visiblePoolCount = visiblePoolCounts.get(cardStatsEntry.oracle_id) ?? cardStatsEntry.poolIndices.length;
              const deckPoolCount = visibleDeckCounts.get(cardStatsEntry.oracle_id) ?? 0;
              const sideboardPoolCount = visibleSideboardCounts.get(cardStatsEntry.oracle_id) ?? 0;
              const poolPct = totalScopedPools > 0 ? visiblePoolCount / totalScopedPools : null;
              const openerTakeRate = cardStatsEntry.p1p1Seen > 0 ? cardStatsEntry.p1p1Count / cardStatsEntry.p1p1Seen : 0;
              const canTogglePoolFilter = isFilteredCard || visiblePoolCount > 0;
              const canToggleDeckFilter = isFilteredDeckCard || deckPoolCount > 0;
              return (
                <tr key={cardStatsEntry.oracle_id} className={isFilteredCard ? 'bg-bg-active' : 'hover:bg-bg-active'}>
                  <td className="px-3 py-2 font-medium">
                    {renderCardLink(cardStatsEntry.oracle_id, cardStatsEntry.name, cardMeta?.[cardStatsEntry.oracle_id]?.imageUrl)}
                  </td>
                  <td className="px-3 py-2 text-text-secondary text-right tabular-nums">{Math.round(cardStatsEntry.elo)}</td>
                  <td className="px-3 py-2 text-text-secondary text-right tabular-nums">{cardStatsEntry.timesSeen}</td>
                  <td className="px-3 py-2 text-text-secondary text-right tabular-nums">{cardStatsEntry.timesPicked}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{(cardStatsEntry.pickRate * 100).toFixed(1)}%</td>
                  <td className="px-3 py-2 text-text-secondary text-right tabular-nums">
                    {cardStatsEntry.avgPickPosition > 0 ? cardStatsEntry.avgPickPosition.toFixed(1) : '—'}
                  </td>
                  <td className="px-3 py-2 text-text-secondary text-right tabular-nums">{cardStatsEntry.wheelCount}</td>
                  <td className="px-3 py-2 text-text-secondary text-right tabular-nums">
                    {cardStatsEntry.p1p1Seen > 0 ? `${(openerTakeRate * 100).toFixed(1)}%` : '—'}
                  </td>
                  <td className="px-3 py-2 text-text-secondary text-right tabular-nums">
                    {(cardStatsEntry.pxp1Seen ?? 0) > 0
                      ? `${(((cardStatsEntry.pxp1Count ?? 0) / (cardStatsEntry.pxp1Seen ?? 1)) * 100).toFixed(1)}%`
                      : '—'}
                  </td>
                  <td className="px-3 py-2 text-text-secondary text-right tabular-nums">
                    {poolPct !== null ? `${(poolPct * 100).toFixed(1)}%` : '—'}
                  </td>
                  <td className="px-3 py-2 text-text-secondary text-right tabular-nums">
                    {inclPct !== undefined ? `${(inclPct * 100).toFixed(1)}%` : '—'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      className={[
                        'px-2 py-0.5 rounded text-xs font-medium border',
                        isFilteredP1P1Card ? 'bg-link text-white border-link' : 'bg-link/10 text-link border-link/30 hover:bg-link/20',
                        cardStatsEntry.p1p1Count === 0 ? 'opacity-40 cursor-not-allowed' : '',
                      ].join(' ')}
                      disabled={cardStatsEntry.p1p1Count === 0}
                      onClick={() => onSelectP1P1Card(cardStatsEntry.oracle_id)}
                    >
                      {isFilteredP1P1Card ? <>✕ </> : null}<span className="tabular-nums">{cardStatsEntry.p1p1Count}</span>
                    </button>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      className={[
                        'px-2 py-0.5 rounded text-xs font-medium border',
                        isFilteredFirstColorCard ? 'bg-link text-white border-link' : 'bg-link/10 text-link border-link/30 hover:bg-link/20',
                        firstColorCount === 0 ? 'opacity-40 cursor-not-allowed' : '',
                      ].join(' ')}
                      disabled={firstColorCount === 0}
                      onClick={() => onSelectFirstColorPick(cardStatsEntry.oracle_id)}
                    >
                      {isFilteredFirstColorCard ? <>✕ </> : null}<span className="tabular-nums">{firstColorCount}</span>
                    </button>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      className={[
                        'px-2 py-0.5 rounded text-xs font-medium border',
                        isFilteredSecondColorCard ? 'bg-link text-white border-link' : 'bg-link/10 text-link border-link/30 hover:bg-link/20',
                        secondColorCount === 0 ? 'opacity-40 cursor-not-allowed' : '',
                      ].join(' ')}
                      disabled={secondColorCount === 0}
                      onClick={() => onSelectSecondColorPick(cardStatsEntry.oracle_id)}
                    >
                      {isFilteredSecondColorCard ? <>✕ </> : null}<span className="tabular-nums">{secondColorCount}</span>
                    </button>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      className={[
                        'px-2 py-0.5 rounded text-xs font-medium border',
                        isFilteredCard ? 'bg-link text-white border-link' : 'bg-link/10 text-link border-link/30 hover:bg-link/20',
                        !canTogglePoolFilter ? 'opacity-40 cursor-not-allowed' : '',
                      ].join(' ')}
                      disabled={!canTogglePoolFilter}
                      onClick={() => onSelectCard(cardStatsEntry.oracle_id)}
                    >
                      {isFilteredCard ? <>✕ <span className="tabular-nums">{visiblePoolCount}</span></> : <span className="tabular-nums">{visiblePoolCount}</span>}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      className={[
                        'px-2 py-0.5 rounded text-xs font-medium border',
                        isFilteredDeckCard ? 'bg-link text-white border-link' : 'bg-link/10 text-link border-link/30 hover:bg-link/20',
                        !canToggleDeckFilter ? 'opacity-40 cursor-not-allowed' : '',
                      ].join(' ')}
                      disabled={!canToggleDeckFilter}
                      onClick={() => onSelectDeckCard(cardStatsEntry.oracle_id)}
                    >
                      {isFilteredDeckCard ? <>✕ <span className="tabular-nums">{deckPoolCount}</span></> : <span className="tabular-nums">{deckPoolCount}</span>}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      className={[
                        'px-2 py-0.5 rounded text-xs font-medium border',
                        isFilteredSideboardCard ? 'bg-link text-white border-link' : 'bg-link/10 text-link border-link/30 hover:bg-link/20',
                        !inSideboardOracles ? 'opacity-40 cursor-not-allowed' : '',
                      ].join(' ')}
                      disabled={!inSideboardOracles}
                      onClick={() => onSelectSideboardCard(cardStatsEntry.oracle_id)}
                    >
                      {isFilteredSideboardCard ? (
                        <>
                          ✕ <span className="tabular-nums">{sideboardPoolCount}</span>
                        </>
                      ) : (
                        <span className="tabular-nums">{sideboardPoolCount}</span>
                      )}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Flexbox direction="row" justify="between" alignItems="center" className="flex-wrap gap-2 pt-1">
        <Text xs className="text-text-secondary">
          Page {currentPage} / {totalPages}
        </Text>
        <Flexbox direction="row" gap="2" alignItems="center">
          <button
            type="button"
            onClick={() => {
              setPage((p) => Math.max(1, p - 1));
              onPageChange?.();
            }}
            disabled={currentPage === 1}
            className="px-2 py-0.5 rounded text-xs font-medium border bg-bg text-text-secondary border-border hover:bg-bg-active disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => {
              setPage((p) => Math.min(totalPages, p + 1));
              onPageChange?.();
            }}
            disabled={currentPage === totalPages}
            className="px-2 py-0.5 rounded text-xs font-medium border bg-bg text-text-secondary border-border hover:bg-bg-active disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </Flexbox>
      </Flexbox>
    </Flexbox>
  );
};

export default CardStatsTable;
