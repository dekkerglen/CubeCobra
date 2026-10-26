import React, { useMemo } from 'react';

import { cardCubeCount, cardElo, cardPopularity, detailsToCard } from '@utils/cardutil';
import { CardDetails } from '@utils/datatypes/Card';
import HistoryType from '@utils/datatypes/History';

import { eloMomentum, eloSeries, Momentum, playRateMomentum, playRateSeries } from 'utils/cardMomentum';

import Sparkline from '../base/Sparkline';
import Tooltip from '../base/Tooltip';

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

const WINDOW_LABELS: Record<string, string> = { '4w': 'the last 4 weeks', '12w': 'the last 12 weeks' };

// A fixed column so both metrics' trend lines end at the same point, and so the chips
// line up with each other rather than sizing to whatever their value happens to be.
const CHIP_COLUMN = 'w-24';

const signed = (value: number, digits: number): string => `${value > 0 ? '+' : ''}${value.toFixed(digits)}`;

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
  description: string;
}

/**
 * Direction is carried by the sign and the colour. The sign is the one that survives
 * red-green colour blindness and a screen reader, so there is no separate arrow.
 *
 * The absolute move hangs off the chip twice over: the house Tooltip for sighted hover,
 * which native `title` does unreliably between adjacent elements, and a visually hidden
 * copy for screen readers, which the tooltip is invisible to.
 */
const TrendChip: React.FC<TrendChipProps> = ({ window, direction, value, description }) => (
  <Tooltip text={description} wrapperTag="span" className="w-full">
    <span className="flex w-full items-center justify-between gap-1 whitespace-nowrap rounded border border-border bg-bg px-1.5 py-0.5 text-xs">
      <span className="text-text-secondary">{window}</span>
      <span className={DIRECTION_COLOR[direction]}>{value}</span>
      <span className="sr-only">{description}</span>
    </span>
  </Tooltip>
);

const EmptyChip: React.FC<{ window: string }> = ({ window }) => {
  const description = `Not enough history to compare ${WINDOW_LABELS[window] ?? window}`;

  return (
    <Tooltip text={description} wrapperTag="span" className="w-full">
      <span className="flex w-full items-center justify-between gap-1 whitespace-nowrap rounded border border-border bg-bg px-1.5 py-0.5 text-xs text-text-secondary">
        <span>{window}</span>
        <span>N/A</span>
        <span className="sr-only">{description}</span>
      </span>
    </Tooltip>
  );
};

const playRateChip = (window: string, momentum: Momentum | null) => {
  if (!momentum) {
    return <EmptyChip window={window} />;
  }

  const { change, relativeChange } = momentum;
  // "pp" is jargon, so the absolute move is spelled out here rather than shown in the chip.
  const description = `${signed(change, 2)} percentage points over ${WINDOW_LABELS[window] ?? window}`;

  // A zero baseline means the card was in no cubes at all beforehand, so there is no
  // relative swing to quote -- it simply arrived.
  if (relativeChange === null) {
    return (
      <TrendChip
        window={window}
        direction={directionOf(change, STEADY_PERCENTAGE_POINTS)}
        description={description}
        value="New"
      />
    );
  }

  return (
    <TrendChip
      window={window}
      direction={directionOf(relativeChange, STEADY_RELATIVE_CHANGE)}
      description={description}
      value={signedPercent(relativeChange)}
    />
  );
};

/** Elo is an interval scale, so the swing is reported in points and never as a percentage. */
const eloChip = (window: string, momentum: Momentum | null) => {
  if (!momentum) {
    return <EmptyChip window={window} />;
  }

  return (
    <TrendChip
      window={window}
      direction={directionOf(momentum.change, STEADY_ELO_POINTS)}
      description={`${signed(momentum.change, 0)} points over ${WINDOW_LABELS[window] ?? window}`}
      value={signed(momentum.change, 0)}
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

// The line fades in from the left so it never competes with the figures stacked over it.
// The oldest history goes, which is the part the text covered anyway; the full chart is a
// tab away. Repeated for -webkit- so Safari honours it.
const TREND_FADE = 'linear-gradient(to right, transparent 10%, black 55%)';
const TREND_MASK = { maskImage: TREND_FADE, WebkitMaskImage: TREND_FADE };

/**
 * One metric as a single band: its name, value and detail stacked at the left with the
 * trend line running behind them, and the trend chips held off to the right. The line
 * stops short of the chips rather than running under shapes that would hide it.
 */
const MetricSection: React.FC<MetricSectionProps> = ({ name, value, detail, series, trendDirection, children }) => (
  <section aria-label={name} className="flex items-end justify-between gap-2">
    <div className="relative min-w-0 flex-1">
      {series.length > 1 && (
        <Sparkline
          values={series}
          title={`${name} over time`}
          className={`absolute inset-0 h-full w-full opacity-80 ${DIRECTION_COLOR[trendDirection]}`}
          style={TREND_MASK}
        />
      )}
      <div className="relative leading-tight">
        <div className="text-xs uppercase tracking-wide text-text-secondary">{name}</div>
        <div className="text-lg font-bold text-text">{value}</div>
        {/* Always rendered, so a metric without a detail still occupies the same height as
            one that has it. Hidden rather than empty, so it is skipped when read.
            text-text/75 rather than text-text-secondary, which is 128/128/128 in every
            theme and only reaches 2.06:1 on this panel. */}
        <div className={`text-xs text-text/75 ${detail ? '' : 'invisible'}`} aria-hidden={!detail}>
          {detail ?? '\u00a0'}
        </div>
      </div>
    </div>
    {series.length > 1 && <div className={`flex shrink-0 flex-col items-end gap-1 ${CHIP_COLUMN}`}>{children}</div>}
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
  const longElo = useMemo(() => eloMomentum(history, LONG_WINDOW_DAYS), [history]);
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
        {eloChip('12w', longElo)}
      </MetricSection>
    </div>
  );
};

export default CardMetrics;
