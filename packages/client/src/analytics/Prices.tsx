import React, { useContext, useMemo } from 'react';

import {
  cardEtchedPrice,
  cardFinish,
  cardFoilPrice,
  cardName,
  cardNormalPrice,
  cardPrice,
  cardStatus,
} from '@utils/cardutil';
import type Card from '@utils/datatypes/Card';
import { CARD_STATUSES, FINISHES } from '@utils/datatypes/Card';
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

import { Card as CardUI, CardBody, CardHeader } from '../components/base/Card';
import { Col, Flexbox, Row } from '../components/base/Layout';
import Text from '../components/base/Text';
import Tooltip from '../components/base/Tooltip';
import CubeContext from '../contexts/CubeContext';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, ChartTooltip, Legend);

// ─── Constants ────────────────────────────────────────────────────────────────

// Statuses that mean you physically have the card in the intended finish already.
const OWNED_STATUSES = ['Owned', 'Premium Owned'];
// Statuses that mean the card still needs to be acquired to truly complete the cube.
const NEEDED_STATUSES = ['Not Owned', 'Proxied', 'Borrowed'];

const STATUS_COLORS: Record<string, string> = {
  Owned: '#6AB572',
  'Premium Owned': '#C9B458',
  Ordered: '#67A6D3',
  Proxied: '#9B59B6',
  Borrowed: '#E8883A',
  'Not Owned': '#ADADAD',
};

