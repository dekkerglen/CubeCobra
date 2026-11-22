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
  default: ({ cards, badges, ringedIndices, onCardHover }: CardGridProps) => (
    <div data-testid="grid" data-ringed={JSON.stringify(ringedIndices ?? [])}>
      {cards.map((_card, i) => (
        <span key={i} onMouseEnter={() => onCardHover?.(i)} onMouseLeave={() => onCardHover?.(null)}>
          {badges?.[i]?.title}
        </span>
      ))}
    </div>
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

  it('hovering a swap-in rings its swap-out', () => {
    const changelog = { mainboard: { swaps: [swap('Old', 'New')] } } as unknown as Changes;

    render(<ChangelogCardView changelog={changelog} cardsPerRow={6} />);

    const [addedGrid, removedGrid] = screen.getAllByTestId('grid');
    const swapIn = addedGrid.querySelector('span')!;
    expect(swapIn).toHaveTextContent('Swapped');

    fireEvent.mouseEnter(swapIn);
    expect(removedGrid).toHaveAttribute('data-ringed', '[0]');

    fireEvent.mouseLeave(swapIn);
    expect(removedGrid).toHaveAttribute('data-ringed', '[]');
  });

  it('does not ring across boards', () => {
    const changelog = {
      mainboard: { swaps: [swap('Mo', 'Mn')] },
      maybeboard: { swaps: [swap('Bo', 'Bn')] },
    } as unknown as Changes;

    render(<ChangelogCardView changelog={changelog} cardsPerRow={6} />);

    const [mainAdded, mainRemoved, maybeAdded, maybeRemoved] = screen.getAllByTestId('grid');
    fireEvent.mouseEnter(mainAdded.querySelector('span')!);

    expect(mainRemoved).toHaveAttribute('data-ringed', '[0]');
    expect(maybeAdded).toHaveAttribute('data-ringed', '[]');
    expect(maybeRemoved).toHaveAttribute('data-ringed', '[]');
  });
});

describe('ChangelogViewControls', () => {
  it('ChangelogViewControls shows cards-per-row only in cards view', () => {
    const setView = jest.fn();
    const { rerender } = render(
      <ChangelogViewControls view="cards" setView={setView} cardsPerRow={6} setCardsPerRow={jest.fn()} />,
    );
    expect(screen.getByDisplayValue('6 Cards Per Row')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cards' })).toHaveAttribute('aria-pressed', 'true');

    rerender(<ChangelogViewControls view="text" setView={setView} cardsPerRow={6} setCardsPerRow={jest.fn()} />);
    expect(screen.queryByDisplayValue('6 Cards Per Row')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Text' }));
    expect(setView).toHaveBeenCalledWith('text');
  });
});
