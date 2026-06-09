import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { TrophyIcon } from '@primer/octicons-react';
import { cdnUrl } from '@utils/cdnUrl';
import {
  cardCmc,
  cardColorCategory,
  cardColorIdentity,
  cardElo,
  cardName,
  cardNameLower,
  cardOracleId,
  cardType,
  encodeName,
} from '@utils/cardutil';
import Card from '@utils/datatypes/Card';
import type DraftRecord from '@utils/datatypes/Record';
import type { ArchetypeSkeleton, BuiltDeck, SlimPool } from '@utils/datatypes/SimulationReport';
import { getColorCombination } from '@utils/sorting/Sort';
import { fromEntries } from '@utils/Util';
import {
  BarElement,
  BubbleController,
  CategoryScale,
  Chart as ChartJS,
  type ChartOptions,
  Legend,
  LinearScale,
  PointElement,
  Tooltip as ChartTooltip,
} from 'chart.js';
import { Bar, Bubble } from 'react-chartjs-2';

import Alert from 'components/base/Alert';
import { Card as CardUI, CardBody, CardHeader } from 'components/base/Card';
import { Col, Flexbox, Row } from 'components/base/Layout';
import Select from 'components/base/Select';
import Spinner from 'components/base/Spinner';
import Text from 'components/base/Text';
import Tooltip from 'components/base/Tooltip';
import { SortableTable } from 'components/SortableTable';
import withAutocard from 'components/WithAutocard';
import { CSRFContext } from 'contexts/CSRFContext';
import CubeContext from 'contexts/CubeContext';

import ClusterDetailPanel from '../components/draftSimulator/ClusterDetailPanel';
import DraftMapScatter, { type DraftMapPoint } from '../components/draftSimulator/DraftMapScatter';
import SimDeckView from '../components/draftSimulator/SimDeckView';
import SimulationProgressBar, {
  getOverallSimProgress,
  type SimulationPhase,
} from '../components/draftSimulator/SimulationProgressBar';
import useLocalRecordAnalysisHistory from '../hooks/useLocalRecordAnalysisHistory';
import { runRecordAnalysis } from '../utils/recordAnalysisRun';
import { AnalysisDeck, ClusterMatchups, RecordAnalysisRunEntry } from '../utils/recordAnalysisStorage';
import { buildCardMeta } from '../utils/recordCardMeta';
import TrophyArchive from './TrophyArchive';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, BubbleController, ChartTooltip, Legend);

// ─── Palette (shared with the cube "At a Glance" charts) ─────────────────────

const COLOR_MAP: Record<string, string> = {
  White: '#D8CEAB',
  Blue: '#67A6D3',
  Black: '#8C7A91',
  Red: '#D85F69',
  Green: '#6AB572',
  Colorless: '#ADADAD',
  Multicolored: '#DBC467',
  Hybrid: '#BC9B6A',
  Lands: '#8B7355',
};
const COLOR_ORDER = ['White', 'Blue', 'Black', 'Red', 'Green', 'Multicolored', 'Hybrid', 'Colorless', 'Lands'];

const TYPE_COLORS: Record<string, string> = {
  Creature: '#6AB572',
  Instant: '#67A6D3',
  Sorcery: '#D85F69',
  Enchantment: '#DBC467',
  Artifact: '#ADADAD',
  Planeswalker: '#9B59B6',
  Land: '#8B7355',
  Battle: '#E8883A',
  Other: '#555555',
};
const TYPE_ORDER = ['Creature', 'Instant', 'Sorcery', 'Enchantment', 'Artifact', 'Planeswalker', 'Land', 'Battle', 'Other'];

const OVER = '#5DAE68'; // above the 50% baseline
const UNDER = '#D85F69'; // below the 50% baseline

const majorType = (card: Card): string => {
  const type = cardType(card);
  for (const t of TYPE_ORDER) {
    if (t !== 'Other' && type.includes(t)) return t;
  }
  return 'Other';
};

const fmtPct = (v: number): string => `${(v * 100).toFixed(1)}%`;
// Win rate with draws as half a win (centres the population on a true 50%).
const rate = (wins: number, losses: number, draws: number): number => {
  const t = wins + losses + draws;
  return t ? (wins + 0.5 * draws) / t : 0;
};
// Archetype-cluster palette, cycled by cluster index. Matches DraftMapScatter's
// own palette exactly so the map dots and the list/detail swatches line up.
const CLUSTER_COLORS = [
  '#2563eb', '#dc2626', '#16a34a', '#ca8a04', '#9333ea', '#0891b2', '#db2777', '#65a30d', '#ea580c', '#4f46e5',
];
// Over/under is measured against the cube's actual average win rate (the baseline),
// not a theoretical 50% — byes and incomplete results shift the real average.
const perfColor = (winRate: number, baseline: number): string => (winRate >= baseline ? OVER : UNDER);

// Win-rate viewport zoomed to the data (rates cluster tightly, so a raw 0–100%
// axis hides differences). Always contains the baseline.
const winrateDomain = (rates: number[], center: number): [number, number] => {
  const vals = rates.filter((r) => Number.isFinite(r));
  let lo = Math.min(center, ...vals);
  let hi = Math.max(center, ...vals);
  const pad = Math.max(0.02, (hi - lo) * 0.12);
  lo = Math.max(0, lo - pad);
  hi = Math.min(1, hi + pad);
  if (hi - lo < 0.16) {
    lo = Math.max(0, center - 0.08);
    hi = Math.min(1, center + 0.08);
  }
  return [lo, hi];
};

// Resolved (non-CSS-var) color for chart.js axis/label text, from the theme.
const chartTextColor = (): string => {
  if (typeof document === 'undefined') return '#888';
  const v = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim();
  return v ? `rgb(${v})` : '#888';
};

// A card's color identity as standard mana-symbol pips (the cube's design language).
const renderColorPips = (card: Card) => {
  const colors = cardColorIdentity(card);
  const symbols = colors.length > 0 ? colors : ['C'];
  return (
    <span className="flex items-center gap-0.5">
      {symbols.map((c) => (
        <img key={c} src={cdnUrl(`/content/symbols/${c.toLowerCase()}.png`)} alt={c} className="inline-block h-4 w-4" />
      ))}
    </span>
  );
};

// ─── Enriched per-card row ───────────────────────────────────────────────────

interface CardRow {
  oracle: string;
  card: Card & { exportValue: string };
  name: string;
  colorCategory: string;
  type: string;
  cmc: number;
  draftElo: number;
  matchElo: number; // 1200 baseline when no match data
  hasMatchElo: boolean;
  decks: number;
  matchCount: number;
  winRate: number;
  drawRate: number;
  gameWinRate: number;
  trophyCount: number;
  trophyRate: number;
  mWe: number; // match win-equivalent (wins + 0.5 * draws)
  mC: number;
}

// ─── Card link (autocard on hover) ───────────────────────────────────────────

const AutocardItem = withAutocard('span');
const renderCardLink = (card: Card) => (
  <AutocardItem className="p-0" card={card}>
    <a href={`/tool/card/${encodeName(card.cardID)}`} target="_blank" rel="noopener noreferrer" className="text-nowrap">
      {cardName(card)}
    </a>
  </AutocardItem>
);

// ─── Building blocks ─────────────────────────────────────────────────────────

const Panel: React.FC<{ title: string; tooltip?: string; right?: React.ReactNode; children: React.ReactNode }> = ({
  title,
  tooltip,
  right,
  children,
}) => (
  <CardUI className="h-full">
    <CardHeader>
      <Flexbox direction="row" justify="between" alignItems="center">
        <Text semibold md>
          {title}
          {tooltip && (
            <Tooltip text={tooltip} wrapperTag="span" position="bottom">
              <span className="ml-1 text-text-secondary/50">ⓘ</span>
            </Tooltip>
          )}
        </Text>
        {right}
      </Flexbox>
    </CardHeader>
    <CardBody>{children}</CardBody>
  </CardUI>
);

