import React, { useMemo, useState } from 'react';

import type { BuiltDeck, CardMeta, CardStats, SimulatedPool } from '@utils/datatypes/SimulationReport';

import { getColorPathAnchorPicks } from '../../utils/draftSimulatorColorPath';
import { getDeckShareColors } from './SimulatorCharts';

const WUBRG = ['W', 'U', 'B', 'R', 'G'] as const;
const ROW_COLORS = ['W', 'U', 'B', 'R', 'G', 'C'] as const;
type Color = (typeof ROW_COLORS)[number];

const COLOR_LABELS: Record<Color, string> = {
  W: 'White',
  U: 'Blue',
  B: 'Black',
  R: 'Red',
  G: 'Green',
  C: 'Colorless',
};
const COLOR_SWATCH: Record<Color, string> = {
  W: '#f8f5e7',
  U: '#bbd5f0',
  B: '#bcb9b8',
  R: '#f3b4ab',
  G: '#b4d8b9',
  C: '#d6d3d1',
};

interface ColorRow {
  color: Color;
  avgPickPosition: number | null;
  p1p1Rate: number;
  pxp1Rate: number;
  avgElo: number | null;
  completionRate: number;
  firstColorAnchorRate: number;
  cubeShare: number;
  deckShare: number;
}

type SortKey =
  | 'color'
  | 'avgPickPosition'
  | 'p1p1Rate'
  | 'pxp1Rate'
  | 'completionRate'
  | 'firstColorAnchorRate'
  | 'avgElo'
  | 'cubeShare'
  | 'deckShare';

const COLOR_ORDER: Record<Color, number> = { W: 0, U: 1, B: 2, R: 3, G: 4, C: 5 };

const fmtPct = (v: number | null | undefined, digits = 1): string =>
  v === null || v === undefined ? '—' : `${(v * 100).toFixed(digits)}%`;
const fmt = (v: number | null | undefined, digits = 1): string =>
  v === null || v === undefined ? '—' : v.toFixed(digits);

