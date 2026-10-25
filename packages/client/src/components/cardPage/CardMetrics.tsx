import React, { useMemo } from 'react';

import { DashIcon, TriangleDownIcon, TriangleUpIcon } from '@primer/octicons-react';
import { cardCubeCount, cardElo, cardPopularity, detailsToCard } from '@utils/cardutil';
import { CardDetails } from '@utils/datatypes/Card';
import HistoryType from '@utils/datatypes/History';

import { eloMomentum, eloSeries, Momentum, playRateMomentum, playRateSeries } from 'utils/cardMomentum';

import Sparkline from '../base/Sparkline';

const SHORT_WINDOW_DAYS = 28;
const LONG_WINDOW_DAYS = 84;

// Below these, week-to-week wobble is indistinguishable from a real move.
const STEADY_RELATIVE_CHANGE = 0.01;
const STEADY_PERCENTAGE_POINTS = 0.01;
const STEADY_ELO_POINTS = 5;

type Direction = 'up' | 'down' | 'steady';

const DIRECTION_COLOR: Record<Direction, string> = {
  up: 'text-green-500',
  down: 'text-red-500',
  steady: 'text-text-secondary',
};

const DIRECTION_ICON = { up: TriangleUpIcon, down: TriangleDownIcon, steady: DashIcon };

const signed = (value: number, digits: number): string => `${value >= 0 ? '+' : ''}${value.toFixed(digits)}`;

/** Drops the decimal past 100% so a runaway swing cannot widen the chip out of its column. */
const signedPercent = (fraction: number): string => `${signed(fraction * 100, Math.abs(fraction) >= 1 ? 0 : 1)}%`;

const directionOf = (value: number, threshold: number): Direction => {
  if (Math.abs(value) < threshold) {
    return 'steady';
  }

  return value > 0 ? 'up' : 'down';
};

interface TrendChipProps {
  window: string;
  direction: Direction;
  value: string;
  detail?: string;
}

const TrendChip: React.FC<TrendChipProps> = ({ window, direction, value, detail }) => {
  const Icon = DIRECTION_ICON[direction];

  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded border border-border bg-bg px-1.5 py-0.5 text-xs">
      <span className="text-text-secondary">{window}</span>
      <span className={DIRECTION_COLOR[direction]}>
        <Icon size={12} />
      </span>
      <span className={DIRECTION_COLOR[direction]}>{value}</span>
      {detail && <span className="text-text-secondary">{detail}</span>}
    </span>
  );
};

const EmptyChip: React.FC<{ window: string }> = ({ window }) => (
  <span className="inline-flex items-center gap-1 whitespace-nowrap rounded border border-border bg-bg px-1.5 py-0.5 text-xs text-text-secondary">
    <span>{window}</span>
    <span>No data</span>
  </span>
);

const playRateChip = (window: string, momentum: Momentum | null) => {
  if (!momentum) {
    return <EmptyChip window={window} />;
  }

  const { change, relativeChange } = momentum;

  // Without a baseline there is no relative swing to lead with, so the raw move stands alone.
  if (relativeChange === null) {
    const direction = directionOf(change, STEADY_PERCENTAGE_POINTS);

    return (
      <TrendChip
        window={window}
        direction={direction}
        value={direction === 'steady' ? 'Steady' : `${signed(change, 2)}pp`}
      />
    );
  }

  const direction = directionOf(relativeChange, STEADY_RELATIVE_CHANGE);

  if (direction === 'steady') {
    return <TrendChip window={window} direction={direction} value="Steady" />;
  }

  return (
    <TrendChip
      window={window}
      direction={direction}
      value={signedPercent(relativeChange)}
      detail={`${signed(change, 2)}pp`}
    />
  );
};

/** Elo is an interval scale, so the swing is reported in points and never as a percentage. */
const eloChip = (window: string, momentum: Momentum | null) => {
  if (!momentum) {
    return <EmptyChip window={window} />;
  }

  const direction = directionOf(momentum.change, STEADY_ELO_POINTS);

  return (
    <TrendChip
      window={window}
      direction={direction}
      value={direction === 'steady' ? 'Steady' : signed(momentum.change, 0)}
    />
  );
};

interface MetricSectionProps {
  name: string;
  value: string;
  detail?: string;
  series: number[];
  trendDirection: Direction;
  children: React.ReactNode;
}

const MetricSection: React.FC<MetricSectionProps> = ({ name, value, detail, series, trendDirection, children }) => (
  <section aria-label={name}>
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-xs uppercase tracking-wide text-text-secondary">{name}</span>
      {/* Stacked and right-aligned so every metric's headline number shares a right edge,
          whether or not it carries a secondary detail. */}
      <span className="flex flex-col items-end leading-tight">
        <span className="text-lg font-bold text-text">{value}</span>
        {detail && <span className="text-xs text-text-secondary">{detail}</span>}
      </span>
    </div>
    {series.length > 1 && (
      <Sparkline
        values={series}
        title={`${name} over time`}
        className={`mt-1.5 h-7 w-full ${DIRECTION_COLOR[trendDirection]}`}
      />
    )}
    {/* Wraps rather than truncates: the xxl breakpoint gives this column barely 244px. */}
    {series.length > 1 && <div className="mt-1.5 flex flex-wrap gap-1.5">{children}</div>}
  </section>
);

interface CardMetricsProps {
  card: CardDetails;
  history: HistoryType[];
}

/**
 * The analytics summary under the card image. Headline numbers come from the card's own
 * details so they survive a card with no recorded history; the trend line and chips are
 * derived from the weekly snapshots and simply drop out when there are none.
 */
const CardMetrics: React.FC<CardMetricsProps> = ({ card, history }) => {
  const details = detailsToCard(card);

  const shortPlayRate = useMemo(() => playRateMomentum(history, SHORT_WINDOW_DAYS), [history]);
  const longPlayRate = useMemo(() => playRateMomentum(history, LONG_WINDOW_DAYS), [history]);
  const shortElo = useMemo(() => eloMomentum(history, SHORT_WINDOW_DAYS), [history]);
  const playRatePoints = useMemo(() => playRateSeries(history), [history]);
  const eloPoints = useMemo(() => eloSeries(history), [history]);

  const playRateDirection = shortPlayRate
    ? directionOf(shortPlayRate.relativeChange ?? shortPlayRate.change, STEADY_RELATIVE_CHANGE)
    : 'steady';
  const eloDirection = shortElo ? directionOf(shortElo.change, STEADY_ELO_POINTS) : 'steady';

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-bg-active p-3">
      <MetricSection
        name="Play Rate"
        value={`${cardPopularity(details).toFixed(2)}%`}
        detail={`${cardCubeCount(details).toLocaleString()} cubes`}
        series={playRatePoints}
        trendDirection={playRateDirection}
      >
        {playRateChip('4w', shortPlayRate)}
        {playRateChip('12w', longPlayRate)}
      </MetricSection>

      <hr className="border-border" />

      <MetricSection name="Elo" value={cardElo(details).toFixed(0)} series={eloPoints} trendDirection={eloDirection}>
        {eloChip('4w', shortElo)}
      </MetricSection>
    </div>
  );
};

export default CardMetrics;