// Horizontal diverging bars rendered as SVG (zero CSS-positioning surprises).
// Each bar grows from the 50% baseline: right & green when it beats 50%, left &
// red when it trails. The viewBox is in 0–100 units stretched to the row width.
const DivergingBars: React.FC<{
  rows: { key: string; label: string; swatch: string; winRate: number; n: number }[];
  domain: [number, number];
  baseline: number;
  emptyText?: string;
  showSwatch?: boolean;
}> = ({ rows, domain, baseline, emptyText, showSwatch = true }) => {
  if (rows.length === 0) {
    return (
      <Text sm className="text-text-secondary">
        {emptyText ?? 'Not enough data.'}
      </Text>
    );
  }
  const [lo, hi] = domain;
  const pos = (w: number) => ((Math.min(hi, Math.max(lo, w)) - lo) / (hi - lo)) * 100;
  const center = pos(baseline);
  return (
    <Flexbox direction="col" gap="2">
      {rows.map((r) => {
        const p = pos(r.winRate);
        const x = Math.min(center, p);
        const w = Math.max(0.8, Math.abs(p - center));
        return (
          <div key={r.key} className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 w-28 shrink-0 min-w-0">
              {showSwatch && (
                <span className="inline-block h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: r.swatch }} />
              )}
              <Text xs className="truncate">
                {r.label}
              </Text>
            </div>
            <div className="flex-1 min-w-0">
              <svg viewBox="0 0 100 16" preserveAspectRatio="none" width="100%" height="16" className="block">
                <rect x={0} y={3} width={100} height={10} rx={2} style={{ fill: 'rgb(var(--bg-active))' }} />
                <rect x={x} y={3} width={w} height={10} rx={1.5} fill={perfColor(r.winRate, baseline)} />
                <rect x={center - 0.2} y={0} width={0.4} height={16} style={{ fill: 'rgb(var(--text-secondary))' }} />
              </svg>
            </div>
            <Text xs semibold className="w-12 text-right tabular-nums">
              <span style={{ color: perfColor(r.winRate, baseline) }}>{fmtPct(r.winRate)}</span>
            </Text>
            <Text xs className="w-10 text-right text-text-secondary tabular-nums">
              {r.n.toLocaleString()}
            </Text>
          </div>
        );
      })}
    </Flexbox>
  );
};

// Fine-grained (2.5%-wide) histogram of per-card win rates as a chart.js bar
// chart — proper axes/units, tooltips, and a red/green split at 50%.
const WinRateHistogram: React.FC<{ winRates: number[]; baseline: number }> = ({ winRates, baseline }) => {
  if (winRates.length === 0) {
    return (
      <Text sm className="text-text-secondary">
        Not enough data.
      </Text>
    );
  }
  const edges: number[] = [0];
  for (let e = 0.3; e <= 0.7001; e += 0.025) edges.push(Number(e.toFixed(3)));
  edges.push(1.0001);
  const n = edges.length - 1;
  const counts = new Array(n).fill(0);
  for (const w of winRates) {
    for (let i = 0; i < n; i++) {
      if (w >= edges[i]! && w < edges[i + 1]!) {
        counts[i] += 1;
        break;
      }
    }
  }
  const text = chartTextColor();
  const labels = edges.slice(0, n).map((lo) => {
    const p = Math.round(lo * 100);
    return [30, 40, 50, 60, 70].includes(p) ? `${p}%` : '';
  });
  // Bars below the cube average are red, above are green.
  const colors = counts.map((_c, i) => ((edges[i]! + edges[i + 1]!) / 2 < baseline ? UNDER : OVER));

  const data = {
    labels,
    datasets: [{ data: counts, backgroundColor: colors, borderRadius: 2, categoryPercentage: 0.96, barPercentage: 1 }],
  };
  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    scales: {
      x: {
        title: { display: true, text: 'Match win %', color: text, font: { size: 11 } },
        grid: { display: false },
        ticks: { color: text, font: { size: 10 }, autoSkip: false, maxRotation: 0 },
      },
      y: {
        title: { display: true, text: '# of cards', color: text, font: { size: 11 } },
        beginAtZero: true,
        grid: { display: false },
        ticks: { color: text, font: { size: 10 }, precision: 0 },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: (items) => `${Math.round(edges[items[0]!.dataIndex]! * 100)}–${Math.round(edges[items[0]!.dataIndex + 1]! * 100)}% win rate`,
          label: (ctx) => `${ctx.parsed.y} card${ctx.parsed.y === 1 ? '' : 's'}`,
        },
      },
    },
  };
  return (
    <div style={{ height: 300 }}>
      <Bar data={data} options={options} />
    </div>
  );
};

// Every qualifying card by sample size (x) vs. win rate (y) as a chart.js bubble
// chart — coloured by colour identity, sized by trophies, dashed 50% baseline.
const recordStr = (d: AnalysisDeck): string =>
  `${d.matchWins}-${d.matchLosses}${d.matchDraws ? `-${d.matchDraws}` : ''}`;

const hexToRgb = (h: string): [number, number, number] => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];
const mix = (a: string, b: string, t: number): string => {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  const c = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0');
  return `#${c(ar, br)}${c(ag, bg)}${c(ab, bb)}`;
};

const colorComboName = (colors?: string[]): string =>
  !colors || colors.length === 0 ? 'Colorless' : getColorCombination([...colors]);
const deckLabel = (d: AnalysisDeck): string => `${colorComboName(d.colors)}${d.archetype ? ` ${d.archetype}` : ''}`;

// The deck map: every recorded deck projected to 2D by the ML model (decks that
// play alike cluster together), rendered with the draft simulator's own
// DraftMapScatter. Clicking a deck focuses its whole cluster — every deck in the
// cluster stays bright while the rest dim out.
const DeckMap: React.FC<{
  decks: AnalysisDeck[];
  skeletons: ArchetypeSkeleton[];
  colorBy: 'cluster' | 'deckColor';
  selectedClusterId: number | null;
  selectedPoolIndex: number | null;
  onSelectPoint: (poolIndex: number, clusterId: number | null) => void;
}> = ({ decks, skeletons, colorBy, selectedClusterId, selectedPoolIndex, onSelectPoint }) => {
  // deck index → cluster slot (skeleton position drives the cluster colour).
  const points = useMemo<DraftMapPoint[]>(() => {
    const byDeck = new Map<number, number>();
    skeletons.forEach((s, idx) => {
      for (const pi of s.poolIndices) byDeck.set(pi, idx);
    });
    return decks.map((d, i) => ({
      x: d.x,
      y: d.y,
      poolIndex: i,
      draftIndex: 0,
      seatIndex: 0,
      clusterId: d.clusterId,
      clusterIndex: byDeck.get(i) ?? null,
      clusterLabel: deckLabel(d),
      archetype: (d.colors ?? []).join('') || 'C', // drives deck-colour mode
    }));
  }, [decks, skeletons]);

  // Selecting a cluster keeps its decks bright (active filter) and dims the rest.
  const activePoolIndexSet = useMemo<Set<number> | null>(() => {
    if (selectedClusterId === null) return null;
    const set = new Set<number>();
    decks.forEach((d, i) => {
      if (d.clusterId === selectedClusterId) set.add(i);
    });
    return set;
  }, [decks, selectedClusterId]);

  if (points.length === 0) {
    return (
      <Text sm className="text-text-secondary">
        The map needs the ML model — run the analysis to build it.
      </Text>
    );
  }
  return (
    <div style={{ width: '100%', maxWidth: 480, aspectRatio: '1 / 1', margin: '0 auto' }}>
      <DraftMapScatter
        points={points}
        selectedPoolIndex={selectedPoolIndex}
        activePoolIndexSet={activePoolIndexSet}
        colorMode={colorBy}
        onSelectPoint={(p) => onSelectPoint(p.poolIndex, p.clusterId)}
        baseRadius={7}
      />
    </div>
  );
};

// Reputation vs reality: dashed diagonal = "as expected".
const eloDiagonalPlugin = {
  id: 'eloDiagonal',
  afterDatasetsDraw: (chart: any) => {
    const area = chart.chartArea;
    if (!area) return;
    const ctx = chart.ctx;
    ctx.save();
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(128,128,128,0.6)';
    ctx.beginPath();
    ctx.moveTo(area.left, area.bottom);
    ctx.lineTo(area.right, area.top);
    ctx.stroke();
    ctx.restore();
  },
};

