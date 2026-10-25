import React from 'react';

import { render, screen, within } from '@testing-library/react';

import '@testing-library/jest-dom';

import { CardDetails } from '@utils/datatypes/Card';
import HistoryType from '@utils/datatypes/History';

import CardMetrics from 'components/cardPage/CardMetrics';
import { getPlaceholderCardDetails } from 'utils/placeholderCardDetails';

const DAY_MS = 24 * 60 * 60 * 1000;
const ANCHOR = new Date('2026-10-25T00:00:00Z').valueOf();

const cardWith = (overrides: Partial<CardDetails> = {}): CardDetails => ({
  ...getPlaceholderCardDetails('scryfall-id'),
  name: 'Soltari Foot Soldier',
  popularity: 0.43,
  cubeCount: 1384,
  elo: 1158,
  ...overrides,
});

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
      [
        'vintage',
        'legacy',
        'modern',
        'pioneer',
        'peasant',
        'pauper',
        'size180',
        'size360',
        'size450',
        'size540',
        'size720',
      ].map((key) => [key, [cubesWithCard, 1000]]),
    ),
  }) as HistoryType;

const span = (from: number, to: number): number[] => Array.from({ length: to - from + 1 }, (_, i) => from + i);

/** Half a year of weekly snapshots, with the last four weeks breaking trend. */
const buildHistory = (recentCubes: number, recentElo: number): HistoryType[] => [
  ...span(12, 23).map((week) => weeklyEntry(week, 50, 1200)),
  ...span(8, 11).map((week) => weeklyEntry(week, 55, 1200)),
  ...span(4, 7).map((week) => weeklyEntry(week, 50, 1200)),
  ...span(0, 3).map((week) => weeklyEntry(week, recentCubes, recentElo)),
];

const section = (name: string) => screen.getByRole('region', { name });
const chip = (name: string, window: string) => within(section(name)).getByText(window).parentElement as HTMLElement;

describe('CardMetrics', () => {
  it('leads with the play rate and cube count the card carries today', () => {
    render(<CardMetrics card={cardWith()} history={buildHistory(60, 1200)} />);

    expect(within(section('Play Rate')).getByText('0.43%')).toBeInTheDocument();
    expect(within(section('Play Rate')).getByText('1,384 cubes')).toBeInTheDocument();
  });

  it('leads with the current elo', () => {
    render(<CardMetrics card={cardWith()} history={buildHistory(60, 1200)} />);

    expect(within(section('Elo')).getByText('1158')).toBeInTheDocument();
  });

  it('reports the play rate trend over both windows', () => {
    // last 4w average 6.0% against 5.0%; last 12w average 5.5% against 5.0%.
    render(<CardMetrics card={cardWith()} history={buildHistory(60, 1200)} />);

    expect(chip('Play Rate', '4w')).toHaveTextContent('+20.0%');
    expect(chip('Play Rate', '4w')).toHaveTextContent('+1.00pp');
    expect(chip('Play Rate', '12w')).toHaveTextContent('+10.0%');
    expect(chip('Play Rate', '12w')).toHaveTextContent('+0.50pp');
  });

  it('reports the elo trend in points rather than a percentage', () => {
    render(<CardMetrics card={cardWith()} history={buildHistory(50, 1265)} />);

    expect(chip('Elo', '4w')).toHaveTextContent('+65');
    expect(chip('Elo', '4w')).not.toHaveTextContent('%');
  });

  it('drops the decimal once a relative move reaches 100%, to keep the chip short', () => {
    // last 4w average 25.0% against 5.0% -- a 400% swing.
    render(<CardMetrics card={cardWith()} history={buildHistory(250, 1200)} />);

    expect(chip('Play Rate', '4w')).toHaveTextContent('+400%');
    expect(chip('Play Rate', '4w')).not.toHaveTextContent('+400.0%');
  });

  it('calls a negligible move steady rather than drawing an arrow', () => {
    render(<CardMetrics card={cardWith()} history={buildHistory(50, 1203)} />);

    expect(chip('Play Rate', '4w')).toHaveTextContent('Steady');
    expect(chip('Elo', '4w')).toHaveTextContent('Steady');
  });

  it('marks a window it cannot compute as having no data, keeping the chip in place', () => {
    // Only four weeks of history: nothing to compare either window against.
    const history = span(0, 3).map((week) => weeklyEntry(week, 50, 1200));

    render(<CardMetrics card={cardWith()} history={history} />);

    expect(chip('Play Rate', '4w')).toHaveTextContent('No data');
    expect(chip('Play Rate', '12w')).toHaveTextContent('No data');
  });

  it('still draws the trend line for a card whose windows cannot be computed', () => {
    const history = span(0, 3).map((week) => weeklyEntry(week, 50, 1200));

    const { container } = render(<CardMetrics card={cardWith()} history={history} />);

    expect(container.querySelectorAll('polyline').length).toBe(2);
  });

  it('drops the trend area but keeps the headline numbers for a card with no history', () => {
    const { container } = render(<CardMetrics card={cardWith()} history={[{} as HistoryType]} />);

    expect(within(section('Play Rate')).getByText('0.43%')).toBeInTheDocument();
    expect(within(section('Elo')).getByText('1158')).toBeInTheDocument();
    expect(container.querySelector('polyline')).not.toBeInTheDocument();
    expect(screen.queryByText('4w')).not.toBeInTheDocument();
    expect(screen.queryByText('12w')).not.toBeInTheDocument();
  });
});
