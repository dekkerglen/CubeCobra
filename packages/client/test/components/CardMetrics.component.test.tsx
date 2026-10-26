import React from 'react';

import { fireEvent, render, screen, within } from '@testing-library/react';

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
    expect(chip('Play Rate', '12w')).toHaveTextContent('+10.0%');
  });

  it('states the direction in the sign, not an icon', () => {
    render(<CardMetrics card={cardWith()} history={buildHistory(40, 1200)} />);

    // Colour alone fails red-green colour blindness and screen readers; the sign does not.
    expect(chip('Play Rate', '4w')).toHaveTextContent('-20.0%');
    expect(chip('Play Rate', '4w').querySelector('svg')).not.toBeInTheDocument();
  });

  it('keeps the absolute move out of the chip but reachable on hover', () => {
    render(<CardMetrics card={cardWith()} history={buildHistory(60, 1200)} />);

    fireEvent.mouseOver(chip('Play Rate', '4w').parentElement as HTMLElement);

    expect(screen.getByText('+1.00 percentage points over the last 4 weeks', { selector: 'div' })).toBeInTheDocument();
    expect(chip('Play Rate', '4w')).not.toHaveTextContent('pp');
  });

  it('describes each window distinctly so adjacent chips are not confused', () => {
    render(<CardMetrics card={cardWith()} history={buildHistory(60, 1200)} />);

    fireEvent.mouseOver(chip('Play Rate', '12w').parentElement as HTMLElement);

    expect(screen.getByText('+0.50 percentage points over the last 12 weeks', { selector: 'div' })).toBeInTheDocument();
  });

  it('gives a screen reader the absolute move, which a visual tooltip cannot', () => {
    render(<CardMetrics card={cardWith()} history={buildHistory(60, 1200)} />);

    const description = chip('Play Rate', '4w').querySelector('.sr-only');

    expect(description).toHaveTextContent('+1.00 percentage points over the last 4 weeks');
  });

  it('explains the elo swing in points for a screen reader', () => {
    render(<CardMetrics card={cardWith()} history={buildHistory(50, 1265)} />);

    expect(chip('Elo', '4w').querySelector('.sr-only')).toHaveTextContent('+65 points over the last 4 weeks');
  });

  it('says why a window it cannot compute is blank', () => {
    const history = span(0, 3).map((week) => weeklyEntry(week, 50, 1200));

    render(<CardMetrics card={cardWith()} history={history} />);

    expect(chip('Play Rate', '12w').querySelector('.sr-only')).toHaveTextContent(
      'Not enough history to compare the last 12 weeks',
    );
  });

  it('reports the elo trend over both windows, like the play rate', () => {
    render(<CardMetrics card={cardWith()} history={buildHistory(50, 1265)} />);

    // elo sits at 1265 for the last 4 weeks and 1200 before that.
    expect(chip('Elo', '4w')).toHaveTextContent('+65');
    // over 12 weeks that averages (1265*4 + 1200*8) / 12 = 1221.67 against 1200.
    expect(chip('Elo', '12w')).toHaveTextContent('+22');
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

  it('keeps showing the number when a move is too small to matter', () => {
    // play rate flat at 5.0%; elo drifts 1200 -> 1203.
    render(<CardMetrics card={cardWith()} history={buildHistory(50, 1203)} />);

    expect(chip('Elo', '4w')).toHaveTextContent('+3');
    expect(chip('Elo', '4w')).not.toHaveTextContent('Steady');
    expect(chip('Play Rate', '4w')).not.toHaveTextContent('Steady');
  });

  it('colours a negligible move neither up nor down', () => {
    render(<CardMetrics card={cardWith()} history={buildHistory(50, 1203)} />);

    const value = chip('Elo', '4w').querySelector('span:last-child') as HTMLElement;

    expect(value.className).not.toContain('text-green');
    expect(value.className).not.toContain('text-red');
  });

  it('does not sign a change of exactly zero', () => {
    render(<CardMetrics card={cardWith()} history={buildHistory(50, 1200)} />);

    expect(chip('Play Rate', '4w')).toHaveTextContent('0.0%');
    expect(chip('Play Rate', '4w')).not.toHaveTextContent('+0.0%');
  });

  it('calls a card that was in no cubes beforehand new, rather than quoting jargon at it', () => {
    const history = [
      ...span(4, 11).map((week) => weeklyEntry(week, 0, 1200)),
      ...span(0, 3).map((week) => weeklyEntry(week, 30, 1200)),
    ];

    render(<CardMetrics card={cardWith()} history={history} />);

    expect(chip('Play Rate', '4w')).toHaveTextContent('New');
    expect(chip('Play Rate', '4w')).not.toHaveTextContent('pp');
  });

  it('marks a window it cannot compute as N/A, keeping the chip in place', () => {
    // Only four weeks of history: nothing to compare either window against.
    const history = span(0, 3).map((week) => weeklyEntry(week, 50, 1200));

    render(<CardMetrics card={cardWith()} history={history} />);

    expect(chip('Play Rate', '4w')).toHaveTextContent('N/A');
    expect(chip('Play Rate', '12w')).toHaveTextContent('N/A');
    expect(chip('Elo', '12w')).toHaveTextContent('N/A');
  });

  it('reserves the detail line on every metric so the sections match in height', () => {
    const { container } = render(<CardMetrics card={cardWith()} history={buildHistory(60, 1265)} />);

    const stacks = [...container.querySelectorAll('section[aria-label] > div:first-child > div')];

    expect(stacks).toHaveLength(2);
    expect(stacks[0].children).toHaveLength(stacks[1].children.length);
  });

  it('keeps both metrics on the same number of chips so their trend lines match', () => {
    const { container } = render(<CardMetrics card={cardWith()} history={buildHistory(60, 1265)} />);

    const columns = [...container.querySelectorAll('section[aria-label] > div:last-child')];

    expect(columns).toHaveLength(2);
    expect(columns[0].children).toHaveLength(columns[1].children.length);
  });

  it('keeps the trend line clear of the chips that would obscure it', () => {
    const { container } = render(<CardMetrics card={cardWith()} history={buildHistory(60, 1200)} />);

    const sparkline = container.querySelector('svg') as SVGElement;
    const chipRow = chip('Play Rate', '4w').closest('div') as HTMLElement;
    const sparklineArea = sparkline.parentElement as HTMLElement;

    // The line fills its own box; the chips sit outside it rather than on top.
    expect(sparklineArea.contains(chipRow)).toBe(false);
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
