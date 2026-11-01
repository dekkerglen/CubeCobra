import React from 'react';

import { render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import Card from '@utils/datatypes/Card';

import DeckBuilderStatsPanel from 'components/DeckBuilderStatsPanel';
import DisplayContext from 'contexts/DisplayContext';

import { defaultDisplayContext } from '../../../server/test/test-utils/context';
import { createBasicLand, createCard } from '../../../server/test/test-utils/data';

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
});
