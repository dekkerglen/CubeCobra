import React from 'react';

import { render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import HistoryType from '@utils/datatypes/History';

import CardBreakdownStats from 'components/cardPage/Stats';
import { getPlaceholderCardDetails } from 'utils/placeholderCardDetails';

jest.mock('components/modals/AddToCubeModal', () => ({
  __esModule: true,
  default: () => <div />,
}));

const DAY_MS = 24 * 60 * 60 * 1000;
const ANCHOR = new Date('2026-10-25T00:00:00Z').valueOf();

const card = getPlaceholderCardDetails('scryfall-id');

const weeklyEntry = (weeksAgo: number, cubesWithCard: number, elo: number): HistoryType =>
  ({
    OTComp: 'oracle-123:week',
    oracle: 'oracle-123',
    date: ANCHOR - weeksAgo * 7 * DAY_MS,
    picks: 0,
    cubes: cubesWithCard,
    total: [cubesWithCard, 1000],
    cubeCount: [cubesWithCard, 1000],
    elo,
    ...Object.fromEntries(
      ['vintage', 'legacy', 'modern', 'pioneer', 'peasant', 'pauper'].map((key) => [key, [cubesWithCard, 1000]]),
    ),
    ...Object.fromEntries(
      ['size180', 'size360', 'size450', 'size540', 'size720'].map((key) => [key, [cubesWithCard, 1000]]),
    ),
  }) as HistoryType;

const weeksAgo = (from: number, to: number): number[] =>
  Array.from({ length: to - from + 1 }, (_, index) => from + index);

/**
 * Half a year of weekly snapshots, oldest first, as the card route delivers them.
 * `recentCubes` covers the last four weeks so the four- and twelve-week windows can be
 * given different stories.
 */
const buildHistory = ({
  recentCubes,
  recentElo,
}: {
  recentCubes: number | number[];
  recentElo: number;
}): HistoryType[] => {
  const perWeek = Array.isArray(recentCubes) ? recentCubes : [recentCubes, recentCubes, recentCubes, recentCubes];

  return [
    ...weeksAgo(12, 23).map((week) => weeklyEntry(week, 50, 1200)),
    ...weeksAgo(8, 11).map((week) => weeklyEntry(week, 55, 1200)),
    ...weeksAgo(4, 7).map((week) => weeklyEntry(week, 50, 1200)),
    ...[3, 2, 1, 0].map((week, index) => weeklyEntry(week, perWeek[index], recentElo)),
  ];
};

const badgeFor = (label: string) => screen.getByText(label).parentElement as HTMLElement;

describe('card page stats momentum', () => {
  it('reports a rising play rate over both windows', () => {
    // last 4w average 6.0% against 5.0% before it; last 12w average 5.5% against 5.0%.
    render(<CardBreakdownStats card={card} history={buildHistory({ recentCubes: 60, recentElo: 1200 })} />);

    expect(badgeFor('Play Rate 4w')).toHaveTextContent('+20.0%');
    expect(badgeFor('Play Rate 4w')).toHaveTextContent('+1.00pp');
    expect(badgeFor('Play Rate 12w')).toHaveTextContent('+10.0%');
    expect(badgeFor('Play Rate 12w')).toHaveTextContent('+0.50pp');
  });

  it('reports a falling play rate with a negative change', () => {
    // last 4w average 4.0% against 5.0% before it.
    render(<CardBreakdownStats card={card} history={buildHistory({ recentCubes: 40, recentElo: 1200 })} />);

    expect(badgeFor('Play Rate 4w')).toHaveTextContent('-20.0%');
    expect(badgeFor('Play Rate 4w')).toHaveTextContent('-1.00pp');
  });

  it('calls a play rate holding within a percent of its baseline steady', () => {
    // last 4w average 5.025% against 5.0% before it -- a real but negligible 0.5% move.
    render(
      <CardBreakdownStats card={card} history={buildHistory({ recentCubes: [50, 50, 50, 51], recentElo: 1200 })} />,
    );

    expect(badgeFor('Play Rate 4w')).toHaveTextContent('Steady');
  });

  it('reports the elo point swing rather than a percentage', () => {
    render(<CardBreakdownStats card={card} history={buildHistory({ recentCubes: 50, recentElo: 1265 })} />);

    expect(badgeFor('Elo 4w')).toHaveTextContent('+65');
    expect(badgeFor('Elo 4w')).not.toHaveTextContent('%');
  });

  it('calls an elo drifting a few points steady', () => {
    render(<CardBreakdownStats card={card} history={buildHistory({ recentCubes: 50, recentElo: 1203 })} />);

    expect(badgeFor('Elo 4w')).toHaveTextContent('Steady');
  });

  it('omits the momentum badges entirely for a card with no recorded history', () => {
    render(<CardBreakdownStats card={card} history={[{} as HistoryType]} />);

    expect(screen.queryByText('Play Rate 4w')).not.toBeInTheDocument();
    expect(screen.queryByText('Play Rate 12w')).not.toBeInTheDocument();
    expect(screen.queryByText('Elo 4w')).not.toBeInTheDocument();
  });
});
