import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';

import { cardColorIdentity, cardKeywords } from '@utils/cardutil';
import { cdnUrl } from '@utils/cdnUrl';
import type Card from '@utils/datatypes/Card';
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip as ChartTooltip,
} from 'chart.js';
import cloud from 'd3-cloud';
import { Bar, Doughnut } from 'react-chartjs-2';

import Button from '../components/base/Button';
import { Card as CardUI, CardBody, CardHeader } from '../components/base/Card';
import { Col, Flexbox, Row } from '../components/base/Layout';
import Text from '../components/base/Text';
import Tooltip from '../components/base/Tooltip';
import Markdown from '../components/Markdown';
import CubeContext from '../contexts/CubeContext';
import { getKeywordReminder } from '../utils/keywordReminderText';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, ChartTooltip, Legend);

// ─── Color constants ────────────────────────────────────────────────────────────
// Keyed by WUBRG pip plus C for colorless. Palette matches the At-a-Glance page.
interface PipDef {
  key: string;
  label: string;
  color: string;
}

const PIPS: PipDef[] = [
  { key: 'W', label: 'White', color: '#D8CEAB' },
  { key: 'U', label: 'Blue', color: '#67A6D3' },
  { key: 'B', label: 'Black', color: '#8C7A91' },
  { key: 'R', label: 'Red', color: '#D85F69' },
  { key: 'G', label: 'Green', color: '#6AB572' },
  { key: 'C', label: 'Colorless', color: '#ADADAD' },
];

const PIP_COLOR: Record<string, string> = Object.fromEntries(PIPS.map((p) => [p.key, p.color]));

// The color buckets a single card contributes to: each color in its identity, or C if none.
const cardColorKeys = (card: Card): string[] => {
  const identity = cardColorIdentity(card).filter((c) => 'WUBRG'.includes(c));
  return identity.length > 0 ? identity : ['C'];
};

// ─── Aggregation ─────────────────────────────────────────────────────────────────
interface KeywordStat {
  keyword: string;
  reminder?: string;
  total: number; // unique cards carrying the keyword
  byColor: Record<string, number>; // color key -> unique cards of that color with the keyword
  dominantColor: string; // pip key with the most cards, for cloud coloring
  cardNames: { name: string; scryfallId: string }[];
}

const buildStats = (cards: Card[]) => {
  const map = new Map<string, { total: number; byColor: Record<string, number>; cards: Card[] }>();
  const colorTotals: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };

  for (const card of cards) {
    const colorKeys = cardColorKeys(card);
    for (const ck of colorKeys) colorTotals[ck] += 1;

    const seen = new Set<string>();
    for (const raw of cardKeywords(card)) {
      const keyword = raw.trim();
      if (!keyword || seen.has(keyword)) continue;
      seen.add(keyword);

      let entry = map.get(keyword);
      if (!entry) {
        entry = { total: 0, byColor: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 }, cards: [] };
        map.set(keyword, entry);
      }
      entry.total += 1;
      entry.cards.push(card);
      for (const ck of colorKeys) entry.byColor[ck] += 1;
    }
  }

  const stats: KeywordStat[] = [...map.entries()].map(([keyword, entry]) => {
    const dominantColor = PIPS.reduce((best, p) => (entry.byColor[p.key] > entry.byColor[best] ? p.key : best), 'C');
    return {
      keyword,
      reminder: getKeywordReminder(keyword),
      total: entry.total,
      byColor: entry.byColor,
      dominantColor,
      cardNames: entry.cards
        .map((c) => ({ name: c.details?.name || '', scryfallId: c.details?.scryfall_id || '' }))
        .filter((c) => c.name)
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
  });

  stats.sort((a, b) => b.total - a.total || a.keyword.localeCompare(b.keyword));
  return { stats, colorTotals };
};

// Stable pseudo-shuffle so the word cloud mixes big and small words without Math.random.
const hashString = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffffffff;
  return Math.abs(h);
};

// ─── Chart options ─────────────────────────────────────────────────────────────
const stackedHBarOptions = {
  indexAxis: 'y' as const,
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    x: { stacked: true, beginAtZero: true, grid: { display: false } },
    y: { stacked: true, grid: { display: false } },
  },
  plugins: {
    legend: { position: 'top' as const, labels: { usePointStyle: true, padding: 8, font: { size: 11 } } },
  },
};

const doughnutOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'right' as const, labels: { usePointStyle: true, padding: 10, font: { size: 11 } } },
  },
  cutout: '55%',
};

