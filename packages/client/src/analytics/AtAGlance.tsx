import React, { useContext, useEffect, useMemo, useState } from 'react';

import {
  cardCmc,
  cardColorCategory,
  cardElo,
  cardFirstPrintYear,
  cardIsLand,
  cardKeywords,
  cardLegalIn,
  cardPopularity,
  cardPrice,
  cardRarity,
  cardTix,
  cardType,
  cardWordCount,
} from '@utils/cardutil';
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
import { Bar, Doughnut } from 'react-chartjs-2';

import { chartCardListHandlers, useCardListModal } from '../components/analytics/CardListModal';
import { barLegendLabels, doughnutLegendLabels } from '../components/analytics/chartLegend';
import { Card as CardUI, CardBody, CardHeader } from '../components/base/Card';
import { Col, Flexbox, Row } from '../components/base/Layout';
import Text from '../components/base/Text';
import Tooltip from '../components/base/Tooltip';
import CardKingdomBulkButton from '../components/purchase/CardKingdomBulkButton';
import ManaPoolBulkButton from '../components/purchase/ManaPoolBulkButton';
import TCGPlayerBulkButton from '../components/purchase/TCGPlayerBulkButton';
import { useAnalysisCards } from '../contexts/AnalysisViewContext';
import CubeContext from '../contexts/CubeContext';
import { releaseYearBuckets } from '../utils/releaseYearBuckets';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, ChartTooltip, Legend);

// ─── Constants ────────────────────────────────────────────────────────────────

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

const RARITY_COLORS: Record<string, string> = {
  common: '#1A1A1A',
  uncommon: '#707883',
  rare: '#C9B458',
  mythic: '#D85040',
  special: '#905D98',
};

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

const FORMAT_COLORS: Record<string, string> = {
  Standard: '#F7CE46',
  Pioneer: '#E8883A',
  Modern: '#D85F69',
  Legacy: '#9B59B6',
  Vintage: '#67A6D3',
  Commander: '#6AB572',
  'Not Legal': '#ADADAD',
};

const FORMAT_HIERARCHY = ['Standard', 'Pioneer', 'Modern', 'Legacy', 'Vintage', 'Commander'];

const COLOR_CATEGORIES_ORDER = ['White', 'Blue', 'Black', 'Red', 'Green', 'Multicolored', 'Hybrid', 'Colorless'];