// Match Elo (actual) vs Cobra draft Elo (expected) — above the diagonal = a card
// that wins more than its draft reputation implies.
const EloScatter: React.FC<{ rows: CardRow[] }> = ({ rows }) => {
  const withElo = rows.filter((r) => r.hasMatchElo);
  if (withElo.length === 0) {
    return (
      <Text sm className="text-text-secondary">
        Match Elo needs match results — run the analysis on records with matches.
      </Text>
    );
  }
  const text = chartTextColor();
  // Draft Elo and Match Elo are different scales/populations, so absolute values
  // aren't comparable. Rank each card within its own population instead: x = its
  // draft-Elo percentile, y = its match-Elo percentile. The diagonal then means
  // "same standing in both" — above it overperforms its draft reputation.
  const percentileFn = (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;
    return (v: number) => {
      let lessThan = 0;
      let equal = 0;
      for (const x of sorted) {
        if (x < v) lessThan += 1;
        else if (x === v) equal += 1;
      }
      // mid-rank for ties, normalised to 0–100
      return n > 0 ? ((lessThan + (equal - 1) / 2) / Math.max(1, n - 1)) * 100 : 50;
    };
  };
  const draftPct = percentileFn(withElo.map((r) => r.draftElo));
  const matchPct = percentileFn(withElo.map((r) => r.matchElo));
  const points = withElo.map((r) => ({ x: draftPct(r.draftElo), y: matchPct(r.matchElo), r: 4 }));
  const colors = withElo.map((r) => COLOR_MAP[r.colorCategory] ?? '#888');
  const labels = withElo.map(
    (r) =>
      `${r.name}: draft ${r.draftElo} (p${Math.round(draftPct(r.draftElo))}) → match ${r.matchElo} (p${Math.round(matchPct(r.matchElo))})`,
  );
  const data = {
    datasets: [
      {
        data: points,
        backgroundColor: colors.map((c) => `${c}C0`),
        borderColor: colors,
        borderWidth: 0.5,
        clip: false as const,
      },
    ],
  };
  const axis = (label: string) => ({
    title: { display: true, text: label, color: text, font: { size: 11 } },
    min: 0,
    max: 100,
    grid: { display: false },
    ticks: { color: text, font: { size: 10 }, stepSize: 25, callback: (v: string | number) => `${v}%` },
  });
  const options: ChartOptions<'bubble'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    layout: { padding: 10 },
    scales: {
      x: axis('Cobra draft Elo — percentile (expected)'),
      y: axis('Match Elo — percentile (actual)'),
    },
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => labels[ctx.dataIndex]! } } },
  };
  return (
    <Flexbox direction="col" gap="2">
      <div style={{ width: '100%', height: 420 }}>
        <Bubble data={data} options={options} plugins={[eloDiagonalPlugin]} />
      </div>
      <Text xs className="text-text-secondary text-center">
        Each card ranked within its own Elo population. Dashed line = same standing in both. Above it = wins more than
        its draft reputation; below = less.
      </Text>
    </Flexbox>
  );
};

const Leaderboard: React.FC<{
  rows: CardRow[];
  metric: (r: CardRow) => string;
  sub?: (r: CardRow) => string;
}> = ({ rows, metric, sub }) => {
  if (rows.length === 0) {
    return (
      <Text sm className="text-text-secondary">
        Not enough data.
      </Text>
    );
  }
  return (
    <Flexbox direction="col" gap="0">
      {rows.map((r, i) => (
        <div key={r.oracle} className="flex items-center gap-2 py-1 border-b border-border last:border-b-0">
          <Text xs className="text-text-secondary w-4 text-right tabular-nums shrink-0">
            {i + 1}
          </Text>
          <span className="inline-block h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: COLOR_MAP[r.colorCategory] ?? '#888' }} />
          <div className="flex-1 min-w-0 truncate text-sm">{renderCardLink(r.card)}</div>
          <Flexbox direction="col" gap="0" className="items-end shrink-0">
            <Text sm semibold className="tabular-nums">
              {metric(r)}
            </Text>
            {sub && (
              <Text xs className="text-text-secondary tabular-nums">
                {sub(r)}
              </Text>
            )}
          </Flexbox>
        </div>
      ))}
    </Flexbox>
  );
};

// One archetype cluster with its decks, record + display label. Shared between the
// map, the cluster deep-dive and the archetype-level charts.
interface ClusterInfo {
  clusterId: number;
  idx: number;
  skel: ArchetypeSkeleton;
  color: string;
  colorProfile: string;
  label: string;
  members: AnalysisDeck[];
  count: number;
  winRate: number;
  trophies: number;
}

