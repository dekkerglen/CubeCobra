import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import Card from '@utils/datatypes/Card';

import DeckBuilderStatsPanel from 'components/DeckBuilderStatsPanel';
import DisplayContext from 'contexts/DisplayContext';

import { defaultDisplayContext } from '../../../server/test/test-utils/context';
import { createBasicLand, createCard, createCardDetails } from '../../../server/test/test-utils/data';

jest.mock('react-chartjs-2', () => ({
  Bar: ({ options }: any) => <div data-testid="bar" data-max={String(options?.scales?.y?.max)} />,
}));
jest.mock('components/draftSimulator/SimulatorCharts', () => {
  throw new Error('the deck stats panel must not pull in the draft simulator module');
});

const renderPanel = (cards: Card[] = []) =>
  render(
    <DisplayContext.Provider value={{ ...defaultDisplayContext, showDeckBuilderStatsPanel: true }}>
      <DeckBuilderStatsPanel cards={cards} />
    </DisplayContext.Provider>,
  );

describe('DeckBuilderStatsPanel', () => {
  it('renders an empty deck without NaN', () => {
    const { container } = renderPanel();

    expect(screen.getByText('Mana Breakdown')).toBeInTheDocument();
    expect(container.textContent).not.toContain('NaN');
  });

  it('uses theme colors rather than light-only ones', () => {
    const { container } = renderPanel();

    expect(container.querySelector('.bg-white, .bg-gray-100, .text-gray-500, .border-gray-300')).toBeNull();
  });

  it('renders all six tiles even for colors the deck does not play', () => {
    renderPanel([createCard({ colors: ['R'], cmc: 1 })]);

    expect(screen.getAllByTestId('bar')).toHaveLength(6);
  });

  it('gives every curve chart the same y-axis maximum', () => {
    renderPanel([
      createCard({ colors: ['R'], cmc: 1 }),
      createCard({ colors: ['R'], cmc: 1 }),
      createCard({ colors: ['G'], cmc: 1 }),
    ]);

    const maxes = screen.getAllByTestId('bar').map((bar) => bar.getAttribute('data-max'));

    expect(new Set(maxes)).toEqual(new Set(['2']));
  });

  it('excludes lands from the headline percentage', () => {
    const { container } = renderPanel([createCard({ colors: ['R'], cmc: 1 }), createBasicLand('Mountain')]);

    const headlines = Array.from(container.querySelectorAll('[data-testid="color-percentage"]')).map(
      (tile) => tile.textContent,
    );

    expect(headlines).toEqual(['0%', '0%', '0%', '100%', '0%', '0%']);
  });

  it('labels the headline percentage with the population it came from', () => {
    const { container } = renderPanel([createCard({ colors: ['R'], cmc: 1 }), createBasicLand('Mountain')]);

    const populations = Array.from(container.querySelectorAll('[data-testid="color-population"]')).map(
      (tile) => tile.textContent,
    );

    expect(populations).toEqual([
      '0 of 1 spells',
      '0 of 1 spells',
      '0 of 1 spells',
      '1 of 1 spells',
      '0 of 1 spells',
      '0 of 1 spells',
    ]);
  });

  it('describes a color as included in spells rather than as a share of the deck', () => {
    const { container } = renderPanel([
      createCard({ colors: ['R'], cmc: 1, details: createCardDetails({ parsed_cost: ['r'] }) }),
    ]);

    const headline = container.querySelectorAll('[data-testid="color-percentage"]')[3]!.parentElement!;
    fireEvent.mouseEnter(headline);

    expect(screen.getByText('1 of 1 spells include red')).toBeInTheDocument();

    fireEvent.mouseLeave(headline);

    const symbolLine = screen.getByText('100% of mana symbols').parentElement!;
    fireEvent.mouseEnter(symbolLine);

    expect(screen.getByText('1 of 1 mana symbols are red')).toBeInTheDocument();
  });

  it('centers the land percentage over the whole track rather than inside the fill', () => {
    const { container } = renderPanel([
      createBasicLand('Mountain'),
      createBasicLand('Forest'),
      createBasicLand('Forest'),
      createBasicLand('Forest'),
    ]);

    const quarter = Array.from(container.querySelectorAll('[data-testid="source-label"]')).filter(
      (label) => label.textContent === '25%',
    ) as HTMLElement[];

    expect(quarter).toHaveLength(2);

    const onFill = quarter.filter((label) => label.style.clipPath === 'inset(0 75% 0 0)');
    const offFill = quarter.filter((label) => label.style.clipPath === 'inset(0 0 0 25%)');

    expect(onFill).toHaveLength(1);
    expect(offFill).toHaveLength(1);
    expect(onFill[0]).not.toBe(offFill[0]);
    expect(quarter.every((label) => label.style.width === '')).toBe(true);
  });
});