const MAJOR_TYPES = ['Creature', 'Instant', 'Sorcery', 'Enchantment', 'Artifact', 'Planeswalker', 'Land', 'Battle'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const pct = (count: number, total: number): string =>
  total > 0 ? `${((count / total) * 100).toFixed(2)}% (${count})` : '0.00% (0)';

const fmt = (n: number, decimals = 2): string => n.toFixed(decimals);

const computeMedian = (sorted: number[]): number => {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
};

const computeStdDev = (values: number[], mean: number): number => {
  if (values.length === 0) return 0;
  return Math.sqrt(values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length);
};

const computeMAD = (values: number[], med: number): number => {
  const absDevs = values.map((v) => Math.abs(v - med)).sort((a, b) => a - b);
  return computeMedian(absDevs);
};

const makesTokens = (card: Card): boolean => {
  return (card.details as any)?.tokens?.length > 0;
};

const isUniversesBeyond = (card: Card): boolean => {
  return ((card.details as any)?.promo_types || []).includes('universesbeyond');
};

const isSupplemental = (card: Card): boolean => {
  return (card.details as any)?.printedInExpansion === false;
};

const getMinFormat = (card: Card): string => {
  const legalFormats = cardLegalIn(card).map((f) => f.toLowerCase());
  for (const format of FORMAT_HIERARCHY) {
    if (legalFormats.includes(format.toLowerCase())) return format;
  }
  return 'Vintage';
};

const getMajorType = (card: Card): string => {
  const type = cardType(card);
  for (const t of MAJOR_TYPES) {
    if (type.includes(t)) return t;
  }
  return 'Other';
};

// A chart's data plus the cards behind each bar or slice ([datasetIndex][index]), so a click can list them.
interface ChartWithCards {
  data: { labels: string[]; datasets: { label?: string; data: number[] }[] };
  cards: Card[][][];
}

const histogramChart = (buckets: { label: string; cards: Card[] }[], color: string) => ({
  data: {
    labels: buckets.map((b) => b.label),
    datasets: [{ data: buckets.map((b) => b.cards.length), backgroundColor: color, borderRadius: 2 }],
  },
  cards: [buckets.map((b) => b.cards)],
});

// Empty groups are left out so they don't clutter the legend.
const donutChart = (groups: { label: string; cards: Card[]; color: string }[]) => {
  const nonEmpty = groups.filter((g) => g.cards.length > 0);
  return {
    data: {
      labels: nonEmpty.map((g) => g.label),
      datasets: [
        {
          data: nonEmpty.map((g) => g.cards.length),
          backgroundColor: nonEmpty.map((g) => g.color),
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.3)',
        },
      ],
    },
    cards: [nonEmpty.map((g) => g.cards)],
  };
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const StatRow: React.FC<{ label: string; value: string; tooltip?: string }> = ({ label, value, tooltip }) => (
  <div className="flex justify-between py-1 border-b border-border last:border-b-0 px-2">
    <Text xs className="text-text-secondary">
      {label}
      {tooltip && (
        <Tooltip text={tooltip} wrapperTag="span" position="bottom">
          <span className="ml-1 text-text-secondary/50">ⓘ</span>
        </Tooltip>
      )}
    </Text>
    <Text xs semibold>
      {value}
    </Text>
  </div>
);

const ChartCard: React.FC<{ title: string; children: React.ReactNode; className?: string; tooltip?: string }> = ({
  title,
  children,
  className,
  tooltip,
}) => (
  <CardUI className={className}>
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
    <CardBody>{children}</CardBody>
  </CardUI>
);

// ─── Chart Options ────────────────────────────────────────────────────────────

const doughnutOptions = {
  responsive: true,
  maintainAspectRatio: true,
  plugins: {
    legend: {
      position: 'right' as const,
      labels: {
        usePointStyle: true,
        padding: 10,
        font: { size: 11 },
        ...doughnutLegendLabels,
      },
    },
  },
  cutout: '55%',
};

const stackedBarOptions = {
  responsive: true,
  maintainAspectRatio: true,
  scales: {
    x: { stacked: true, grid: { display: false } },
    y: { stacked: true, beginAtZero: true },
  },
  plugins: {
    legend: {
      position: 'top' as const,
      labels: { usePointStyle: true, padding: 8, font: { size: 11 }, ...barLegendLabels },
    },
  },
};

const histogramOptions = {
  responsive: true,
  maintainAspectRatio: true,
  scales: {
    x: { grid: { display: false } },
    y: { beginAtZero: true },
  },
  plugins: {
    legend: { display: false },
  },
};

// ─── Main Component ───────────────────────────────────────────────────────────

interface AtAGlanceProps {
  tokenMap: Record<string, any>;
  cubeAnalytics: any;
}

const AtAGlance: React.FC<AtAGlanceProps> = ({ tokenMap }) => {
  const { cube } = useContext(CubeContext);
  const cards = useAnalysisCards();
  const total = cards.length;

  // ── Computed Stats ────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    // Unique cards by name
    const nameSet = new Set(cards.map((c) => c.details?.name).filter(Boolean));
    const uniqueCount = nameSet.size;

    // Key numbers
    const landCount = cards.filter((c) => cardIsLand(c)).length;
    const creatureCount = cards.filter((c) => cardType(c).includes('Creature')).length;
    const tokensCardCount = cards.filter(makesTokens).length;
    const uniqueTokenOracleIds = new Set<string>();
    for (const card of cards) {
      for (const tokenId of (card.details as any)?.tokens || []) {
        const oracleId = tokenMap[tokenId]?.details?.oracle_id;
        if (oracleId) uniqueTokenOracleIds.add(oracleId);
      }
    }
    const uniqueTokenCount = uniqueTokenOracleIds.size;
    const ubCount = cards.filter(isUniversesBeyond).length;
    const suppCount = cards.filter(isSupplemental).length;

    // Summary stats
    const nonLandCards = cards.filter((c) => !cardIsLand(c));
    const avgCmc = nonLandCards.length > 0 ? nonLandCards.reduce((s, c) => s + cardCmc(c), 0) / nonLandCards.length : 0;
    const avgElo = total > 0 ? cards.reduce((s, c) => s + cardElo(c), 0) / total : 0;
    const avgPopularity = total > 0 ? cards.reduce((s, c) => s + cardPopularity(c), 0) / total : 0;

    // Release year stats
    const years = cards.map((c) => cardFirstPrintYear(c)).filter((y) => y > 0);
    const avgYear = years.length > 0 ? years.reduce((a, b) => a + b, 0) / years.length : 0;
    const yearStd = computeStdDev(years, avgYear);
    const sortedYears = [...years].sort((a, b) => a - b);
    const medYear = computeMedian(sortedYears);
    const medYearDev = computeMAD(sortedYears, medYear);

    // Characteristics
    const avgWordCount = total > 0 ? cards.reduce((s, c) => s + cardWordCount(c), 0) / total : 0;
    const uniqueKeywordCount = new Set(cards.flatMap((c) => cardKeywords(c))).size;

    // Pricing
    const totalActualPrice = cards.reduce((s, c) => s + (cardPrice(c) || 0), 0);
    const totalTix = cards.reduce((s, c) => s + (cardTix(c) || 0), 0);

    return {
      uniqueCount,
      landCount,
      creatureCount,
      tokensCardCount,
      uniqueTokenCount,
      ubCount,
      suppCount,
      avgCmc,
      avgElo,
      avgPopularity,
      avgYear,
      yearStd,
      medYear,
      medYearDev,
      avgWordCount,
      uniqueKeywordCount,
      totalActualPrice,
      totalTix,
    };
  }, [cards, tokenMap, total]);

  // ── Lazy-loaded min pricing (server-side cheapest oracle) ──────────────

  const [minPrice, setMinPrice] = useState<number | null>(null);
  const [serverActualPrice, setServerActualPrice] = useState<number | null>(null);
  const [pricesLoading, setPricesLoading] = useState(false);

  useEffect(() => {
    if (cube.priceVisibility !== 'pu') return;
    setPricesLoading(true);
    fetch(`/cube/api/minprices/${cube.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success === 'true') {
          setMinPrice(data.totalMinPrice);
          if (typeof data.totalActualPrice === 'number') {
            setServerActualPrice(data.totalActualPrice);
          }
        }
      })
      .catch(() => {})
      .finally(() => setPricesLoading(false));
  }, [cube.id, cube.priceVisibility]);

  // Use server-computed actual price (includes fallback for unpriced printings) when available
  const displayActualPrice = serverActualPrice ?? stats.totalActualPrice;

  // ── Chart Data ────────────────────────────────────────────────────────────

  // Mana Curve (stacked bar by color, excluding lands)
  const manaCurveData = useMemo(() => {
    const nonLandCards = cards.filter((c) => !cardIsLand(c));
    const cmcLabels = ['0', '1', '2', '3', '4', '5', '6', '7+'];

    const series = COLOR_CATEGORIES_ORDER.map((color) => ({
      color,
      buckets: cmcLabels.map((_, i) =>
        nonLandCards.filter((c) => cardColorCategory(c) === color && Math.min(Math.floor(cardCmc(c)), 7) === i),
      ),
    })).filter((s) => s.buckets.some((b) => b.length > 0));

    return {
      data: {
        labels: cmcLabels,
        datasets: series.map(({ color, buckets }) => ({
          label: color,
          data: buckets.map((b) => b.length),
          backgroundColor: COLOR_MAP[color],
        })),
      },
      cards: series.map((s) => s.buckets),
    };
  }, [cards]);

  // Color Pie (donut)
  const colorPieData = useMemo(
    () =>
      donutChart(
        [...COLOR_CATEGORIES_ORDER, 'Lands'].map((cat) => ({
          label: cat,
          cards: cards.filter((c) => cardColorCategory(c) === cat),
          color: COLOR_MAP[cat] || '#555',
        })),
      ),
    [cards],
  );

  // ELO Distribution (histogram, 50-point buckets)
  const eloHistogramData = useMemo(() => {
    if (cards.length === 0) return histogramChart([], '#67A6D3');
    const elos = cards.map((c) => cardElo(c));

    const minElo = Math.floor(Math.min(...elos) / 50) * 50;
    const maxElo = Math.ceil(Math.max(...elos) / 50) * 50;
    const buckets: { label: string; cards: Card[] }[] = [];
    for (let bucket = minElo; bucket < maxElo; bucket += 50) {
      buckets.push({
        label: String(bucket),
        cards: cards.filter((c) => cardElo(c) >= bucket && cardElo(c) < bucket + 50),
      });
    }

    return histogramChart(buckets, '#67A6D3');
  }, [cards]);

  // Rarity Breakdown (donut)
  const rarityData = useMemo(
    () =>
      donutChart(
        ['common', 'uncommon', 'rare', 'mythic', 'special'].map((r) => ({
          label: r.charAt(0).toUpperCase() + r.slice(1),
          cards: cards.filter((c) => cardRarity(c)?.toLowerCase() === r),
          color: RARITY_COLORS[r] || '#555',
        })),
      ),
    [cards],
  );

  // Release Year (histogram)
  const releaseYearData = useMemo(
    () => histogramChart(releaseYearBuckets(cards, new Date().getFullYear()), '#6AB572'),
    [cards],
  );

  // Card Types (donut)
  const cardTypeData = useMemo(
    () =>
      donutChart(
        [...MAJOR_TYPES, 'Other'].map((t) => ({
          label: t,
          cards: cards.filter((c) => getMajorType(c) === t),
          color: TYPE_COLORS[t] || '#555',
        })),
      ),
    [cards],
  );

  // Format Legality (donut)
  const formatLegalityData = useMemo(
    () =>
      donutChart(
        [...FORMAT_HIERARCHY, 'Not Legal'].map((f) => ({
          label: f,
          cards: cards.filter((c) => getMinFormat(c) === f),
          color: FORMAT_COLORS[f] || '#555',
        })),
      ),
    [cards],
  );

  // Word Count Distribution (histogram)
  const wordCountHistogramData = useMemo(() => {
    if (cards.length === 0) return histogramChart([], '#DBC467');

    const maxWc = Math.max(...cards.map((c) => cardWordCount(c)));
    const bucketSize = Math.max(1, Math.ceil(maxWc / 15));

    const buckets: { label: string; cards: Card[] }[] = [];
    for (let b = 0; b <= maxWc; b += bucketSize) {
      buckets.push({
        label: bucketSize === 1 ? String(b) : `${b}-${b + bucketSize - 1}`,
        cards: cards.filter((c) => cardWordCount(c) >= b && cardWordCount(c) < b + bucketSize),
      });
    }

    return histogramChart(buckets, '#DBC467');
  }, [cards]);

  // Popularity Distribution (histogram, dynamic buckets)
  const popularityHistogramData = useMemo(() => {
    if (cards.length === 0) return histogramChart([], '#B87BD6');

    const maxPop = Math.max(...cards.map((c) => cardPopularity(c)));
    const bucketSize = Math.max(1, Math.ceil(maxPop / 15));
    const buckets: { label: string; cards: Card[] }[] = [];
    for (let b = 0; b <= maxPop; b += bucketSize) {
      buckets.push({
        label: bucketSize === 1 ? `${b}%` : `${b}-${b + bucketSize - 1}%`,
        cards: cards.filter((c) => cardPopularity(c) >= b && cardPopularity(c) < b + bucketSize),
      });
    }

    return histogramChart(buckets, '#B87BD6');
  }, [cards]);

  // Price Distribution (histogram, dynamic buckets)
  const priceHistogramData = useMemo(() => {
    const priced = cards.filter((c) => (cardPrice(c) ?? 0) > 0);
    if (priced.length === 0) return histogramChart([], '#5DAE68');
    const priceOf = (c: Card) => cardPrice(c) ?? 0;

    const bucketEdges = [0, 0.25, 0.5, 1, 2, 5, 10, 25, 50, 100, 250, 500, 1000];
    // Find the last bucket that has cards
    const maxPrice = Math.max(...priced.map(priceOf));
    const lastIdx = bucketEdges.findIndex((e) => e > maxPrice);
    const edges = lastIdx === -1 ? bucketEdges : bucketEdges.slice(0, lastIdx + 1);

    const buckets: { label: string; cards: Card[] }[] = [];
    for (let i = 0; i < edges.length - 1; i++) {
      const lo = edges[i];
      const hi = edges[i + 1];
      buckets.push({ label: `$${lo}-${hi}`, cards: priced.filter((c) => priceOf(c) >= lo && priceOf(c) < hi) });
    }
    // Last bucket: captures anything >= last edge
    const lastEdge = edges[edges.length - 1];
    const lastBucket = priced.filter((c) => priceOf(c) >= lastEdge);
    if (lastBucket.length > 0) {
      buckets.push({ label: `$${lastEdge}+`, cards: lastBucket });
    }

    return histogramChart(buckets, '#5DAE68');
  }, [cards]);

  // ── Card List Modal ───────────────────────────────────────────────────────

  const { openCardList, cardListModal } = useCardListModal();

  // Clicking a bar or slice lists its cards, titled e.g. "Mana Value: 3 · Blue".
  const listOnClick = (name: string, chart: ChartWithCards, formatLabel = (label: string) => label) =>
    chartCardListHandlers((datasetIndex, index) => {
      const series = chart.data.datasets[datasetIndex]?.label;
      return {
        title: `${name}: ${formatLabel(chart.data.labels[index])}${series ? ` · ${series}` : ''}`,
        cards: chart.cards[datasetIndex]?.[index] ?? [],
      };
    }, openCardList);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Flexbox direction="col" gap="3" className="p-2">
      {/* ─── Row 1: Tables (Key Numbers + Summary Stats + Purchase) ──── */}
      <Row className="g-3">
        <Col xs={12} lg={4}>
          <CardUI>
            <CardHeader>
              <Text semibold md>
                Key Numbers
              </Text>
            </CardHeader>
            <div>
              <StatRow label="Unique Cards" value={pct(stats.uniqueCount, total)} />
              <StatRow label="Lands" value={pct(stats.landCount, total)} />
              <StatRow label="Creatures" value={pct(stats.creatureCount, total)} />
              <StatRow label="Makes Tokens" value={pct(stats.tokensCardCount, total)} />
              <StatRow label="Unique Tokens" value={String(stats.uniqueTokenCount)} />
              <StatRow label="Universes Beyond" value={pct(stats.ubCount, total)} />
              <StatRow label="Supplemental Product" value={pct(stats.suppCount, total)} />
            </div>
          </CardUI>
        </Col>
        <Col xs={12} lg={4}>
          <CardUI>
            <CardHeader>
              <Text semibold md>
                Summary Stats
              </Text>
            </CardHeader>
            <div>
              <StatRow label="Avg. Mana Value" value={fmt(stats.avgCmc)} />
              <StatRow label="Avg. Card Elo" value={fmt(stats.avgElo)} />
              <StatRow
                label="Avg. Card Popularity"
                value={`${fmt(stats.avgPopularity)}%`}
                tooltip="Average percentage of cubes on Cube Cobra that include each card in this cube"
              />
              <StatRow
                label="Avg. Release Year"
                value={stats.avgYear > 0 ? `${Math.round(stats.avgYear)} (±${fmt(stats.yearStd, 1)})` : 'N/A'}
              />
              <StatRow
                label="Median Release Year"
                value={stats.medYear > 0 ? `${stats.medYear} (±${fmt(stats.medYearDev, 1)})` : 'N/A'}
              />
              <StatRow label="Avg. Word Count" value={fmt(stats.avgWordCount)} />
              <StatRow label="Unique Keywords" value={String(stats.uniqueKeywordCount)} />
            </div>
          </CardUI>
        </Col>
        <Col xs={12} lg={4}>
          <CardUI>
            <CardHeader>
              <Text semibold md>
                Purchase
              </Text>
            </CardHeader>
            <div>
              {cube.priceVisibility === 'pu' && pricesLoading && (
                <StatRow
                  label="Min Price (USD)"
                  value="Loading..."
                  tooltip="Total cost using the cheapest available printing of each card across all sets"
                />
              )}
              {cube.priceVisibility === 'pu' && minPrice !== null && (
                <StatRow
                  label="Min Price (USD)"
                  value={`$${minPrice.toFixed(2)}`}
                  tooltip="Total cost using the cheapest available printing of each card across all sets"
                />
              )}
              <StatRow
                label="Actual Price (USD)"
                value={pricesLoading ? 'Loading...' : `$${displayActualPrice.toFixed(2)}`}
                tooltip="Total cost using the specific printings in your cube (falls back to cheapest version for unpriced printings)"
              />
              {stats.totalTix > 0 && (
                <StatRow
                  label="MTGO"
                  value={`${stats.totalTix.toFixed(2)} TIX`}
                  tooltip="Total cost in Magic Online event tickets"
                />
              )}
            </div>
            <Flexbox direction="col" gap="2" className="p-2">
              <TCGPlayerBulkButton cards={cards} />
              <ManaPoolBulkButton cards={cards} />
              <CardKingdomBulkButton cards={cards} />
            </Flexbox>
          </CardUI>
        </Col>
      </Row>

      {/* ─── Row 2: Histograms (Mana Curve + Release Year) ──────────── */}
      <Row className="g-3">
        <Col xs={12} lg={6}>
          <ChartCard title="Mana Curve">
            <Bar
              data={manaCurveData.data}
              options={{ ...stackedBarOptions, ...listOnClick('Mana Value', manaCurveData) }}
            />
          </ChartCard>
        </Col>
        <Col xs={12} lg={6}>
          <ChartCard title="Original Release Year">
            <Bar
              data={releaseYearData.data}
              options={{ ...histogramOptions, ...listOnClick('Original Release Year', releaseYearData) }}
            />
          </ChartCard>
        </Col>
      </Row>

      {/* ─── Row 3: Donuts (Color + Types + Rarity + Format) ─────────── */}
      <Row className="g-3">
        <Col xs={12} sm={6} lg={3}>
          <ChartCard title="Color Distribution">
            <Doughnut
              data={colorPieData.data}
              options={{ ...doughnutOptions, ...listOnClick('Color', colorPieData) }}
            />
          </ChartCard>
        </Col>
        <Col xs={12} sm={6} lg={3}>
          <ChartCard title="Card Types">
            <Doughnut
              data={cardTypeData.data}
              options={{ ...doughnutOptions, ...listOnClick('Card Type', cardTypeData) }}
            />
          </ChartCard>
        </Col>
        <Col xs={12} sm={6} lg={3}>
          <ChartCard
            title="Rarity Breakdown"
            tooltip="Uses each card's printing in this cube, so a card reprinted at a different rarity counts at the printing you chose. A per-card rarity override takes precedence."
          >
            <Doughnut data={rarityData.data} options={{ ...doughnutOptions, ...listOnClick('Rarity', rarityData) }} />
          </ChartCard>
        </Col>
        <Col xs={12} sm={6} lg={3}>
          <ChartCard title="Format Legality">
            <Doughnut
              data={formatLegalityData.data}
              options={{ ...doughnutOptions, ...listOnClick('Format Legality', formatLegalityData) }}
            />
          </ChartCard>
        </Col>
      </Row>

      {/* ─── Row 4: Histograms (Elo + Word Count) ───────────────────── */}
      <Row className="g-3">
        <Col xs={12} lg={6}>
          <ChartCard title="Elo Distribution">
            <Bar
              data={eloHistogramData.data}
              options={{
                ...histogramOptions,
                ...listOnClick('Elo', eloHistogramData, (label) => `${label}–${Number(label) + 49}`),
              }}
            />
          </ChartCard>
        </Col>
        <Col xs={12} lg={6}>
          <ChartCard title="Word Count Distribution">
            <Bar
              data={wordCountHistogramData.data}
              options={{ ...histogramOptions, ...listOnClick('Word Count', wordCountHistogramData) }}
            />
          </ChartCard>
        </Col>
      </Row>

      {/* ─── Row 5: Histograms (Popularity + Price) ──────────────────── */}
      <Row className="g-3">
        <Col xs={12} lg={6}>
          <ChartCard
            title="Popularity Distribution"
            tooltip="Percentage of cubes on Cube Cobra that include each card — shows how niche or ubiquitous your card choices are"
          >
            <Bar
              data={popularityHistogramData.data}
              options={{ ...histogramOptions, ...listOnClick('Popularity', popularityHistogramData) }}
            />
          </ChartCard>
        </Col>
        <Col xs={12} lg={6}>
          <ChartCard
            title="Price Distribution"
            tooltip="Uses each card's printing and finish in this cube — the same basis as Actual Price, not the cheapest printing. Cards with no price are omitted."
          >
            <Bar
              data={priceHistogramData.data}
              options={{ ...histogramOptions, ...listOnClick('Price', priceHistogramData) }}
            />
          </ChartCard>
        </Col>
      </Row>
      {cardListModal}
    </Flexbox>
  );
};

export default AtAGlance;
