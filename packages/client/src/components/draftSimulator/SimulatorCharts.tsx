import React from 'react';

import type { BuiltDeck, CardMeta } from '@utils/datatypes/SimulationReport';

import { ArcElement, BarElement, CategoryScale, Chart as ChartJS, Legend, Tooltip } from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import Text from '../base/Text';

ChartJS.register(ArcElement, BarElement, CategoryScale, Tooltip, Legend);

export const COLOR_KEYS = ['W', 'U', 'B', 'R', 'G'] as const;
export const COLOR_KEYS_WITH_C = [...COLOR_KEYS, 'C'] as const;

export const MTG_COLORS: Record<string, { bg: string; label: string }> = {
  W: { bg: '#D8CEAB', label: 'White' },
  U: { bg: '#67A6D3', label: 'Blue' },
  B: { bg: '#8C7A91', label: 'Black' },
  R: { bg: '#D85F69', label: 'Red' },
  G: { bg: '#6AB572', label: 'Green' },
  C: { bg: '#ADADAD', label: 'Colorless' },
  M: { bg: '#DBC467', label: 'Multicolor' },
};

export const MANA_CURVE_BUCKETS = [
  { key: '0', label: '0' },
  { key: '1', label: '1' },
  { key: '2', label: '2' },
  { key: '3', label: '3' },
  { key: '4', label: '4' },
  { key: '5', label: '5' },
  { key: '6', label: '6' },
  { key: '7+', label: '7+' },
] as const;

export const HISTOGRAM_HEIGHT = 56; // px — bar drawing area

export const CARD_TYPE_COLORS: Record<string, string> = {
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

export const CARD_TYPE_ORDER = ['Creature', 'Instant', 'Sorcery', 'Enchantment', 'Artifact', 'Planeswalker', 'Land', 'Battle', 'Other'];

export function normalizeColorOrder(profile: string): string {
  if (!profile || profile === 'C') return 'C';
  const sorted = profile.split('').filter((c) => COLOR_KEYS.includes(c as any)).sort((a, b) => COLOR_KEYS.indexOf(a as any) - COLOR_KEYS.indexOf(b as any));
  return sorted.length > 0 ? sorted.join('') : 'C';
}

export function getDeckShareColors(oracle: string, cardMeta: Record<string, CardMeta>): string[] {
  const meta = cardMeta[oracle];
  if ((meta?.type ?? '').toLowerCase().includes('land')) return [];
  const identity = (meta?.colorIdentity ?? []).filter((color) => MTG_COLORS[color] && color !== 'C');
  return identity.length > 0 ? identity : ['C'];
}

/** Reads the --text CSS variable as an rgb() string, reacting to theme changes. */
export function useChartTextColor(): string {
  const read = () => {
    if (typeof document === 'undefined') return 'rgb(33,37,41)';
    const v = getComputedStyle(document.documentElement).getPropertyValue('--text').trim();
    return v ? `rgb(${v})` : 'rgb(33,37,41)';
  };
  const [color, setColor] = React.useState(read);
  React.useEffect(() => {
    const obs = new MutationObserver(() => setColor(read()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] });
    return () => obs.disconnect();
  }, []);
  return color;
}

export function makeDoughnutOptions(textColor: string) {
  return {
    responsive: true,
    maintainAspectRatio: true,
    animation: false as const,
    plugins: {
      legend: {
        position: 'right' as const,
        labels: {
          usePointStyle: true,
          padding: 10,
          font: { size: 11 },
          color: textColor,
          generateLabels: (chart: any) => {
            const data = chart.data;
            return (data.labels as string[]).map((label: string, i: number) => ({
              text: `${label}  ${(data.datasets[0].data[i] as number).toFixed(0)}%`,
              fillStyle: data.datasets[0].backgroundColor[i],
              strokeStyle: data.datasets[0].backgroundColor[i],
              fontColor: textColor,
              pointStyle: 'circle' as const,
              hidden: false,
              index: i,
            }));
          },
        },
      },
      tooltip: {
        callbacks: {
          label: (ctx: any) => ` ${ctx.label}: ${(ctx.raw as number).toFixed(1)}%`,
        },
      },
    },
    cutout: '55%',
  };
}