// Archetype-vs-archetype matchup grid: cell (row A, col B) = A's match win rate
// against B. Green beats the cube average, red trails it; click a row to focus it.
const ArchetypeMatchupMatrix: React.FC<{
  clusters: ClusterInfo[];
  matchups: ClusterMatchups;
  baseline: number;
  selectedClusterId: number | null;
  onSelect: (id: number) => void;
}> = ({ clusters, matchups, baseline, selectedClusterId, onSelect }) => {
  if (clusters.length < 2 || Object.keys(matchups).length === 0) {
    return (
      <Text sm className="text-text-secondary">
        Not enough cross-archetype matches yet — re-run the analysis on records with more rounds.
      </Text>
    );
  }
  const cellRate = (a: number, b: number): { rate: number; matches: number } | null => {
    const e = matchups[`${a}|${b}`];
    if (!e || e.matches === 0) return null;
    return { rate: (e.wins + 0.5 * e.draws) / e.matches, matches: e.matches };
  };
  const heat = (w: number): string => {
    const t = Math.max(-1, Math.min(1, (w - baseline) / 0.2));
    return t >= 0 ? mix('#5b6168', OVER, t) : mix('#5b6168', UNDER, -t);
  };
  const swatch = (c: ClusterInfo) => (
    <span className="inline-block h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: c.color }} />
  );
  return (
    <Flexbox direction="col" gap="2">
      <div className="overflow-x-auto max-w-full">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-bg-accent p-2 text-left border-b border-border">
                <Text xs className="text-text-secondary">
                  Row beats column →
                </Text>
              </th>
              {clusters.map((c) => (
                <th key={c.clusterId} className="p-2 align-bottom border-b border-border" title={`vs ${c.label}`}>
                  <div className="flex flex-col items-center gap-1">
                    {swatch(c)}
                    <Text xs semibold>
                      {c.colorProfile}
                    </Text>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {clusters.map((a) => (
              <tr key={a.clusterId}>
                <th
                  className={`sticky left-0 z-10 p-2 text-left border-b border-border cursor-pointer transition-colors ${
                    a.clusterId === selectedClusterId ? 'bg-bg-active' : 'bg-bg-accent hover:bg-bg-active'
                  }`}
                  onClick={() => onSelect(a.clusterId)}
                  title={a.label}
                >
                  <div className="flex items-center gap-2">
                    {swatch(a)}
                    <Text sm semibold className="truncate max-w-[12rem]">
                      {a.label}
                    </Text>
                  </div>
                </th>
                {clusters.map((b) => {
                  const v = cellRate(a.clusterId, b.clusterId);
                  return (
                    <td
                      key={b.clusterId}
                      className="p-2 text-center align-middle border-b border-l border-border"
                      style={{ background: v ? heat(v.rate) : undefined }}
                      title={
                        v
                          ? `${a.colorProfile} vs ${b.colorProfile}: ${fmtPct(v.rate)} over ${v.matches} matches`
                          : 'No matches'
                      }
                    >
                      {v ? (
                        <div className="flex flex-col items-center leading-tight text-white">
                          <span className="text-sm font-semibold tabular-nums">{fmtPct(v.rate)}</span>
                          <span className="text-[10px] tabular-nums text-white/75">{v.matches} mt</span>
                        </div>
                      ) : (
                        <Text sm className="text-text-secondary">
                          ·
                        </Text>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Text xs className="text-text-secondary">
        Cell = the row archetype's match win rate vs the column archetype, with the sample size. Green beats the cube
        average, red trails it; the diagonal is the mirror.
      </Text>
    </Flexbox>
  );
};

// ─── Synergy / matchup explorer (derived from the local analysis run) ────────

interface PartnerEntry {
  oracle: string;
  decks: number;
  trophies: number;
  winRate: number;
}
interface RivalEntry {
  oracle: string;
  matches: number;
  winRate: number;
}
interface TopSynergy {
  a: string;
  b: string;
  decks: number;
  trophies: number;
  winRate: number;
}

const SynergyRow: React.FC<{ card?: Card; right: React.ReactNode; sub?: React.ReactNode; over?: boolean }> = ({
  card,
  right,
  sub,
  over,
}) => {
  if (!card) return null;
  return (
    <div className="flex items-center gap-2 py-1 border-b border-border last:border-b-0">
      <div className="flex-1 min-w-0 truncate text-sm">{renderCardLink(card)}</div>
      <Flexbox direction="col" gap="0" className="items-end shrink-0">
        <Text sm semibold className="tabular-nums">
          <span style={over === undefined ? undefined : { color: over ? OVER : UNDER }}>{right}</span>
        </Text>
        {sub && (
          <Text xs className="text-text-secondary tabular-nums">
            {sub}
          </Text>
        )}
      </Flexbox>
    </div>
  );
};

// ─── Run controls (mirrors the draft simulator's run UI) ─────────────────────

const RECORD_PHASE_LABELS: Record<string, string> = {
  setup: 'Reading records…',
  loadmodel: 'Loading draft model…',
  cluster: 'Clustering decks…',
  save: 'Saving…',
};

const RunControls: React.FC<{
  runs: RecordAnalysisRunEntry[];
  selectedTs: number | null;
  isRunning: boolean;
  loadingRun: boolean;
  runError: string | null;
  simPhase: SimulationPhase;
  overallProgress: number;
  onRun: () => void;
  onCancel: () => void;
  onLoad: (ts: number) => void;
  onDelete: (ts: number) => void;
  onClear: () => void;
}> = ({ runs, selectedTs, isRunning, loadingRun, runError, simPhase, overallProgress, onRun, onCancel, onLoad, onDelete, onClear }) => (
  <CardUI>
    <CardBody>
      <Flexbox direction="row" gap="3" justify="between" alignItems="start" wrap="wrap">
        <Flexbox direction="col" gap="0" className="min-w-0">
          <Text semibold md>
            Analysis runs
          </Text>
          <Text xs className="text-text-secondary">
            Runs in your browser — loads the draft model (~70 MB, cached after first use) and clusters decks into
            archetypes. Each run is saved locally.
          </Text>
        </Flexbox>
        <Flexbox direction="row" gap="2" alignItems="center" className="shrink-0">
          {isRunning && (
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 rounded border border-border text-sm text-text-secondary hover:bg-bg-active"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={onRun}
            disabled={isRunning}
            className="px-5 py-2 rounded bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white font-semibold text-sm whitespace-nowrap"
          >
            {isRunning ? 'Analyzing…' : 'Run analysis'}
          </button>
        </Flexbox>
      </Flexbox>
      {isRunning && (
        <div className="mt-3">
          <SimulationProgressBar phase={simPhase} overallProgress={overallProgress} label={simPhase ? RECORD_PHASE_LABELS[simPhase] : undefined} />
        </div>
      )}
      {runError && (
        <Alert color="danger" className="mt-2">
          {runError}
        </Alert>
      )}
      {runs.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border">
          <Flexbox direction="row" gap="3" alignItems="center" className="mb-2">
            <Text xs className="font-medium text-text-secondary uppercase tracking-wide">
              Recent runs
            </Text>
            <button type="button" className="text-xs text-text-secondary hover:text-text" onClick={onClear}>
              Clear all
            </button>
            {loadingRun && <Spinner sm />}
          </Flexbox>
          <div className="flex flex-wrap gap-2">
            {runs.map((run) => (
              <div
                key={run.ts}
                onClick={() => onLoad(run.ts)}
                className={`group relative flex flex-col cursor-pointer select-none rounded-md border px-3 py-2 pr-7 transition-colors ${
                  run.ts === selectedTs ? 'border-link bg-bg-active' : 'border-border bg-bg-accent hover:bg-bg-active'
                }`}
                style={{ minWidth: 150 }}
              >
                <span className="text-sm font-semibold whitespace-nowrap leading-tight">
                  {run.deckCount} decks · {run.recordCount} records
                </span>
                <span className="text-[11px] text-text-secondary whitespace-nowrap mt-0.5">
                  {new Date(run.generatedAt).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                {!run.clustered && (
                  <span className="mt-1 inline-flex w-fit rounded border border-yellow-500/40 bg-yellow-500/10 px-1.5 py-0.5 text-[10px] font-medium text-yellow-600">
                    No map
                  </span>
                )}
                <button
                  type="button"
                  className="absolute top-1.5 right-1.5 w-4 h-4 flex items-center justify-center rounded text-[10px] text-text-secondary/50 hover:text-text-secondary opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(run.ts);
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </CardBody>
  </CardUI>
);

// ─── Main ────────────────────────────────────────────────────────────────────

interface WinrateAnalyticsProps {
  records: DraftRecord[];
  lastKey: any;
}

const WinrateAnalytics: React.FC<WinrateAnalyticsProps> = ({ records, lastKey }) => {
  const { cube, changedCards } = useContext(CubeContext);
  const cards = changedCards.mainboard || [];
  const { csrfFetch } = useContext(CSRFContext);

  const {
    runs,
    displayRun,
    selectedTs,
    loadingRun,
    handleLoadRun,
    handleDeleteRun,
    handleClearHistory,
    handlePersistCompletedRun,
  } = useLocalRecordAnalysisHistory(cube?.id || '');

  // ── Run state (the analysis runs locally; the button loads the ML model) ────
  const [isRunning, setIsRunning] = useState(false);
  const [simPhase, setSimPhase] = useState<SimulationPhase>(null);
  const [modelLoadProgress, setModelLoadProgress] = useState(0);
  const [runError, setRunError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const handleRun = useCallback(async () => {
    if (!cube) return;
    setIsRunning(true);
    setRunError(null);
    setModelLoadProgress(0);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const runData = await runRecordAnalysis(csrfFetch, cube, cards, {
        onPhase: setSimPhase,
        onModelProgress: setModelLoadProgress,
        signal: controller.signal,
      });
      await handlePersistCompletedRun(runData);
    } catch (err) {
      if (!(err instanceof Error && err.name === 'AbortError')) {
        setRunError(err instanceof Error ? err.message : 'Analysis failed');
      }
    } finally {
      setIsRunning(false);
      setSimPhase(null);
      abortRef.current = null;
    }
  }, [cube, csrfFetch, cards, handlePersistCompletedRun]);

  const cardDict = useMemo(
    () => fromEntries(cards.filter((card) => cardOracleId(card)).map((card) => [cardOracleId(card), card])) as Record<string, Card>,
    [cards],
  );

  const analyticsCards = displayRun?.cards;
  const allRows = useMemo<CardRow[]>(() => {
    if (!analyticsCards) return [];
    return Object.entries(analyticsCards)
      .filter(([oracle]) => cardDict[oracle])
      .map(([oracle, a]) => {
        const card = cardDict[oracle]!;
        const matchCount = a.matchWins + a.matchLosses + a.matchDraws;
        const gameTotal = a.gameWins + a.gameLosses + a.gameDraws;
        // Draws count as half a win so the population centres on a true 50%.
        const mWe = a.matchWins + 0.5 * a.matchDraws;
        return {
          oracle,
          card: { exportValue: cardName(card), ...card },
          name: cardName(card),
          colorCategory: cardColorCategory(card),
          type: majorType(card),
          cmc: cardCmc(card),
          draftElo: Math.round(cardElo(card)),
          matchElo: a.matchElo ?? 1200,
          hasMatchElo: a.matchElo !== undefined,
          decks: a.decks,
          matchCount,
          winRate: matchCount ? mWe / matchCount : 0,
          drawRate: matchCount ? a.matchDraws / matchCount : 0,
          gameWinRate: gameTotal ? (a.gameWins + 0.5 * a.gameDraws) / gameTotal : 0,
          trophyCount: a.trophies,
          trophyRate: a.decks ? a.trophies / a.decks : 0,
          mWe,
          mC: matchCount,
        };
      });
  }, [analyticsCards, cardDict]);

  const defaultMinDecks = useMemo(() => {
    for (const t of [3, 2]) {
      if (allRows.filter((r) => r.decks >= t).length >= 12) return t;
    }
    return 1;
  }, [allRows]);

  const [minDecks, setMinDecks] = useState<number>(0);
  const [mapColorBy, setMapColorBy] = useState<'cluster' | 'deckColor'>('cluster');
  const [selectedClusterId, setSelectedClusterId] = useState<number | null>(null);
  const [selectedPoolIndex, setSelectedPoolIndex] = useState<number | null>(null);
  const [excludeManaFixingLands, setExcludeManaFixingLands] = useState(false);
  // Clear the cluster / deck drill-in when switching to a different analysis run.
  useEffect(() => {
    setSelectedClusterId(null);
    setSelectedPoolIndex(null);
  }, [displayRun?.ts]);
  const effectiveMin = minDecks || defaultMinDecks;
  const rows = useMemo(() => allRows.filter((r) => r.decks >= effectiveMin), [allRows, effectiveMin]);

  // ── Synergy + matchups, derived from the selected run (no server calls) ─────
  const byOracle = useMemo(() => fromEntries(allRows.map((r) => [r.oracle, r])) as Record<string, CardRow>, [allRows]);
  const mostPlayedOracle = useMemo(
    () => (allRows.length ? allRows.reduce((b, r) => (r.decks > b.decks ? r : b), allRows[0]!).oracle : ''),
    [allRows],
  );
  const [selectedOracle, setSelectedOracle] = useState('');
  const activeOracle = selectedOracle || mostPlayedOracle;

  const pairsMap = displayRun?.pairs ?? {};
  const matchupsMap = displayRun?.matchups ?? {};

  const topSynergies = useMemo<TopSynergy[]>(() => {
    const entries = Object.entries(pairsMap);
    if (entries.length === 0) return [];
    const minD = entries.filter(([, v]) => v.decks >= 3).length >= 10 ? 3 : 2;
    return entries
      .filter(([, v]) => v.decks >= minD)
      .map(([k, v]) => {
        const [a, b] = k.split('|');
        return { a: a!, b: b!, decks: v.decks, trophies: v.trophies, winRate: rate(v.matchWins, v.matchLosses, v.matchDraws) };
      })
      .sort((x, y) => y.winRate - x.winRate || y.decks - x.decks)
      .slice(0, 24);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayRun]);

  const synergy = useMemo(() => {
    if (!activeOracle || Object.keys(pairsMap).length === 0) return null;
    const partners: PartnerEntry[] = [];
    for (const [k, v] of Object.entries(pairsMap)) {
      const [a, b] = k.split('|');
      const other = a === activeOracle ? b : b === activeOracle ? a : undefined;
      if (!other) continue;
      partners.push({ oracle: other, decks: v.decks, trophies: v.trophies, winRate: rate(v.matchWins, v.matchLosses, v.matchDraws) });
    }
    partners.sort((x, y) => y.winRate - x.winRate || y.decks - x.decks);
    const rivals: RivalEntry[] = [];
    for (const [k, v] of Object.entries(matchupsMap)) {
      const [x, y] = k.split('|');
      if (x !== activeOracle) continue;
      rivals.push({ oracle: y!, matches: v.matches, winRate: rate(v.matchWins, v.matchLosses, v.matchDraws) });
    }
    return {
      partners: { top: partners.slice(0, 40), bottom: partners.slice(-40).reverse() },
      matchups: {
        beats: [...rivals].sort((a, b) => b.winRate - a.winRate || b.matches - a.matches).slice(0, 30),
        losesTo: [...rivals].sort((a, b) => a.winRate - b.winRate || b.matches - a.matches).slice(0, 30),
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayRun, activeOracle]);

  // The cube's actual average win rate (appearance-weighted) — the baseline that
  // over/under-performance is measured against, robust to byes / incomplete data.
  const totalMWe = allRows.reduce((s, r) => s + r.mWe, 0);
  const totalMC = allRows.reduce((s, r) => s + r.mC, 0);
  const baseline = totalMC ? totalMWe / totalMC : 0.5;

  // The ML clusters (archetypes): each with its decks, record, staples + identity.
  // `idx` is the skeleton's position — it drives the map's cluster colour, so the
  // list swatches match the map exactly.
  const runDecks = displayRun?.decks ?? [];
  const skeletons = displayRun?.skeletons ?? [];
  const clusterMatchups = displayRun?.clusterMatchups ?? {};

  // Reconstruct the inputs the reused simulator components expect (cardMeta /
  // deck builds / slim pools / cube oracle set), straight from the run + cube.
  // Cube cards drive it; the run's captured card info backfills any deck card no
  // longer in the live cube (so decks/charts don't render blank "loading" cards).
  const simCardMeta = useMemo(() => {
    const meta = buildCardMeta(cards);
    for (const [oracle, info] of Object.entries(displayRun?.cardImages ?? {})) {
      const existing = meta[oracle];
      if (!existing || !existing.imageUrl) {
        meta[oracle] = {
          name: info.name,
          imageUrl: info.imageUrl,
          colorIdentity: info.colorIdentity,
          elo: existing?.elo ?? 1200,
          cmc: info.cmc,
          type: info.type,
          producedMana: existing?.producedMana ?? [],
          isManaFixingLand: existing?.isManaFixingLand,
          mlOracleId: existing?.mlOracleId,
        };
      }
    }
    return meta;
  }, [cards, displayRun]);
  const cubeOracleSet = useMemo(() => new Set(Object.keys(cardDict)), [cardDict]);
  const allDeckBuilds = useMemo<BuiltDeck[]>(
    () => runDecks.map((d) => ({ mainboard: d.oracles, sideboard: [] as string[] })),
    [runDecks],
  );
  const allSlimPools = useMemo<SlimPool[]>(
    () =>
      runDecks.map((d, i) => ({
        draftIndex: 0,
        seatIndex: i,
        archetype: '',
        picks: d.oracles.map((o, p) => ({ oracle_id: o, packNumber: 0, pickNumber: p + 1 })),
      })),
    [runDecks],
  );

  const clusters = useMemo<ClusterInfo[]>(
    () =>
      skeletons
        .map((skel, idx) => {
          const members = runDecks.filter((d) => d.clusterId === skel.clusterId);
          let we = 0;
          let tot = 0;
          let trophies = 0;
          const archCounts: Record<string, number> = {};
          for (const d of members) {
            we += d.matchWins + 0.5 * d.matchDraws;
            tot += d.matchWins + d.matchLosses + d.matchDraws;
            if (d.trophy) trophies += 1;
            if (d.archetype) archCounts[d.archetype] = (archCounts[d.archetype] ?? 0) + 1;
          }
          const dominant = Object.entries(archCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
          const colorProfile = skel.colorProfile || 'C';
          return {
            clusterId: skel.clusterId,
            idx,
            skel,
            color: CLUSTER_COLORS[idx % CLUSTER_COLORS.length]!,
            colorProfile,
            label: `${colorProfile}${dominant ? ` ${dominant}` : ''}`,
            members,
            count: members.length,
            winRate: tot ? we / tot : 0,
            trophies,
          };
        })
        .filter((c) => c.count > 0),
    [skeletons, runDecks],
  );
  const clustersByWinRate = useMemo(() => [...clusters].sort((a, b) => b.winRate - a.winRate), [clusters]);
  const selectedCluster = useMemo(
    () => clusters.find((c) => c.clusterId === selectedClusterId) ?? null,
    [clusters, selectedClusterId],
  );
  const selectedDeck = selectedPoolIndex != null ? (runDecks[selectedPoolIndex] ?? null) : null;
  const selectedClusterDeckBuilds = useMemo<BuiltDeck[] | null>(
    () =>
      selectedCluster
        ? (selectedCluster.skel.poolIndices.map((i) => allDeckBuilds[i]).filter(Boolean) as BuiltDeck[])
        : null,
    [selectedCluster, allDeckBuilds],
  );
  const archetypeDomain = winrateDomain(
    clusters.map((c) => c.winRate),
    baseline,
  );

  // ── Aggregations (appearance-weighted win rate per group) ──────────────────
  const aggregate = (keyFn: (r: CardRow) => string, order: string[], colorFor: (k: string) => string) => {
    const groups: Record<string, { mWe: number; mC: number; n: number }> = {};
    for (const r of allRows) {
      const k = keyFn(r);
      if (!groups[k]) groups[k] = { mWe: 0, mC: 0, n: 0 };
      groups[k]!.mWe += r.mWe;
      groups[k]!.mC += r.mC;
      groups[k]!.n += r.decks;
    }
    return order
      .filter((k) => groups[k] && groups[k]!.mC > 0)
      .map((k) => ({ key: k, label: k, swatch: colorFor(k), winRate: groups[k]!.mWe / groups[k]!.mC, n: groups[k]!.n }));
  };

  const byColor = aggregate((r) => r.colorCategory, COLOR_ORDER, (k) => COLOR_MAP[k] ?? '#888').sort(
    (a, b) => b.winRate - a.winRate,
  );
  const byType = aggregate((r) => r.type, TYPE_ORDER, (k) => TYPE_COLORS[k] ?? '#888').sort((a, b) => b.winRate - a.winRate);
  const cmcBuckets = ['0', '1', '2', '3', '4', '5', '6', '7+'];
  const byCmc = aggregate(
    (r) => {
      const c = Math.max(0, Math.floor(r.cmc));
      return c >= 7 ? '7+' : String(c);
    },
    cmcBuckets,
    () => '#67A6D3',
  ); // keep mana-value order (no re-sort)

  const colorDomain = winrateDomain(byColor.map((b) => b.winRate), baseline);
  const typeDomain = winrateDomain(byType.map((b) => b.winRate), baseline);
  const cmcDomain = winrateDomain(byCmc.map((b) => b.winRate), baseline);

  // ── Leaderboards (over/under ranked by Match Elo — more robust than raw %) ──
  const topPerformers = [...rows].sort((a, b) => b.matchElo - a.matchElo || b.winRate - a.winRate).slice(0, 8);
  const underPerformers = [...rows].sort((a, b) => a.matchElo - b.matchElo || a.winRate - b.winRate).slice(0, 8);
  const topPlayed = [...allRows].sort((a, b) => b.decks - a.decks).slice(0, 8);
  const trophyCards = [...allRows]
    .filter((r) => r.trophyCount > 0)
    .sort((a, b) => b.trophyCount - a.trophyCount || b.trophyRate - a.trophyRate);

  const renderPercent = (val: number) => <>{(val * 100).toFixed(1)}%</>;

  const minDeckOptions = [1, 2, 3, 5, 10].map((n) => ({ value: `${n}`, label: `${n}+ decks` }));
  const cardOptions = [...allRows]
    .sort((a, b) => b.decks - a.decks)
    .map((r) => ({ value: r.oracle, label: `${r.name} (${r.decks})` }));
  const selectedRow = byOracle[activeOracle];

  const synergyList = (entries: PartnerEntry[] | undefined, empty: string) => {
    const items = (entries ?? []).map((e) => ({ e, card: cardDict[e.oracle] })).filter((x) => x.card).slice(0, 8);
    if (items.length === 0) return <Text sm className="text-text-secondary">{empty}</Text>;
    return (
      <Flexbox direction="col" gap="0">
        {items.map(({ e, card }) => (
          <SynergyRow
            key={e.oracle}
            card={card}
            over={e.winRate >= baseline}
            right={fmtPct(e.winRate)}
            sub={`${e.decks} deck${e.decks === 1 ? '' : 's'}`}
          />
        ))}
      </Flexbox>
    );
  };
  const matchupList = (entries: RivalEntry[] | undefined, empty: string) => {
    const items = (entries ?? []).map((e) => ({ e, card: cardDict[e.oracle] })).filter((x) => x.card).slice(0, 8);
    if (items.length === 0) return <Text sm className="text-text-secondary">{empty}</Text>;
    return (
      <Flexbox direction="col" gap="0">
        {items.map(({ e, card }) => (
          <SynergyRow
            key={e.oracle}
            card={card}
            over={e.winRate >= baseline}
            right={fmtPct(e.winRate)}
            sub={`${e.matches} match${e.matches === 1 ? '' : 'es'}`}
          />
        ))}
      </Flexbox>
    );
  };

  return (
    <Flexbox direction="col" gap="3" className="p-2">
      <RunControls
        runs={runs}
        selectedTs={selectedTs}
        isRunning={isRunning}
        loadingRun={loadingRun}
        runError={runError}
        simPhase={simPhase}
        overallProgress={getOverallSimProgress(simPhase, modelLoadProgress, 0)}
        onRun={handleRun}
        onCancel={() => abortRef.current?.abort()}
        onLoad={handleLoadRun}
        onDelete={handleDeleteRun}
        onClear={handleClearHistory}
      />

      {!displayRun ? (
        <CardUI>
          <CardBody>
            <Flexbox direction="col" gap="2" alignItems="start">
              <Text lg semibold>
                No analysis yet
              </Text>
              <Text sm className="text-text-secondary">
                Run an analysis to compute win rates, synergies, matchups, Match Elo, and the archetype map from this
                cube&apos;s records. It runs in your browser and is saved locally.
              </Text>
            </Flexbox>
          </CardBody>
        </CardUI>
      ) : allRows.length === 0 ? (
        <CardUI>
          <CardBody>
            <Text sm className="text-text-secondary">
              This analysis found no decks with recorded match results. Upload decks and enter match results, then run
              again.
            </Text>
          </CardBody>
        </CardUI>
      ) : (
        <>
          {/* Controls + framing */}
          <CardUI>
            <CardBody className="py-2">
              <Flexbox direction="row" gap="3" alignItems="center" wrap="wrap" justify="between">
                <Text sm className="text-text-secondary">
                  Over/under-performance is measured against this cube&apos;s{' '}
                  <span className="font-semibold text-text">average win rate ({fmtPct(baseline)})</span> — green beats
                  the average, red trails it. Draws count as half a win.
                </Text>
            <Flexbox direction="row" gap="2" alignItems="center" className="shrink-0">
              <Text sm className="text-nowrap">
                Min. sample
              </Text>
              <div className="w-32">
                <Select dense value={`${effectiveMin}`} setValue={(v) => setMinDecks(parseInt(v, 10))} options={minDeckOptions} />
              </div>
            </Flexbox>
          </Flexbox>
        </CardBody>
      </CardUI>

      {/* By color / by type */}
      <Row className="g-3">
        <Col xs={12} lg={6}>
          <Panel title="Win Rate by Color" tooltip="Appearance-weighted match win rate of all cards in each color category, vs the cube average.">
            <DivergingBars rows={byColor} domain={colorDomain} baseline={baseline} />
          </Panel>
        </Col>
        <Col xs={12} lg={6}>
          <Panel title="Win Rate by Card Type" tooltip="Appearance-weighted match win rate by primary card type, vs the cube average.">
            <DivergingBars rows={byType} domain={typeDomain} baseline={baseline} showSwatch={false} />
          </Panel>
        </Col>
      </Row>

      {/* By mana value / distribution */}
      <Row className="g-3">
        <Col xs={12} lg={6}>
          <Panel title="Win Rate by Mana Value" tooltip="Appearance-weighted match win rate grouped by mana value, vs the cube average.">
            <DivergingBars rows={byCmc} domain={cmcDomain} baseline={baseline} showSwatch={false} />
          </Panel>
        </Col>
        <Col xs={12} lg={6}>
          <Panel title="Win Rate Distribution" tooltip={`Per-card match win rates (cards with ${effectiveMin}+ decks), 2.5% buckets. Red = below the cube average, green = above.`}>
            <WinRateHistogram winRates={rows.map((r) => r.winRate)} baseline={baseline} />
          </Panel>
        </Col>
      </Row>

      {/* Archetype map (left, with the win-rate list beneath it) + the selected
          archetype's detail card on its right. */}
      <Row className="g-3">
        <Col xs={12}>
          <Panel
            title="Archetype Map"
            tooltip="Every recorded deck projected to 2D by the draft model — decks that play alike sit together. Click a deck on the map, or an archetype in the list below it, to open that archetype on the right. Colour by cluster, or by each deck's colours."
            right={
              <div className="flex rounded-md border border-border overflow-hidden text-xs">
                {(['cluster', 'deckColor'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setMapColorBy(mode)}
                    className={`px-2 py-1 ${mapColorBy === mode ? 'bg-bg-active font-semibold' : 'text-text-secondary hover:bg-bg-active'}`}
                  >
                    {mode === 'cluster' ? 'Cluster' : 'Deck colour'}
                  </button>
                ))}
              </div>
            }
          >
            {clusters.length === 0 ? (
              <Text sm className="text-text-secondary">
                Run the analysis to cluster decks into archetypes.
              </Text>
            ) : (
              <div className={`grid grid-cols-1 gap-5 ${selectedCluster ? 'lg:grid-cols-12' : ''}`}>
                {/* LEFT: the archetype list, then the map, then the selected deck. */}
                <div className={selectedCluster ? 'lg:col-span-5 min-w-0' : 'min-w-0'}>
                  <Flexbox direction="col" gap="1">
                    {clustersByWinRate.map((c: ClusterInfo) => {
                      const lo = archetypeDomain[0];
                      const hi = archetypeDomain[1];
                      const pos = (w: number) => ((Math.min(hi, Math.max(lo, w)) - lo) / (hi - lo)) * 100;
                      const center = pos(baseline);
                      const p = pos(c.winRate);
                      return (
                        <button
                          key={c.clusterId}
                          type="button"
                          onClick={() => {
                            setSelectedClusterId(c.clusterId);
                            setSelectedPoolIndex(null);
                          }}
                          className={`flex items-center gap-2 w-full text-left rounded px-1 py-0.5 ${c.clusterId === selectedClusterId ? 'bg-bg-active' : 'hover:bg-bg-active'}`}
                        >
                          <span className="inline-block h-3 w-3 rounded-sm shrink-0" style={{ background: c.color }} />
                          <Text sm semibold className="w-28 shrink-0 truncate">
                            {c.label}
                          </Text>
                          <div className="flex-1 min-w-0">
                            <svg viewBox="0 0 100 14" preserveAspectRatio="none" width="100%" height="14" className="block">
                              <rect x={0} y={3} width={100} height={8} rx={2} style={{ fill: 'rgb(var(--bg-active))' }} />
                              <rect
                                x={Math.min(center, p)}
                                y={3}
                                width={Math.max(0.8, Math.abs(p - center))}
                                height={8}
                                rx={1.5}
                                fill={perfColor(c.winRate, baseline)}
                              />
                              <rect x={center - 0.2} y={0} width={0.4} height={14} style={{ fill: 'rgb(var(--text-secondary))' }} />
                            </svg>
                          </div>
                          <Text xs semibold className="w-11 text-right tabular-nums">
                            <span style={{ color: perfColor(c.winRate, baseline) }}>{fmtPct(c.winRate)}</span>
                          </Text>
                          <Text xs className="w-12 text-right text-text-secondary tabular-nums">
                            {c.count}
                            {c.trophies > 0 ? ` ·${c.trophies}🏆` : ''}
                          </Text>
                        </button>
                      );
                    })}
                  </Flexbox>
                  <div className="mt-4">
                    <DeckMap
                      decks={runDecks}
                      skeletons={skeletons}
                      colorBy={mapColorBy}
                      selectedClusterId={selectedCluster ? selectedClusterId : null}
                      selectedPoolIndex={selectedPoolIndex}
                      onSelectPoint={(pi, cid) => {
                        setSelectedPoolIndex(pi);
                        setSelectedClusterId(cid);
                      }}
                    />
                  </div>
                  {selectedDeck && (
                    <div className="mt-4 rounded-lg border border-border bg-bg-accent/30 overflow-hidden">
                      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border bg-bg-accent/50">
                        <Flexbox direction="col" gap="0" className="min-w-0">
                          <Text sm semibold className="truncate">
                            {selectedDeck.playerName}
                            {selectedDeck.trophy ? ' 🏆' : ''}
                          </Text>
                          <Text xs className="text-text-secondary truncate">
                            {deckLabel(selectedDeck)} · {recordStr(selectedDeck)}
                          </Text>
                        </Flexbox>
                        <div className="flex items-center gap-2 shrink-0">
                          <a href={`/cube/record/${selectedDeck.recordId}`} className="text-link text-xs hover:underline">
                            view record
                          </a>
                          <button
                            type="button"
                            onClick={() => setSelectedPoolIndex(null)}
                            className="text-text-secondary hover:bg-bg-active rounded px-1"
                            title="Clear selected deck"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                      <SimDeckView deck={{ mainboard: selectedDeck.oracles, sideboard: [] }} cardMeta={simCardMeta} />
                    </div>
                  )}
                </div>

                {/* RIGHT: the selected archetype's card — tabbed view + stat charts. */}
                {selectedCluster && (
                  <div className="lg:col-span-7 min-w-0">
                    <Flexbox direction="col" gap="4">
                      <ClusterDetailPanel
                        skeleton={selectedCluster.skel}
                        clusterIndex={selectedCluster.idx}
                        displayName={selectedCluster.label}
                        decksTab={{
                          label: 'Decks',
                          title: 'Every deck in this cluster, by win rate. Click one to select it on the map.',
                          content: (
                            <Flexbox direction="col" gap="0">
                              {selectedCluster.skel.poolIndices
                                .map((i) => ({ i, d: runDecks[i] }))
                                .filter((x): x is { i: number; d: AnalysisDeck } => !!x.d)
                                .sort(
                                  (a, b) =>
                                    rate(b.d.matchWins, b.d.matchLosses, b.d.matchDraws) -
                                    rate(a.d.matchWins, a.d.matchLosses, a.d.matchDraws),
                                )
                                .map(({ i, d }) => {
                                  const wr = rate(d.matchWins, d.matchLosses, d.matchDraws);
                                  return (
                                    <button
                                      key={i}
                                      type="button"
                                      onClick={() => setSelectedPoolIndex(i)}
                                      className={`flex items-center gap-2 w-full text-left px-2 py-1.5 border-b border-border last:border-b-0 ${
                                        i === selectedPoolIndex ? 'bg-bg-active' : 'hover:bg-bg-active'
                                      }`}
                                    >
                                      <span className="w-4 shrink-0 flex justify-center text-yellow-500">
                                        {d.trophy ? <TrophyIcon size={14} /> : null}
                                      </span>
                                      <Flexbox direction="col" gap="0" className="min-w-0 flex-1">
                                        <Text sm semibold className="truncate">
                                          {d.playerName}
                                        </Text>
                                        <Text xs className="text-text-secondary truncate">
                                          {deckLabel(d)} · {d.recordName}
                                        </Text>
                                      </Flexbox>
                                      <Text xs semibold className="tabular-nums w-12 text-right shrink-0">
                                        {recordStr(d)}
                                      </Text>
                                      <Text sm semibold className="tabular-nums w-14 text-right shrink-0">
                                        <span style={{ color: perfColor(wr, baseline) }}>{fmtPct(wr)}</span>
                                      </Text>
                                    </button>
                                  );
                                })}
                            </Flexbox>
                          ),
                        }}
                        totalPools={runDecks.length}
                        clusterDeckBuilds={selectedClusterDeckBuilds}
                        cubeOracleSet={cubeOracleSet}
                        cardMeta={simCardMeta}
                        slimPools={allSlimPools}
                        deckBuilds={allDeckBuilds}
                        excludeManaFixingLands={excludeManaFixingLands}
                        setExcludeManaFixingLands={setExcludeManaFixingLands}
                        onOpenPool={(pi) => {
                          const d = runDecks[pi];
                          if (d) window.open(`/cube/record/${d.recordId}`, '_blank', 'noopener');
                        }}
                        poolLabel={(pi) => {
                          const d = runDecks[pi];
                          return d ? `${d.playerName} · ${recordStr(d)}${d.trophy ? ' 🏆' : ''}` : '';
                        }}
                        onClose={() => {
                          setSelectedClusterId(null);
                          setSelectedPoolIndex(null);
                        }}
                      />
                    </Flexbox>
                  </div>
                )}
              </div>
            )}
          </Panel>
        </Col>
      </Row>

      {/* Archetype-vs-archetype matchup matrix (win rates already live on the map). */}
      {clusters.length > 0 && (
        <Row className="g-3">
          <Col xs={12}>
            <Panel
              title="Archetype Matchups"
              tooltip="Row vs column: how each archetype's decks fared against each other archetype. Green beats the cube average, red trails it. Click a row to focus that archetype."
            >
              <ArchetypeMatchupMatrix
                clusters={clustersByWinRate}
                matchups={clusterMatchups}
                baseline={baseline}
                selectedClusterId={selectedClusterId}
                onSelect={(id) => {
                  setSelectedClusterId(id);
                  setSelectedPoolIndex(null);
                }}
              />
            </Panel>
          </Col>
        </Row>
      )}

      {/* Reputation vs reality (match Elo × draft Elo) — full width */}
      <Row className="g-3">
        <Col xs={12}>
          <Panel
            title="Reputation vs Reality"
            tooltip="Each card's Cobra draft Elo (how strong the model expects it to be) against its Match Elo (how it actually performed in your records). Above the dashed line = overperforming its draft reputation."
          >
            <EloScatter rows={rows} />
          </Panel>
        </Col>
      </Row>

      {/* Trophy case — full width */}
      <Row className="g-3">
        <Col xs={12}>
          <CardUI>
            <CardHeader>
              <Text semibold md>
                🏆 Trophy Case
              </Text>
            </CardHeader>
            <TrophyArchive records={records} lastKey={lastKey} />
          </CardUI>
        </Col>
      </Row>

      {/* Leaderboards */}
      <Row className="g-3">
        <Col xs={12} md={6} lg={3}>
          <Panel title="🔥 Overperformers" tooltip={`Highest Match Elo among cards with ${effectiveMin}+ decks — performance vs the strength of opposition faced.`}>
            <Leaderboard
              rows={topPerformers}
              metric={(r) => `${r.matchElo}`}
              sub={(r) => `${fmtPct(r.winRate)} · ${r.decks}d`}
            />
          </Panel>
        </Col>
        <Col xs={12} md={6} lg={3}>
          <Panel title="🧊 Underperformers" tooltip={`Lowest Match Elo among cards with ${effectiveMin}+ decks.`}>
            <Leaderboard
              rows={underPerformers}
              metric={(r) => `${r.matchElo}`}
              sub={(r) => `${fmtPct(r.winRate)} · ${r.decks}d`}
            />
          </Panel>
        </Col>
        <Col xs={12} md={6} lg={3}>
          <Panel title="📈 Most Played" tooltip="Cards appearing in the most decks across all records.">
            <Leaderboard rows={topPlayed} metric={(r) => `${r.decks}`} sub={(r) => `${fmtPct(r.winRate)} win`} />
          </Panel>
        </Col>
        <Col xs={12} md={6} lg={3}>
          <Panel title="🏅 Trophy Leaders" tooltip="Cards in the most trophy-winning decks.">
            <Leaderboard rows={trophyCards.slice(0, 8)} metric={(r) => `${r.trophyCount} 🏆`} sub={(r) => `${fmtPct(r.trophyRate)} of decks`} />
          </Panel>
        </Col>
      </Row>

      {/* Synergy: top pairs + card deep-dive */}
      <Row className="g-3">
        <Col xs={12} lg={4}>
          <Panel title="🤝 Top Synergies" tooltip="Card pairs that, when played in the same deck, win the most — the strongest two-card combos in your records.">
            {topSynergies === null ? (
              <Flexbox direction="row" gap="2" alignItems="center">
                <Spinner sm />
                <Text sm className="text-text-secondary">
                  Loading…
                </Text>
              </Flexbox>
            ) : topSynergies.length === 0 ? (
              <Text sm className="text-text-secondary">
                Not enough co-occurrence data yet. Recompile analytics after more records.
              </Text>
            ) : (
              <Flexbox direction="col" gap="0">
                {topSynergies
                  .map((s) => ({ s, a: cardDict[s.a], b: cardDict[s.b] }))
                  .filter((x) => x.a && x.b)
                  .slice(0, 12)
                  .map(({ s, a, b }) => (
                    <div key={`${s.a}|${s.b}`} className="flex items-center gap-2 py-1 border-b border-border last:border-b-0">
                      <div className="flex-1 min-w-0 text-sm truncate">
                        {renderCardLink(a!)} <span className="text-text-secondary">+</span> {renderCardLink(b!)}
                      </div>
                      <Flexbox direction="col" gap="0" className="items-end shrink-0">
                        <Text sm semibold className="tabular-nums">
                          <span style={{ color: perfColor(s.winRate, baseline) }}>{fmtPct(s.winRate)}</span>
                        </Text>
                        <Text xs className="text-text-secondary tabular-nums">
                          {s.decks} decks
                        </Text>
                      </Flexbox>
                    </div>
                  ))}
              </Flexbox>
            )}
          </Panel>
        </Col>
        <Col xs={12} lg={8}>
          <Panel
            title="Card Deep-Dive"
            tooltip="Pick a card to see which cards it wins WITH (synergies) and how it fares AGAINST opposing decks (matchups)."
            right={
              <div className="w-64 max-w-[50vw]">
                <Select dense value={activeOracle} setValue={setSelectedOracle} options={cardOptions} />
              </div>
            }
          >
            {selectedRow && (
              <Flexbox direction="row" gap="3" alignItems="center" className="mb-2">
                <span className="inline-block h-3 w-3 rounded-sm shrink-0" style={{ background: COLOR_MAP[selectedRow.colorCategory] ?? '#888' }} />
                <Text semibold>{selectedRow.name}</Text>
                <Text sm className="text-text-secondary">
                  {fmtPct(selectedRow.winRate)} win · {selectedRow.decks} decks · {selectedRow.trophyCount} 🏆
                </Text>
              </Flexbox>
            )}
            <Row className="g-3">
              <Col xs={12} md={6}>
                <Text xs semibold className="text-text-secondary uppercase tracking-wide">
                  Best partners
                </Text>
                {synergyList(synergy?.partners?.top, 'No shared-deck data yet.')}
              </Col>
              <Col xs={12} md={6}>
                <Text xs semibold className="text-text-secondary uppercase tracking-wide">
                  Worst partners
                </Text>
                {synergyList(synergy?.partners?.bottom, 'No shared-deck data yet.')}
              </Col>
              <Col xs={12} md={6}>
                <Text xs semibold className="text-text-secondary uppercase tracking-wide">
                  Dominates (vs opposing decks)
                </Text>
                {matchupList(synergy?.matchups?.beats, 'No matchup data yet.')}
              </Col>
              <Col xs={12} md={6}>
                <Text xs semibold className="text-text-secondary uppercase tracking-wide">
                  Struggles against
                </Text>
                {matchupList(synergy?.matchups?.losesTo, 'No matchup data yet.')}
              </Col>
            </Row>
          </Panel>
        </Col>
      </Row>

      {/* Full table */}
      <Panel
        title="All Cards"
        tooltip={`Every tracked card with ${effectiveMin}+ decks. Click a column to sort; export to CSV from the header.`}
        right={
          <Text xs className="text-text-secondary">
            {rows.length.toLocaleString()} cards
          </Text>
        }
      >
        <Text xs className="text-text-secondary mb-2">
          <span className="font-semibold text-text">Draft Elo</span> is CubeCobra&apos;s global pick-based rating (how
          highly the card is drafted everywhere). <span className="font-semibold text-text">Match Elo</span> is computed
          from this cube&apos;s match results — it rises when the card&apos;s decks beat higher-rated opposition.
        </Text>
        <div className="overflow-x-auto">
          <SortableTable
            columnProps={[
              { key: 'card', title: 'Card', heading: true, sortable: true, renderFn: renderCardLink },
              { key: 'colorCategory', title: 'Colors', sortable: true, heading: false, renderFn: (_v, row) => renderColorPips(row.card) },
              { key: 'type', title: 'Type', sortable: true, heading: false },
              { key: 'cmc', title: 'MV', sortable: true, heading: false },
              { key: 'decks', title: 'Decks', sortable: true, heading: false },
              { key: 'winRate', title: 'Match Win %', sortable: true, heading: false, renderFn: renderPercent },
              { key: 'matchCount', title: 'Matches', sortable: true, heading: false },
              { key: 'gameWinRate', title: 'Game Win %', sortable: true, heading: false, renderFn: renderPercent },
              { key: 'trophyCount', title: 'Trophies', sortable: true, heading: false },
              {
                key: 'matchElo',
                title: 'Match Elo',
                sortable: true,
                heading: false,
                tooltip: "Performance Elo from this cube's match results — independent of draft Elo.",
                renderFn: (_v, row) => (row.hasMatchElo ? row.matchElo : '—'),
              },
              {
                key: 'draftElo',
                title: 'Draft Elo',
                sortable: true,
                heading: false,
                tooltip: 'CubeCobra global draft Elo — how highly the card is picked across all cubes.',
              },
            ]}
            data={rows}
            sortFns={{ card: (a: Card, b: Card) => cardNameLower(a).localeCompare(cardNameLower(b)) }}
            defaultSortConfig={{ key: 'decks', direction: 'descending' }}
          />
        </div>
      </Panel>
        </>
      )}
    </Flexbox>
  );
};

export default WinrateAnalytics;