const ColorPreferencesTable: React.FC<{
  cardStats: CardStats[];
  cardMeta: Record<string, CardMeta>;
  displayedPools: SimulatedPool[];
  activeDecks: BuiltDeck[] | null;
  numSeats: number;
}> = ({ cardStats, cardMeta, displayedPools, activeDecks, numSeats }) => {
  const rows = useMemo<ColorRow[]>(() => {
    const zeroRecord = (): Record<Color, number> => ({ W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 });

    // WUBRG colors of a card. Empty array => colorless.
    const getColors = (oracleId: string): string[] =>
      (cardMeta[oracleId]?.colorIdentity ?? []).filter((c) => (WUBRG as readonly string[]).includes(c));

    const isInColor = (oracleId: string, color: Color): boolean => {
      const cs = getColors(oracleId);
      return color === 'C' ? cs.length === 0 : cs.includes(color);
    };

    // Cube share: cube composition by color (one value per cube, not per draft).
    const cubeTotal = Object.keys(cardMeta).length;
    const cubeColorCount = zeroRecord();
    for (const oracleId of Object.keys(cardMeta)) {
      const cs = getColors(oracleId);
      if (cs.length === 0) cubeColorCount.C += 1;
      else for (const c of cs) cubeColorCount[c as Color] += 1;
    }

    // Reverse-index: pool index -> set of oracle ids that appeared in that pool.
    const seenByPool: Map<number, Set<string>> = new Map();
    for (const c of cardStats) {
      for (const idx of c.poolIndices) {
        let s = seenByPool.get(idx);
        if (!s) {
          s = new Set();
          seenByPool.set(idx, s);
        }
        s.add(c.oracle_id);
      }
    }

    // Accumulators for per-draft means: sum of per-draft values + count of drafts that had a defined value.
    const sumPickPos = zeroRecord();
    const cntPickPos = zeroRecord();
    const sumElo = zeroRecord();
    const cntElo = zeroRecord();
    // Deck Share is pooled across all decks (matches the Deck Color Distribution donut):
    // lands are excluded entirely, and each non-land card contributes 1.0 split fractionally
    // across its colors. Final share = aggregatedShares[color] / aggregatedTotal.
    const aggregatedShares = zeroRecord();
    let aggregatedTotal = 0;

    // P1P1 % and PxP1 % are draft-level shares (sum to 100% across rows): each draft's first
    // pick contributes 1.0 split equally across its colors; PxP1 sums over all packs in the draft.
    const p1p1Assigned = zeroRecord();
    let p1p1Drafts = 0;
    const pxp1Assigned = zeroRecord();
    let pxp1Drafts = 0;

    // C1 % (first-color anchor) and Completion %.
    const firstColorAnchorCount = zeroRecord();
    const completedCount = zeroRecord();

    const addFractional = (oracleId: string, bucket: Record<Color, number>, weight: number) => {
      const cs = getColors(oracleId);
      if (cs.length === 0) {
        bucket.C += weight;
      } else {
        const share = weight / cs.length;
        for (const c of cs) bucket[c as Color] += share;
      }
    };

    // Per-draft loop
    for (const pool of displayedPools) {
      const seen = seenByPool.get(pool.poolIndex) ?? new Set<string>();

      // P1P1: pack 0, pick 1
      const p1p1 = pool.picks.find((p) => p.packNumber === 0 && p.pickNumber === 1);
      if (p1p1) {
        addFractional(p1p1.oracle_id, p1p1Assigned, 1);
        p1p1Drafts += 1;
      }

      // PxP1: pick 1 of each pack
      const pxp1Picks = pool.picks.filter((p) => p.pickNumber === 1);
      if (pxp1Picks.length > 0) {
        for (const p of pxp1Picks) addFractional(p.oracle_id, pxp1Assigned, 1 / pxp1Picks.length);
        pxp1Drafts += 1;
      }

      // First-color anchor
      const deck = activeDecks?.[pool.poolIndex] ?? null;
      const { firstColorAnchorPick } = getColorPathAnchorPicks(pool, deck, cardMeta);
      if (firstColorAnchorPick) addFractional(firstColorAnchorPick.oracle_id, firstColorAnchorCount, 1);

      // Drafters/N: use the deck's archetype label (the colors it's "named" by) — not a
      // mainboard card scan. A "WU" archetype contributes to both W and U.
      const archColors = pool.archetype.split('').filter((c) => (WUBRG as readonly string[]).includes(c));
      if (archColors.length === 0) completedCount.C += 1;
      else for (const c of archColors) completedCount[c as Color] += 1;

      // Per-color per-draft accumulations
      for (const color of ROW_COLORS) {
        // Seen / Picked
        let seenN = 0;
        for (const oid of seen) if (isInColor(oid, color)) seenN += 1;

        let pickedN = 0;
        let pickPosSum = 0;
        let eloSum = 0;
        for (const p of pool.picks) {
          if (!isInColor(p.oracle_id, color)) continue;
          pickedN += 1;
          pickPosSum += p.pickNumber;
          eloSum += cardMeta[p.oracle_id]?.elo ?? 0;
        }

        if (pickedN > 0) {
          sumPickPos[color] += pickPosSum / pickedN;
          cntPickPos[color] += 1;
          sumElo[color] += eloSum / pickedN;
          cntElo[color] += 1;
        }
      }
    }

    // Pooled aggregate matching getDeckColorShareSegments in SimulatorCharts: skip lands,
    // each non-land card splits its 1.0 weight fractionally across its WUBRG colors.
    if (activeDecks) {
      for (const deck of activeDecks) {
        for (const o of deck.mainboard) {
          const cs = getDeckShareColors(o, cardMeta);
          if (cs.length === 0) continue;
          const share = 1 / cs.length;
          for (const c of cs) {
            aggregatedShares[c as Color] += share;
            aggregatedTotal += share;
          }
        }
      }
    }

    return ROW_COLORS.map<ColorRow>((color) => ({
      color,
      avgPickPosition: cntPickPos[color] > 0 ? sumPickPos[color] / cntPickPos[color] : null,
      p1p1Rate: p1p1Drafts > 0 ? p1p1Assigned[color] / p1p1Drafts : 0,
      pxp1Rate: pxp1Drafts > 0 ? pxp1Assigned[color] / pxp1Drafts : 0,
      avgElo: cntElo[color] > 0 ? sumElo[color] / cntElo[color] : null,
      completionRate: displayedPools.length > 0 ? completedCount[color] / displayedPools.length : 0,
      firstColorAnchorRate: displayedPools.length > 0 ? firstColorAnchorCount[color] / displayedPools.length : 0,
      cubeShare: cubeTotal > 0 ? cubeColorCount[color] / cubeTotal : 0,
      deckShare: aggregatedTotal > 0 ? aggregatedShares[color] / aggregatedTotal : 0,
    }));
  }, [cardStats, cardMeta, displayedPools, activeDecks, numSeats]);

  const [sortKey, setSortKey] = useState<SortKey>('color');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const sortedRows = useMemo(() => {
    const out = [...rows];
    out.sort((a, b) => {
      if (sortKey === 'color') {
        return sortDir === 'asc'
          ? COLOR_ORDER[a.color] - COLOR_ORDER[b.color]
          : COLOR_ORDER[b.color] - COLOR_ORDER[a.color];
      }
      const av = a[sortKey];
      const bv = b[sortKey];
      // Push null values to the end regardless of sort direction.
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return out;
  }, [rows, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      // Numeric columns default to descending (highest first) on first click;
      // 'color' defaults to WUBRG order (ascending).
      setSortDir(key === 'color' ? 'asc' : 'desc');
    }
  };

  const sortIndicator = (key: SortKey) => (sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '');

  return (
    <div className="overflow-x-auto rounded border border-border bg-bg">
      <table className="min-w-full divide-y divide-border text-sm">
        <thead className="bg-bg-accent">
          <tr>
            <th
              className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider cursor-pointer select-none hover:text-text"
              scope="col"
              onClick={() => handleSort('color')}
            >
              Color{sortIndicator('color')}
            </th>
            <th
              className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider cursor-pointer select-none hover:text-text"
              scope="col"
              title="Per-draft mean pick number of color-X picks (1 = first pick of pack), then mean across drafts. Lower = picked earlier."
              onClick={() => handleSort('avgPickPosition')}
            >
              Avg Pick Pos{sortIndicator('avgPickPosition')}
            </th>
            <th
              className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider cursor-pointer select-none hover:text-text"
              scope="col"
              title="Of all drafts, % whose P1P1 was this color. Multi-color picks split fractionally across their colors; colorless → C. Rows sum to 100%."
              onClick={() => handleSort('p1p1Rate')}
            >
              P1P1 %{sortIndicator('p1p1Rate')}
            </th>
            <th
              className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider cursor-pointer select-none hover:text-text"
              scope="col"
              title="Per draft, fraction of first-of-pack picks that were this color (averaged over all pack openers in the draft, fractional for multi-color); then mean across drafts. Rows sum to 100%."
              onClick={() => handleSort('pxp1Rate')}
            >
              PxP1 %{sortIndicator('pxp1Rate')}
            </th>
            <th
              className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider cursor-pointer select-none hover:text-text"
              scope="col"
              title={`Average number of drafters at the table classified into this color by deck archetype (out of ${numSeats} seats). Uses the deck-naming logic (pool.archetype, e.g. "WU" or "BRG") — a WU deck contributes to both the W and U rows.`}
              onClick={() => handleSort('completionRate')}
            >
              Drafters /{numSeats}
              {sortIndicator('completionRate')}
            </th>
            <th
              className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider cursor-pointer select-none hover:text-text"
              scope="col"
              title="% of drafts where this color served as the deck's first color commitment — the anchor pick that established the deck's first color."
              onClick={() => handleSort('firstColorAnchorRate')}
            >
              First Color Commit{sortIndicator('firstColorAnchorRate')}
            </th>
            <th
              className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider cursor-pointer select-none hover:text-text"
              scope="col"
              title="Per-draft mean Elo of color-X picks, then mean across drafts. Each draft contributes equally regardless of how many color-X cards were picked."
              onClick={() => handleSort('avgElo')}
            >
              Avg Elo{sortIndicator('avgElo')}
            </th>
            <th
              className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider cursor-pointer select-none hover:text-text"
              scope="col"
              title="Cube composition (one value per cube, not per draft): % of cube cards that include this color. Multi-color counted per color, colorless → C."
              onClick={() => handleSort('cubeShare')}
            >
              Cube Share{sortIndicator('cubeShare')}
            </th>
            <th
              className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider cursor-pointer select-none hover:text-text"
              scope="col"
              title="Share of color-X across all non-land mainboard cards across all decks (pooled). Multi-color cards split their weight fractionally across their colors; lands are excluded. Matches the Deck Color Distribution donut."
              onClick={() => handleSort('deckShare')}
            >
              Deck Share{sortIndicator('deckShare')}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {sortedRows.map((row) => (
            <tr key={row.color} style={{ background: `${COLOR_SWATCH[row.color]}33` }}>
              <td className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-3 w-3 rounded-full border border-black/15"
                    style={{ background: COLOR_SWATCH[row.color] }}
                  />
                  <span className="font-medium">{COLOR_LABELS[row.color]}</span>
                </div>
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{fmt(row.avgPickPosition)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{fmtPct(row.p1p1Rate)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{fmtPct(row.pxp1Rate)}</td>
              <td className="px-3 py-2 text-right tabular-nums">
                {(row.completionRate * numSeats).toFixed(1)} / {numSeats}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{fmtPct(row.firstColorAnchorRate)}</td>
              <td className="px-3 py-2 text-right tabular-nums">
                {row.avgElo === null ? '—' : Math.round(row.avgElo)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{fmtPct(row.cubeShare)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{fmtPct(row.deckShare)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ColorPreferencesTable;
