import React from 'react';

import { render, screen, within } from '@testing-library/react';

import '@testing-library/jest-dom';

import Card from '@utils/datatypes/Card';

import CardGrid from 'components/card/CardGrid';

jest.mock('components/FoilCardImage', () => ({
  __esModule: true,
  default: ({ card }: { card: Card }) => <img alt={card.cardID} />,
}));

const cards = [{ cardID: 'card-a' }, { cardID: 'card-b' }] as Card[];

const wrapperOf = (cardID: string) => screen.getByAltText(cardID).parentElement as HTMLElement;

describe('CardGrid', () => {
  it('renders a badge with its title for the indexed card', () => {
    render(
      <CardGrid cards={cards} badges={[undefined, { label: '+', title: 'Added', className: 'bg-green-600/90' }]} />,
    );

    const badge = within(wrapperOf('card-b')).getByLabelText('Added');
    expect(badge).toHaveAttribute('title', 'Added');
    expect(badge).toHaveClass('bg-green-600/90', 'top-[14%]', 'right-[8%]');
    expect(badge).toHaveTextContent('+');
    expect(screen.getAllByLabelText('Added')).toHaveLength(1);
    expect(within(wrapperOf('card-a')).queryByLabelText('Added')).not.toBeInTheDocument();
  });

  it('renders unchanged without the new props', () => {
    const { container } = render(<CardGrid cards={cards} />);

    expect(container.querySelector('[aria-label]')).toBeNull();
  });

  it('keeps the existing ratings rings', () => {
    render(<CardGrid cards={cards} ratings={[0.2, 0.8]} selectedIndex={0} />);

    expect(wrapperOf('card-b')).toHaveClass('ring-[#007BFF]');
    expect(wrapperOf('card-a')).toHaveClass('ring-[#E6B800]');
    expect(wrapperOf('card-a')).not.toHaveClass('ring-[#007BFF]');
  });
});