export function makeEloHistogramOptions(textColor: string) {
  return {
    responsive: true,
    maintainAspectRatio: true,
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 10 }, color: textColor } },
      y: { beginAtZero: true, grid: { display: false }, ticks: { font: { size: 10 }, color: textColor } },
    },
    plugins: { legend: { display: false } },
  };
}

export function getMajorCardType(typeStr: string): string {
  for (const t of CARD_TYPE_ORDER) {
    if (t !== 'Other' && typeStr.includes(t)) return t;
  }
  return 'Other';
}

export const RowColorShare: React.FC<{ deck: BuiltDeck | null; cardMeta: Record<string, CardMeta> }> = ({ deck, cardMeta }) => {
  if (!deck || deck.mainboard.length === 0) return null;
  const shares: Record<string, number> = Object.fromEntries(COLOR_KEYS_WITH_C.map((k) => [k, 0]));
  for (const oracle of deck.mainboard) {
    const colors = getDeckShareColors(oracle, cardMeta);
    if (colors.length === 0) continue;
    const share = 1 / colors.length;
    for (const c of colors) shares[c] = (shares[c] ?? 0) + share;
  }
  const total = Object.values(shares).reduce((s, v) => s + v, 0);
  if (total === 0) return null;
  const segments = COLOR_KEYS_WITH_C.map((k) => ({ key: k, pct: (shares[k] ?? 0) / total, bg: MTG_COLORS[k]!.bg })).filter(
    (s) => s.pct > 0.01,
  );
  return (
    <div className="flex w-full overflow-hidden rounded-sm" style={{ height: 10 }}>
      {segments.map((s) => (
        <div
          key={s.key}
          style={{ width: `${s.pct * 100}%`, background: s.bg }}
          title={`${s.key}: ${(s.pct * 100).toFixed(0)}%`}
        />
      ))}
    </div>
  );
};

export const DeckColorShareChart: React.FC<{ deckBuilds: BuiltDeck[] | null; cardMeta: Record<string, CardMeta> }> = ({
  deckBuilds,
  cardMeta,
}) => {
  const textColor = useChartTextColor();
  const segments = getDeckColorShareSegments(deckBuilds, cardMeta);
  if (!segments) {
    return <Text sm className="text-text-secondary">Unavailable for this filter.</Text>;
  }

  const chartData = {
    labels: segments.map((s) => s.label),
    datasets: [
      {
        data: segments.map((s) => s.pct * 100),
        backgroundColor: segments.map((s) => s.bg),
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
      },
    ],
  };

  return (
    <div className="w-full">
      <Doughnut data={chartData} options={makeDoughnutOptions(textColor)} />
    </div>
  );
};

export function getDeckColorShareSegments(deckBuilds: BuiltDeck[] | null, cardMeta: Record<string, CardMeta>) {
  if (!deckBuilds || deckBuilds.length === 0) return null;

  const shares: Record<string, number> = Object.fromEntries(COLOR_KEYS_WITH_C.map((key) => [key, 0]));
  for (const deck of deckBuilds) {
    for (const oracle of deck.mainboard) {
      const cardColors = getDeckShareColors(oracle, cardMeta);
      if (cardColors.length === 0) continue;
      const share = 1 / cardColors.length;
      for (const color of cardColors) shares[color] = (shares[color] ?? 0) + share;
    }
  }
  const totalShare = Object.values(shares).reduce((sum, v) => sum + v, 0);
  return COLOR_KEYS_WITH_C.map((key) => ({
    key,
    label: MTG_COLORS[key]!.label,
    bg: MTG_COLORS[key]!.bg,
    pct: totalShare > 0 ? (shares[key] ?? 0) / totalShare : 0,
  })).filter((s) => s.pct > 0.005);
}