// ─── Sub-components ───────────────────────────────────────────────────────────────
const StatTile: React.FC<{ label: string; value: string; sub?: string }> = ({ label, value, sub }) => (
  <CardUI className="flex-1">
    <CardBody>
      <Flexbox direction="col" gap="1" alignItems="center" className="py-2">
        <Text xl semibold>
          {value}
        </Text>
        <Text xs className="text-text-secondary text-center">
          {label}
        </Text>
        {sub && (
          <Text xs className="text-text-secondary/70 text-center">
            {sub}
          </Text>
        )}
      </Flexbox>
    </CardBody>
  </CardUI>
);

const ChartCard: React.FC<{ title: string; children: React.ReactNode; tooltip?: string; height?: number }> = ({
  title,
  children,
  tooltip,
  height = 340,
}) => (
  <CardUI>
    <CardHeader>
      <Text semibold md>
        {title}
        {tooltip && (
          <Tooltip text={tooltip} wrapperTag="span" position="bottom">
            <span className="ml-1 text-text-secondary/50">ⓘ</span>
          </Tooltip>
        )}
      </Text>
    </CardHeader>
    <CardBody>
      <div style={{ height }}>{children}</div>
    </CardBody>
  </CardUI>
);

// Standard mana-symbol pip image (matches the cube's design language).
const ManaPip: React.FC<{ code: string; title?: string }> = ({ code, title }) => (
  <img
    src={cdnUrl(`/content/symbols/${code.toLowerCase()}.png`)}
    alt={code}
    title={title}
    className="inline-block h-5 w-5"
  />
);

// ─── Word cloud (d3-cloud layout) ──────────────────────────────────────────────
interface CloudInput {
  keyword: string;
  size: number;
  color: string;
  reminder?: string;
  total: number;
}

type PlacedWord = CloudInput & { text: string; x?: number; y?: number; rotate?: number };

const WordCloudView: React.FC<{ words: CloudInput[]; height?: number }> = ({ words, height = 380 }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);
  const [placed, setPlaced] = useState<PlacedWord[]>([]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (words.length === 0) {
      setPlaced([]);
      return undefined;
    }
    let cancelled = false;
    // Largest words first so d3-cloud prioritizes them if space runs out.
    const input: PlacedWord[] = [...words].sort((a, b) => b.size - a.size).map((w) => ({ ...w, text: w.keyword }));

    const layout = cloud<PlacedWord>()
      .size([Math.max(300, width), height])
      .words(input)
      .padding(4)
      .rotate((d) => {
        const h = hashString(d.text || '');
        return h % 5 === 0 ? 90 : 0; // mostly horizontal, an occasional vertical word
      })
      .font('sans-serif')
      .fontSize((d) => d.size || 12)
      .spiral('archimedean')
      .on('end', (out: PlacedWord[]) => {
        if (!cancelled) setPlaced(out);
      });
    layout.start();
    return () => {
      cancelled = true;
      layout.stop();
    };
  }, [words, width, height]);

  return (
    <div ref={containerRef} className="w-full">
      <svg width="100%" height={height} viewBox={`0 0 ${Math.max(300, width)} ${height}`}>
        <g transform={`translate(${Math.max(300, width) / 2}, ${height / 2})`}>
          {placed.map((w) => (
            <text
              key={w.keyword}
              textAnchor="middle"
              transform={`translate(${w.x ?? 0}, ${w.y ?? 0}) rotate(${w.rotate ?? 0})`}
              style={{
                fontSize: `${w.size}px`,
                fontWeight: 600,
                fontFamily: 'sans-serif',
                fill: w.color,
                cursor: 'default',
              }}
            >
              <title>
                {w.reminder ? `${w.keyword}: ${w.reminder} (${w.total})` : `${w.keyword} — ${w.total} cards`}
              </title>
              {w.keyword}
            </text>
          ))}
        </g>
      </svg>
    </div>
  );
};

const MAX_CARDS_INLINE = 24;

