import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import Card, { Changes } from '@utils/datatypes/Card';

import ChangelogCardView from 'components/blog/ChangelogCardView';
import ChangelogViewControls from 'components/blog/ChangelogViewControls';
import { CardGridProps } from 'components/card/CardGrid';

jest.mock('hooks/useCardDetails', () => ({
  useCardDetails: () => ({ details: {} }),
}));

jest.mock('components/card/CardGrid', () => ({
  __esModule: true,
  default: ({ cards, badges, hrefFn }: CardGridProps) => (
    <div data-testid="grid">
      {cards.map((card, i) => (
        <span key={i} data-href={hrefFn?.(card)}>
          {badges?.[i]?.title}
        </span>
      ))}
    </div>
  ),
}));

jest.mock('components/blog/SwapStackTile', () => ({
  __esModule: true,
  default: ({ oldCard, card }: { oldCard: Card; card: Card }) => (
    <div data-testid="swap">{`${oldCard.cardID}>${card.cardID}`}</div>
  ),
}));

const card = (cardID: string): Card => ({ cardID }) as Card;

const swap = (oldID: string, newID: string) => ({ index: 0, oldCard: card(oldID), card: card(newID) });

describe('ChangelogCardView', () => {
  it('renders only non-empty rows under each board heading', () => {
    const changelog = {
      mainboard: { adds: [card('A')] },
      maybeboard: { edits: [{ index: 0, oldCard: card('Eo'), newCard: card('En') }] },
    } as unknown as Changes;

    render(<ChangelogCardView changelog={changelog} cardsPerRow={6} />);

    expect(screen.getByText('Mainboard')).toBeInTheDocument();
    expect(screen.getByText('Added (1)')).toBeInTheDocument();
    expect(screen.getByText('Maybeboard')).toBeInTheDocument();
    expect(screen.getByText('Edited (1)')).toBeInTheDocument();
    expect(screen.queryByText(/Removed \(/)).toBeNull();
  });

  it('renders swaps in their own row as pairs', () => {
    const changelog = { mainboard: { adds: [card('A')], swaps: [swap('old', 'new')] } } as unknown as Changes;

    render(<ChangelogCardView changelog={changelog} cardsPerRow={6} />);

    expect(screen.getByText('Added (1)')).toBeInTheDocument();
    expect(screen.getByText('Swapped (1)')).toBeInTheDocument();
    expect(screen.getByTestId('swap')).toHaveTextContent('old>new');
    expect(screen.queryByText(/Removed \(/)).toBeNull();
  });

  it('renders a swaps-only board without Added or Removed rows', () => {
    const changelog = { mainboard: { swaps: [swap('old', 'new')] } } as unknown as Changes;

    render(<ChangelogCardView changelog={changelog} cardsPerRow={6} />);

    expect(screen.getByText('Swapped (1)')).toBeInTheDocument();
    expect(screen.queryByText(/Added \(/)).toBeNull();
    expect(screen.queryByText(/Removed \(/)).toBeNull();
  });

  it('links grid cards to their card pages', () => {
    const changelog = { mainboard: { adds: [card('A')] } } as unknown as Changes;

    render(<ChangelogCardView changelog={changelog} cardsPerRow={6} />);

    expect(screen.getByText('Added')).toHaveAttribute('data-href', '/tool/card/A');
  });
});

describe('ChangelogViewControls', () => {
  it('ChangelogViewControls shows cards-per-row only in cards view', () => {
    const setView = jest.fn();
    const { rerender } = render(
      <ChangelogViewControls view="cards" setView={setView} cardsPerRow={6} setCardsPerRow={jest.fn()} />,
    );
    expect(screen.getByRole('combobox')).toHaveDisplayValue('6 Cards Per Row');
    expect(screen.getByRole('button', { name: 'Cards' })).toHaveAttribute('aria-pressed', 'true');

    rerender(<ChangelogViewControls view="text" setView={setView} cardsPerRow={6} setCardsPerRow={jest.fn()} />);
    expect(screen.queryByRole('combobox')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Text' }));
    expect(setView).toHaveBeenCalledWith('text');
  });
});