export const DeckColorShareLegend: React.FC<{ deckBuilds: BuiltDeck[] | null; cardMeta: Record<string, CardMeta> }> = ({
  deckBuilds,
  cardMeta,
}) => {
  const segments = getDeckColorShareSegments(deckBuilds, cardMeta);
  if (!segments) {
    return <Text sm className="text-text-secondary">Unavailable for this filter.</Text>;
  }
  return (
    <div className="flex flex-col gap-1.5">
      {segments.map((segment) => (
        <div key={segment.key} className="flex items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full border border-black/10"
              style={{ background: segment.bg }}
            />
            <span className="text-text-secondary">{segment.label}</span>
          </div>
          <span className="font-medium text-text tabular-nums">{(segment.pct * 100).toFixed(0)}%</span>
        </div>
      ))}
    </div>
  );
};

export const ManaCurveShareChart: React.FC<{ deckBuilds: BuiltDeck[] | null; cardMeta: Record<string, CardMeta> }> = ({
  deckBuilds,
  cardMeta,
}) => {
  if (!deckBuilds || deckBuilds.length === 0) {
    return <Text sm className="text-text-secondary">Unavailable for this filter.</Text>;
  }

  const counts: Record<string, number> = Object.fromEntries(MANA_CURVE_BUCKETS.map((b) => [b.key, 0]));
  let totalCards = 0;
  for (const deck of deckBuilds) {
    for (const oracle of deck.mainboard) {
      const meta = cardMeta[oracle];
      if ((meta?.type ?? '').toLowerCase().includes('land')) continue;
      const cmc = Math.max(0, Math.floor(meta?.cmc ?? 0));
      const key = cmc >= 7 ? '7+' : String(cmc);
      counts[key] = (counts[key] ?? 0) + 1;
      totalCards++;
    }
  }

  const buckets = MANA_CURVE_BUCKETS.map((b) => ({
    ...b,
    pct: totalCards > 0 ? (counts[b.key] ?? 0) / totalCards : 0,
  }));
  const maxPct = Math.max(...buckets.map((b) => b.pct), 0.001);

  return (
    <div className="flex flex-col gap-1">
      {/* Histogram bars */}
      <div className="flex items-end gap-1" style={{ height: HISTOGRAM_HEIGHT }}>
        {buckets.map((b) => {
          const barH = Math.round((b.pct / maxPct) * HISTOGRAM_HEIGHT);
          return (
            <div key={b.key} className="flex-1 flex flex-col items-center justify-end" style={{ height: HISTOGRAM_HEIGHT }}>
              {b.pct > 0 && (
                <div
                  title={`${b.label}: ${(b.pct * 100).toFixed(1)}%`}
                  style={{
                    height: Math.max(3, barH),
                    width: '100%',
                    borderRadius: '4px 4px 0 0',
                    background: 'rgb(var(--link) / 0.65)',
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
      {/* Baseline */}
      <div className="w-full" style={{ height: 1, background: 'rgb(var(--border))' }} />
      {/* X-axis labels */}
      <div className="flex gap-1">
        {buckets.map((b) => (
          <div key={b.key} className="flex-1 text-center text-[10px] text-text-secondary">{b.label}</div>
        ))}
      </div>
      {/* Value row — compact, under axis */}
      <div className="flex gap-1 mt-0.5">
        {buckets.map((b) => (
          <div key={b.key} className="flex-1 text-center text-[10px] font-semibold text-text tabular-nums">
            {b.pct > 0 ? `${(b.pct * 100).toFixed(0)}%` : ''}
          </div>
        ))}
      </div>
    </div>
  );
};

export const CardTypeShareChart: React.FC<{ deckBuilds: BuiltDeck[] | null; cardMeta: Record<string, CardMeta> }> = ({
  deckBuilds,
  cardMeta,
}) => {
  const textColor = useChartTextColor();
  const entries = getCardTypeShareEntries(deckBuilds, cardMeta);
  if (!entries) {
    return <Text sm className="text-text-secondary">Unavailable for this filter.</Text>;
  }

  const chartData = {
    labels: entries.map((e) => e.label),
    datasets: [
      {
        data: entries.map((e) => e.pct * 100),
        backgroundColor: entries.map((e) => e.bg),
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
      },
    ],
  };

  return (
    <div className="w-full">
      <Doughnut data={chartData} options={makeDoughnutOptions(textColor)} />
    </div>
  );
};

export function getCardTypeShareEntries(deckBuilds: BuiltDeck[] | null, cardMeta: Record<string, CardMeta>) {
  if (!deckBuilds || deckBuilds.length === 0) return null;

  const counts: Record<string, number> = Object.fromEntries(CARD_TYPE_ORDER.map((t) => [t, 0]));
  for (const deck of deckBuilds) {
    for (const oracle of deck.mainboard) {
      const typeStr = cardMeta[oracle]?.type ?? '';
      if (/Basic Land/i.test(typeStr)) continue;
      const t = getMajorCardType(typeStr);
      counts[t] = (counts[t] ?? 0) + 1;
    }
  }

  const entries = CARD_TYPE_ORDER.map((t) => ({ label: t, count: counts[t] ?? 0, bg: CARD_TYPE_COLORS[t]! })).filter(
    (e) => e.count > 0,
  );
  const total = entries.reduce((s, e) => s + e.count, 0);
  return entries.map((entry) => ({ ...entry, pct: total > 0 ? entry.count / total : 0 }));
}

export const CardTypeShareLegend: React.FC<{ deckBuilds: BuiltDeck[] | null; cardMeta: Record<string, CardMeta> }> = ({
  deckBuilds,
  cardMeta,
}) => {
  const entries = getCardTypeShareEntries(deckBuilds, cardMeta);
  if (!entries) {
    return <Text sm className="text-text-secondary">Unavailable for this filter.</Text>;
  }
  return (
    <div className="flex flex-col gap-1.5">
      {entries.map((entry) => (
        <div key={entry.label} className="flex items-center justify-between gap-3 text-sm">
          <span className="text-text-secondary">{entry.label}</span>
          <span className="font-medium text-text tabular-nums">{(entry.pct * 100).toFixed(0)}%</span>
        </div>
      ))}
    </div>
  );
};

export const EloDistributionChart: React.FC<{ deckBuilds: BuiltDeck[] | null; cardMeta: Record<string, CardMeta> }> = ({
  deckBuilds,
  cardMeta,
}) => {
  const textColor = useChartTextColor();
  if (!deckBuilds || deckBuilds.length === 0) {
    return <Text sm className="text-text-secondary">Unavailable for this filter.</Text>;
  }

  const elos: number[] = [];
  for (const deck of deckBuilds) {
    for (const oracle of deck.mainboard) {
      const elo = cardMeta[oracle]?.elo;
      if (elo) elos.push(elo);
    }
  }
  if (elos.length === 0) return <Text sm className="text-text-secondary">No Elo data available.</Text>;

  const minElo = Math.floor(elos.reduce((a, b) => Math.min(a, b), Infinity) / 50) * 50;
  const maxElo = Math.ceil(elos.reduce((a, b) => Math.max(a, b), -Infinity) / 50) * 50;
  const labels: string[] = [];
  const counts: number[] = [];
  for (let bucket = minElo; bucket < maxElo; bucket += 50) {
    labels.push(String(bucket));
    counts.push(elos.filter((e) => e >= bucket && e < bucket + 50).length);
  }

  const chartData = {
    labels,
    datasets: [{ data: counts, backgroundColor: '#67A6D3', borderRadius: 2 }],
  };

  return <Bar data={chartData} options={makeEloHistogramOptions(textColor)} />;
};