const FINISH_COLORS: Record<string, string> = {
  'Non-foil': '#ADADAD',
  Foil: '#67A6D3',
  Etched: '#C9B458',
  'Alt-foil': '#9B59B6',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const usd = (n: number): string =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Price of a card at whatever finish it is assigned in the cube.
const assignedPrice = (card: Card): number => cardPrice(card) ?? 0;

// Price of a foil copy of the card (etched counts as a foil). Undefined when the
// card has no foil printing on record — i.e. it can't be foiled.
const foilOnlyPrice = (card: Card): number | undefined => cardFoilPrice(card) ?? cardEtchedPrice(card) ?? undefined;

// Value of a card if it were foiled: its foil price, falling back to non-foil for
// cards that simply have no foil version.
const foilValue = (card: Card): number => foilOnlyPrice(card) ?? cardNormalPrice(card) ?? 0;

const isFoilFinish = (finish: string): boolean => finish === 'Foil' || finish === 'Etched' || finish === 'Alt-foil';

const normalizedStatus = (card: Card): string => cardStatus(card) || 'Not Owned';

// ─── Sub-components ───────────────────────────────────────────────────────────

const BigStat: React.FC<{ label: string; value: string; sub?: string; tooltip?: string; accent?: string }> = ({
  label,
  value,
  sub,
  tooltip,
  accent,
}) => (
  <CardUI className="h-full">
    <CardBody>
      <Flexbox direction="col" gap="1">
        <Text sm className="text-text-secondary">
          {label}
          {tooltip && (
            <Tooltip text={tooltip} wrapperTag="span" position="bottom">
              <span className="ml-1 text-text-secondary/50">ⓘ</span>
            </Tooltip>
          )}
        </Text>
        <span className="text-xl font-semibold" style={accent ? { color: accent } : undefined}>
          {value}
        </span>
        {sub && (
          <Text xs className="text-text-secondary">
            {sub}
          </Text>
        )}
      </Flexbox>
    </CardBody>
  </CardUI>
);

const StatRow: React.FC<{ label: string; value: string; swatch?: string; tooltip?: string }> = ({
  label,
  value,
  swatch,
  tooltip,
}) => (
  <div className="flex justify-between py-1 border-b border-border last:border-b-0 px-2">
    <Text xs className="text-text-secondary">
      {swatch && (
        <span
          className="inline-block mr-2 rounded-sm align-middle"
          style={{ width: 10, height: 10, backgroundColor: swatch }}
        />
      )}
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

const ChartCard: React.FC<{ title: string; children: React.ReactNode; tooltip?: string }> = ({
  title,
  children,
  tooltip,
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
    <CardBody>{children}</CardBody>
  </CardUI>
);

// ─── Chart Options ────────────────────────────────────────────────────────────

const doughnutCountOptions = {
  responsive: true,
  maintainAspectRatio: true,
  plugins: {
    legend: {
      position: 'right' as const,
      labels: { usePointStyle: true, padding: 10, font: { size: 11 } },
    },
  },
  cutout: '55%',
};

const doughnutValueOptions = {
  ...doughnutCountOptions,
  plugins: {
    legend: doughnutCountOptions.plugins.legend,
    tooltip: {
      callbacks: {
        label: (ctx: any) => `${ctx.label}: ${usd(ctx.parsed)}`,
      },
    },
  },
};

const valueBarOptions = {
  responsive: true,
  maintainAspectRatio: true,
  scales: {
    x: { grid: { display: false } },
    y: { beginAtZero: true, ticks: { callback: (v: any) => `$${v}` } },
  },
  plugins: {
    legend: { display: false },
    tooltip: { callbacks: { label: (ctx: any) => usd(ctx.parsed.y) } },
  },
};

// ─── Main Component ───────────────────────────────────────────────────────────

const Prices: React.FC = () => {
  const { changedCards } = useContext(CubeContext);
  const cards = useMemo(() => changedCards.mainboard || [], [changedCards.mainboard]);
  const total = cards.length;

  const stats = useMemo(() => {
    let totalValue = 0;
    let ownedValue = 0;
    let orderedValue = 0;
    let neededValue = 0;
    let currentFoilValue = 0;
    let costToFoilRemaining = 0;
    let fullFoilValue = 0;
    let pricedCount = 0;

    const valueByStatus: Record<string, number> = {};
    const countByStatus: Record<string, number> = {};
    const valueByFinish: Record<string, number> = {};

    let mostExpensive: { name: string; price: number } | null = null;

    for (const card of cards) {
      const status = normalizedStatus(card);
      const finish = cardFinish(card);
      const price = assignedPrice(card);

      totalValue += price;
      if (cardPrice(card) !== undefined) pricedCount += 1;

      countByStatus[status] = (countByStatus[status] || 0) + 1;
      valueByStatus[status] = (valueByStatus[status] || 0) + price;
      valueByFinish[finish] = (valueByFinish[finish] || 0) + price;

      if (OWNED_STATUSES.includes(status)) ownedValue += price;
      if (status === 'Ordered') orderedValue += price;
      if (NEEDED_STATUSES.includes(status)) neededValue += price;

      if (isFoilFinish(finish)) {
        currentFoilValue += price;
      } else {
        // Non-foil card — what it would cost to buy a foil copy.
        costToFoilRemaining += foilOnlyPrice(card) ?? 0;
      }
      fullFoilValue += foilValue(card);

      if (price > 0 && (!mostExpensive || price > mostExpensive.price)) {
        mostExpensive = { name: cardName(card), price };
      }
    }

    return {
      totalValue,
      ownedValue,
      orderedValue,
      neededValue,
      currentFoilValue,
      costToFoilRemaining,
      fullFoilValue,
      pricedCount,
      valueByStatus,
      countByStatus,
      valueByFinish,
      mostExpensive,
      avgPrice: pricedCount > 0 ? totalValue / pricedCount : 0,
      ownedCount: cards.filter((c) => OWNED_STATUSES.includes(normalizedStatus(c))).length,
    };
  }, [cards]);

  // ── Chart data ──────────────────────────────────────────────────────────────

  const statusCountData = useMemo(() => {
    const labels = CARD_STATUSES.filter((s) => (stats.countByStatus[s] || 0) > 0);
    return {
      labels,
      datasets: [
        {
          data: labels.map((s) => stats.countByStatus[s]),
          backgroundColor: labels.map((s) => STATUS_COLORS[s] || '#555'),
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.3)',
        },
      ],
    };
  }, [stats.countByStatus]);

  const statusValueData = useMemo(() => {
    const labels = CARD_STATUSES.filter((s) => (stats.valueByStatus[s] || 0) > 0);
    return {
      labels,
      datasets: [
        {
          data: labels.map((s) => Number(stats.valueByStatus[s].toFixed(2))),
          backgroundColor: labels.map((s) => STATUS_COLORS[s] || '#555'),
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.3)',
        },
      ],
    };
  }, [stats.valueByStatus]);

  const finishValueData = useMemo(() => {
    const labels = FINISHES.filter((f) => (stats.valueByFinish[f] || 0) > 0);
    return {
      labels,
      datasets: [
        {
          data: labels.map((f) => Number(stats.valueByFinish[f].toFixed(2))),
          backgroundColor: labels.map((f) => FINISH_COLORS[f] || '#555'),
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.3)',
        },
      ],
    };
  }, [stats.valueByFinish]);

  const foilBarData = useMemo(
    () => ({
      labels: ['Current value', 'Cost to foil rest', 'Full-foil value'],
      datasets: [
        {
          data: [
            Number(stats.totalValue.toFixed(2)),
            Number(stats.costToFoilRemaining.toFixed(2)),
            Number(stats.fullFoilValue.toFixed(2)),
          ],
          backgroundColor: ['#6AB572', '#E8883A', '#67A6D3'],
          borderRadius: 2,
        },
      ],
    }),
    [stats.totalValue, stats.costToFoilRemaining, stats.fullFoilValue],
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Flexbox direction="col" gap="3" className="p-2">
      {/* ─── Headline numbers ─────────────────────────────────────────────── */}
      <Row className="g-3">
        <Col xs={12} sm={6} lg={3}>
          <BigStat
            label="Total Cube Value"
            value={usd(stats.totalValue)}
            sub={`${stats.pricedCount} / ${total} cards priced`}
            accent="#6AB572"
            tooltip="Sum of every card's price at the finish it's assigned in your cube."
          />
        </Col>
        <Col xs={12} sm={6} lg={3}>
          <BigStat
            label="Owned Value"
            value={usd(stats.ownedValue)}
            sub={`${stats.ownedCount} / ${total} cards owned`}
            tooltip="Value of cards marked Owned or Premium Owned — what you already hold."
          />
        </Col>
        <Col xs={12} sm={6} lg={3}>
          <BigStat
            label="Cost to Finish Cube"
            value={usd(stats.neededValue)}
            sub="Not Owned, Proxied & Borrowed"
            accent="#E8883A"
            tooltip="What it would cost to buy real copies of every card you don't yet own, in its assigned finish."
          />
        </Col>
        <Col xs={12} sm={6} lg={3}>
          <BigStat
            label="Cost to Finish Foiling"
            value={usd(stats.costToFoilRemaining)}
            sub="Foil copies of non-foil cards"
            accent="#67A6D3"
            tooltip="Cost to buy foil copies of every card currently assigned a non-foil finish."
          />
        </Col>
      </Row>

      {/* ─── Detail tables ────────────────────────────────────────────────── */}
      <Row className="g-3">
        <Col xs={12} lg={4}>
          <CardUI>
            <CardHeader>
              <Text semibold md>
                Value by Ownership
              </Text>
            </CardHeader>
            <div>
              <StatRow label="Total Cube Value" value={usd(stats.totalValue)} swatch="#6AB572" />
              <StatRow label="Owned" value={usd(stats.ownedValue)} swatch={STATUS_COLORS['Owned']} />
              <StatRow label="On Order" value={usd(stats.orderedValue)} swatch={STATUS_COLORS['Ordered']} />
              <StatRow
                label="Still to Acquire"
                value={usd(stats.neededValue)}
                swatch={STATUS_COLORS['Not Owned']}
                tooltip="Not Owned, Proxied and Borrowed cards."
              />
            </div>
          </CardUI>
        </Col>
        <Col xs={12} lg={4}>
          <CardUI>
            <CardHeader>
              <Text semibold md>
                Foiling
              </Text>
            </CardHeader>
            <div>
              <StatRow
                label="Current Foil Value"
                value={usd(stats.currentFoilValue)}
                tooltip="Value of cards already assigned a foil, etched, or alt-foil finish."
              />
              <StatRow
                label="Cost to Foil Rest"
                value={usd(stats.costToFoilRemaining)}
                tooltip="Cost to buy foil copies of the cards still in non-foil."
              />
              <StatRow
                label="Full-Foil Cube Value"
                value={usd(stats.fullFoilValue)}
                tooltip="Total value if every card were foil (non-foil price kept for cards with no foil printing)."
              />
            </div>
          </CardUI>
        </Col>
        <Col xs={12} lg={4}>
          <CardUI>
            <CardHeader>
              <Text semibold md>
                Averages
              </Text>
            </CardHeader>
            <div>
              <StatRow label="Average Card Price" value={usd(stats.avgPrice)} />
              <StatRow
                label="Most Expensive Card"
                value={stats.mostExpensive ? usd(stats.mostExpensive.price) : '—'}
              />
              {stats.mostExpensive && <StatRow label="↳ Card" value={stats.mostExpensive.name} />}
              <StatRow
                label="Cards Priced"
                value={total > 0 ? `${((stats.pricedCount / total) * 100).toFixed(1)}%` : '0%'}
              />
            </div>
          </CardUI>
        </Col>
      </Row>

      {/* ─── Charts ───────────────────────────────────────────────────────── */}
      <Row className="g-3">
        <Col xs={12} sm={6} lg={4}>
          <ChartCard title="Cards by Status" tooltip="How many cards fall in each ownership status.">
            <Doughnut data={statusCountData} options={doughnutCountOptions} />
          </ChartCard>
        </Col>
        <Col xs={12} sm={6} lg={4}>
          <ChartCard title="Value by Status" tooltip="Cube value split across ownership statuses.">
            <Doughnut data={statusValueData} options={doughnutValueOptions} />
          </ChartCard>
        </Col>
        <Col xs={12} sm={6} lg={4}>
          <ChartCard title="Value by Finish" tooltip="Cube value split across card finishes.">
            <Doughnut data={finishValueData} options={doughnutValueOptions} />
          </ChartCard>
        </Col>
      </Row>

      <Row className="g-3">
        <Col xs={12}>
          <ChartCard title="Foiling Cost" tooltip="Current cube value, extra cost to foil the rest, and the resulting full-foil value.">
            <div style={{ maxHeight: 320 }}>
              <Bar data={foilBarData} options={valueBarOptions} />
            </div>
          </ChartCard>
        </Col>
      </Row>
    </Flexbox>
  );
};

export default Prices;
