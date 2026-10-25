import React from 'react';

import { DashIcon, TriangleDownIcon, TriangleUpIcon } from '@primer/octicons-react';

import { Momentum } from 'utils/cardMomentum';

import { Flexbox } from '../base/Layout';
import Text from '../base/Text';
import TextBadge from '../TextBadge';

// Below these, week-to-week wobble is indistinguishable from a real move.
const STEADY_RELATIVE_CHANGE = 0.01;
const STEADY_PERCENTAGE_POINTS = 0.01;
const STEADY_ELO_POINTS = 5;

type Direction = 'up' | 'down' | 'steady';

const signed = (value: number, digits: number): string => `${value >= 0 ? '+' : ''}${value.toFixed(digits)}`;

const directionOf = (value: number, threshold: number): Direction => {
  if (Math.abs(value) < threshold) {
    return 'steady';
  }

  return value > 0 ? 'up' : 'down';
};

interface MomentumBadgeProps {
  name: string;
  direction: Direction;
  value: string;
  detail?: string;
}

const MomentumBadge: React.FC<MomentumBadgeProps> = ({ name, direction, value, detail }) => {
  const color = { up: 'text-green-500', down: 'text-red-500', steady: 'text-text-secondary' }[direction];
  const Icon = { up: TriangleUpIcon, down: TriangleDownIcon, steady: DashIcon }[direction];

  return (
    <TextBadge name={name}>
      <Flexbox direction="row" alignItems="center" gap="1">
        <span className={color}>
          <Icon size={16} />
        </span>
        <Text className={color}>{value}</Text>
        {detail && (
          <Text sm className="text-text-secondary">
            {detail}
          </Text>
        )}
      </Flexbox>
    </TextBadge>
  );
};

interface MetricMomentumBadgeProps {
  name: string;
  momentum: Momentum | null;
}

/**
 * Leads with the relative swing, since a tenth of a percentage point means something very
 * different to a fringe card than to a staple, and keeps the raw points alongside it.
 */
export const PlayRateMomentumBadge: React.FC<MetricMomentumBadgeProps> = ({ name, momentum }) => {
  if (!momentum) {
    return null;
  }

  const { change, relativeChange } = momentum;

  // Without a baseline there is no relative swing to lead with, so the raw move stands alone.
  if (relativeChange === null) {
    const direction = directionOf(change, STEADY_PERCENTAGE_POINTS);

    return (
      <MomentumBadge
        name={name}
        direction={direction}
        value={direction === 'steady' ? 'Steady' : `${signed(change, 2)}pp`}
      />
    );
  }

  const direction = directionOf(relativeChange, STEADY_RELATIVE_CHANGE);

  if (direction === 'steady') {
    return <MomentumBadge name={name} direction={direction} value="Steady" />;
  }

  return (
    <MomentumBadge
      name={name}
      direction={direction}
      value={`${signed(relativeChange * 100, 1)}%`}
      detail={`${signed(change, 2)}pp`}
    />
  );
};

/** Elo is an interval scale, so the swing is reported in points and never as a percentage. */
export const EloMomentumBadge: React.FC<MetricMomentumBadgeProps> = ({ name, momentum }) => {
  if (!momentum) {
    return null;
  }

  const direction = directionOf(momentum.change, STEADY_ELO_POINTS);

  return (
    <MomentumBadge
      name={name}
      direction={direction}
      value={direction === 'steady' ? 'Steady' : signed(momentum.change, 0)}
    />
  );
};