const KeywordReferenceCard: React.FC<{ stat: KeywordStat; cube: any }> = ({ stat, cube }) => {
  const shown = stat.cardNames.slice(0, MAX_CARDS_INLINE);
  const remaining = stat.cardNames.length - shown.length;
  const markdown = shown.map((c) => `[[${c.name}|${c.scryfallId}]]`).join(', ');

  return (
    <CardUI className="h-full">
      <CardBody>
        <Flexbox direction="col" gap="2">
          <Flexbox direction="row" justify="between" alignItems="center" gap="2">
            <Text semibold md>
              {stat.keyword}
            </Text>
            <span
              className="rounded-full px-2 py-0.5 text-xs font-semibold"
              style={{
                backgroundColor: PIP_COLOR[stat.dominantColor],
                color: contrastText(PIP_COLOR[stat.dominantColor]),
              }}
            >
              {stat.total}
            </span>
          </Flexbox>
          {stat.reminder ? (
            <Text sm className="italic text-text-secondary">
              {stat.reminder}
            </Text>
          ) : (
            <Text sm className="italic text-text-secondary/50">
              No reminder text on file for this keyword.
            </Text>
          )}
          <div className="text-sm">
            <Markdown markdown={markdown} cube={cube} />
            {remaining > 0 && <span className="text-text-secondary"> +{remaining} more</span>}
          </div>
        </Flexbox>
      </CardBody>
    </CardUI>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────────
const Keywords: React.FC = () => {
  const { cube, changedCards } = useContext(CubeContext);
  const cards = useMemo(() => changedCards.mainboard || [], [changedCards.mainboard]);

  const [densityMode, setDensityMode] = useState<'count' | 'density'>('count');

  const { stats, colorTotals } = useMemo(() => buildStats(cards), [cards]);

  const totalInstances = useMemo(() => stats.reduce((s, k) => s + k.total, 0), [stats]);
  const cardsWithKeyword = useMemo(() => cards.filter((c) => cardKeywords(c).length > 0).length, [cards]);
  const mostCommon = stats[0];

  // Word cloud input: scale font size by frequency (sqrt spreads the mid-range nicely).
  const cloudWords = useMemo((): CloudInput[] => {
    if (stats.length === 0) return [];
    const max = stats[0].total;
    const min = stats[stats.length - 1].total;
    const range = Math.max(1, max - min);
    return stats.map((s) => ({
      keyword: s.keyword,
      reminder: s.reminder,
      color: PIP_COLOR[s.dominantColor],
      size: 14 + Math.sqrt((s.total - min) / range) * 52,
      total: s.total,
    }));
  }, [stats]);

  // Top keywords by color (stacked horizontal bar).
  const topByColor = useMemo(() => {
    const top = stats.slice(0, 15).reverse(); // reverse so the biggest is on top in a horizontal bar
    return {
      labels: top.map((s) => s.keyword),
      datasets: PIPS.map((p) => ({
        label: p.label,
        data: top.map((s) => s.byColor[p.key]),
        backgroundColor: p.color,
        borderWidth: 0,
      })).filter((d) => d.data.some((v) => v > 0)),
    };
  }, [stats]);

  // Total keyword weight by color (doughnut).
  const colorWeight = useMemo(() => {
    const totals = PIPS.map((p) => stats.reduce((s, k) => s + k.byColor[p.key], 0));
    const nonZero = PIPS.filter((_, i) => totals[i] > 0);
    return {
      labels: nonZero.map((p) => p.label),
      datasets: [
        {
          data: totals.filter((t) => t > 0),
          backgroundColor: nonZero.map((p) => p.color),
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.3)',
        },
      ],
    };
  }, [stats]);

  // Heatmap max for shading intensity.
  const heatMax = useMemo(() => {
    let max = 0;
    for (const s of stats) {
      for (const p of PIPS) {
        const val = densityMode === 'count' ? s.byColor[p.key] : cellDensity(s.byColor[p.key], colorTotals[p.key]);
        if (val > max) max = val;
      }
    }
    return max || 1;
  }, [stats, densityMode, colorTotals]);

  if (stats.length === 0) {
    return (
      <Flexbox direction="col" gap="2" className="m-2">
        <Text semibold lg>
          Keywords
        </Text>
        <Text>No cards in this cube have keyword abilities.</Text>
      </Flexbox>
    );
  }

  return (
    <Flexbox direction="col" gap="3" className="p-2">
      <Flexbox direction="col" gap="1">
        <Text semibold lg>
          Keywords ({stats.length})
        </Text>
        <Text className="text-text-secondary">
          Every keyword ability, action, and ability word your cube uses — what each one does, how common it is, and
          which colors carry it.
        </Text>
      </Flexbox>

      {/* Stat tiles */}
      <Flexbox direction="row" gap="3" wrap="wrap">
        <StatTile label="Unique Keywords" value={String(stats.length)} />
        <StatTile label="Keyword Instances" value={String(totalInstances)} sub="keyword ↔ card pairings" />
        <StatTile
          label="Cards with Keywords"
          value={String(cardsWithKeyword)}
          sub={`${((cardsWithKeyword / Math.max(1, cards.length)) * 100).toFixed(0)}% of the cube`}
        />
        <StatTile label="Most Common" value={mostCommon.keyword} sub={`${mostCommon.total} cards`} />
      </Flexbox>

      {/* Word cloud */}
      <CardUI>
        <CardHeader>
          <Text semibold md>
            Keyword Cloud
            <Tooltip
              text="Size scales with how many cards carry the keyword; color is the color that uses it most."
              wrapperTag="span"
              position="bottom"
            >
              <span className="ml-1 text-text-secondary/50">ⓘ</span>
            </Tooltip>
          </Text>
        </CardHeader>
        <CardBody>
          <WordCloudView words={cloudWords} />
        </CardBody>
      </CardUI>

      {/* Charts */}
      <Row className="g-3">
        <Col xs={12} lg={8}>
          <ChartCard
            title="Top Keywords by Color"
            tooltip="The 15 most common keywords, each bar split by the colors of the cards carrying it."
            height={420}
          >
            <Bar data={topByColor} options={stackedHBarOptions} />
          </ChartCard>
        </Col>
        <Col xs={12} lg={4}>
          <ChartCard
            title="Mechanical Color Weight"
            tooltip="Share of all keyword ↔ card pairings contributed by each color."
            height={420}
          >
            <Doughnut data={colorWeight} options={doughnutOptions} />
          </ChartCard>
        </Col>
      </Row>

      {/* Density-by-color heatmap */}
      <CardUI>
        <CardHeader>
          <Flexbox direction="row" justify="between" alignItems="center" wrap="wrap" gap="2">
            <Text semibold md>
              Keyword Density by Color
              <Tooltip
                text={
                  densityMode === 'count'
                    ? 'Number of cards of each color that carry the keyword. Multicolor cards count in each of their colors.'
                    : 'Share of each color’s cards that carry the keyword.'
                }
                wrapperTag="span"
                position="bottom"
              >
                <span className="ml-1 text-text-secondary/50">ⓘ</span>
              </Tooltip>
            </Text>
            <Flexbox direction="row" gap="1">
              <Button color={densityMode === 'count' ? 'primary' : 'secondary'} onClick={() => setDensityMode('count')}>
                Count
              </Button>
              <Button
                color={densityMode === 'density' ? 'primary' : 'secondary'}
                onClick={() => setDensityMode('density')}
              >
                Density
              </Button>
            </Flexbox>
          </Flexbox>
        </CardHeader>
        <div className="overflow-x-auto rounded-b-md">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className="text-left p-2 sticky left-0 bg-bg-accent">Keyword</th>
                {PIPS.map((p) => (
                  <th key={p.key} className="p-2 text-center">
                    <span className="inline-flex items-center justify-center" title={p.label}>
                      <ManaPip code={p.key} title={p.label} />
                    </span>
                  </th>
                ))}
                <th className="p-2 text-center">Total</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => (
                <tr key={s.keyword} className="border-t border-border">
                  <td className="p-2 font-semibold sticky left-0 bg-bg-accent whitespace-nowrap">{s.keyword}</td>
                  {PIPS.map((p) => {
                    const raw = s.byColor[p.key];
                    const val = densityMode === 'count' ? raw : cellDensity(raw, colorTotals[p.key]);
                    const intensity = val / heatMax;
                    const display = raw === 0 ? '' : densityMode === 'count' ? String(raw) : `${val.toFixed(0)}%`;
                    return (
                      <td
                        key={p.key}
                        className="p-2 text-center"
                        style={{ backgroundColor: rgba(p.color, 0.12 + intensity * 0.75) }}
                      >
                        {display}
                      </td>
                    );
                  })}
                  <td className="p-2 text-center font-semibold">{s.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardUI>

      {/* Reminder-text reference */}
      <Flexbox direction="col" gap="2">
        <Text semibold md>
          Reminder Text Reference
        </Text>
        <Row className="g-3">
          {stats.map((s) => (
            <Col key={s.keyword} xs={12} md={6} lg={4}>
              <KeywordReferenceCard stat={s} cube={cube} />
            </Col>
          ))}
        </Row>
      </Flexbox>
    </Flexbox>
  );
};

// density as a percentage of that color's cards
function cellDensity(count: number, colorTotal: number): number {
  return colorTotal > 0 ? (count / colorTotal) * 100 : 0;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.substring(0, 2), 16), parseInt(h.substring(2, 4), 16), parseInt(h.substring(4, 6), 16)];
}

// hex (#rrggbb) -> rgba string with the given alpha
function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${Math.min(1, alpha).toFixed(3)})`;
}

// Pick readable text color (black/white) for a solid background using perceived luminance.
function contrastText(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#1A1A1A' : '#FFFFFF';
}

export default Keywords;
